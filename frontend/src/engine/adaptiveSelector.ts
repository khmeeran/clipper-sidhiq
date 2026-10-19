/**
 * Adaptive Selection & Deduplication Engine
 * Selects non-redundant, high-quality candidates without arbitrary clip quotas.
 */

import { CandidateClip } from './heuristicIntelligence';

function calculateOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

export function adaptivelySelectClips(
  candidates: CandidateClip[],
  options: {
    minScore?: number;
    maxMergeDuration?: number;
  } = {}
): CandidateClip[] {
  const minScore = options.minScore ?? 6.5;
  const maxMergeDuration = options.maxMergeDuration ?? 75.0;

  if (candidates.length === 0) return [];

  // 1. Filter by minimum score
  let qualified = candidates.filter(c => c.score >= minScore);

  // If strict threshold filters everything, take top 1-2 candidates
  if (qualified.length === 0 && candidates.length > 0) {
    qualified = [candidates[0]];
  }

  // 2. Sort chronologically by start_time
  qualified.sort((a, b) => a.start_time - b.start_time);

  // 3. Deduplicate / Merge overlapping clips
  const selected: CandidateClip[] = [];

  for (const curr of qualified) {
    if (selected.length === 0) {
      selected.push({ ...curr });
      continue;
    }

    const prev = selected[selected.length - 1];
    const overlap = calculateOverlap(prev.start_time, prev.end_time, curr.start_time, curr.end_time);
    const minDur = Math.min(prev.duration, curr.duration);

    // If overlap exceeds 30% of either clip
    if (overlap > 0.3 * minDur) {
      const mergedStart = Math.min(prev.start_time, curr.start_time);
      const mergedEnd = Math.max(prev.end_time, curr.end_time);
      const mergedDur = mergedEnd - mergedStart;

      if (mergedDur <= maxMergeDuration) {
        // Merge into single cohesive clip
        selected[selected.length - 1] = {
          id: `clip_${Math.round(mergedStart)}_${Math.round(mergedEnd)}`,
          start_time: Number(mergedStart.toFixed(1)),
          end_time: Number(mergedEnd.toFixed(1)),
          duration: Number(mergedDur.toFixed(1)),
          title: prev.score >= curr.score ? prev.title : curr.title,
          hook: prev.hook,
          reason: `Merged sequence: ${prev.reason} & ${curr.reason}`,
          hook_strength: Math.max(prev.hook_strength, curr.hook_strength),
          context_completeness: Math.max(prev.context_completeness, curr.context_completeness),
          score: Number(Math.max(prev.score, curr.score).toFixed(1))
        };
      } else {
        // Keep higher scored candidate
        if (curr.score > prev.score) {
          selected[selected.length - 1] = { ...curr };
        }
      }
    } else {
      selected.push({ ...curr });
    }
  }

  // Assign clean sequential IDs
  return selected.map((c, idx) => ({
    ...c,
    id: `clip_${idx + 1}`
  }));
}
