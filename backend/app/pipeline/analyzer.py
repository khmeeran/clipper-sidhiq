import json
import logging
import re
from typing import List, Dict, Any, Callable, Optional
import httpx

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an elite video editor and viral short-form content producer.
Your goal is to identify the most compelling, standalone moments from a video transcript to turn into viral vertical clips (TikTok, Instagram Reels, YouTube Shorts).

A great short clip must have:
1. A strong, immediate hook in the first 3 seconds (provocative question, shocking statement, high emotion, humor, or deep insight).
2. Complete standalone context: The viewer must understand the setup, the core point, and the resolution/payoff without needing to watch the rest of the video.
3. Natural duration: Ideal length is between 20 and 75 seconds (minimum 15s, maximum 90s). Never cut off mid-thought or mid-sentence!

Cultural context: Be culturally aware of global and Indian contexts (Cricket, school, pocket money, films, tech, hustle, humor, life lessons).

CRITICAL: You must return ONLY a valid JSON object matching this exact format:
{
  "candidates": [
    {
      "start_time": 12.5,
      "end_time": 58.0,
      "title": "Punchy 3-5 Word Title",
      "hook": "The opening 1-line statement that hooks the viewer",
      "reason": "Clear explanation of why this moment works well standalone",
      "hook_strength": 8.5,
      "context_completeness": 9.0,
      "score": 8.8
    }
  ]
}

No chat, no explanation, no markdown text outside the JSON.
"""

def extract_json_from_llm(raw_text: str) -> Optional[Dict[str, Any]]:
    """Robustly extracts JSON from LLM output even if wrapped in markdown or conversational chatter."""
    text = raw_text.strip()
    
    # Check for markdown code blocks
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if json_match:
        text = json_match.group(1).strip()
    
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    
    # Try finding outer braces { ... }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(text[first_brace:last_brace+1])
        except Exception:
            pass

    return None

async def query_ollama(
    base_url: str,
    model: str,
    prompt: str,
    system_prompt: str = SYSTEM_PROMPT,
    timeout: float = 120.0
) -> str:
    """Send a structured completion request to local Ollama instance."""
    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            "num_predict": 2048
        }
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")

def chunk_transcript(segments: List[Dict[str, Any]], chunk_duration: float = 240.0, overlap: float = 40.0) -> List[List[Dict[str, Any]]]:
    """
    Breaks a long list of segments into overlapping chunks of ~4 minutes with 40s overlap.
    Ensures long videos (e.g. 1-6 hours) are analyzed safely without hitting LLM context limits.
    """
    if not segments:
        return []
    
    total_duration = segments[-1]["end"]
    if total_duration <= chunk_duration:
        return [segments]

    chunks = []
    current_chunk = []
    chunk_start = 0.0

    for seg in segments:
        current_chunk.append(seg)
        if seg["end"] - chunk_start >= chunk_duration:
            chunks.append(current_chunk)
            # Find start for next chunk incorporating overlap
            next_start_target = seg["end"] - overlap
            current_chunk = [s for s in current_chunk if s["end"] >= next_start_target]
            chunk_start = current_chunk[0]["start"] if current_chunk else seg["end"]

    if current_chunk and (not chunks or current_chunk != chunks[-1]):
        chunks.append(current_chunk)

    return chunks

def format_segments_for_llm(segments: List[Dict[str, Any]]) -> str:
    """Formats transcript segments with precise timestamps for the LLM."""
    lines = []
    for s in segments:
        start_min = int(s['start'] // 60)
        start_sec = int(s['start'] % 60)
        end_min = int(s['end'] // 60)
        end_sec = int(s['end'] % 60)
        time_tag = f"[{start_min:02d}:{start_sec:02d} -> {end_min:02d}:{end_sec:02d}] ({s['start']:.1f}s - {s['end']:.1f}s)"
        lines.append(f"{time_tag}: {s['text']}")
    return "\n".join(lines)

def heuristic_fallback_candidates(segments: List[Dict[str, Any]], total_duration: float) -> List[Dict[str, Any]]:
    """Fallback candidate generation if Ollama fails or transcript has minimal dialogue."""
    candidates = []
    if not segments:
        # Fallback to evenly spaced 30s clips
        num_clips = max(1, min(4, int(total_duration // 60)))
        step = total_duration / (num_clips + 1)
        for i in range(num_clips):
            st = max(0.0, (i + 1) * step - 15.0)
            en = min(total_duration, st + 35.0)
            candidates.append({
                "start_time": round(st, 1),
                "end_time": round(en, 1),
                "title": f"Key Moment #{i+1}",
                "hook": "Highlights from video",
                "reason": "Automated visual highlight fallback",
                "hook_strength": 7.0,
                "context_completeness": 7.0,
                "score": 7.0
            })
        return candidates

    # Group segments into ~30-45s blocks
    accum_text = []
    block_start = segments[0]["start"]
    for seg in segments:
        accum_text.append(seg["text"])
        curr_dur = seg["end"] - block_start
        if curr_dur >= 30.0 or seg == segments[-1]:
            combined_text = " ".join(accum_text)
            candidates.append({
                "start_time": round(block_start, 1),
                "end_time": round(seg["end"], 1),
                "title": f"Highlight ({int(block_start)}s - {int(seg['end'])}s)",
                "hook": accum_text[0][:60] + "...",
                "reason": "Identified high dialogue density sequence",
                "hook_strength": 7.2,
                "context_completeness": 7.5,
                "score": 7.3
            })
            accum_text = []
            block_start = seg["end"]

    return candidates

async def analyze_transcript(
    transcript_data: Dict[str, Any],
    ollama_url: str = "http://127.0.0.1:11434",
    model: str = "llama3.2:3b",
    progress_callback: Optional[Callable[[float, str], None]] = None
) -> List[Dict[str, Any]]:
    """
    Orchestrates transcript chunking, Ollama LLM candidate generation,
    schema validation, and fallback handling.
    """
    segments = transcript_data.get("segments", [])
    total_duration = transcript_data.get("duration", 0.0)

    if not segments or total_duration < 10.0:
        logger.warning("Very few or no segments in transcript. Using heuristic generator.")
        return heuristic_fallback_candidates(segments, total_duration)

    chunks = chunk_transcript(segments)
    all_raw_candidates = []

    if progress_callback:
        progress_callback(10.0, f"Analyzing transcript across {len(chunks)} contextual section(s)...")

    for idx, chunk in enumerate(chunks):
        chunk_text = format_segments_for_llm(chunk)
        prompt = f"""Below is a timestamped section of the video transcript:

{chunk_text}

Analyze this section and find all standalone viral moments that meet the criteria.
Remember:
- Start and end timestamps must strictly align with actual spoken sentences shown above.
- Clip duration must be between 15s and 90s.
- Evaluate each candidate with a realistic quality score (1-10).
- Return ONLY valid JSON with 'candidates' array.
"""
        pct = 10.0 + ((idx + 1) / len(chunks)) * 80.0
        if progress_callback:
            progress_callback(round(pct, 1), f"Ollama analyzing section {idx+1}/{len(chunks)} with {model}...")

        try:
            raw_response = await query_ollama(ollama_url, model, prompt)
            parsed = extract_json_from_llm(raw_response)
            if parsed and isinstance(parsed.get("candidates"), list):
                for c in parsed["candidates"]:
                    try:
                        st = float(c.get("start_time", 0))
                        en = float(c.get("end_time", 0))
                        dur = en - st
                        if 12.0 <= dur <= 120.0 and en <= total_duration + 2.0:
                            all_raw_candidates.append({
                                "start_time": max(0.0, round(st, 1)),
                                "end_time": min(total_duration, round(en, 1)),
                                "title": str(c.get("title", f"Clip at {int(st)}s")).strip()[:70],
                                "hook": str(c.get("hook", "")).strip()[:150],
                                "reason": str(c.get("reason", "Engaging standalone moment")).strip()[:250],
                                "hook_strength": float(c.get("hook_strength", 7.0)),
                                "context_completeness": float(c.get("context_completeness", 7.0)),
                                "score": float(c.get("score", 7.0))
                            })
                    except Exception as err:
                        logger.warning(f"Error parsing candidate: {err}")
            else:
                logger.warning(f"Failed to parse candidates from chunk {idx+1}")
        except Exception as e:
            logger.error(f"Error querying Ollama on chunk {idx+1}: {e}")

    # If Ollama didn't return valid candidates, use heuristic fallback
    if not all_raw_candidates:
        logger.info("Ollama yielded 0 candidates, using heuristic fallback generator.")
        all_raw_candidates = heuristic_fallback_candidates(segments, total_duration)

    if progress_callback:
        progress_callback(100.0, f"Identified {len(all_raw_candidates)} potential candidate moments.")

    return all_raw_candidates
