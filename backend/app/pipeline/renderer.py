import subprocess
import json
import logging
import zipfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Tuple
from .reframer import build_filter_graph
from .subtitles import generate_ass_subtitles
from .ingest import generate_thumbnail

logger = logging.getLogger(__name__)

def validate_rendered_clip(clip_path: Path, expected_min_duration: float = 3.0) -> Tuple[bool, str, Dict[str, Any]]:
    """Validates that rendered MP4 is compliant with vertical 1080x1920 specs."""
    if not clip_path.exists() or clip_path.stat().st_size < 10000:
        return False, "Rendered file does not exist or is too small.", {}

    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "stream=width,height,codec_name,codec_type,duration:format=duration,size",
        "-of", "json",
        str(clip_path)
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(res.stdout)
    except Exception as e:
        return False, f"FFprobe validation error: {e}", {}

    streams = data.get("streams", [])
    format_info = data.get("format", {})

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video_stream:
        return False, "No video stream in rendered MP4.", {}

    w = int(video_stream.get("width", 0))
    h = int(video_stream.get("height", 0))
    codec = video_stream.get("codec_name", "")
    dur = float(format_info.get("duration", 0.0))

    if w != 1080 or h != 1920:
        return False, f"Incorrect dimensions: {w}x{h} (expected 1080x1920).", {}

    if codec not in ["h264", "avc1"]:
        return False, f"Unexpected video codec: {codec} (expected H.264).", {}

    if dur < expected_min_duration:
        return False, f"Clip duration too short: {dur:.1f}s.", {}

    return True, "Valid vertical MP4", {
        "width": w,
        "height": h,
        "duration": dur,
        "codec": codec,
        "size_bytes": clip_path.stat().st_size
    }


def render_single_clip(
    source_video_path: Path,
    output_clip_path: Path,
    output_thumbnail_path: Path,
    clip_info: Dict[str, Any],
    transcript_data: Optional[Dict[str, Any]] = None,
    reframing_mode: str = "blur_background",
    subtitle_style: str = "violet_glow",
    subtitle_margin_v: int = 400
) -> Dict[str, Any]:
    """
    Renders an individual clip to 1080x1920 vertical MP4 with subtitles and thumbnail.
    """
    output_clip_path.parent.mkdir(parents=True, exist_ok=True)
    start_time = clip_info["start_time"]
    end_time = clip_info["end_time"]
    clip_duration = end_time - start_time

    # Generate ASS subtitles if transcript is available
    ass_path = output_clip_path.with_suffix(".ass")
    has_subs = False
    if transcript_data and transcript_data.get("segments"):
        has_subs = generate_ass_subtitles(
            transcript_data=transcript_data,
            clip_start=start_time,
            clip_end=end_time,
            output_ass_path=ass_path,
            style_name=subtitle_style,
            margin_v=subtitle_margin_v
        )

    # Build filter
    filter_expr = build_filter_graph(
        reframing_mode=reframing_mode,
        subtitle_ass_path=ass_path if has_subs else None
    )

    # FFmpeg command
    # Use accurate seeking before input (-ss) and duration (-t)
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start_time),
        "-t", str(clip_duration),
        "-i", str(source_video_path)
    ]

    if reframing_mode == "center_crop":
        cmd += ["-vf", filter_expr]
    else:
        cmd += ["-filter_complex", filter_expr, "-map", "[outv]", "-map", "0:a?"]

    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_clip_path)
    ]

    logger.info(f"Rendering clip '{clip_info['title']}' ({start_time}s -> {end_time}s)...")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        logger.error(f"FFmpeg render error: {result.stderr}")
        raise RuntimeError(f"FFmpeg failed rendering clip {clip_info['id']}: {result.stderr[-400:]}")

    # Validate output
    valid, msg, meta = validate_rendered_clip(output_clip_path)
    if not valid:
        raise ValueError(f"Rendered clip failed validation: {msg}")

    # Generate clip thumbnail from the middle of the vertical clip
    mid_ts = min(1.5, clip_duration / 2.0)
    generate_thumbnail(output_clip_path, output_thumbnail_path, timestamp=mid_ts)

    # Cleanup temporary ASS file
    if ass_path.exists():
        try:
            ass_path.unlink()
        except Exception:
            pass

    return {
        "output_path": str(output_clip_path),
        "thumbnail_path": str(output_thumbnail_path),
        "file_size_bytes": meta["size_bytes"],
        "duration": meta["duration"],
        "width": meta["width"],
        "height": meta["height"]
    }

def create_clips_zip(clips_dir: Path, zip_output_path: Path) -> Path:
    """Creates a clean ZIP archive of all rendered MP4 clips."""
    zip_output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for mp4_file in clips_dir.glob("*.mp4"):
            zf.write(mp4_file, arcname=mp4_file.name)
    return zip_output_path
