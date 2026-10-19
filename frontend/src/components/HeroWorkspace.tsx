import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Link2, 
  UploadCloud, 
  ArrowRight, 
  Film, 
  ShieldCheck, 
  Clipboard, 
  AlertCircle,
  FileVideo,
  X,
  Play
} from 'lucide-react';
import { BridgeStatus } from '../api/bridgeClient';

interface HeroWorkspaceProps {
  onSubmitUrl: (url: string) => void;
  onUploadFile: (file: File) => void;
  bridgeStatus: BridgeStatus | null;
  onOpenHowItWorks: () => void;
}

export const HeroWorkspace: React.FC<HeroWorkspaceProps> = ({
  onSubmitUrl,
  onUploadFile,
  bridgeStatus,
  onOpenHowItWorks
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    const trimmed = urlInput.trim();

    if (!trimmed) {
      setErrorMessage('Please paste a video URL.');
      return;
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setErrorMessage('Please enter a valid URL starting with http:// or https://');
      return;
    }

    onSubmitUrl(trimmed);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        setErrorMessage(null);
      }
    } catch (_) {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setShowUploadModal(false);
      onUploadFile(file);
    }
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
      const file = e.dataTransfer.files[0];
      setShowUploadModal(false);
      onUploadFile(file);
    }
  };

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
      {/* Top Pill */}
      <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-semibold mb-6 shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>Automated Meaningful Moment Selection & 9:16 Vertical Reframing</span>
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
        Turn Long Videos Into <br />
        <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
          Ready-to-Share Clips.
        </span>
      </h1>

      {/* Supporting Copy */}
      <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
        Turn long videos into short, meaningful vertical clips with timestamped transcripts and downloadable subtitles — using a simple workflow.
      </p>

      {/* Primary Ingestion Form */}
      <div className="max-w-3xl mx-auto mb-8">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-2xl sm:rounded-3xl bg-[#11131b] border-2 border-white/10 hover:border-violet-500/40 focus-within:border-violet-500 transition-all p-2 sm:p-2.5 shadow-2xl shadow-violet-950/20 flex flex-col sm:flex-row items-center gap-2"
        >
          <div className="flex items-center space-x-3 w-full pl-3 pr-2 py-2 sm:py-0">
            <Link2 className="w-5 h-5 text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder="Paste YouTube, Shorts, or video link..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none"
            />
            {urlInput ? (
              <button
                type="button"
                onClick={() => setUrlInput('')}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePaste}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto shrink-0 flex items-center justify-center space-x-2 px-7 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-[0.99]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create My Clips</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-center space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Secondary Action: Upload Video File */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
          <span>Or have a file ready?</span>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all"
          >
            <UploadCloud className="w-4 h-4 text-cyan-400" />
            <span>Upload a Video</span>
          </button>

          <span className="text-gray-600">•</span>

          {/* Quick Benchmark Video Button */}
          <button
            type="button"
            onClick={() => {
              setUrlInput('https://www.youtube.com/watch?v=1$vs100M_Cars');
              onSubmitUrl('https://www.youtube.com/watch?v=1$vs100M_Cars');
            }}
            className="inline-flex items-center space-x-1.5 text-violet-400 hover:text-violet-300 underline font-semibold transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Test with Benchmark Video ($1 vs $100M Car)</span>
          </button>
        </div>
      </div>

      {/* Honest Privacy Guarantee Note */}
      <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-gray-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>100% processed locally on your device via GPU/CPU acceleration. No video is ever uploaded to external cloud storage.</span>
      </div>

      {/* Upload Modal / Dropzone */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#11131b] border border-white/10 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <FileVideo className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Select Local Video</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/15 hover:border-violet-500/50 bg-white/[0.02]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
              <div className="font-bold text-white text-sm mb-1">
                Drag and drop your MP4, MOV, or WebM here
              </div>
              <div className="text-xs text-gray-400">
                Or click to browse files on your device
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
