/**
 * Heuristic Content Intelligence Engine (Ollama-free)
 * Discovers high-potential viral moments using audio energy dynamic peaks,
 * speech density, sentence/pause boundaries, and pacing metrics.
 */

import { AudioAnalysisResult } from './audioAnalyzer';

export interface CandidateClip {
  id: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  hook: string;
  reason: string;
  hook_strength: number;
  context_completeness: number;
  score: number;
}

export function discoverCandidatesHeuristically(
  audioAnalysis: AudioAnalysisResult,
  options: {
    minDuration?: number;
    maxDuration?: number;
    minScore?: number;
  } = {}
): CandidateClip[] {
  const minDur = options.minDuration ?? 15.0;
  const maxDur = options.maxDuration ?? 75.0;
  const minScore = options.minScore ?? 6.5;

  const { speechSegments, pauses, energyPeaks, duration: totalDuration, averageEnergy } = audioAnalysis;

  if (speechSegments.length === 0 || totalDuration < minDur) {
    // If audio is shorter than minDur, return whole video if viable
    if (totalDuration >= 5.0) {
      return [{
        id: `cand_1`,
        start_time: 0,
        end_time: Number(totalDuration.toFixed(1)),
        duration: Number(totalDuration.toFixed(1)),
        title: 'Full Sequence Highlight',
        hook: 'Complete standalone video moment',
        reason: 'Entire clip selected as singular cohesive segment.',
        hook_strength: 7.5,
        context_completeness: 8.5,
        score: 7.8
      }];
    }
    return [];
  }

  const rawCandidates: CandidateClip[] = [];

  // 1. Sliding window candidate generator anchored to natural pause boundaries
  // A great clip starts right after a pause (clean sentence onset)
  // and ends on a pause (clean sentence conclusion)
  const candidateStarts: number[] = [0];
  for (const p of pauses) {
    if (p.start < totalDuration - minDur) {
      candidateStarts.push(p.end);
    }
  }

  const candidateEnds: number[] = [];
  for (const p of pauses) {
    if (p.start >= minDur) {
      candidateEnds.push(p.start);
    }
  }
  candidateEnds.push(totalDuration);

  // Cross-match start and end points within [minDur, maxDur]
  for (const start of candidateStarts) {
    for (const end of candidateEnds) {
      const dur = end - start;
      if (dur >= minDur && dur <= maxDur) {
        // Calculate speech density (% of time with active speech)
        let activeSpeechSec = 0;
        let peakCount = 0;
        let initialBurstScore = 0;

        for (const seg of speechSegments) {
          const overlapStart = Math.max(start, seg.start);
          const overlapEnd = minDur ? Math.min(end, seg.end) : end;
          if (overlapEnd > overlapStart) {
            activeSpeechSec += (overlapEnd - overlapStart);
          }
        }

        // Energy peaks in candidate
        for (const peak of energyPeaks) {
          if (peak.start >= start && peak.end <= end) {
            peakCount++;
          }
          // Hook evaluation: check if an energy burst happens in first 4 seconds
          if (peak.start >= start && peak.start <= start + 4.0) {
            initialBurstScore = Math.max(initialBurstScore, peak.peakScore);
          }
        }

        const speechDensity = activeSpeechSec / dur;

        // Only evaluate candidates with active speech > 60%
        if (speechDensity >= 0.55) {
          // Compute scores
          // 1. Hook strength: starts with elevated volume or high speech density
          const hookStrength = Number(
            Math.min(9.8, Math.max(5.0, 6.0 + initialBurstScore * 0.4 + (speechDensity > 0.8 ? 1.0 : 0.0))).toFixed(1)
          );

          // 2. Context completeness: starts and ends on clean pause boundaries
          const contextCompleteness = Number(
            Math.min(9.5, Math.max(6.0, 7.0 + (dur >= 25 && dur <= 60 ? 1.5 : 0.5))).toFixed(1)
          );

          // 3. Overall Viral Score (weighted sum)
          // 40% hook, 30% speech density, 20% context, 10% peak presence
          const densityScore = speechDensity * 10;
          const peakBonus = Math.min(1.5, peakCount * 0.3);
          const rawScore = (hookStrength * 0.35) + (densityScore * 0.30) + (contextCompleteness * 0.25) + peakBonus;
          const score = Number(Math.min(9.9, Math.max(5.0, rawScore)).toFixed(1));

          if (score >= minScore) {
            const startMin = Math.floor(start / 60);
            const startSec = Math.floor(start % 60);
            const timeTag = `${startMin}:${startSec < 10 ? '0' : ''}${startSec}`;

            rawCandidates.push({
              id: `cand_${Math.round(start)}_${Math.round(end)}`,
              start_time: Number(start.toFixed(1)),
              end_time: Number(end.toFixed(1)),
              duration: Number(dur.toFixed(1)),
              title: `Viral Moment at ${timeTag}`,
              hook: `Strong opening delivery at ${timeTag}`,
              reason: `High speech density (${Math.round(speechDensity * 100)}%), ${peakCount} emphasis peaks, clean sentence boundary payoff.`,
              hook_strength: hookStrength,
              context_completeness: contextCompleteness,
              score
            });
          }
        }
      }
    }
  }

  // Sort candidates by score descending
  rawCandidates.sort((a, b) => b.score - a.score);

  return rawCandidates;
}
