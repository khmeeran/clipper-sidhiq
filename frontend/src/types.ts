export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type JobStage =
  | 'QUEUED'
  | 'INGESTING'
  | 'ANALYZING'
  | 'TRANSCRIBING'
  | 'SELECTING'
  | 'RENDERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

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
  blob?: Blob;
  url: string;
  thumbnailUrl: string;
  file_size_bytes?: number;
  width?: number;
  height?: number;
}

export interface LocalJob {
  id: string;
  filename: string;
  status: JobStatus;
  stage: JobStage;
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

export interface BrowserSystemStatus {
  webCodecsSupported: boolean;
  webAudioSupported: boolean;
  speechRecognitionSupported: boolean;
  storageUsageMB: number;
  storageQuotaMB: number;
  storagePercentUsed: number;
  engine: string;
}

export interface ClientSettings {
  reframing_mode: 'blur_background' | 'center_crop';
  subtitle_style: 'violet_glow' | 'radiant_gold' | 'clean_white';
  min_clip_score: number;
  margin_v: number;
  retention_hours: number;
}
