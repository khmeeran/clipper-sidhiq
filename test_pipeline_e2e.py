import sys
import asyncio
import json
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path("E:/Clipper_Sidhiq/backend")))

from app.pipeline.ingest import validate_video, generate_thumbnail
from app.pipeline.transcribe import transcribe_video
from app.pipeline.analyzer import analyze_transcript
from app.pipeline.selector import adaptive_selection
from app.pipeline.renderer import render_single_clip, validate_rendered_clip, create_clips_zip

async def run_pipeline_test():
    source_video = Path("E:/Clipper_Sidhiq/test_data/sample_input.mp4")
    out_dir = Path("E:/Clipper_Sidhiq/test_data/output_e2e")
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=== STAGE 1: INGESTION & VALIDATION ===")
    valid, msg, meta = validate_video(source_video)
    assert valid, f"Validation failed: {msg}"
    print(f"Video validated: {meta['resolution']}, {meta['fps']} fps, {meta['duration']:.2f}s, size: {meta['file_size_bytes']} bytes")

    thumb_path = out_dir / "thumb.jpg"
    assert generate_thumbnail(source_video, thumb_path, timestamp=2.0)
    print(f"Thumbnail created at {thumb_path}")

    print("\n=== STAGE 2: FASTER-WHISPER TRANSCRIPTION ===")
    transcript_path = out_dir / "transcript.json"
    transcript = transcribe_video(
        video_path=source_video,
        output_json_path=transcript_path,
        total_duration=meta["duration"],
        model_size="base",
        device_pref="cuda",
        progress_callback=lambda pct, txt: print(f"Whisper Progress [{pct:.1f}%]: {txt}")
    )
    print(f"Transcription complete! Language: {transcript['language']}, Segments: {len(transcript['segments'])}")
    print(f"Transcript text: {transcript['full_text']}")

    print("\n=== STAGE 3: OLLAMA CONTENT INTELLIGENCE ===")
    candidates = await analyze_transcript(
        transcript_data=transcript,
        ollama_url="http://127.0.0.1:11434",
        model="llama3.2:3b",
        progress_callback=lambda pct, txt: print(f"Analyzer Progress [{pct:.1f}%]: {txt}")
    )
    print(f"Ollama identified {len(candidates)} candidate moments:")
    for c in candidates:
        print(f" - [{c['start_time']}s -> {c['end_time']}s] Title: '{c['title']}', Score: {c['score']}")

    print("\n=== STAGE 4: ADAPTIVE SELECTION & DEDUPLICATION ===")
    selected = adaptive_selection(
        candidates=candidates,
        job_id="test_job_1",
        min_score=6.0,
        max_duration=90.0,
        min_duration=10.0
    )
    print(f"Adaptively selected {len(selected)} final clips (No hardcoded 10-clip quota)")
    assert len(selected) > 0, "Expected at least 1 selected clip"

    print("\n=== STAGE 5: VERTICAL REFRAMING & 1080x1920 MP4 RENDERING ===")
    clips_dir = out_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    for idx, clip in enumerate(selected):
        clip_path = clips_dir / f"{clip['id']}.mp4"
        clip_thumb = clips_dir / f"{clip['id']}.jpg"
        print(f"Rendering Clip #{idx+1}: '{clip['title']}' ({clip['start_time']}s -> {clip['end_time']}s)...")
        res = render_single_clip(
            source_video_path=source_video,
            output_clip_path=clip_path,
            output_thumbnail_path=clip_thumb,
            clip_info=clip,
            transcript_data=transcript,
            reframing_mode="blur_background",
            subtitle_style="violet_glow"
        )
        print(f"Rendered: {res['width']}x{res['height']}, duration: {res['duration']:.2f}s, size: {res['file_size_bytes']} bytes")

        # Validate with ffprobe
        v_ok, v_msg, v_meta = validate_rendered_clip(clip_path)
        assert v_ok, f"Rendered clip validation failed: {v_msg}"
        print(f"Validation passed: {v_meta['codec']}, {v_meta['width']}x{v_meta['height']}")

    print("\n=== STAGE 6: ZIP ARCHIVE GENERATION ===")
    zip_path = out_dir / "test_all_clips.zip"
    create_clips_zip(clips_dir, zip_path)
    print(f"ZIP packaging complete at {zip_path} (size: {zip_path.stat().st_size} bytes)")

    print("\n>>> ALL PIPELINE TESTS PASSED 100% SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
