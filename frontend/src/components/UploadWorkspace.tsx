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
  Zap
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
  
  // Custom job preferences
  const [reframingMode, setReframingMode] = useState<'blur_background' | 'center_crop'>(settings.reframing_mode || 'blur_background');
  const [subtitleStyle, setSubtitleStyle] = useState<'violet_glow' | 'radiant_gold' | 'clean_white'>(settings.subtitle_style || 'violet_glow');
  const [minClipScore, setMinClipScore] = useState<number>(settings.min_clip_score || 6.5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      {/* Upload Box */}
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

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
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
