/**
 * Clipper Sidhiq — Bridge Client API
 * Communicates with the local companion bridge server at http://127.0.0.1:4175
 */

const BRIDGE_BASE_URL = 'http://127.0.0.1:4175';

export interface BridgeClip {
  id: string;
  title: string;
  fileName: string;
  filePath?: string;
  start?: number;
  end?: number;
  duration: number;
  width: number;
  height: number;
  aspect: string;
  sizeBytes?: number;
  sizeMB?: number | string;
}

export interface PipelineJob {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage: 'DOWNLOADING' | 'TRANSCRIBING' | 'FINDING_MOMENTS' | 'RENDERING_CLIPS' | 'PREPARING_DOWNLOADS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stageMessage: string;
  percent: number;
  speed?: string;
  eta?: string;
  folder?: string;
  videoName?: string;
  clips?: BridgeClip[];
  transcriptTxt?: string | null;
  transcriptSrt?: string | null;
  zipFile?: string | null;
  zipSizeMB?: number;
  error?: string | null;
}

export interface CompletedProject {
  id: string;
  folder: string;
  videoName: string;
  status: string;
  created_at: number;
  clips: BridgeClip[];
  transcriptTxt: string | null;
  transcriptSrt: string | null;
  zipFile: string | null;
}

export interface BridgeStatus {
  online: boolean;
  binaries?: {
    ytDlp: boolean;
    ffmpeg: boolean;
    ffprobe: boolean;
    python: boolean;
    node: boolean;
  };
}

export async function checkBridgeHealth(): Promise<BridgeStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BRIDGE_BASE_URL}/api/handshake`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { online: true, binaries: data.binaries };
    }
  } catch (_) {}
  return { online: false };
}

export async function startCreateClipsPipeline(url: string, localFilePath?: string): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/create-clips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, localFile: localFilePath })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to connect to local companion bridge.' };
  }
}

export async function getPipelineJobStatus(jobId: string): Promise<{ ok: boolean; job?: PipelineJob; error?: string }> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/pipeline-job/${encodeURIComponent(jobId)}`);
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function cancelPipelineJob(jobId: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/cancel-job/${encodeURIComponent(jobId)}`, { method: 'POST' });
    return await res.json();
  } catch (_) {
    return { ok: false };
  }
}

export async function getCompletedProjectsList(): Promise<CompletedProject[]> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/history`);
    if (res.ok) {
      const data = await res.json();
      return data.projects || [];
    }
  } catch (_) {}
  return [];
}

export async function fetchTranscriptText(folder: string, fileName: string): Promise<string> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/transcript-content/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`);
    if (res.ok) {
      const data = await res.json();
      return data.content || '';
    }
  } catch (_) {}
  return '';
}

export function getAssetUrl(folder: string, fileName: string, isDownload = false): string {
  const encFolder = encodeURIComponent(folder);
  const encFile = encodeURIComponent(fileName);
  return `${BRIDGE_BASE_URL}/api/asset/${encFolder}/${encFile}${isDownload ? '?download=1' : ''}`;
}

export async function uploadLocalFileToBridge(file: File): Promise<{ ok: boolean; filePath?: string; fileName?: string; error?: string }> {
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'x-file-name': encodeURIComponent(file.name),
        'Content-Type': file.type || 'video/mp4'
      },
      body: file
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
