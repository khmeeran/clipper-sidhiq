import os
import re
from pathlib import Path
from typing import List, Dict, Any

def format_ass_timestamp(seconds: float) -> str:
    """Format seconds into ASS timestamp format: H:MM:SS.cs"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        s += 1
        cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def get_style_colors(style_name: str) -> Dict[str, str]:
    """Returns ASS color codes for primary, highlight, and outline."""
    # ASS colors are in &HAABBGGRR format
    styles = {
        "violet_glow": {
            "primary": "&H00FFFFFF",      # Crisp White
            "highlight": "&H00FF55B0",    # Electric Violet/Pink
            "outline": "&H0010091A",      # Deep dark violet outline
            "outline_width": "3.5",
            "shadow": "2.0"
        },
        "radiant_gold": {
            "primary": "&H0000FFFF",      # Radiant Gold/Yellow
            "highlight": "&H00FFFFFF",    # White
            "outline": "&H00000000",      # Pure black
            "outline_width": "3.5",
            "shadow": "2.0"
        },
        "clean_white": {
            "primary": "&H00FFFFFF",      # Clean White
            "highlight": "&H0000E5FF",    # Bright Cyan
            "outline": "&H00000000",      # Pure black
            "outline_width": "3.5",
            "shadow": "2.0"
        }
    }
    return styles.get(style_name, styles["violet_glow"])

def generate_ass_subtitles(
    transcript_data: Dict[str, Any],
    clip_start: float,
    clip_end: float,
    output_ass_path: Path,
    style_name: str = "violet_glow",
    margin_v: int = 400
) -> bool:
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file synchronized
    with the speech segments for the specified clip time window.
    Timestamps are zero-indexed relative to clip_start.
    """
    colors = get_style_colors(style_name)
    output_ass_path.parent.mkdir(parents=True, exist_ok=True)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,54,{colors['primary']},&H000000FF,{colors['outline']},&H80000000,-1,0,0,0,100,100,1.5,0,1,{colors['outline_width']},{colors['shadow']},2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines = []
    segments = transcript_data.get("segments", [])

    for seg in segments:
        s_start = seg["start"]
        s_end = seg["end"]

        # Check if segment overlaps with clip
        if s_end <= clip_start or s_start >= clip_end:
            continue

        words = seg.get("words", [])
        if words:
            # Group words into short punchy bursts (3-5 words)
            chunk_size = 4
            for i in range(0, len(words), chunk_size):
                w_chunk = words[i:i+chunk_size]
                if not w_chunk:
                    continue

                w_start = w_chunk[0]["start"]
                w_end = w_chunk[-1]["end"]

                if w_end <= clip_start or w_start >= clip_end:
                    continue

                # Relative timestamps for the clip
                rel_start = max(0.0, w_start - clip_start)
                rel_end = max(rel_start + 0.3, min(clip_end - clip_start, w_end - clip_start))

                start_str = format_ass_timestamp(rel_start)
                end_str = format_ass_timestamp(rel_end)

                phrase = " ".join([w["word"].upper() for w in w_chunk])
                # Escape ASS special chars
                phrase = phrase.replace("\\", "").replace("{", "").replace("}", "")

                dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{phrase}")
        else:
            # Fallback to whole segment text
            rel_start = max(0.0, s_start - clip_start)
            rel_end = max(rel_start + 0.5, min(clip_end - clip_start, s_end - clip_start))
            start_str = format_ass_timestamp(rel_start)
            end_str = format_ass_timestamp(rel_end)
            text = seg["text"].strip().upper().replace("\\", "").replace("{", "").replace("}", "")
            dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}")

    full_content = header + "\n".join(dialogue_lines) + "\n"
    
    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(full_content)

    return True
