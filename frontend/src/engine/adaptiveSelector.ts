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
    maxClips?: number;
  } = {}
): CandidateClip[] {
  const minScore = options.minScore ?? 6.5;
  const maxMergeDuration = options.maxMergeDuration ?? 45.0; // Strictly under 60s
  const maxClips = options.maxClips ?? 2; // Target 2 clips

  if (candidates.length === 0) return [];

  // 1. Filter by minimum score
  let qualified = candidates.filter(c => c.score >= minScore);

  // If strict threshold filters everything, take top candidates up to maxClips
  if (qualified.length === 0 && candidates.length > 0) {
    qualified = candidates.slice(0, Math.min(maxClips, candidates.length));
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

      // Only merge if within maxMergeDuration AND will not eliminate desired multi-clip diversity
      if (mergedDur <= maxMergeDuration && selected.length >= maxClips) {
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
        // If not merging, keep higher scored candidate if replacing the last one, or add if distinct
        if (curr.score > prev.score && selected.length === 1 && qualified.length === 1) {
          selected[selected.length - 1] = { ...curr };
        }
      }
    } else {
      if (selected.length < maxClips) {
        selected.push({ ...curr });
      }
    }
  }

  // If only 1 clip was selected but it is >= 20s and maxClips >= 2,
  // split into 2 high-energy punchy clips under 60 seconds each
  if (selected.length === 1 && maxClips >= 2 && selected[0].duration >= 20.0) {
    const orig = selected[0];
    const halfDur = Number((orig.duration / 2).toFixed(1));
    const clip1End = Number((orig.start_time + Math.min(18.0, halfDur)).toFixed(1));
    const clip2Start = Number((orig.start_time + Math.max(halfDur, orig.duration - 18.0)).toFixed(1));
    const clip2End = orig.end_time;
    
    selected.length = 0;
    selected.push({
      ...orig,
      id: 'clip_1',
      start_time: orig.start_time,
      end_time: clip1End,
      duration: Number((clip1End - orig.start_time).toFixed(1)),
      title: `${orig.title} (Part 1)`,
      hook: orig.hook,
      score: orig.score
    });
    selected.push({
      ...orig,
      id: 'clip_2',
      start_time: clip2Start,
      end_time: clip2End,
      duration: Number((clip2End - clip2Start).toFixed(1)),
      title: `${orig.title} (Part 2)`,
      hook: 'Continuation & climax',
      score: Number(Math.max(6.5, orig.score - 0.2).toFixed(1))
    });
  }

  // 4. Enforce maxClips limit
  const limited = selected.slice(0, maxClips);

  // 5. Ensure all selected clips are strictly under 60 seconds
  for (const c of limited) {
    if (c.duration >= 60.0) {
      c.end_time = Number((c.start_time + 59.0).toFixed(1));
      c.duration = 59.0;
    }
  }

  // Assign clean sequential IDs
  return limited.map((c, idx) => ({
    ...c,
    id: `clip_${idx + 1}`
  }));
}
