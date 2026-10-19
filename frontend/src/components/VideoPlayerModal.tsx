import React, { useEffect, useRef } from 'react';
import { X, Download, Sparkles } from 'lucide-react';
import { LocalRenderedClip } from '../types';

interface VideoPlayerModalProps {
  clip: LocalRenderedClip;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  clip,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div 
        className="relative bg-[#0e1017] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col md:flex-row overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Player 9:16 vertical view */}
        <div className="bg-black flex items-center justify-center md:w-[420px] p-2 flex-shrink-0">
          <div className="relative aspect-[9/16] w-full max-h-[75vh] rounded-xl overflow-hidden shadow-inner">
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              src={clip.url}
            />
          </div>
        </div>

        {/* Metadata Details */}
        <div className="p-6 flex-1 flex flex-col justify-between overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>★ {clip.score.toFixed(1)} Viral Potential</span>
            </div>

            <h2 className="text-2xl font-bold text-white leading-tight">
              {clip.title}
            </h2>

            {clip.hook && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Hook Opening</span>
                <p className="text-sm text-gray-200 italic">"{clip.hook}"</p>
              </div>
            )}

            {clip.reason && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Explainable Analysis</span>
                <p className="text-sm text-gray-300 leading-relaxed">{clip.reason}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[#12141c] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Duration</span>
                <span className="text-sm font-semibold text-white font-mono">{clip.duration.toFixed(1)}s</span>
              </div>
              <div className="p-3 rounded-xl bg-[#12141c] border border-white/5">
                <span className="text-[11px] text-gray-400 block">Format</span>
                <span className="text-sm font-semibold text-white font-mono">1080 × 1920 (9:16)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <a
              href={clip.url}
              download={`${clip.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_1080x1920.mp4`}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download 1080x1920 MP4</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
