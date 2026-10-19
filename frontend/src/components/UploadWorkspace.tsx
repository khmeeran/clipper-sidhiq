import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Film, 
  Sparkles, 
  Sliders, 
  AlertCircle,
  FileVideo,
  Clock,
  Maximize2,
  HardDrive,
  ShieldCheck,
  Zap,
  Link as LinkIcon,
  Globe,
  ArrowRight,
  Loader2,
  HelpCircle,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Terminal,
  FolderOpen,
  Folder,
  XCircle,
  Monitor,
  Smartphone
} from 'lucide-react';
import { BrowserSystemStatus, ClientSettings, ElectronEnvironment } from '../types';
import { getCachedVideo, saveCachedVideo } from '../engine/storageManager';

interface UploadWorkspaceProps {
  onStartProcessing: (file: File, options: Record<string, any>) => Promise<void>;
  isProcessing: boolean;
  systemStatus: BrowserSystemStatus | null;
  settings: ClientSettings;
}

/**
 * Validates container magic bytes and decodes metadata using HTMLVideoElement.
 * Throws an explicit error if the file is incomplete, corrupted, or not a playable video.
 */
async function validateVideoContainer(blob: Blob): Promise<{ duration: number; width: number; height: number }> {
  if (blob.size < 1024) {
    throw new Error('Downloaded file is smaller than 1 KB and is not a valid video.');
  }

  // 1. Check header magic bytes for MP4 / MOV / WebM / MKV
  const headerSlice = blob.slice(0, 32);
  const headerBuffer = await headerSlice.arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);

  const isWebM = headerBytes[0] === 0x1a && headerBytes[1] === 0x45 && headerBytes[2] === 0xdf && headerBytes[3] === 0xa3;
  const headerStr = Array.from(headerBytes).map(b => String.fromCharCode(b)).join('');
  const isMp4OrMov = headerStr.includes('ftyp') || headerStr.includes('moov') || headerStr.includes('mdat') || headerStr.includes('wide');
  const isRiff = headerStr.startsWith('RIFF');

  if (!isWebM && !isMp4OrMov && !isRiff) {
    throw new Error('Validation failed: Downloaded data does not match a recognized MP4, MOV, WebM, or MKV container signature.');
  }

  // 2. Decode metadata client-side via temporary video element
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(url);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error('Validation failed: Video metadata probe timed out. The file may be truncated or corrupted.'));
    }, 12000);

    const onLoaded = () => {
      clearTimeout(timer);
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanUp();

      if (!duration || isNaN(duration) || duration <= 0) {
        reject(new Error('Validation failed: Video container has 0 duration.'));
      } else if (!width || !height) {
        reject(new Error('Validation failed: Video dimensions could not be parsed.'));
      } else {
        resolve({ duration, width, height });
      }
    };

    const onError = () => {
      clearTimeout(timer);
      cleanUp();
      reject(new Error('Validation failed: Browser media decoder could not parse video frames. Unsupported codec or damaged file.'));
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
    video.src = url;
  });
}

export const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({
  onStartProcessing,
  isProcessing,
  systemStatus,
  settings,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ duration: number; width: number; height: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Ingestion Mode: Local File vs Paste Video URL
  const [uploadMode, setUploadMode] = useState<'local' | 'url'>('local');
  const [videoUrl, setVideoUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ percent: number; loaded: number; total: number } | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<string>('');

  // Desktop Engine Detection & Preferences
  const isDesktop = Boolean(window.electronAPI?.isDesktop);
  const [desktopEnv, setDesktopEnv] = useState<ElectronEnvironment | null>(null);
  const [customDownloadDir, setCustomDownloadDir] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [downloadEta, setDownloadEta] = useState<string>('');
  const [downloadedFilePath, setDownloadedFilePath] = useState<string>('');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getEnvironment().then((env) => {
        setDesktopEnv(env);
        if (env.downloadsDir) setCustomDownloadDir(env.downloadsDir);
      }).catch(console.error);

      const unsubscribe = window.electronAPI.onDownloadProgress((data) => {
        if (data.percent !== undefined) {
          setFetchProgress({
            percent: Math.round(data.percent),
            loaded: data.totalBytes ? Math.round((data.totalBytes * data.percent) / 100) : 0,
            total: data.totalBytes || 0
          });
        }
        if (data.speed) setDownloadSpeed(data.speed);
        if (data.eta) setDownloadEta(data.eta);
        if (data.taskId) setCurrentTaskId(data.taskId);
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  const handleCancelDownload = async () => {
    if (window.electronAPI && currentTaskId) {
      await window.electronAPI.cancelDownload(currentTaskId);
    }
    setIsFetchingUrl(false);
    setCurrentTaskId(null);
    setFetchProgress(null);
    setErrorMessage('Download cancelled.');
  };

  const handleSelectFolder = async () => {
    if (window.electronAPI) {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        setCustomDownloadDir(selected);
      }
    }
  };

  const handleOpenFolder = async (target?: string) => {
    if (window.electronAPI) {
      await window.electronAPI.openFolder(target || customDownloadDir || desktopEnv?.downloadsDir || '');
    }
  };

  // Downloaded File Local Persistence & State
  const [downloadedBlob, setDownloadedBlob] = useState<Blob | null>(null);
  const [downloadedFilename, setDownloadedFilename] = useState<string>('');
  const [isDownloadedFromUrl, setIsDownloadedFromUrl] = useState(false);
  const [isCachedDownload, setIsCachedDownload] = useState(false);

  // YouTube Guidance & Architecture Proposal State (Web fallback)
  const [youtubeGuidance, setYoutubeGuidance] = useState<{ url: string; videoId?: string } | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Custom job preferences
  const [reframingMode, setReframingMode] = useState<'blur_background' | 'center_crop'>(settings.reframing_mode || 'blur_background');
  const [subtitleStyle, setSubtitleStyle] = useState<'violet_glow' | 'radiant_gold' | 'clean_white'>(settings.subtitle_style || 'violet_glow');
  const [minClipScore, setMinClipScore] = useState<number>(settings.min_clip_score || 7.5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFetchUrl = async (e?: React.FormEvent, autoStart = false) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setYoutubeGuidance(null);
    const trimmed = videoUrl.trim();

    if (!trimmed) {
      setErrorMessage('Please enter a video URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMessage('Please enter a valid URL starting with http:// or https://');
      return;
    }

    // ----------------------------------------------------
    // 1. DESKTOP MODE: Native Local Ingestion via Bundled Binaries
    // ----------------------------------------------------
    if (window.electronAPI?.isDesktop) {
      setIsFetchingUrl(true);
      setFetchProgress({ percent: 0, loaded: 0, total: 0 });
      setDownloadSpeed('Initializing downloader...');
      setDownloadEta('');
      setIsCachedDownload(false);

      try {
        const res = await window.electronAPI.downloadVideo({
          url: trimmed,
          downloadDir: customDownloadDir || desktopEnv?.downloadsDir
        });

        if (res.cancelled) {
          setIsFetchingUrl(false);
          setCurrentTaskId(null);
          setFetchProgress(null);
          setErrorMessage('Download cancelled.');
          return;
        }

        if (!res.success || !res.filePath) {
          throw new Error(res.error || 'Failed to download video.');
        }

        setCurrentTaskId(null);
        setDownloadedFilePath(res.filePath);
        setDownloadedFilename(res.fileName || 'downloaded_video.mp4');
        setIsDownloadedFromUrl(true);

        // Read file bytes into ArrayBuffer
        const fileRes = await window.electronAPI.readMediaFile(res.filePath);
        if (!fileRes.success || !fileRes.buffer) {
          throw new Error(fileRes.error || 'Failed to read downloaded video file into memory.');
        }

        const file = new File([fileRes.buffer], res.fileName || 'video.mp4', { type: 'video/mp4' });
        setSelectedFile(file);

        if (res.metadata?.valid && res.metadata.video) {
          setVideoPreview({
            duration: res.metadata.duration || 0,
            width: res.metadata.video.width,
            height: res.metadata.video.height
          });
        }

        setVideoUrl('');

        if (autoStart) {
          await onStartProcessing(file, {
            reframingMode,
            subtitleStyle,
            minScore: minClipScore
          });
        }
      } catch (err: any) {
        console.error('Desktop URL download failed:', err);
        setSelectedFile(null);
        setIsDownloadedFromUrl(false);
        setErrorMessage(err.message || 'Desktop video download failed.');
      } finally {
        setIsFetchingUrl(false);
        setFetchProgress(null);
      }
      return;
    }

    // ----------------------------------------------------
    // 2. WEB BROWSER / VERCEL MODE (Static Web Logic)
    // ----------------------------------------------------
    const lower = trimmed.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      let videoId = '';
      try {
        if (lower.includes('youtu.be/')) {
          videoId = trimmed.split('youtu.be/')[1].split(/[?#]/)[0];
        } else if (lower.includes('watch?v=') || lower.includes('watch/')) {
          const match = trimmed.match(/[?&]v=([^&#]+)/);
          if (match) videoId = match[1];
        }
      } catch (_) {}
      setYoutubeGuidance({ url: trimmed, videoId });
      return;
    }

    if (['vimeo.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'facebook.com'].some(d => lower.includes(d))) {
      setErrorMessage(
        'Social and streaming platform links restrict direct browser media access (CORS & DRM). Please download the video file locally and use the Local File Upload tab.'
      );
      return;
    }

    // 1. Check local IndexedDB cache to avoid duplicate downloads
    try {
      const cached = await getCachedVideo(trimmed);
      if (cached && cached.blob && cached.blob.size > 1024) {
        setIsFetchingUrl(true);
        const metadata = await validateVideoContainer(cached.blob);
        const file = new File([cached.blob], cached.filename, { type: cached.mimeType || 'video/mp4' });
        setDownloadedBlob(cached.blob);
        setDownloadedFilename(cached.filename);
        setIsDownloadedFromUrl(true);
        setIsCachedDownload(true);
        setSelectedFile(file);
        setVideoPreview(metadata);
        setIsFetchingUrl(false);
        return;
      }
    } catch (cErr) {
      console.warn('Cache check bypassed:', cErr);
    }

    setIsFetchingUrl(true);
    setFetchProgress(null);
    setDownloadSpeed('');
    setIsCachedDownload(false);

    const downloadStartTime = performance.now();

    try {
      const response = await fetch(trimmed, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status} (${response.statusText || 'Error'}). Please verify the link or file permissions.`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const hasVideoExt = /\.(mp4|mov|webm|mkv|avi|m4v)(\?.*)?$/i.test(trimmed);
      if (contentType && !contentType.startsWith('video/') && !contentType.includes('octet-stream') && !hasVideoExt) {
        throw new Error(
          `The provided URL returned content type '${contentType}', which does not appear to be a direct video stream. Ensure this is a direct link to an MP4, MOV, or WebM file.`
        );
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loadedBytes += value.length;
            const elapsedSec = (performance.now() - downloadStartTime) / 1000;
            const speed = elapsedSec > 0 ? (loadedBytes / (1024 * 1024)) / elapsedSec : 0;
            const pct = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
            setFetchProgress({ percent: pct, loaded: loadedBytes, total: totalBytes });
            setDownloadSpeed(`${speed.toFixed(1)} MB/s`);
          }
        }
      } else {
        const buffer = await response.arrayBuffer();
        chunks.push(new Uint8Array(buffer));
        loadedBytes = buffer.byteLength;
      }

      // 1. Minimum Size Check
      if (loadedBytes < 1024) {
        throw new Error('Downloaded file is smaller than 1 KB and is not a valid video.');
      }

      // Extract filename from URL
      let filename = 'downloaded_video.mp4';
      try {
        const urlObj = new URL(trimmed);
        const namePart = urlObj.pathname.split('/').pop();
        if (namePart && namePart.includes('.')) {
          filename = decodeURIComponent(namePart.split('?')[0]);
        }
      } catch (_) {}

      const inferredMime = contentType.startsWith('video/') ? contentType : 'video/mp4';
      const blob = new Blob(chunks as any, { type: inferredMime });

      // 2. Validate Container Integrity & Browser Decoding Before Handing to Pipeline
      const metadata = await validateVideoContainer(blob);

      // 3. Save Persistent Copy in IndexedDB Cache
      await saveCachedVideo({
        url: trimmed,
        filename,
        blob,
        size: loadedBytes,
        mimeType: inferredMime,
        cachedAt: Date.now()
      });

      // 4. Construct local File object and populate workspace
      const file = new File([blob], filename, { type: inferredMime });
      setDownloadedBlob(blob);
      setDownloadedFilename(filename);
      setIsDownloadedFromUrl(true);
      setSelectedFile(file);
      setVideoPreview(metadata);
      setVideoUrl('');
    } catch (err: any) {
      console.error('URL video download failed:', err);
      // Incomplete or failed downloads must NEVER enter the processing pipeline
      setSelectedFile(null);
      setDownloadedBlob(null);
      setIsDownloadedFromUrl(false);

      if (err.name === 'TypeError' && err.message?.toLowerCase().includes('failed to fetch')) {
        setErrorMessage(
          'Browser CORS Blocked: The remote server hosting this video does not send cross-origin headers (Access-Control-Allow-Origin). Modern web browsers block client-side reading for security. Fallback: Download the file to your computer and use the Local File Upload tab.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to download or validate video from the specified URL.');
      }
    } finally {
      setIsFetchingUrl(false);
      setFetchProgress(null);
    }
  };

  const handleSaveDiskCopy = () => {
    if (!downloadedBlob) return;
    const url = URL.createObjectURL(downloadedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadedFilename || 'downloaded_video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setYoutubeGuidance(null);
    setIsDownloadedFromUrl(false);
    setDownloadedBlob(null);
    const validExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setErrorMessage(`Unsupported format '${ext}'. Please select MP4, MOV, MKV, or WebM.`);
      return;
    }

    setSelectedFile(file);

    // Read video duration and dimensions client-side immediately
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoPreview({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      setVideoPreview(null);
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    await onStartProcessing(selectedFile, {
      reframingMode,
      subtitleStyle,
      minScore: minClipScore,
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>AI Video Clipping Studio • 100% On-Device Processing</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Turn Long Videos Into{' '}
          <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
            Ready-to-Share Clips
          </span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Transform your podcasts, interviews, and long videos into engaging vertical clips for YouTube Shorts, Instagram Reels, and TikTok — fast, private, and rendered directly on your device.
        </p>
      </div>

      {/* Ingestion Mode Selector Tabs */}
      {!selectedFile && (
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1 rounded-xl bg-[#0e1017] border border-white/5 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setUploadMode('local');
                setErrorMessage(null);
                setYoutubeGuidance(null);
              }}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
                uploadMode === 'local'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Local File Upload</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUploadMode('url');
                setErrorMessage(null);
              }}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
                uploadMode === 'url'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Paste Video URL</span>
            </button>
          </div>
        </div>
      )}

      {/* YouTube Link Guidance Notice */}
      {youtubeGuidance && !selectedFile && (
        <div data-testid="youtube-guidance-panel" className="rounded-2xl p-6 bg-[#13151f] border border-purple-500/30 space-y-4 shadow-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">YouTube Link Notice</h4>
                <p className="text-xs text-gray-400">Target URL: <span className="text-purple-300 font-mono truncate max-w-xs sm:max-w-md inline-block align-bottom">{youtubeGuidance.url}</span></p>
              </div>
            </div>
            <button
              onClick={() => setYoutubeGuidance(null)}
              className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs text-gray-300 leading-relaxed">
            <p className="font-semibold text-purple-300">Why YouTube links require a local video file in web browsers:</p>
            <p className="text-gray-400">
              YouTube streams video and audio as separate dynamic data chunks rather than a single static file, and web browsers prevent direct media downloading to protect video content.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-3">
            <div className="flex items-center space-x-2 text-xs text-purple-200 font-medium">
              <Check className="w-4 h-4 text-cyan-400" />
              <span>Two Simple Ways to Process This Video:</span>
            </div>
            <div className="space-y-2 text-xs text-gray-300 pl-1">
              <p>
                <strong className="text-white">1. Desktop App:</strong> In <span className="text-purple-300 font-semibold">Clipper Sidhiq Desktop</span>, videos download automatically with one click.
              </p>
              <p>
                <strong className="text-white">2. Web Browser:</strong> Save the video file to your computer first, then drop it into the <button type="button" onClick={() => { setYoutubeGuidance(null); setUploadMode('local'); }} className="text-cyan-400 hover:underline font-semibold">Local File Upload</button> tab.
              </p>
            </div>
            <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-400">
              <span className="text-[11px] text-gray-500">Need help saving a copy? You can also use the companion tool:</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`python tools/fetch_youtube.py "${youtubeGuidance.url}"`);
                  setCopiedCommand(true);
                  setTimeout(() => setCopiedCommand(false), 2500);
                }}
                className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-sans text-xs flex items-center space-x-1 transition-colors border border-purple-500/30 flex-shrink-0"
              >
                {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCommand ? 'Copied helper!' : 'Copy helper command'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Video Ingestion Card */}
      {uploadMode === 'url' && !selectedFile && !youtubeGuidance && (
        <div className="rounded-2xl p-8 bg-[#0e1017] border border-white/10 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              {isDesktop ? <Monitor className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
            </div>
            <h3 className="text-lg font-semibold text-white">
              {isDesktop ? 'Desktop Video Downloader & Clipper' : 'Direct Video URL Ingestion'}
            </h3>
            <p className="text-xs text-gray-400 max-w-lg mx-auto">
              {isDesktop
                ? 'Paste any supported video URL (YouTube, Vimeo, TikTok, direct MP4). The bundled engine downloads the media locally on your machine and runs the clipping pipeline.'
                : 'Provide a direct link to an MP4, MOV, or WebM file. The video is fetched directly by your browser into local memory with zero cloud servers.'}
            </p>
          </div>

          {/* Desktop Destination Folder Picker */}
          {isDesktop && (
            <div className="max-w-2xl mx-auto flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-400">
              <div className="flex items-center space-x-2 truncate mr-2">
                <Folder className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="truncate">
                  Save Folder: <code className="text-gray-200 font-mono">{customDownloadDir || desktopEnv?.downloadsDir || 'ClipperSidhiq_Downloads'}</code>
                </span>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={isFetchingUrl}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  title="Choose a different folder for downloaded videos"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenFolder()}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-cyan-200 flex items-center space-x-1 transition-colors"
                  title="Open folder in Windows Explorer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={(e) => handleFetchUrl(e, isDesktop)} className="space-y-4 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={
                    isDesktop
                      ? 'https://www.youtube.com/watch?v=... or direct MP4 link'
                      : 'https://example.com/sample_video.mp4'
                  }
                  disabled={isFetchingUrl}
                  className="w-full pl-10 pr-4 py-3 bg-[#141620] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                />
              </div>

              {isDesktop ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleFetchUrl(e, true)}
                    disabled={isFetchingUrl || !videoUrl.trim()}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Download video locally and immediately start generating vertical clips"
                  >
                    {isFetchingUrl ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-cyan-300" />
                        <span>Download and Create Clips</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleFetchUrl(e, false)}
                    disabled={isFetchingUrl || !videoUrl.trim()}
                    className="px-3.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Download and validate file locally without immediately auto-clipping"
                  >
                    Fetch Only
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isFetchingUrl || !videoUrl.trim()}
                  className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isFetchingUrl ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <span>Fetch Video</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Fetch Progress Bar */}
            {isFetchingUrl && (
              <div className="space-y-3 p-4 rounded-xl bg-[#141620] border border-purple-500/20">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    <span className="text-purple-300 font-medium">
                      {isDesktop ? 'Downloading video via bundled yt-dlp...' : 'Downloading video into browser memory...'}
                    </span>
                  </div>

                  {isDesktop && (
                    <button
                      type="button"
                      onClick={handleCancelDownload}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                      title="Abort the current download process"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Download</span>
                    </button>
                  )}
                </div>

                <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 h-full transition-all duration-150"
                    style={{ width: `${fetchProgress?.percent || 5}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                  <span>
                    {fetchProgress && fetchProgress.total > 0
                      ? `${fetchProgress.percent}% (${formatBytes(fetchProgress.loaded)} / ${formatBytes(fetchProgress.total)})`
                      : `${fetchProgress?.percent || 0}%`}
                  </span>
                  {downloadSpeed && <span className="text-cyan-300">Speed: {downloadSpeed}</span>}
                  {downloadEta && <span className="text-purple-300">ETA: {downloadEta}</span>}
                </div>
              </div>
            )}

            {/* Capability & Sources Notes */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs text-gray-400">
              <div className="flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-gray-300 font-medium">
                    {isDesktop ? 'Desktop Supported Sources:' : 'Supported URL Types:'}
                  </p>
                  {isDesktop ? (
                    <p className="text-gray-400 leading-relaxed">
                      YouTube (standard videos & Shorts), Vimeo, TikTok, Twitch, Facebook, Twitter, and direct links to MP4/MOV/WebM. Files are saved locally to your device and validated with FFprobe before vertical clipping.
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-400 leading-relaxed">
                        Direct media links to <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">.mp4</code>, <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">.mov</code>, or <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">.webm</code> hosted on CORS-permissive servers.
                      </p>
                      <p className="text-gray-500 pt-1 leading-relaxed">
                        <strong className="text-gray-400">Streaming Platforms:</strong> YouTube, Vimeo, Instagram, and TikTok block browser fetching via CORS and DRM. To process content from those platforms, download the file to your computer first and use the <strong>Local File Upload</strong> tab.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Local Upload Box or Selected Video Configuration */}
      {(uploadMode === 'local' || selectedFile) && (
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer ${
          dragActive
            ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
            : selectedFile
            ? 'border-white/10 bg-[#12141c]'
            : 'border-white/10 hover:border-purple-500/50 hover:bg-[#12141c]/50 bg-[#0e1017]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.mkv,.webm,.avi,.m4v"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {!selectedFile ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">
                Drag & drop your source video here, or <span className="text-purple-400 hover:underline">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                Supports MP4, MOV, MKV, WebM • 100% private: video never leaves your browser
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <FileVideo className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base truncate max-w-md">{selectedFile.name}</h3>
                  <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
                    <span>{formatBytes(selectedFile.size)}</span>
                    {videoPreview && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{formatDuration(videoPreview.duration)}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Maximize2 className="w-3 h-3 text-gray-400" />
                          <span>{videoPreview.width}x{videoPreview.height}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isDownloadedFromUrl && downloadedBlob && (
                  <button
                    type="button"
                    onClick={handleSaveDiskCopy}
                    className="text-xs text-purple-300 hover:text-white px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 flex items-center space-x-1.5 transition-colors"
                    title="Save this downloaded video permanently to your disk"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Copy to Disk</span>
                  </button>
                )}

                {downloadedFilePath && (
                  <button
                    type="button"
                    onClick={() => handleOpenFolder(downloadedFilePath)}
                    className="text-xs text-cyan-300 hover:text-white px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 flex items-center space-x-1.5 transition-colors"
                    title="Show original downloaded file in Windows Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Show in Explorer</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setVideoPreview(null);
                    setDownloadedBlob(null);
                    setIsDownloadedFromUrl(false);
                  }}
                  className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Change File
                </button>
              </div>
            </div>

            {/* Downloaded from URL Validation Banner */}
            {isDownloadedFromUrl && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center space-x-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  {isCachedDownload
                    ? 'Reused from validated local device storage (zero duplicate download).'
                    : 'Download completed & validated. Video is stored locally on your device and ready for clipping.'}
                </span>
              </div>
            )}

            {/* Quick Production Options */}
            <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Reframing Style (9:16 Vertical)
                </label>
                <select
                  value={reframingMode}
                  onChange={(e) => setReframingMode(e.target.value as any)}
                  className="w-full bg-[#181a24] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="blur_background">Blurred Canvas (Recommended for 16:9)</option>
                  <option value="center_crop">Center Crop (Direct 9:16)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Captions Theme
                </label>
                <select
                  value={subtitleStyle}
                  onChange={(e) => setSubtitleStyle(e.target.value as any)}
                  className="w-full bg-[#181a24] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="violet_glow">Electric Violet (High Contrast)</option>
                  <option value="radiant_gold">Radiant Gold / Yellow</option>
                  <option value="clean_white">Clean Minimal White</option>
                </select>
              </div>
            </div>

            {/* Adaptive Threshold Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1 font-medium"
              >
                <Sliders className="w-3 h-3" />
                <span>{showAdvanced ? 'Hide Discovery Threshold' : 'Tune Quality Threshold'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 rounded-xl bg-[#181a24] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">Minimum Viral Score</span>
                    <span className="font-mono text-purple-400 font-bold">{minClipScore.toFixed(1)} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="5.0"
                    max="9.0"
                    step="0.1"
                    value={minClipScore}
                    onChange={(e) => setMinClipScore(parseFloat(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-gray-500">
                    Lower values extract more candidate moments; higher values filter for top punchy highlights only.
                  </p>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-base shadow-lg shadow-purple-600/25 flex items-center justify-center space-x-2.5 transition-all duration-150 active:scale-[0.99] disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5 text-purple-200" />
                <span>Find My Best Clips (Process In-Browser)</span>
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          {uploadMode === 'url' && (
            <button
              type="button"
              onClick={() => {
                setUploadMode('local');
                setErrorMessage(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-500/30 whitespace-nowrap transition-colors flex-shrink-0"
            >
              Switch to Local Upload
            </button>
          )}
        </div>
      )}

      {/* Premium How It Works Section — Pure Plain English, Zero Jargon */}
      <section className="pt-10 border-t border-white/5 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>How It Works</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Turn Long Videos into Ready-to-Share Clips
          </h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            A straightforward, four-step process to transform your footage into engaging vertical content.
          </p>
        </div>

        {/* 4 Step Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 hover:border-purple-500/30 transition-all duration-200 space-y-3 group shadow-lg">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white/5 text-purple-300 border border-white/5">
                01
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                Step 1 — Add Your Video
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1.5">
                Upload a video from your device or paste a supported video link.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 hover:border-cyan-500/30 transition-all duration-200 space-y-3 group shadow-lg">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white/5 text-cyan-300 border border-white/5">
                02
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                Step 2 — Find the Best Moments
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1.5">
                Clipper analyzes the video and identifies promising moments worth clipping.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 hover:border-indigo-500/30 transition-all duration-200 space-y-3 group shadow-lg">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white/5 text-indigo-300 border border-white/5">
                03
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                Step 3 — Create Vertical Clips
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1.5">
                Your selected moments are transformed into vertical videos ready for Shorts, Reels, and other platforms.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 hover:border-emerald-500/30 transition-all duration-200 space-y-3 group shadow-lg">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform">
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white/5 text-emerald-300 border border-white/5">
                04
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                Step 4 — Download and Share
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1.5">
                Preview your clips, download them individually, or export them together.
              </p>
            </div>
          </div>
        </div>

        {/* Clear Privacy Statement based on actual implementation */}
        <div className="p-5 rounded-2xl bg-[#0b0e14] border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5 sm:mt-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">100% Private On-Device Processing</h4>
              <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
                Your video files and clips remain entirely on your device. All clip discovery and vertical video creation happen locally in your browser or desktop app with zero cloud servers.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 self-end sm:self-center">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-medium border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Zero Cloud Upload</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
