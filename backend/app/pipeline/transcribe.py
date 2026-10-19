import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Callable, Optional
import torch

logger = logging.getLogger(__name__)

# Cached model instance to avoid re-loading weights on every single job
_cached_model = None
_cached_model_key = None

def get_whisper_model(model_size: str = "base", device_pref: str = "cuda"):
    global _cached_model, _cached_model_key
    
    # Check if CUDA is really usable
    use_cuda = device_pref.lower() == "cuda" and torch.cuda.is_available()
    device = "cuda" if use_cuda else "cpu"
    compute_type = "float16" if use_cuda else "int8"
    
    key = f"{model_size}_{device}_{compute_type}"
    if _cached_model is not None and _cached_model_key == key:
        return _cached_model

    from faster_whisper import WhisperModel
    logger.info(f"Loading Faster-Whisper model '{model_size}' on {device} ({compute_type})...")
    
    try:
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        _cached_model = model
        _cached_model_key = key
        return model
    except Exception as e:
        logger.warning(f"Failed to load Faster-Whisper with {device} ({compute_type}): {e}. Falling back to CPU.")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        _cached_model = model
        _cached_model_key = f"{model_size}_cpu_int8"
        return model

def transcribe_video(
    video_path: Path,
    output_json_path: Path,
    total_duration: float,
    model_size: str = "base",
    device_pref: str = "cuda",
    progress_callback: Optional[Callable[[float, str], None]] = None
) -> Dict[str, Any]:
    """
    Transcribes audio from video locally using Faster-Whisper.
    Emits word-level timestamps and saves intermediate JSON.
    """
    # If transcript already exists and is non-empty, load it (recovery feature)
    if output_json_path.exists() and output_json_path.stat().st_size > 100:
        try:
            with open(output_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("segments") and len(data["segments"]) > 0:
                    logger.info("Found existing valid transcript, skipping retranscription.")
                    if progress_callback:
                        progress_callback(100.0, "Loaded existing transcript.")
                    return data
        except Exception:
            pass

    if progress_callback:
        progress_callback(5.0, f"Initializing Whisper '{model_size}' model...")

    model = get_whisper_model(model_size, device_pref)

    if progress_callback:
        progress_callback(15.0, "Transcribing speech and extracting word timestamps...")

    segments_generator, info = model.transcribe(
        str(video_path),
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    detected_language = info.language
    language_prob = info.language_probability
    logger.info(f"Detected speech language: {detected_language} (prob: {language_prob:.2f})")

    segments_list = []
    full_text_parts = []

    for seg in segments_generator:
        seg_dict = {
            "id": seg.id,
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
            "words": [
                {
                    "word": w.word.strip(),
                    "start": round(w.start, 2),
                    "end": round(w.end, 2),
                    "probability": round(w.probability, 2)
                }
                for w in (seg.words or [])
            ]
        }
        segments_list.append(seg_dict)
        full_text_parts.append(seg.text.strip())

        # Update progress based on timestamp reached vs total duration
        if total_duration > 0 and progress_callback:
            # Scale transcription phase between 15% and 95%
            pct = 15.0 + min(80.0, (seg.end / total_duration) * 80.0)
            progress_callback(round(pct, 1), f"Transcribed up to {int(seg.end)}s / {int(total_duration)}s ({seg.text.strip()[:40]}...)")

    full_transcript = " ".join(full_text_parts)

    result = {
        "language": detected_language,
        "language_probability": round(language_prob, 2),
        "duration": total_duration,
        "full_text": full_transcript,
        "segments": segments_list
    }

    # Save to disk immediately
    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    if progress_callback:
        progress_callback(100.0, f"Transcription completed ({len(segments_list)} segments).")

    return result
