from pathlib import Path
from typing import Optional

def escape_ffmpeg_path(path: Path) -> str:
    """
    Escapes a Windows filesystem path for use inside FFmpeg filter strings.
    E.g. E:\dir\file.ass -> E\\:/dir/file.ass
    """
    posix_path = path.as_posix()
    # Escape colon after drive letter: E: -> E\\:
    if len(posix_path) > 1 and posix_path[1] == ":":
        posix_path = posix_path[0] + "\\:" + posix_path[2:]
    # Also escape single quotes and brackets if present
    posix_path = posix_path.replace("'", "'\\''").replace("[", "\\[").replace("]", "\\]")
    return posix_path

def build_filter_graph(
    reframing_mode: str = "blur_background",
    subtitle_ass_path: Optional[Path] = None,
    target_width: int = 1080,
    target_height: int = 1920
) -> str:
    """
    Constructs an FFmpeg complex filter graph or video filter chain
    to transform any source aspect ratio into a flawless 9:16 vertical 1080x1920 video.
    """
    sub_filter = ""
    if subtitle_ass_path and subtitle_ass_path.exists():
        escaped_ass = escape_ffmpeg_path(subtitle_ass_path)
        sub_filter = f",ass='{escaped_ass}'"

    if reframing_mode == "center_crop":
        # Crops center 9:16 aspect ratio from source and scales to 1080x1920
        # If input is wider than 9:16: crop by height * 9 / 16
        # If input is taller than 9:16: crop by width * 16 / 9
        vf = (
            f"crop='if(gt(iw/ih,9/16),ih*9/16,iw)':'if(gt(iw/ih,9/16),ih,iw*16/9)':"
            f"'(in_w-out_w)/2':'(in_h-out_h)/2',"
            f"scale={target_width}:{target_height}:flags=lanczos{sub_filter}"
        )
        return vf
    else:
        # Default: blur_background composition (most professional for 16:9 widescreen content)
        # Background: fills 1080x1920 and is blurred + darkened slightly for contrast
        # Foreground: crisp center-fit video
        vf = (
            f"split=2[bg_raw][fg_raw];"
            f"[bg_raw]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
            f"crop={target_width}:{target_height},"
            f"boxblur=luma_radius=min(h\\,w)/25:luma_power=3,"
            f"eq=brightness=-0.12:contrast=1.05[bg];"
            f"[fg_raw]scale={target_width}:-2:flags=lanczos[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[merged]"
        )
        if sub_filter:
            # Append ass filter to merged stream
            # ass filter without the leading comma
            escaped_ass = escape_ffmpeg_path(subtitle_ass_path)
            vf += f";[merged]ass='{escaped_ass}'[outv]"
        else:
            vf += ";[merged]copy[outv]"
        return vf
