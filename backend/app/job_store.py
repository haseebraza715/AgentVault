"""SQLite-backed job store replacing the in-memory vault_store dict."""

import json
import os
import sqlite3
import threading
import time
from typing import Any

_DB_PATH = os.getenv("JOB_STORE_DB", os.path.join(os.path.dirname(__file__), "..", "jobs.db"))
_LOCAL = threading.local()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    vault_id     TEXT PRIMARY KEY,
    temp_dir     TEXT NOT NULL,
    zip_path     TEXT NOT NULL,
    preview_path TEXT NOT NULL,
    vault_dir    TEXT NOT NULL,
    original_vault_dir TEXT NOT NULL,
    report_path  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'processing',
    processed    INTEGER NOT NULL DEFAULT 0,
    total        INTEGER NOT NULL DEFAULT 0,
    error        TEXT,
    downloaded_zip     INTEGER NOT NULL DEFAULT 0,
    downloaded_preview INTEGER NOT NULL DEFAULT 0,
    created_at   REAL NOT NULL,
    last_access  REAL NOT NULL,
    completed_at REAL
);
"""


def _conn() -> sqlite3.Connection:
    """Return a thread-local connection (SQLite objects can't cross threads)."""
    conn = getattr(_LOCAL, "conn", None)
    if conn is None:
        db_path = os.path.abspath(_DB_PATH)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(_SCHEMA)
        conn.commit()
        _LOCAL.conn = conn
    return conn


def _ensure_table() -> None:
    c = _conn()
    c.execute(_SCHEMA)
    c.commit()


_ensure_table()


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    d["downloaded_zip"] = bool(d["downloaded_zip"])
    d["downloaded_preview"] = bool(d["downloaded_preview"])
    # Alias for backward compat
    d["zip"] = d["zip_path"]
    d["preview"] = d["preview_path"]
    d["report"] = d["report_path"]
    return d


def create_job(
    vault_id: str,
    temp_dir: str,
    zip_path: str,
    preview_path: str,
    vault_dir: str,
    original_vault_dir: str,
    total: int,
) -> None:
    now = time.time()
    c = _conn()
    c.execute(
        """INSERT INTO jobs
           (vault_id, temp_dir, zip_path, preview_path, vault_dir,
            original_vault_dir, report_path, status, processed, total,
            downloaded_zip, downloaded_preview, created_at, last_access)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (vault_id, temp_dir, zip_path, preview_path, vault_dir,
         original_vault_dir, "", "processing", 0, total, 0, 0, now, now),
    )
    c.commit()


def get_job(vault_id: str) -> dict[str, Any] | None:
    row = _conn().execute("SELECT * FROM jobs WHERE vault_id=?", (vault_id,)).fetchone()
    return _row_to_dict(row)


def update_job(vault_id: str, **fields: Any) -> None:
    if not fields:
        return
    cols = []
    vals: list[Any] = []
    for key, val in fields.items():
        if key in ("downloaded_zip", "downloaded_preview"):
            val = int(val)
        cols.append(f"{key}=?")
        vals.append(val)
    vals.append(vault_id)
    c = _conn()
    c.execute(f"UPDATE jobs SET {', '.join(cols)} WHERE vault_id=?", vals)
    c.commit()


def delete_job(vault_id: str) -> None:
    c = _conn()
    c.execute("DELETE FROM jobs WHERE vault_id=?", (vault_id,))
    c.commit()


def mark_access(vault_id: str) -> None:
    update_job(vault_id, last_access=time.time())


def list_jobs() -> list[dict[str, Any]]:
    rows = _conn().execute("SELECT * FROM jobs").fetchall()
    return [_row_to_dict(r) for r in rows]  # type: ignore[misc]
