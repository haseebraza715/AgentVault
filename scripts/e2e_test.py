import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

import requests


def wait_for_server(url: str, timeout: int = 20) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(0.5)
    raise RuntimeError(f"Server not ready at {url}")


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", required=True, help="Path to vault zip")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument(
        "--timeout",
        default=900,
        type=int,
        help="Max seconds to wait for processing",
    )
    args = parser.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        raise FileNotFoundError(zip_path)

    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    venv_python = backend_dir / ".venv" / "bin" / "python"
    if not venv_python.exists():
        raise RuntimeError("backend/.venv is missing. Create it and install requirements first.")

    env = os.environ.copy()
    host = args.host
    port = args.port
    base_url = f"http://{host}:{port}"

    server = subprocess.Popen(
        [str(venv_python), "-m", "uvicorn", "app.main:app", "--port", str(port)],
        cwd=str(backend_dir),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        wait_for_server(f"{base_url}/health")
        with zip_path.open("rb") as handle:
            resp = requests.post(
                f"{base_url}/upload-vault", files={"file": (zip_path.name, handle)}
            )
        resp.raise_for_status()
        vault_id = resp.json()["vault_id"]

        status_url = f"{base_url}/status/{vault_id}"
        rate_limit = int(env.get("LLM_REQUESTS_PER_MINUTE", "20"))
        max_wait = args.timeout

        status = requests.get(status_url).json()
        total = status.get("total") or 0
        if rate_limit > 0 and total:
            estimated = int(((total + rate_limit - 1) / rate_limit) * 60) + 60
            max_wait = max(max_wait, estimated)

        deadline = time.time() + max_wait
        while time.time() < deadline:
            status = requests.get(status_url).json()
            if status.get("status") in ("done", "error"):
                break
            time.sleep(2)
        else:
            raise RuntimeError("Processing timed out")

        if status.get("status") != "done":
            raise RuntimeError(f"Processing failed: {status}")

        download_url = f"{base_url}/download/{vault_id}"
        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "processed.zip"
            with requests.get(download_url, stream=True) as r:
                r.raise_for_status()
                with out_path.open("wb") as out:
                    for chunk in r.iter_content(chunk_size=8192):
                        out.write(chunk)

            with zipfile.ZipFile(out_path) as zf:
                names = set(zf.namelist())
                if "index.md" not in names:
                    raise RuntimeError("index.md not found in output zip")
                if "entities.md" not in names:
                    raise RuntimeError("entities.md not found in output zip")

        print(json.dumps({"status": "ok", "processed": status.get("processed")}, indent=2))
        return 0
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    raise SystemExit(run())
