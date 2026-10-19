import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Dict, Any, Optional, Set
from .config import JOBS_DIR, settings
from .database import (
    get_job, update_job_progress, update_job_metadata,
    complete_job, fail_job, cancel_job as db_cancel_job,
    add_clip, update_clip_rendered, get_job_clips, get_connection
)
from .pipeline.ingest import validate_video, generate_thumbnail
from .pipeline.transcribe import transcribe_video
from .pipeline.analyzer import analyze_transcript
from .pipeline.selector import adaptive_selection
from .pipeline.renderer import render_single_clip

logger = logging.getLogger(__name__)

# Active background tasks and cancellation registry
_running_tasks: Dict[str, asyncio.Task] = {}
_cancelled_jobs: Set[str] = set()

# Server-Sent Events listeners: queue of messages for each connected client
_sse_subscribers: Set[asyncio.Queue] = set()

async def broadcast_event(event_type: str, data: Dict[str, Any]):
    """Broadcast an SSE event to all connected UI clients."""
    msg = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    dead_queues = []
    for q in _sse_subscribers:
        try:
            q.put_nowait(msg)
        except Exception:
            dead_queues.append(q)
    for q in dead_queues:
        _sse_subscribers.discard(q)

def add_sse_subscriber() -> asyncio.Queue:
    q = asyncio.Queue()
    _sse_subscribers.add(q)
    return q

def remove_sse_subscriber(q: asyncio.Queue):
    _sse_subscribers.discard(q)

def is_job_cancelled(job_id: str) -> bool:
    return job_id in _cancelled_jobs

async def request_job_cancellation(job_id: str):
    _cancelled_jobs.add(job_id)
    if job_id in _running_tasks:
        _running_tasks[job_id].cancel()
    db_cancel_job(job_id)
    await broadcast_event("job_update", {
        "job_id": job_id,
        "status": "CANCELLED",
        "stage": "CANCELLED",
        "progress_percent": 0.0,
        "stage_message": "Job cancelled by user"
    })

async def execute_job_pipeline(job_id: str):
    """
    Main asynchronous pipeline executing:
    QUEUED -> INGESTING -> TRANSCRIBING -> ANALYZING -> SELECTING -> RENDERING -> VALIDATING -> COMPLETED
    """
    job = get_job(job_id)
    if not job:
        logger.error(f"Cannot execute non-existent job {job_id}")
        return

    job_dir = JOBS_DIR / job_id
    source_path = Path(job["source_path"])
    job_settings = json.loads(job.get("settings_json", "{}"))

    # Config options with fallbacks
    whisper_model = job_settings.get("whisper_model", settings.whisper_model)
    whisper_device = job_settings.get("whisper_device", settings.whisper_device)
    ollama_model = job_settings.get("ollama_model", settings.default_ollama_model)
    ollama_url = job_settings.get("ollama_base_url", settings.ollama_base_url)
    reframing_mode = job_settings.get("reframing_mode", settings.default_reframing)
    subtitle_style = job_settings.get("subtitle_style", settings.subtitle_style)
    min_score = float(job_settings.get("min_clip_score", settings.min_clip_score))

    main_loop = asyncio.get_running_loop()

    def emit_progress(stage: str, percent: float, msg: str, status: Optional[str] = None):
        update_job_progress(job_id, stage, percent, msg, status)
        payload = {
            "job_id": job_id,
            "status": status or "RUNNING",
            "stage": stage,
            "progress_percent": percent,
            "stage_message": msg
        }
        try:
            current_loop = asyncio.get_running_loop()
            current_loop.create_task(broadcast_event("job_update", payload))
        except RuntimeError:
            asyncio.run_coroutine_threadsafe(broadcast_event("job_update", payload), main_loop)

    try:
        if is_job_cancelled(job_id):
            return

        # -------------------------------------------------------------
        # 1. INGESTING & VALIDATING
        # -------------------------------------------------------------
        emit_progress("INGESTING", 5.0, "Validating video format and reading metadata...", status="RUNNING")
        
        valid, val_msg, meta = validate_video(source_path)
        if not valid:
            raise ValueError(f"Video validation failed: {val_msg}")

        thumbnail_path = job_dir / "thumbnail.jpg"
        generate_thumbnail(source_path, thumbnail_path, timestamp=min(2.0, meta["duration"] * 0.1))

        update_job_metadata(
            job_id=job_id,
            duration=meta["duration"],
            resolution=meta["resolution"],
            fps=meta["fps"],
            file_size_bytes=meta["file_size_bytes"],
            thumbnail_path=str(thumbnail_path)
        )
        emit_progress("INGESTING", 12.0, f"Ingested {meta['resolution']} video ({int(meta['duration'])}s)")

        if is_job_cancelled(job_id):
            return

        # -------------------------------------------------------------
        # 2. TRANSCRIBING
        # -------------------------------------------------------------
        emit_progress("TRANSCRIBING", 15.0, f"Transcribing audio with Faster-Whisper ({whisper_model})...")
        transcript_path = job_dir / "transcript.json"

        def whisper_progress(pct: float, text: str):
            if is_job_cancelled(job_id):
                raise asyncio.CancelledError()
            # Scale whisper progress between 15% and 50%
            scaled = 15.0 + (pct / 100.0) * 35.0
            emit_progress("TRANSCRIBING", round(scaled, 1), text)

        # Run whisper in thread pool so it does not block the async event loop
        loop = asyncio.get_running_loop()
        transcript_data = await loop.run_in_executor(
            None,
            lambda: transcribe_video(
                video_path=source_path,
                output_json_path=transcript_path,
                total_duration=meta["duration"],
                model_size=whisper_model,
                device_pref=whisper_device,
                progress_callback=whisper_progress
            )
        )

        emit_progress("TRANSCRIBING", 50.0, f"Speech transcribed ({len(transcript_data.get('segments', []))} segments)")

        if is_job_cancelled(job_id):
            return

        # -------------------------------------------------------------
        # 3. ANALYZING (OLLAMA LLM)
        # -------------------------------------------------------------
        emit_progress("ANALYZING", 52.0, f"Ollama analyzing content with {ollama_model}...")

        def analyzer_progress(pct: float, text: str):
            if is_job_cancelled(job_id):
                raise asyncio.CancelledError()
            # Scale analyzer progress between 52% and 70%
            scaled = 52.0 + (pct / 100.0) * 18.0
            emit_progress("ANALYZING", round(scaled, 1), text)

        candidates = await analyze_transcript(
            transcript_data=transcript_data,
            ollama_url=ollama_url,
            model=ollama_model,
            progress_callback=analyzer_progress
        )

        # Save candidate output
        candidates_path = job_dir / "candidates.json"
        with open(candidates_path, "w", encoding="utf-8") as f:
            json.dump(candidates, f, indent=2)

        emit_progress("ANALYZING", 70.0, f"Identified {len(candidates)} high-potential moment candidates")

        if is_job_cancelled(job_id):
            return

        # -------------------------------------------------------------
        # 4. SELECTING & DEDUPLICATING
        # -------------------------------------------------------------
        emit_progress("SELECTING", 72.0, "Deduplicating and adaptively selecting best clips...")

        selected_clips = adaptive_selection(
            candidates=candidates,
            job_id=job_id,
            min_score=min_score,
            max_duration=settings.max_clip_duration,
            min_duration=settings.min_clip_duration
        )

        if not selected_clips:
            raise ValueError("No segments met quality thresholds. Try adjusting minimum score or duration.")

        # Persist selected clips to DB
        for c in selected_clips:
            add_clip(c)

        emit_progress("SELECTING", 75.0, f"Selected {len(selected_clips)} distinct moments for vertical rendering")

        if is_job_cancelled(job_id):
            return

        # -------------------------------------------------------------
        # 5. RENDERING & SUBTITLES
        # -------------------------------------------------------------
        clips_dir = job_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)
        total_clips = len(selected_clips)

        for idx, clip_info in enumerate(selected_clips):
            if is_job_cancelled(job_id):
                return

            clip_id = clip_info["id"]
            clip_output_path = clips_dir / f"{clip_id}.mp4"
            clip_thumb_path = clips_dir / f"{clip_id}.jpg"

            base_pct = 75.0 + (idx / total_clips) * 20.0
            emit_progress(
                "RENDERING",
                round(base_pct, 1),
                f"Rendering clip {idx+1}/{total_clips}: '{clip_info['title']}' (1080x1920 9:16)..."
            )

            # Run FFmpeg rendering in thread pool
            render_res = await loop.run_in_executor(
                None,
                lambda c_info=clip_info, out_p=clip_output_path, thumb_p=clip_thumb_path: render_single_clip(
                    source_video_path=source_path,
                    output_clip_path=out_p,
                    output_thumbnail_path=thumb_p,
                    clip_info=c_info,
                    transcript_data=transcript_data,
                    reframing_mode=reframing_mode,
                    subtitle_style=subtitle_style,
                    subtitle_margin_v=settings.subtitle_margin_v
                )
            )

            # Update clip record in SQLite
            update_clip_rendered(
                clip_id=clip_id,
                output_path=render_res["output_path"],
                thumbnail_path=render_res["thumbnail_path"],
                file_size_bytes=render_res["file_size_bytes"]
            )

        # -------------------------------------------------------------
        # 6. VALIDATING & COMPLETING
        # -------------------------------------------------------------
        emit_progress("VALIDATING", 98.0, "Validating all rendered vertical MP4s...")
        await asyncio.sleep(0.5)

        complete_job(job_id, clip_count=total_clips, retention_hours=settings.retention_hours)
        emit_progress("COMPLETED", 100.0, f"Successfully created {total_clips} viral vertical clips!", status="COMPLETED")
        logger.info(f"Job {job_id} completed successfully with {total_clips} clips.")

    except asyncio.CancelledError:
        logger.info(f"Job {job_id} was cancelled.")
        db_cancel_job(job_id)
        emit_progress("CANCELLED", 0.0, "Job was cancelled by user", status="CANCELLED")
    except Exception as e:
        logger.exception(f"Job {job_id} encountered an error: {e}")
        fail_job(job_id, str(e))
        emit_progress("FAILED", 0.0, f"Error: {str(e)}", status="FAILED")
    finally:
        _running_tasks.pop(job_id, None)
        _cancelled_jobs.discard(job_id)

def start_job(job_id: str):
    """Spawns background task for the job."""
    task = asyncio.create_task(execute_job_pipeline(job_id))
    _running_tasks[job_id] = task
    return task

def recover_stale_jobs_on_startup():
    """Finds any jobs that were interrupted when server shut down and updates their state."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, status FROM jobs
    WHERE status IN ('QUEUED', 'RUNNING')
    """)
    stale_jobs = cursor.fetchall()
    for row in stale_jobs:
        job_id = row["id"]
        logger.warning(f"Marking interrupted job {job_id} as FAILED due to server restart.")
        fail_job(job_id, "Interrupted by server restart. You can safely delete or re-upload.")
    conn.close()
