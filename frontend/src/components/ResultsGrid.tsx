import React, { useState } from 'react';
import { 
  Play, 
  Download, 
  Archive, 
  Trash2, 
  Sparkles, 
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import { LocalJob, LocalRenderedClip } from '../types';

interface ResultsGridProps {
  job: LocalJob;
  clips: LocalRenderedClip[];
  onPlayClip: (clip: LocalRenderedClip) => void;
  onClearJob: (jobId: string) => void;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({
  job,
  clips,
  onPlayClip,
  onClearJob,
}) => {
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);

  const toggleExpand = (clipId: string) => {
    setExpandedClipId(expandedClipId === clipId ? null : clipId);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-8">
      {/* Retention & Header Banner */}
      <div className="p-6 rounded-2xl bg-[#10121a] border border-white/5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>In-Browser AI Results • {clips.length} Clips Discovered</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              {job.filename}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {job.zipUrl && (
              <a
                href={job.zipUrl}
                download={`${job.filename.replace(/[^a-zA-Z0-9_-]/g, '_')}_all_clips.zip`}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 flex items-center space-x-2 transition-all active:scale-[0.98]"
              >
                <Archive className="w-4 h-4" />
                <span>Download All (ZIP)</span>
              </a>
            )}

            <button
              onClick={() => onClearJob(job.id)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 transition-colors"
              title="Clear job from local browser storage"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Client Storage Status */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              All clips generated locally on your device in portrait <strong className="text-gray-200">1080 × 1920 (9:16)</strong> format.
            </span>
          </div>
          <span className="text-[11px] text-gray-500">Zero cloud upload</span>
        </div>
      </div>

      {/* Grid of 9:16 Vertical Video Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {clips.map((clip) => {
          const isExpanded = expandedClipId === clip.id;
          const scoreColor = clip.score >= 8.5 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-purple-300 border-purple-500/30 bg-purple-500/10';

          return (
            <div
              key={clip.id}
              className="rounded-2xl bg-[#0f1118] border border-white/5 hover:border-purple-500/30 transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-lg"
            >
              {/* Vertical 9:16 Thumbnail Container */}
              <div 
                onClick={() => onPlayClip(clip)}
                className="relative aspect-[9/16] bg-black cursor-pointer overflow-hidden group-hover:scale-[1.01] transition-transform duration-200"
              >
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <Sparkles className="w-8 h-8" />
                  </div>
                )}

                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"></div>

                {/* Top Badges */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${scoreColor}`}>
                    ★ {clip.score.toFixed(1)} Viral Score
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[11px] font-mono font-medium">
                    {formatDuration(clip.duration)}
                  </span>
                </div>

                {/* Center Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-xl shadow-purple-600/40 group-hover:scale-110 transition-all">
                    <Play className="w-6 h-6 fill-current ml-1" />
                  </div>
                </div>

                {/* Bottom Hook Preview */}
                {clip.hook && (
                  <div className="absolute bottom-3 inset-x-3">
                    <p className="text-xs text-white/90 line-clamp-2 font-medium bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-white/10">
                      "{clip.hook}"
                    </p>
                  </div>
                )}
              </div>

              {/* Card Meta & Actions */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base leading-snug">
                      {clip.title}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-gray-400 mt-1 font-mono">
                    <span>{formatDuration(clip.start_time)} → {formatDuration(clip.end_time)}</span>
                    {clip.file_size_bytes ? (
                      <>
                        <span>•</span>
                        <span>{formatBytes(clip.file_size_bytes)}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Collapsible Reasoning */}
                {clip.reason && (
                  <div className="pt-2 border-t border-white/5">
                    <button
                      onClick={() => toggleExpand(clip.id)}
                      className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <span className="flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 text-purple-400" />
                        <span>Why this moment?</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <p className="mt-2 text-xs text-gray-300 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                        {clip.reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex items-center space-x-2">
                  <button
                    onClick={() => onPlayClip(clip)}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <a
                    href={clip.url}
                    download={`${clip.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_1080x1920.mp4`}
                    className="flex-1 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
