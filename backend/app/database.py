import sqlite3
import json
import time
from typing import Optional, List, Dict, Any
from pathlib import Path
from .config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Jobs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        source_path TEXT NOT NULL,
        status TEXT NOT NULL,
        stage TEXT NOT NULL,
        progress_percent REAL DEFAULT 0.0,
        stage_message TEXT DEFAULT '',
        duration REAL DEFAULT 0.0,
        resolution TEXT DEFAULT '',
        fps REAL DEFAULT 0.0,
        file_size_bytes INTEGER DEFAULT 0,
        thumbnail_path TEXT DEFAULT '',
        transcript_path TEXT DEFAULT '',
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL,
        completed_at REAL,
        expires_at REAL,
        error_message TEXT DEFAULT '',
        clip_count INTEGER DEFAULT 0,
        settings_json TEXT DEFAULT '{}'
    )
    """)

    # Clips table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        title TEXT NOT NULL,
        hook TEXT DEFAULT '',
        reason TEXT DEFAULT '',
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        duration REAL NOT NULL,
        score REAL DEFAULT 0.0,
        hook_strength REAL DEFAULT 0.0,
        context_completeness REAL DEFAULT 0.0,
        output_path TEXT DEFAULT '',
        thumbnail_path TEXT DEFAULT '',
        rendered INTEGER DEFAULT 0,
        file_size_bytes INTEGER DEFAULT 0,
        width INTEGER DEFAULT 1080,
        height INTEGER DEFAULT 1920,
        created_at REAL NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
    """)

    # Persistent user preferences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    conn.commit()
    conn.close()

# Job DB operations
def create_job(job_id: str, filename: str, source_path: str, settings_dict: dict) -> Dict[str, Any]:
    now = time.time()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO jobs (
        id, filename, source_path, status, stage, progress_percent,
        stage_message, created_at, updated_at, settings_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id, filename, source_path, "QUEUED", "QUEUED", 0.0,
        "Job initialized in queue", now, now, json.dumps(settings_dict)
    ))
    conn.commit()
    conn.close()
    return get_job(job_id)

def update_job_progress(job_id: str, stage: str, progress_percent: float, stage_message: str = "", status: Optional[str] = None):
    now = time.time()
    conn = get_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("""
        UPDATE jobs
        SET stage = ?, progress_percent = ?, stage_message = ?, status = ?, updated_at = ?
        WHERE id = ?
        """, (stage, progress_percent, stage_message, status, now, job_id))
    else:
        cursor.execute("""
        UPDATE jobs
        SET stage = ?, progress_percent = ?, stage_message = ?, updated_at = ?
        WHERE id = ?
        """, (stage, progress_percent, stage_message, now, job_id))
    conn.commit()
    conn.close()

def update_job_metadata(job_id: str, duration: float, resolution: str, fps: float, file_size_bytes: int, thumbnail_path: str):
    now = time.time()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE jobs
    SET duration = ?, resolution = ?, fps = ?, file_size_bytes = ?, thumbnail_path = ?, updated_at = ?
    WHERE id = ?
    """, (duration, resolution, fps, file_size_bytes, thumbnail_path, now, job_id))
    conn.commit()
    conn.close()

def complete_job(job_id: str, clip_count: int, retention_hours: float = 6.0):
    now = time.time()
    expires_at = now + (retention_hours * 3600)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE jobs
    SET status = 'COMPLETED', stage = 'COMPLETED', progress_percent = 100.0,
        stage_message = 'All clips rendered and validated successfully',
        completed_at = ?, expires_at = ?, clip_count = ?, updated_at = ?
    WHERE id = ?
    """, (now, expires_at, clip_count, now, job_id))
    conn.commit()
    conn.close()

def fail_job(job_id: str, error_message: str):
    now = time.time()
    expires_at = now + (6.0 * 3600)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE jobs
    SET status = 'FAILED', stage_message = ?, error_message = ?,
        expires_at = ?, updated_at = ?
    WHERE id = ?
    """, (error_message, error_message, expires_at, now, job_id))
    conn.commit()
    conn.close()

def cancel_job(job_id: str):
    now = time.time()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE jobs
    SET status = 'CANCELLED', stage = 'CANCELLED', stage_message = 'Job was cancelled by user',
        updated_at = ?
    WHERE id = ?
    """, (now, job_id))
    conn.commit()
    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def list_jobs(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_job_db(job_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM clips WHERE job_id = ?", (job_id,))
    cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()

# Clip DB operations
def add_clip(clip_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO clips (
        id, job_id, title, hook, reason, start_time, end_time, duration,
        score, hook_strength, context_completeness, output_path, thumbnail_path,
        rendered, file_size_bytes, width, height, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        clip_data["id"], clip_data["job_id"], clip_data["title"],
        clip_data.get("hook", ""), clip_data.get("reason", ""),
        clip_data["start_time"], clip_data["end_time"], clip_data["duration"],
        clip_data.get("score", 0.0), clip_data.get("hook_strength", 0.0),
        clip_data.get("context_completeness", 0.0),
        clip_data.get("output_path", ""), clip_data.get("thumbnail_path", ""),
        clip_data.get("rendered", 0), clip_data.get("file_size_bytes", 0),
        clip_data.get("width", 1080), clip_data.get("height", 1920),
        time.time()
    ))
    conn.commit()
    conn.close()
    return clip_data

def update_clip_rendered(clip_id: str, output_path: str, thumbnail_path: str, file_size_bytes: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE clips
    SET output_path = ?, thumbnail_path = ?, file_size_bytes = ?, rendered = 1
    WHERE id = ?
    """, (output_path, thumbnail_path, file_size_bytes, clip_id))
    conn.commit()
    conn.close()

def get_job_clips(job_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clips WHERE job_id = ? ORDER BY start_time ASC", (job_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_clip(clip_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clips WHERE id = ?", (clip_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

# App Settings operations
def get_app_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row[0]
    return default

def set_app_setting(key: str, value: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

def get_all_settings() -> Dict[str, str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM app_settings")
    rows = cursor.fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}
