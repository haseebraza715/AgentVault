from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

vault_store: dict[str, dict[str, object]] = {}
rate_limit_window: dict[str, list[float]] = {}
daily_job_counts: dict[str, dict[str, int]] = {}
analytics_counts = {"uploads": 0, "downloads": 0, "feedback": 0}

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


def maybe_cleanup_job(vault_id: str, background_tasks: BackgroundTasks) -> None:
    job = vault_store.get(vault_id)
    if not job:
        return
    completed_at = job.get("completed_at")
    last_access = job.get("last_access") or job.get("created_at")
    if completed_at is None:
        return
    idle_seconds = time.time() - float(last_access)
    ttl_seconds = JOB_TTL_MINUTES * 60
    if idle_seconds < ttl_seconds:
        return
    temp_dir = job["temp_dir"]
    vault_store.pop(vault_id, None)
    background_tasks.add_task(cleanup_job, temp_dir)


def maybe_cleanup_job(vault_id: str, background_tasks: BackgroundTasks) -> None:
    job = vault_store.get(vault_id)
    if not job:
        return
    if job.get("downloaded_zip") and job.get("downloaded_preview"):
        temp_dir = job["temp_dir"]
        vault_store.pop(vault_id, None)
        background_tasks.add_task(cleanup_job, temp_dir)


def run_processing_job(vault_id: str, vault_dir: str, output_zip: str, preview_path: str) -> None:
    def progress_cb(processed: int, total: int) -> None:
        job = vault_store.get(vault_id)
        if job:
            job["processed"] = processed
            job["total"] = total

    try:
        result = process_vault(vault_dir, progress_cb=progress_cb)
        write_index_files(vault_dir, result.entities)
        write_preview_file(vault_dir, preview_path)
        zip_dir(vault_dir, output_zip)
        job = vault_store.get(vault_id)
        if job:
            job["status"] = "done"
            job["processed"] = result.processed_files
            job["total"] = result.total_files
            job["completed_at"] = time.time()
    except Exception as exc:  # pragma: no cover
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
    os.makedirs(vault_dir, exist_ok=True)

    with open(upload_path, "wb") as handle:
        handle.write(raw)

    unzip_safe(upload_path, vault_dir)

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
    }

    analytics_counts["uploads"] += 1

    thread = threading.Thread(
        target=run_processing_job,
        args=(vault_id, vault_dir, output_zip, preview_path),
        daemon=True,
    )
    thread.start()

    return {"vault_id": vault_id}


@app.get("/status/{vault_id}")
def vault_status(vault_id: str):
    job = vault_store.get(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")
    mark_access(job)
    return {
        "status": job["status"],
        "processed": job["processed"],
        "total": job["total"],
        "error": job["error"],
    }


@app.get("/download/{vault_id}")
def download_vault(vault_id: str, background_tasks: BackgroundTasks):
    job = vault_store.get(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")

    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Vault not ready.")

    output_zip = job["zip"]
    job["downloaded_zip"] = True
    analytics_counts["downloads"] += 1
    mark_access(job)

    maybe_cleanup_job(vault_id, background_tasks)

    return FileResponse(output_zip, filename="agentvault-processed.zip")


@app.get("/preview/{vault_id}")
def download_preview(vault_id: str, background_tasks: BackgroundTasks):
    job = vault_store.get(vault_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vault not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Vault not ready.")
    preview_path = job["preview"]
    if not os.path.exists(preview_path):
        raise HTTPException(status_code=404, detail="Preview not found.")

    job["downloaded_preview"] = True
    mark_access(job)
    maybe_cleanup_job(vault_id, background_tasks)

    return FileResponse(preview_path, filename="agentvault-preview.md")


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
