import subprocess
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

def extract_metadata(video_path: Path) -> Dict[str, Any]:
    """Extract stream and container metadata from video file using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "stream=index,codec_type,codec_name,width,height,r_frame_rate,duration,bit_rate:format=duration,size,bit_rate,format_name",
        "-of", "json",
        str(video_path)
    ]
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(result.stdout)
    except Exception as e:
        logger.error(f"FFprobe failed on {video_path}: {e}")
        raise ValueError(f"Could not read media metadata: {e}")

    streams = data.get("streams", [])
    format_info = data.get("format", {})

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if not video_stream:
        raise ValueError("No video stream found in uploaded media.")

    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    # FPS calculation
    fps_str = video_stream.get("r_frame_rate", "30/1")
    try:
        num, den = fps_str.split("/")
        fps = round(float(num) / float(den), 2)
    except Exception:
        fps = 30.0

    # Duration calculation
    duration_str = format_info.get("duration") or video_stream.get("duration") or "0"
    try:
        duration = float(duration_str)
    except Exception:
        duration = 0.0

    size_bytes = int(format_info.get("size", video_path.stat().st_size if video_path.exists() else 0))

    return {
        "width": width,
        "height": height,
        "resolution": f"{width}x{height}",
        "fps": fps,
        "duration": duration,
        "file_size_bytes": size_bytes,
        "video_codec": video_stream.get("codec_name", "unknown"),
        "has_audio": audio_stream is not None,
        "audio_codec": audio_stream.get("codec_name", "none") if audio_stream else "none",
        "format_name": format_info.get("format_name", "unknown")
    }

def generate_thumbnail(video_path: Path, output_thumbnail: Path, timestamp: float = 2.0) -> bool:
    """Generate a clean thumbnail frame from the video at a given timestamp."""
    output_thumbnail.parent.mkdir(parents=True, exist_ok=True)
    
    # Try specified timestamp, fallback to 0.5s if video is shorter
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(timestamp),
        "-i", str(video_path),
        "-vframes", "1",
        "-vf", "scale='min(720,iw)':-2",
        "-q:v", "3",
        str(output_thumbnail)
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return output_thumbnail.exists()
    except subprocess.CalledProcessError:
        # Fallback to 0.0s
        try:
            cmd[2] = "0.0"
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            return output_thumbnail.exists()
        except Exception as e:
            logger.error(f"Failed to generate thumbnail: {e}")
            return False

def validate_video(video_path: Path) -> Tuple[bool, str, Dict[str, Any]]:
    """Validate that the file is a playable video with adequate duration."""
    if not video_path.exists():
        return False, "Video file does not exist on disk.", {}

    if video_path.stat().st_size < 1000:
        return False, "File is too small or empty to be a valid video.", {}

    try:
        meta = extract_metadata(video_path)
    except Exception as e:
        return False, f"Failed media validation: {str(e)}", {}

    if meta["duration"] < 3.0:
        return False, f"Video is too short ({meta['duration']:.1f}s). Must be at least 3 seconds.", meta

    return True, "Valid video", meta
