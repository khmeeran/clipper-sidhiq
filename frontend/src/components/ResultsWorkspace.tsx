import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Archive, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  Maximize2, 
  RotateCcw,
  Search,
  Check,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PipelineJob, BridgeClip, getAssetUrl, fetchTranscriptText } from '../api/bridgeClient';

interface ResultsWorkspaceProps {
  job: PipelineJob;
  onNewProject: () => void;
}

export const ResultsWorkspace: React.FC<ResultsWorkspaceProps> = ({
  job,
  onNewProject
}) => {
  const folder = job.folder || job.videoName || '';
  const clips = job.clips || [];

  const [transcriptContent, setTranscriptContent] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (folder && job.transcriptTxt) {
      fetchTranscriptText(folder, job.transcriptTxt).then(text => {
        setTranscriptContent(text);
      }).catch(console.error);
    }
  }, [folder, job.transcriptTxt]);

  const handleCopyTranscript = () => {
    if (transcriptContent) {
      navigator.clipboard.writeText(transcriptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredLines = transcriptContent
    ? transcriptContent.split('\n').filter(line => {
        if (!searchQuery) return true;
        return line.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : [];

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fadeIn">
      {/* Top Banner / Actions */}
      <div className="rounded-3xl bg-gradient-to-b from-[#13151f] via-[#0f1118] to-[#090a0f] border border-white/[0.08] p-6 sm:p-8 shadow-2xl mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Vertical Clips & Transcripts Ready</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {job.videoName || 'Processed Video'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Generated 2 meaningful 1080×1920 vertical clips under 60 seconds with timestamped transcripts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {job.zipFile && (
              <a
                href={getAssetUrl(folder, job.zipFile, true)}
                download={job.zipFile}
                className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-violet-600/30 transition-all hover:scale-[1.02]"
              >
                <Archive className="w-4 h-4" />
                <span>Download All (ZIP)</span>
                {job.zipSizeMB && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-black/30 font-mono">
                    {job.zipSizeMB} MB
                  </span>
                )}
              </a>
            )}

            <button
              onClick={onNewProject}
              className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-semibold text-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Generated Vertical Clips */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Vertical 1080×1920 Clips (&lt; 60s)
            </h2>
            <p className="text-xs text-gray-400">
              Blurred background framing with synchronized stereo audio ready for Shorts, Reels & TikTok.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 font-bold px-2.5 py-1 rounded bg-cyan-400/10 border border-cyan-400/20">
            {clips.length} Clips Produced
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {clips.map((clip, index) => {
            const videoUrl = getAssetUrl(folder, clip.fileName);
            const downloadUrl = getAssetUrl(folder, clip.fileName, true);

            return (
              <div
                key={clip.id || index}
                className="rounded-3xl bg-gradient-to-b from-[#13151f] to-[#0c0e14] border border-white/[0.08] overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Clip Header Info */}
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-white">
                      {clip.title}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                        1080×1920 (9:16)
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{clip.duration}s</span>
                      </span>
                      {clip.sizeMB && (
                        <span className="text-[11px] font-mono text-gray-400">
                          {clip.sizeMB} MB
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vertical Video Player Frame */}
                <div className="relative bg-black flex items-center justify-center p-3 grow">
                  <div className="w-full max-w-[340px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                    <video
                      src={videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Download Clip Action */}
                <div className="p-5 border-t border-white/[0.06] bg-[#0f1118]">
                  <a
                    href={downloadUrl}
                    download={clip.fileName}
                    className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-600/25 transition-all hover:scale-[1.01]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP4 ({clip.duration}s)</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timestamped Transcript & Subtitles Section */}
      <div className="rounded-3xl bg-[#0c0e14] border border-white/[0.08] p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-extrabold text-white">
                Timestamped Transcript & Subtitles
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Full transcript with millisecond timestamps and standard subtitle format.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {job.transcriptTxt && (
              <a
                href={getAssetUrl(folder, job.transcriptTxt, true)}
                download={job.transcriptTxt}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>transcript.txt</span>
              </a>
            )}

            {job.transcriptSrt && (
              <a
                href={getAssetUrl(folder, job.transcriptSrt, true)}
                download={job.transcriptSrt}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>transcript.srt</span>
              </a>
            )}

            <button
              onClick={handleCopyTranscript}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
              title={showTranscript ? 'Collapse transcript' : 'Expand transcript'}
            >
              {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Interactive Transcript Viewer */}
        {showTranscript && (
          <div>
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search transcript lines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#13151f] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div className="max-h-96 overflow-y-auto rounded-2xl bg-[#13151f]/60 border border-white/[0.06] p-4 font-mono text-xs text-gray-300 space-y-1.5">
              {filteredLines.length > 0 ? (
                filteredLines.map((line, idx) => (
                  <div key={idx} className="hover:bg-white/5 px-2 py-1 rounded transition-colors">
                    {line.startsWith('[') ? (
                      <span>
                        <span className="text-cyan-400 font-bold">{line.slice(0, line.indexOf(']') + 1)}</span>
                        <span className="text-gray-200">{line.slice(line.indexOf(']') + 1)}</span>
                      </span>
                    ) : (
                      line
                    )}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 py-4 text-center">
                  {transcriptContent ? 'No matching dialogue found.' : 'Loading transcript...'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
