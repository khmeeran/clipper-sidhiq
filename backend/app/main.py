import os
import uuid
import json
import logging
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import aiofiles
import httpx
import torch

from .config import settings, JOBS_DIR, BASE_DIR
from .database import (
    init_db, create_job, get_job, list_jobs, get_job_clips,
    get_clip, delete_job_db, get_all_settings, set_app_setting
)
from .job_manager import (
    start_job, request_job_cancellation, add_sse_subscriber,
    remove_sse_subscriber, recover_stale_jobs_on_startup
)
from .cleanup_service import (
    start_cleanup_daemon, delete_job_files, register_download_start,
    register_download_end
)
from .pipeline.renderer import create_clips_zip

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("clipper")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Clipper Sidhiq local backend...")
    init_db()
    recover_stale_jobs_on_startup()
    cleanup_task = asyncio.create_task(start_cleanup_daemon(interval_seconds=300))
    yield
    # Shutdown
    cleanup_task.cancel()
    logger.info("Clipper Sidhiq backend shut down.")

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan
)

# CORS restricted to localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080", "http://localhost:8080", "http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# System & Diagnostics Endpoints
# -------------------------------------------------------------------
@app.get("/api/system/status")
async def get_system_status():
    """Returns local AI availability: Ollama models, CUDA status, and storage."""
    # Check Ollama
    ollama_ok = False
    ollama_models = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code == 200:
                ollama_ok = True
                data = resp.json()
                ollama_models = [m["name"] for m in data.get("models", [])]
    except Exception:
        ollama_ok = False

    # Check GPU
    cuda_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if cuda_available else "CPU Only"

    return {
        "status": "ready",
        "ollama_connected": ollama_ok,
        "ollama_models": ollama_models,
        "cuda_available": cuda_available,
        "gpu_name": gpu_name,
        "default_ollama_model": settings.default_ollama_model,
        "whisper_device": settings.whisper_device if cuda_available else "cpu",
        "retention_hours": settings.retention_hours
    }

# -------------------------------------------------------------------
# Settings Endpoints
# -------------------------------------------------------------------
@app.get("/api/settings")
def get_settings():
    db_settings = get_all_settings()
    return {
        "ollama_base_url": db_settings.get("ollama_base_url", settings.ollama_base_url),
        "ollama_model": db_settings.get("ollama_model", settings.default_ollama_model),
        "whisper_model": db_settings.get("whisper_model", settings.whisper_model),
        "whisper_device": db_settings.get("whisper_device", settings.whisper_device),
        "reframing_mode": db_settings.get("reframing_mode", settings.default_reframing),
        "subtitle_style": db_settings.get("subtitle_style", settings.subtitle_style),
        "min_clip_score": float(db_settings.get("min_clip_score", settings.min_clip_score)),
        "retention_hours": float(db_settings.get("retention_hours", settings.retention_hours))
    }

@app.post("/api/settings")
def save_settings(payload: dict):
    for k, v in payload.items():
        set_app_setting(k, str(v))
    return {"status": "updated", "settings": get_all_settings()}

# -------------------------------------------------------------------
# Video Upload & Job Creation
# -------------------------------------------------------------------
@app.post("/api/upload")
async def upload_video(
    file: UploadFile = File(...),
    ollama_model: Optional[str] = Form(None),
    whisper_model: Optional[str] = Form(None),
    reframing_mode: Optional[str] = Form(None),
    subtitle_style: Optional[str] = Form(None),
    min_clip_score: Optional[float] = Form(None)
):
    """
    Streams uploaded video directly to disk and starts the AI clipping pipeline.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing.")

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    allowed_exts = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(allowed_exts)}"
        )

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    dest_file = job_dir / f"source{ext}"

    # Stream write to disk in 1MB chunks to keep memory usage minimal
    try:
        async with aiofiles.open(dest_file, "wb") as out_f:
            while chunk := await file.read(1024 * 1024):
                await out_f.write(chunk)
    except Exception as e:
        delete_job_files(job_id)
        raise HTTPException(status_code=500, detail=f"Failed writing upload to disk: {e}")

    # Build job-specific configuration
    job_settings = {
        "ollama_model": ollama_model or settings.default_ollama_model,
        "whisper_model": whisper_model or settings.whisper_model,
        "whisper_device": settings.whisper_device,
        "reframing_mode": reframing_mode or settings.default_reframing,
        "subtitle_style": subtitle_style or settings.subtitle_style,
        "min_clip_score": min_clip_score if min_clip_score is not None else settings.min_clip_score,
        "ollama_base_url": settings.ollama_base_url
    }

    job_record = create_job(
        job_id=job_id,
        filename=file.filename,
        source_path=str(dest_file),
        settings_dict=job_settings
    )

    # Start the async background pipeline
    start_job(job_id)

    return {
        "job_id": job_id,
        "filename": file.filename,
        "status": "QUEUED",
        "job": job_record
    }

# -------------------------------------------------------------------
# Jobs API
# -------------------------------------------------------------------
@app.get("/api/jobs")
def get_jobs_list(limit: int = 50):
    return {"jobs": list_jobs(limit=limit)}

@app.get("/api/jobs/{job_id}")
def get_job_detail(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    clips = get_job_clips(job_id)
    return {
        "job": job,
        "clips": clips
    }

@app.post("/api/jobs/{job_id}/cancel")
async def cancel_running_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    await request_job_cancellation(job_id)
    return {"status": "cancelled", "job_id": job_id}

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    # Cancel if running
    await request_job_cancellation(job_id)
    # Delete disk files and database record
    delete_job_files(job_id)
    delete_job_db(job_id)
    return {"status": "deleted", "job_id": job_id}

# -------------------------------------------------------------------
# Media Streaming and Download Endpoints
# -------------------------------------------------------------------
@app.get("/api/jobs/{job_id}/thumbnail")
def get_job_thumbnail(job_id: str):
    job = get_job(job_id)
    if not job or not job.get("thumbnail_path"):
        raise HTTPException(status_code=404, detail="Thumbnail not available.")
    thumb_path = Path(job["thumbnail_path"])
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found.")
    return FileResponse(thumb_path, media_type="image/jpeg")

@app.get("/api/jobs/{job_id}/clips/{clip_id}/thumbnail")
def get_clip_thumbnail(job_id: str, clip_id: str):
    clip = get_clip(clip_id)
    if not clip or not clip.get("thumbnail_path"):
        raise HTTPException(status_code=404, detail="Clip thumbnail not available.")
    thumb_path = Path(clip["thumbnail_path"])
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found.")
    return FileResponse(thumb_path, media_type="image/jpeg")

@app.get("/api/jobs/{job_id}/clips/{clip_id}/stream")
def stream_clip_video(job_id: str, clip_id: str):
    """Streams the vertical MP4 clip for inline browser video player."""
    clip = get_clip(clip_id)
    if not clip or not clip.get("output_path"):
        raise HTTPException(status_code=404, detail="Clip not rendered yet.")
    clip_path = Path(clip["output_path"])
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip file missing from disk.")
    return FileResponse(clip_path, media_type="video/mp4")

@app.get("/api/jobs/{job_id}/clips/{clip_id}/download")
def download_single_clip(job_id: str, clip_id: str):
    """Triggers direct browser download of the vertical MP4 file."""
    clip = get_clip(clip_id)
    if not clip or not clip.get("output_path"):
        raise HTTPException(status_code=404, detail="Clip not available.")
    clip_path = Path(clip["output_path"])
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip file missing.")

    register_download_start()
    safe_title = "".join(c for c in clip['title'] if c.isalnum() or c in " _-").strip() or clip_id
    filename = f"{safe_title}_vertical.mp4"

    def file_iterator():
        try:
            with open(clip_path, "rb") as f:
                while chunk := f.read(64 * 1024):
                    yield chunk
        finally:
            register_download_end()

    return StreamingResponse(
        file_iterator(),
        media_type="video/mp4",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/jobs/{job_id}/download-all")
def download_all_clips_zip(job_id: str):
    """Packages all rendered clips into a ZIP archive and triggers download."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    clips_dir = JOBS_DIR / job_id / "clips"
    if not clips_dir.exists() or not list(clips_dir.glob("*.mp4")):
        raise HTTPException(status_code=404, detail="No clips available to package.")

    zip_path = JOBS_DIR / job_id / f"{job['filename']}_all_clips.zip"
    create_clips_zip(clips_dir, zip_path)

    register_download_start()
    def zip_iterator():
        try:
            with open(zip_path, "rb") as f:
                while chunk := f.read(128 * 1024):
                    yield chunk
        finally:
            register_download_end()

    return StreamingResponse(
        zip_iterator(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_path.name}"'}
    )

# -------------------------------------------------------------------
# Server-Sent Events (SSE) for Real-Time UI Progress
# -------------------------------------------------------------------
@app.get("/api/events")
async def sse_events():
    """Stream real-time progress updates directly to connected browser clients."""
    queue = add_sse_subscriber()

    async def event_generator():
        try:
            # Send initial ping
            yield "event: ping\ndata: {}\n\n"
            while True:
                data = await queue.get()
                yield data
        except asyncio.CancelledError:
            remove_sse_subscriber(queue)
            raise
        finally:
            remove_sse_subscriber(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# -------------------------------------------------------------------
# Static Frontend Serving
# -------------------------------------------------------------------
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        # Serve index.html for client-side routing unless it's a specific file in dist
        target = frontend_dist / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(frontend_dist / "index.html")
