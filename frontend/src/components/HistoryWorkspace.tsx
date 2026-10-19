import React from 'react';
import { 
  FolderArchive, 
  Film, 
  Clock, 
  Download, 
  Archive, 
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { CompletedProject, getAssetUrl, PipelineJob } from '../api/bridgeClient';

interface HistoryWorkspaceProps {
  projects: CompletedProject[];
  onSelectProject: (job: PipelineJob) => void;
  onCreateNew: () => void;
}

export const HistoryWorkspace: React.FC<HistoryWorkspaceProps> = ({
  projects,
  onSelectProject,
  onCreateNew
}) => {
  if (projects.length === 0) {
    return (
      <div className="py-20 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mx-auto mb-4">
          <FolderArchive className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Saved Projects Yet</h3>
        <p className="text-sm text-gray-400 mb-6">
          Paste a video URL or upload a file to generate your first 1080×1920 vertical clips.
        </p>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-600/30"
        >
          <Sparkles className="w-4 h-4" />
          <span>Create My Clips</span>
        </button>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-white">Saved Projects</h2>
          <p className="text-sm text-gray-400 mt-1">
            Browse and replay previously generated vertical clips, transcripts, and ZIP archives.
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-all shadow-lg"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((proj) => {
          const zipUrl = proj.zipFile ? getAssetUrl(proj.folder, proj.zipFile, true) : null;

          return (
            <div
              key={proj.id}
              className="rounded-3xl bg-gradient-to-b from-[#13151f] to-[#0c0e14] border border-white/[0.08] p-6 hover:border-violet-500/30 transition-all duration-300 shadow-xl flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate max-w-xs group-hover:text-violet-300 transition-colors">
                        {proj.videoName}
                      </h3>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(proj.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clips Preview List */}
                <div className="space-y-2 mb-6">
                  {proj.clips.map((clip, cIdx) => (
                    <div
                      key={clip.id || cIdx}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs"
                    >
                      <span className="font-medium text-gray-300 truncate max-w-[200px]">
                        {clip.title}
                      </span>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[10px]">
                          1080×1920
                        </span>
                        <span className="text-gray-400 font-mono flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>{clip.duration}s</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    const mappedJob: PipelineJob = {
                      id: proj.id,
                      status: 'COMPLETED',
                      stage: 'COMPLETED',
                      stageMessage: 'Loaded from saved project',
                      percent: 100,
                      folder: proj.folder,
                      videoName: proj.videoName,
                      clips: proj.clips,
                      transcriptTxt: proj.transcriptTxt,
                      transcriptSrt: proj.transcriptSrt,
                      zipFile: proj.zipFile
                    };
                    onSelectProject(mappedJob);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Clips & Transcript</span>
                </button>

                {zipUrl && (
                  <a
                    href={zipUrl}
                    download={proj.zipFile || 'assets.zip'}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition-colors"
                    title="Download ZIP Archive"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>ZIP</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
