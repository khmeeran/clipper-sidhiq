import os
import shutil
import time
import asyncio
import logging
from pathlib import Path
from typing import Optional
from .config import JOBS_DIR
from .database import get_connection, delete_job_db

logger = logging.getLogger(__name__)

# Track active downloads so cleanup never deletes files while a user is actively downloading
active_downloads_count = 0

def register_download_start():
    global active_downloads_count
    active_downloads_count += 1

def register_download_end():
    global active_downloads_count
    active_downloads_count = max(0, active_downloads_count - 1)

def is_safe_job_path(job_dir: Path) -> bool:
    """Ensure path is strictly inside the JOBS_DIR to prevent path traversal."""
    try:
        resolved = job_dir.resolve()
        return JOBS_DIR.resolve() in resolved.parents or resolved == JOBS_DIR.resolve()
    except Exception:
        return False

def delete_job_files(job_id: str) -> bool:
    """Safely deletes all files for a job inside JOBS_DIR."""
    job_dir = JOBS_DIR / job_id
    if not is_safe_job_path(job_dir) or not job_dir.exists():
        return False

    try:
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.info(f"Deleted files for job {job_id} at {job_dir}")
        return True
    except Exception as e:
        logger.error(f"Error deleting job dir {job_dir}: {e}")
        return False

def purge_expired_jobs():
    """Checks database for jobs whose retention has expired and deletes them."""
    if active_downloads_count > 0:
        logger.info(f"Skipping auto-cleanup: {active_downloads_count} download(s) in progress.")
        return

    now = time.time()
    conn = get_connection()
    cursor = conn.cursor()
    # Find finished jobs past their expiration
    cursor.execute("""
    SELECT id, status, expires_at FROM jobs
    WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED')
      AND expires_at IS NOT NULL
      AND expires_at <= ?
    """, (now,))
    expired = cursor.fetchall()
    conn.close()

    for row in expired:
        job_id = row["id"]
        logger.info(f"Job {job_id} has passed retention expiration. Purging...")
        delete_job_files(job_id)
        delete_job_db(job_id)

async def start_cleanup_daemon(interval_seconds: int = 300):
    """Background task that runs periodically to enforce the 6-hour retention policy."""
    logger.info(f"Retention cleanup daemon started (interval: {interval_seconds}s).")
    while True:
        try:
            purge_expired_jobs()
        except Exception as e:
            logger.error(f"Error in cleanup daemon: {e}")
        await asyncio.sleep(interval_seconds)
