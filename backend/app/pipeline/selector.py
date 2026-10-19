import uuid
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def calculate_overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """Calculate the overlap duration in seconds between two time intervals."""
    overlap_start = max(a_start, b_start)
    overlap_end = min(a_end, b_end)
    return max(0.0, overlap_end - overlap_start)

def adaptive_selection(
    candidates: List[Dict[str, Any]],
    job_id: str,
    min_score: float = 6.5,
    max_duration: float = 90.0,
    min_duration: float = 12.0
) -> List[Dict[str, Any]]:
    """
    Filters, deduplicates, and adaptively selects candidate moments.
    No hard-coded count: returns whatever number of genuine, high-quality clips qualify.
    """
    if not candidates:
        return []

    # 1. Filter out clips below minimum score and duration bounds
    valid = []
    for c in candidates:
        duration = c["end_time"] - c["start_time"]
        if duration < min_duration or duration > max_duration:
            continue
        if c.get("score", 0.0) < min_score:
            continue
        valid.append(c)

    # If strict min_score filtered everything, lower slightly to top candidates so user gets results
    if not valid and candidates:
        candidates_sorted = sorted(candidates, key=lambda x: x.get("score", 0), reverse=True)
        valid = candidates_sorted[:max(1, min(3, len(candidates_sorted)))]

    # 2. Sort candidates by start_time
    valid.sort(key=lambda x: x["start_time"])

    # 3. Deduplicate / Merge overlapping candidates
    selected: List[Dict[str, Any]] = []

    for curr in valid:
        if not selected:
            selected.append(curr)
            continue

        prev = selected[-1]
        overlap_sec = calculate_overlap(prev["start_time"], prev["end_time"], curr["start_time"], curr["end_time"])
        prev_dur = prev["end_time"] - prev["start_time"]
        curr_dur = curr["end_time"] - curr["start_time"]

        # If overlap is > 30% of either clip
        if overlap_sec > 0.3 * min(prev_dur, curr_dur):
            # Can they be merged cleanly into a single clip under max_duration?
            merged_start = min(prev["start_time"], curr["start_time"])
            merged_end = max(prev["end_time"], curr["end_time"])
            merged_dur = merged_end - merged_start

            if merged_dur <= max_duration:
                # Merge into a unified moment
                selected[-1] = {
                    "start_time": merged_start,
                    "end_time": merged_end,
                    "title": prev["title"] if prev.get("score", 0) >= curr.get("score", 0) else curr["title"],
                    "hook": prev["hook"] or curr["hook"],
                    "reason": f"Merged coherent segment: {prev.get('reason', '')} / {curr.get('reason', '')}",
                    "hook_strength": max(prev.get("hook_strength", 0), curr.get("hook_strength", 0)),
                    "context_completeness": max(prev.get("context_completeness", 0), curr.get("context_completeness", 0)),
                    "score": round(max(prev.get("score", 0), curr.get("score", 0)), 1)
                }
            else:
                # Keep the one with higher score
                if curr.get("score", 0) > prev.get("score", 0):
                    selected[-1] = curr
        else:
            selected.append(curr)

    # 4. Finalize clip objects with IDs and durations
    final_clips = []
    for idx, c in enumerate(selected):
        dur = round(c["end_time"] - c["start_time"], 1)
        clip_id = f"clip_{job_id[:8]}_{idx+1}_{uuid.uuid4().hex[:4]}"
        final_clips.append({
            "id": clip_id,
            "job_id": job_id,
            "title": c["title"],
            "hook": c.get("hook", ""),
            "reason": c.get("reason", ""),
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "duration": dur,
            "score": c.get("score", 7.0),
            "hook_strength": c.get("hook_strength", 7.0),
            "context_completeness": c.get("context_completeness", 7.0),
            "rendered": 0,
            "output_path": "",
            "thumbnail_path": ""
        })

    logger.info(f"Adaptive selection chose {len(final_clips)} clips for job {job_id}")
    return final_clips
