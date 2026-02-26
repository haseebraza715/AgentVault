from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv
import os
import shutil
import tempfile
import uuid
import zipfile
import threading
import time
import json
from datetime import datetime
import logging

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from .vault_processor import (
    collect_markdown_files,
    process_vault,
    write_index_files,
    write_preview_file,
)
from . import job_store

app = FastAPI()
logging.basicConfig(level=logging.INFO)

allowed_origins = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))
MAX_FILES = int(os.getenv("MAX_FILES", "500"))
DAILY_JOB_LIMIT = int(os.getenv("DAILY_JOB_LIMIT", "20"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
JOB_TTL_MINUTES = int(os.getenv("JOB_TTL_MINUTES", "60"))

# Backward-compat alias so existing tests can still import vault_store
vault_store: dict[str, dict[str, object]] = {}
rate_limit_window: dict[str, list[float]] = {}
daily_job_counts: dict[str, dict[str, int]] = {}
analytics_counts = {"uploads": 0, "downloads": 0, "feedback": 0}
_JOB_STORE_DEGRADED = False

BLOCKED_EXTENSIONS = {
    ".exe",
    ".dll",
    ".bat",
    ".cmd",
    ".sh",
    ".ps1",
    ".dmg",
    ".app",
}


class FeedbackIn(BaseModel):
    message: str
    email: str | None = None


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)
    logging.info(
        "%s %s %s %sms", request.method, request.url.path, response.status_code, duration_ms
    )
    return response


def rate_limit_check(client_id: str) -> None:
    now = time.time()
    window = rate_limit_window.setdefault(client_id, [])
    window[:] = [ts for ts in window if now - ts < 60]
    if len(window) >= RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")
    window.append(now)


def daily_limit_check(client_id: str) -> None:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    record = daily_job_counts.setdefault(client_id, {"date": today, "count": 0})
    if record["date"] != today:
        record["date"] = today
        record["count"] = 0
    if record["count"] >= DAILY_JOB_LIMIT:
        raise HTTPException(status_code=429, detail="Daily job limit exceeded.")
    record["count"] += 1


def is_safe_zip_member(member: zipfile.ZipInfo) -> bool:
    name = member.filename
    if name.startswith("/") or name.startswith("\\"):
        return False
    normalized = os.path.normpath(name)
    return not normalized.startswith("..") and ".." not in normalized.split(os.sep)


def has_blocked_extension(member: zipfile.ZipInfo) -> bool:
    _, ext = os.path.splitext(member.filename.lower())
    return ext in BLOCKED_EXTENSIONS


def unzip_safe(zip_path: str, dest_dir: str) -> None:
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        for member in zip_ref.infolist():
            if not is_safe_zip_member(member):
                raise HTTPException(status_code=400, detail="Unsafe zip contents detected.")
            if has_blocked_extension(member):
                raise HTTPException(status_code=400, detail="Executable files are not allowed.")
        zip_ref.extractall(dest_dir)


def zip_dir(source_dir: str, output_zip: str) -> None:
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zip_handle:
        for root, _, files in os.walk(source_dir):
            for file_name in files:
                file_path = os.path.join(root, file_name)
                arcname = os.path.relpath(file_path, source_dir)
                zip_handle.write(file_path, arcname)


def cleanup_job(temp_dir: str) -> None:
    shutil.rmtree(temp_dir, ignore_errors=True)


def mark_access(job: dict[str, object]) -> None:
    job["last_access"] = time.time()


def _degrade_job_store(action: str, exc: Exception) -> None:
    global _JOB_STORE_DEGRADED
    if _JOB_STORE_DEGRADED:
        return
    _JOB_STORE_DEGRADED = True
    logging.warning(
        "Job store %s failed (%s). Falling back to in-memory store for this process.",
        action,
        exc,
    )


def _store_create_job(
    vault_id: str,
    temp_dir: str,
    zip_path: str,
    preview_path: str,
    vault_dir: str,
    original_vault_dir: str,
    total: int,
) -> None:
    if _JOB_STORE_DEGRADED:
        return
    try:
        job_store.create_job(
            vault_id=vault_id,
            temp_dir=temp_dir,
            zip_path=zip_path,
            preview_path=preview_path,
            vault_dir=vault_dir,
            original_vault_dir=original_vault_dir,
            total=total,
        )
    except Exception as exc:  # pragma: no cover
        _degrade_job_store("create", exc)


def _store_get_job(vault_id: str) -> dict[str, object] | None:
    if _JOB_STORE_DEGRADED:
        return None
    try:
        return job_store.get_job(vault_id)
    except Exception as exc:  # pragma: no cover
        _degrade_job_store("read", exc)
        return None


def _store_update_job(vault_id: str, **fields: object) -> None:
    if _JOB_STORE_DEGRADED:
        return
    try:
        job_store.update_job(vault_id, **fields)
    except Exception as exc:  # pragma: no cover
        _degrade_job_store("update", exc)


def _store_delete_job(vault_id: str) -> None:
    if _JOB_STORE_DEGRADED:
        return
    try:
        job_store.delete_job(vault_id)
    except Exception as exc:  # pragma: no cover
        _degrade_job_store("delete", exc)


def _store_mark_access(vault_id: str) -> None:
    if _JOB_STORE_DEGRADED:
        return
    try:
        job_store.mark_access(vault_id)
    except Exception as exc:  # pragma: no cover
        _degrade_job_store("access mark", exc)


def _get_job(vault_id: str) -> dict[str, object] | None:
    """Try SQLite store first, fall back to in-memory dict for tests."""
    job = _store_get_job(vault_id)
    if job is not None:
        return job
    return vault_store.get(vault_id)


def _delete_job(vault_id: str) -> None:
    _store_delete_job(vault_id)
    vault_store.pop(vault_id, None)


def maybe_cleanup_job(vault_id: str, background_tasks: BackgroundTasks) -> None:
    job = _get_job(vault_id)
    if not job:
        return
    completed_at = job.get("completed_at")
    if completed_at is None:
        return
    if job.get("downloaded_zip") and job.get("downloaded_preview"):
        temp_dir = str(job["temp_dir"])
        _delete_job(vault_id)
        background_tasks.add_task(cleanup_job, temp_dir)
        return
    last_access = job.get("last_access") or job.get("created_at")
    idle_seconds = time.time() - float(last_access)
    ttl_seconds = JOB_TTL_MINUTES * 60
    if idle_seconds < ttl_seconds:
        return
    temp_dir = str(job["temp_dir"])
    _delete_job(vault_id)
    background_tasks.add_task(cleanup_job, temp_dir)


def run_processing_job(
    vault_id: str,
    vault_dir: str,
    original_vault_dir: str,
    output_zip: str,
    preview_path: str,
) -> None:
    def progress_cb(processed: int, total: int) -> None:
        _store_update_job(vault_id, processed=processed, total=total)
        # Keep in-memory dict in sync for backward compat
        job = vault_store.get(vault_id)
        if job:
            job["processed"] = processed
            job["total"] = total

    try:
        started_at = datetime.utcnow().isoformat() + "Z"
        result = process_vault(
            vault_dir,
            vault_id=vault_id,
            started_at=started_at,
            progress_cb=progress_cb,
        )
        write_index_files(vault_dir, result.entities, result.entity_refs)
        write_preview_file(vault_dir, preview_path)
        zip_dir(vault_dir, output_zip)

        # Append report.json into the zip so it's included in the download
        report_file = result.report_path or os.path.join(vault_dir, "report.json")
        if os.path.exists(report_file):
            with zipfile.ZipFile(output_zip, "a", zipfile.ZIP_DEFLATED) as zf:
                zf.write(report_file, "report.json")

        _store_update_job(
            vault_id,
            status="done",
            processed=result.processed_files,
            total=result.total_files,
            completed_at=time.time(),
            report_path=report_file,
            vault_dir=vault_dir,
            original_vault_dir=original_vault_dir,
        )
        job = vault_store.get(vault_id)
        if job:
            job["status"] = "done"
            job["processed"] = result.processed_files
            job["total"] = result.total_files
            job["completed_at"] = time.time()
            job["report"] = report_file
            job["vault_dir"] = vault_dir
            job["original_vault_dir"] = original_vault_dir
    except Exception as exc:  # pragma: no cover
        _store_update_job(vault_id, status="error", error=str(exc))
        job = vault_store.get(vault_id)
        if job:
            job["status"] = "error"
            job["error"] = str(exc)


@app.post("/upload-vault")
async def upload_vault(request: Request, file: UploadFile = File(...)):
    client_id = request.client.host if request.client else "unknown"
    rate_limit_check(client_id)
    daily_limit_check(client_id)

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported.")

    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(status_code=400, detail="Upload too large.")

    temp_dir = tempfile.mkdtemp(prefix="agentvault_")
    upload_path = os.path.join(temp_dir, "upload.zip")
    vault_dir = os.path.join(temp_dir, "vault")
    original_vault_dir = os.path.join(temp_dir, "original_vault")
    os.makedirs(vault_dir, exist_ok=True)

    with open(upload_path, "wb") as handle:
        handle.write(raw)

    unzip_safe(upload_path, vault_dir)
    shutil.copytree(vault_dir, original_vault_dir, dirs_exist_ok=True)

    markdown_files = collect_markdown_files(vault_dir)
    if not markdown_files:
        cleanup_job(temp_dir)
        raise HTTPException(status_code=400, detail="No markdown files found.")
    if len(markdown_files) > MAX_FILES:
        cleanup_job(temp_dir)
        raise HTTPException(status_code=400, detail="Vault too large.")

    output_zip = os.path.join(temp_dir, "processed.zip")
    preview_path = os.path.join(temp_dir, "preview.md")
    vault_id = str(uuid.uuid4())

    vault_store[vault_id] = {
        "temp_dir": temp_dir,
        "zip": output_zip,
        "preview": preview_path,
        "status": "processing",
        "processed": 0,
        "total": len(markdown_files),
        "error": None,
        "downloaded_zip": False,
        "downloaded_preview": False,
        "created_at": time.time(),
        "last_access": time.time(),
        "vault_dir": vault_dir,
        "original_vault_dir": original_vault_dir,
        "report": os.path.join(vault_dir, "report.json"),
    }

    _store_create_job(
        vault_id=vault_id,
        temp_dir=temp_dir,
        zip_path=output_zip,
        preview_path=preview_path,
        vault_dir=vault_dir,
        original_vault_dir=original_vault_dir,
        total=len(markdown_files),
    )

    analytics_counts["uploads"] += 1

    thread = threading.Thread(
        target=run_processing_job,
        args=(vault_id, vault_dir, original_vault_dir, output_zip, preview_path),
        daemon=True,
    )
    thread.start()

    return {"vault_id": vault_id}


@app.get("/status/{vault_id}")
def vault_status(vault_id: str):
    job = _get_job(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")
    _store_mark_access(vault_id)
    mark_access(job)
    return {
        "status": job["status"],
        "processed": job["processed"],
        "total": job["total"],
        "error": job.get("error"),
    }


@app.get("/download/{vault_id}")
def download_vault(vault_id: str, background_tasks: BackgroundTasks):
    job = _get_job(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")

    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Vault not ready.")

    output_zip = str(job["zip"])
    _store_update_job(vault_id, downloaded_zip=True, last_access=time.time())
    job["downloaded_zip"] = True
    mark_access(job)
    analytics_counts["downloads"] += 1

    maybe_cleanup_job(vault_id, background_tasks)

    return FileResponse(output_zip, filename="agentvault-processed.zip")


@app.get("/preview/{vault_id}")
def download_preview(vault_id: str, background_tasks: BackgroundTasks):
    job = _get_job(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Vault not ready.")
    preview_path = str(job["preview"])
    if not os.path.exists(preview_path):
        raise HTTPException(status_code=404, detail="Preview not found.")

    _store_update_job(vault_id, downloaded_preview=True, last_access=time.time())
    job["downloaded_preview"] = True
    mark_access(job)
    maybe_cleanup_job(vault_id, background_tasks)

    return FileResponse(preview_path, filename="agentvault-preview.md")


@app.get("/report/{vault_id}")
def report(vault_id: str):
    job = _get_job(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")
    if job.get("status") != "done":
        raise HTTPException(status_code=404, detail="Report not ready.")
    report_path = str(job.get("report") or job.get("report_path") or "")
    if not report_path or not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Report not found.")
    with open(report_path, "r", encoding="utf-8") as handle:
        return JSONResponse(content=json.load(handle))


@app.get("/diff/{vault_id}")
def diff_note(vault_id: str, path: str):
    job = _get_job(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")
    if job.get("status") != "done":
        raise HTTPException(status_code=404, detail="Diff not ready.")
    if not path or not path.endswith(".md"):
        raise HTTPException(status_code=400, detail="Invalid note path.")
    if os.path.isabs(path):
        raise HTTPException(status_code=400, detail="Invalid note path.")
    normalized = os.path.normpath(path)
    if normalized.startswith("..") or ".." in normalized.split(os.sep):
        raise HTTPException(status_code=400, detail="Invalid note path.")

    original_root = str(job.get("original_vault_dir") or "")
    processed_root = str(job.get("vault_dir") or "")
    if not original_root or not processed_root:
        raise HTTPException(status_code=404, detail="Diff not available.")
    original_path = os.path.normpath(os.path.join(original_root, normalized))
    processed_path = os.path.normpath(os.path.join(processed_root, normalized))
    original_root_abs = os.path.abspath(original_root)
    processed_root_abs = os.path.abspath(processed_root)
    if not (original_path == original_root_abs or original_path.startswith(original_root_abs + os.sep)):
        raise HTTPException(status_code=400, detail="Invalid note path.")
    if not (processed_path == processed_root_abs or processed_path.startswith(processed_root_abs + os.sep)):
        raise HTTPException(status_code=400, detail="Invalid note path.")
    if not os.path.exists(original_path) or not os.path.exists(processed_path):
        raise HTTPException(status_code=404, detail="Note not found.")
    with open(original_path, "r", encoding="utf-8") as handle:
        original_text = handle.read()
    with open(processed_path, "r", encoding="utf-8") as handle:
        processed_text = handle.read()
    return {"path": normalized, "original": original_text, "processed": processed_text}


@app.post("/feedback")
async def feedback(payload: FeedbackIn):
    analytics_counts["feedback"] += 1
    logging.info("Feedback received: %s", payload.message)
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return analytics_counts


@app.post("/billing/webhook")
async def billing_webhook(request: Request):
    _ = await request.body()
    return {"status": "ok"}
