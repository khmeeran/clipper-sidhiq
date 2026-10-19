import React, { useState, useRef } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { BrowserSystemStatus, ClientSettings } from '../types';

interface UploadWorkspaceProps {
  onStartProcessing: (file: File, options: Record<string, any>) => Promise<void>;
  isProcessing: boolean;
  systemStatus: BrowserSystemStatus | null;
  settings: ClientSettings;
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

  // Custom job preferences
  const [reframingMode, setReframingMode] = useState<'blur_background' | 'center_crop'>(settings.reframing_mode || 'blur_background');
  const [subtitleStyle, setSubtitleStyle] = useState<'violet_glow' | 'radiant_gold' | 'clean_white'>(settings.subtitle_style || 'violet_glow');
  const [minClipScore, setMinClipScore] = useState<number>(settings.min_clip_score || 6.5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFetchUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    const trimmed = videoUrl.trim();

    if (!trimmed) {
      setErrorMessage('Please enter a video URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMessage('Please enter a valid URL starting with http:// or https://');
      return;
    }

    const lower = trimmed.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      setErrorMessage(
        'YouTube watch URLs are streaming webpages, not direct video files. Modern web browsers cannot fetch raw YouTube streams directly due to platform security and CORS. Please download the video file to your computer first and use the Local File Upload tab.'
      );
      return;
    }

    if (['vimeo.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'facebook.com'].some(d => lower.includes(d))) {
      setErrorMessage(
        'Social and video streaming platforms restrict direct browser media access (CORS & DRM). Please download the video file locally and use the Local File Upload tab.'
      );
      return;
    }

    setIsFetchingUrl(true);
    setFetchProgress(null);

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
            const pct = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
            setFetchProgress({ percent: pct, loaded: loadedBytes, total: totalBytes });
          }
        }
      } else {
        const buffer = await response.arrayBuffer();
        chunks.push(new Uint8Array(buffer));
        loadedBytes = buffer.byteLength;
      }

      if (loadedBytes < 1024) {
        throw new Error('The downloaded file is less than 1 KB and is not a valid video.');
      }

      // Extract filename from URL
      let filename = 'remote_video.mp4';
      try {
        const urlObj = new URL(trimmed);
        const namePart = urlObj.pathname.split('/').pop();
        if (namePart && namePart.includes('.')) {
          filename = decodeURIComponent(namePart.split('?')[0]);
        }
      } catch (_) {}

      const inferredMime = contentType.startsWith('video/') ? contentType : 'video/mp4';
      const file = new File(chunks as any, filename, { type: inferredMime });

      handleFileSelect(file);
      setVideoUrl('');
    } catch (err: any) {
      console.error('URL video fetch failed:', err);
      if (err.name === 'TypeError' && err.message?.toLowerCase().includes('failed to fetch')) {
        setErrorMessage(
          'Browser CORS Blocked: The remote server hosting this video does not allow cross-origin requests from other web pages. Modern browsers block this for security. Fallback: Download the video file to your computer and use the Local File Upload tab.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to retrieve video from the specified URL.');
      }
    } finally {
      setIsFetchingUrl(false);
      setFetchProgress(null);
    }
  };

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
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
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% In-Browser Engine • Zero Cloud Upload • Vercel Accessible</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Turn Long Videos Into <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Moments That Matter</span>
        </h1>
        <p className="text-gray-400 text-base max-w-2xl mx-auto">
          Speech envelope analysis, silence gating, intelligent viral moment discovery, and 9:16 vertical reframing — rendered directly on your device.
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

      {/* URL Video Ingestion Card */}
      {uploadMode === 'url' && !selectedFile && (
        <div className="rounded-2xl p-8 bg-[#0e1017] border border-white/10 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white">Direct Video URL Ingestion</h3>
            <p className="text-xs text-gray-400 max-w-lg mx-auto">
              Provide a direct link to an MP4, MOV, or WebM file. The video is fetched directly by your browser into local memory with zero cloud servers.
            </p>
          </div>

          <form onSubmit={handleFetchUrl} className="space-y-4 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/sample_video.mp4"
                  disabled={isFetchingUrl}
                  className="w-full pl-10 pr-4 py-3 bg-[#141620] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                />
              </div>

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
            </div>

            {/* Fetch Progress Bar */}
            {isFetchingUrl && (
              <div className="space-y-2 p-4 rounded-xl bg-[#141620] border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300 font-medium">Downloading video into browser memory...</span>
                  <span className="font-mono text-gray-400">
                    {fetchProgress && fetchProgress.total > 0
                      ? `${fetchProgress.percent}% (${formatBytes(fetchProgress.loaded)} / ${formatBytes(fetchProgress.total)})`
                      : fetchProgress
                      ? `${formatBytes(fetchProgress.loaded)} received`
                      : 'Connecting...'}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-150"
                    style={{ width: `${fetchProgress?.percent || 25}%` }}
                  />
                </div>
              </div>
            )}

            {/* Capability & CORS Notes */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs text-gray-400">
              <div className="flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-gray-300 font-medium">Supported URL Types:</p>
                  <p className="text-gray-400 leading-relaxed">
                    Direct media links to <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">.mp4</code>, <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">.mov</code>, or <code className="text-purple-300 bg-white/5 px-1 py-0.5 rounded">.webm</code> hosted on CORS-permissive servers (e.g. AWS S3, Cloudflare R2, GitHub releases, open web archives, public CDNs).
                  </p>
                  <p className="text-gray-500 pt-1 leading-relaxed">
                    <strong className="text-gray-400">Streaming Platforms:</strong> YouTube, Vimeo, Instagram, and TikTok block browser fetching via CORS and DRM. To process content from those platforms, download the file to your computer first and use the <strong>Local File Upload</strong> tab.
                  </p>
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

              <button
                onClick={() => {
                  setSelectedFile(null);
                  setVideoPreview(null);
                }}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Change File
              </button>
            </div>

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

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-sm text-white">Browser-Native WebCodecs</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Renders exact 1080x1920 MP4s using client GPU acceleration. Zero server or cloud fees.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-sm text-white">Adaptive Discovery</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Speech density & energy peaks dictate clips. Returns 3 strong clips or 20+ when justified.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <HardDrive className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-sm text-white">100% Client Privacy</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Your footage never leaves your device. Hostable on Vercel and accessible anywhere.
          </p>
        </div>
      </div>
    </div>
  );
};
