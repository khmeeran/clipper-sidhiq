/**
 * Unified In-Browser Video Clipping Pipeline Orchestrator
 * Executes the complete serverless workflow:
 * Ingestion -> Audio Analysis -> Transcription -> Heuristic Scoring -> Adaptive Selection -> 1080x1920 Vertical Rendering
 */

import JSZip from 'jszip';
import { extractAndAnalyzeAudio } from './audioAnalyzer';
import { transcribeInBrowser, BrowserTranscript } from './transcriptionEngine';
import { discoverCandidatesHeuristically, CandidateClip } from './heuristicIntelligence';
import { adaptivelySelectClips } from './adaptiveSelector';
import { renderVerticalClipInBrowser, RenderResult, RenderOptions } from './verticalRenderer';
import { saveJobToIndexedDB } from './storageManager';

export interface LocalRenderedClip {
  id: string;
  title: string;
  hook: string;
  reason: string;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  hook_strength: number;
  context_completeness: number;
  blob: Blob;
  url: string;
  thumbnailUrl: string;
  file_size_bytes: number;
  width: number;
  height: number;
}

export interface LocalJob {
  id: string;
  filename: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage: 'INGESTING' | 'ANALYZING' | 'TRANSCRIBING' | 'SELECTING' | 'RENDERING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress_percent: number;
  stage_message: string;
  duration: number;
  resolution: string;
  file_size_bytes: number;
  created_at: number;
  completed_at?: number;
  error_message?: string;
  clip_count: number;
  clips: LocalRenderedClip[];
  zipBlob?: Blob;
  zipUrl?: string;
}

export class ClientClipperPipeline {
  private isCancelled = false;

  public cancel() {
    this.isCancelled = true;
  }

  public async run(
    file: File,
    options: {
      reframingMode?: 'blur_background' | 'center_crop';
      subtitleStyle?: 'violet_glow' | 'radiant_gold' | 'clean_white';
      minScore?: number;
    } = {},
    onUpdate?: (job: LocalJob) => void
  ): Promise<LocalJob> {
    this.isCancelled = false;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job: LocalJob = {
      id: jobId,
      filename: file.name,
      status: 'RUNNING',
      stage: 'INGESTING',
      progress_percent: 5,
      stage_message: 'Reading video metadata and preparing browser engine...',
      duration: 0,
      resolution: '',
      file_size_bytes: file.size,
      created_at: Date.now(),
      clip_count: 0,
      clips: []
    };

    const emit = (stage: LocalJob['stage'], pct: number, msg: string, status: LocalJob['status'] = 'RUNNING') => {
      job.stage = stage;
      job.progress_percent = pct;
      job.stage_message = msg;
      job.status = status;
      onUpdate?.({ ...job });
    };

    emit('INGESTING', 5, 'Initializing video container in browser...');

    // 1. Create hidden video element to inspect metadata
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video element in browser.'));
      });

      job.duration = video.duration;
      job.resolution = `${video.videoWidth}x${video.videoHeight}`;

      if (this.isCancelled) throw new Error('Job cancelled by user.');

      // 2. Audio Analysis (Auto-Editor volume envelope & silence gating)
      emit('ANALYZING', 12, 'Analyzing volume envelopes and silence boundaries...');
      const audioResult = await extractAndAnalyzeAudio(file, (pct, msg) => {
        if (this.isCancelled) throw new Error('Job cancelled by user.');
        emit('ANALYZING', 12 + Math.round((pct / 100) * 25), msg);
      });

      if (this.isCancelled) throw new Error('Job cancelled by user.');

      // 3. Dialogue transcription & alignment
      emit('TRANSCRIBING', 40, 'Generating dialogue subtitle segments...');
      const transcript = await transcribeInBrowser(audioResult, video, (pct, msg) => {
        if (this.isCancelled) throw new Error('Job cancelled by user.');
        emit('TRANSCRIBING', 40 + Math.round((pct / 100) * 15), msg);
      });

      if (this.isCancelled) throw new Error('Job cancelled by user.');

      // 4. Heuristic Content Intelligence & Scoring (Ollama-free)
      emit('SELECTING', 58, 'Evaluating hook strength, speech density, and pacing...');
      const candidates = discoverCandidatesHeuristically(audioResult, {
        minDuration: 15.0,
        maxDuration: 75.0,
        minScore: options.minScore || 6.5
      });

      // 5. Adaptive Selection & Deduplication
      emit('SELECTING', 65, 'Deduplicating and adaptively selecting best moments...');
      const selectedClips = adaptivelySelectClips(candidates, {
        minScore: options.minScore || 6.5
      });

      if (selectedClips.length === 0) {
        throw new Error('No candidate segments met quality thresholds. Try a lower minimum score.');
      }

      job.clip_count = selectedClips.length;
      emit('SELECTING', 70, `Selected ${selectedClips.length} standalone moments (Adaptive discovery)`);

      if (this.isCancelled) throw new Error('Job cancelled by user.');

      // 6. In-Browser 1080x1920 Vertical Rendering
      const renderedClips: LocalRenderedClip[] = [];

      for (let i = 0; i < selectedClips.length; i++) {
        if (this.isCancelled) throw new Error('Job cancelled by user.');

        const candidate = selectedClips[i];
        const basePct = 70 + Math.round((i / selectedClips.length) * 25);
        emit(
          'RENDERING',
          basePct,
          `Rendering vertical clip ${i + 1}/${selectedClips.length}: '${candidate.title}' (1080x1920 9:16)...`
        );

        const renderRes = await renderVerticalClipInBrowser(
          video,
          candidate,
          transcript,
          {
            reframingMode: options.reframingMode || 'blur_background',
            subtitleStyle: options.subtitleStyle || 'violet_glow',
            audioBuffer: audioResult.audioBuffer,
            onProgress: (subPct, subMsg) => {
              if (this.isCancelled) throw new Error('Job cancelled by user.');
              const currentStepPct = basePct + Math.round((subPct / 100) * (25 / selectedClips.length));
              emit('RENDERING', Math.min(96, currentStepPct), subMsg);
            }
          }
        );

        renderedClips.push({
          id: candidate.id,
          title: candidate.title,
          hook: candidate.hook,
          reason: candidate.reason,
          start_time: candidate.start_time,
          end_time: candidate.end_time,
          duration: candidate.duration,
          score: candidate.score,
          hook_strength: candidate.hook_strength,
          context_completeness: candidate.context_completeness,
          blob: renderRes.blob,
          url: renderRes.url,
          thumbnailUrl: renderRes.thumbnailUrl,
          file_size_bytes: renderRes.sizeBytes,
          width: renderRes.width,
          height: renderRes.height
        });
      }

      // 7. Bundle ZIP Archive with JSZip
      emit('RENDERING', 97, 'Packaging consolidated ZIP archive...');
      const zip = new JSZip();
      for (const c of renderedClips) {
        const safeTitle = c.title.replace(/[^a-zA-Z0-9_-]/g, '_');
        zip.file(`${safeTitle}_1080x1920.mp4`, c.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);

      job.clips = renderedClips;
      job.zipBlob = zipBlob;
      job.zipUrl = zipUrl;
      job.completed_at = Date.now();

      // Save summary to IndexedDB
      saveJobToIndexedDB({
        id: job.id,
        filename: job.filename,
        duration: job.duration,
        resolution: job.resolution,
        file_size_bytes: job.file_size_bytes,
        clip_count: job.clip_count,
        created_at: job.created_at,
        completed_at: job.completed_at,
        clips: renderedClips.map(c => ({
          id: c.id,
          title: c.title,
          hook: c.hook,
          reason: c.reason,
          duration: c.duration,
          score: c.score,
          thumbnailUrl: c.thumbnailUrl
        }))
      });

      emit('COMPLETED', 100, `Successfully created ${renderedClips.length} vertical 1080x1920 clips!`, 'COMPLETED');
      return job;

    } catch (err: any) {
      if (this.isCancelled) {
        emit('CANCELLED', 0, 'Job was cancelled by user.', 'CANCELLED');
      } else {
        emit('FAILED', 0, `Error: ${err.message || String(err)}`, 'FAILED');
      }
      throw err;
    } finally {
      URL.revokeObjectURL(videoUrl);
    }
  }
}
