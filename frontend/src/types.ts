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

export interface DownloadProgressEvent {
  taskId: string;
  percent: number;
  speed: string;
  eta: string;
  totalBytes: number;
  filename: string;
}

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  duration?: number;
  formatName?: string;
  bitRate?: number;
  video?: {
    codec: string;
    width: number;
    height: number;
    fps?: number;
  };
  audio?: {
    codec: string;
    channels?: number;
    sampleRate?: number;
  } | null;
}

export interface ElectronEnvironment {
  isDesktop: boolean;
  platform: string;
  downloadsDir: string;
  exportsDir: string;
  binaries: {
    ytDlp: boolean;
    ffmpeg: boolean;
    ffprobe: boolean;
    paths: {
      ytDlp: string;
      ffmpeg: string;
      ffprobe: string;
    };
  };
}

export interface ElectronDownloadResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
  taskId?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  metadata?: MediaValidationResult;
}

export interface ElectronReadFileResult {
  success: boolean;
  error?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  buffer?: ArrayBuffer;
}

export interface ElectronAPI {
  isDesktop: boolean;
  getEnvironment: () => Promise<ElectronEnvironment>;
  selectDirectory: () => Promise<string | null>;
  downloadVideo: (options: { url: string; downloadDir?: string }) => Promise<ElectronDownloadResult>;
  cancelDownload: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  onDownloadProgress: (callback: (data: DownloadProgressEvent) => void) => () => void;
  validateMedia: (filePath: string) => Promise<MediaValidationResult>;
  readMediaFile: (filePath: string) => Promise<ElectronReadFileResult>;
  saveClip: (options: { fileName: string; buffer: ArrayBuffer; folderPath?: string }) => Promise<{ success: boolean; savedPath?: string; folderPath?: string; error?: string }>;
  openFolder: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

