import React from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  Circle, 
  XCircle, 
  Film, 
  Sparkles, 
  Smartphone, 
  FileText, 
  Archive, 
  DownloadCloud,
  StopCircle
} from 'lucide-react';
import { PipelineJob } from '../api/bridgeClient';

interface ProcessingWorkspaceProps {
  job: PipelineJob;
  onCancel: () => void;
  onReset: () => void;
}

export const ProcessingWorkspace: React.FC<ProcessingWorkspaceProps> = ({
  job,
  onCancel,
  onReset
}) => {
  const stages = [
    {
      id: 'DOWNLOADING',
      title: 'Downloading Video',
      desc: job.speed ? `${job.speed} • ETA ${job.eta || 'calculating'}` : 'Retrieving high-quality video and audio streams',
      icon: DownloadCloud
    },
    {
      id: 'TRANSCRIBING',
      title: 'Creating Transcript',
      desc: 'Transcribing speech with millisecond timestamps via Whisper',
      icon: FileText
    },
    {
      id: 'FINDING_MOMENTS',
      title: 'Finding Meaningful Moments',
      desc: 'Analyzing speech activity to extract hook and viral sequence (< 60s)',
      icon: Sparkles
    },
    {
      id: 'RENDERING_CLIPS',
      title: 'Rendering Vertical Clips',
      desc: 'Generating 1080×1920 canvas with blurred background & sharp center',
      icon: Smartphone
    },
    {
      id: 'PREPARING_DOWNLOADS',
      title: 'Preparing Downloads',
      desc: 'Compiling all vertical MP4s, transcripts, and ZIP archive',
      icon: Archive
    }
  ];

  const getStageState = (stageId: string) => {
    const stageOrder = ['DOWNLOADING', 'TRANSCRIBING', 'FINDING_MOMENTS', 'RENDERING_CLIPS', 'PREPARING_DOWNLOADS', 'COMPLETED'];
    const currentIdx = stageOrder.indexOf(job.stage);
    const targetIdx = stageOrder.indexOf(stageId);

    if (job.status === 'COMPLETED') return 'completed';
    if (job.status === 'FAILED') {
      if (currentIdx === targetIdx) return 'failed';
      if (currentIdx > targetIdx) return 'completed';
      return 'pending';
    }

    if (currentIdx > targetIdx) return 'completed';
    if (currentIdx === targetIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto animate-fadeIn">
      {/* Header Panel */}
      <div className="rounded-3xl bg-gradient-to-b from-[#13151f] via-[#0f1118] to-[#090a0f] border border-white/[0.08] p-6 sm:p-8 shadow-2xl mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Film className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                Active Video Pipeline
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white truncate max-w-md">
                {job.videoName || 'Processing Video...'}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {job.status === 'RUNNING' && (
              <button
                onClick={onCancel}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                <span>Cancel Processing</span>
              </button>
            )}
            {job.status === 'FAILED' && (
              <button
                onClick={onReset}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors shadow-lg"
              >
                <span>Try Another Video</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center text-xs font-bold mb-2">
            <span className="text-gray-300 flex items-center space-x-2">
              {job.status === 'RUNNING' && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
              <span>{job.stageMessage || 'Processing in progress...'}</span>
            </span>
            <span className="font-mono text-cyan-400 text-sm">{job.percent}%</span>
          </div>

          <div className="w-full h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden relative p-[1px]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 transition-all duration-500 ease-out shadow-lg shadow-cyan-500/25"
              style={{ width: `${Math.max(job.percent, 4)}%` }}
            />
          </div>
        </div>

        {/* Error Notification */}
        {job.status === 'FAILED' && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start space-x-3 mt-4">
            <XCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <div>
              <div className="font-bold text-red-200">Processing Failed</div>
              <p className="text-xs text-red-300/90 mt-0.5 leading-relaxed">
                {job.error || 'An unexpected error occurred during processing.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5-Stage Step Progression Checklist */}
      <div className="rounded-3xl bg-[#0c0e14] border border-white/[0.08] p-6 sm:p-8 shadow-xl">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">
          Pipeline Progression
        </h3>

        <div className="space-y-6">
          {stages.map((stage, idx) => {
            const state = getStageState(stage.id);
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex items-start space-x-4 p-4 rounded-2xl transition-all duration-300 ${
                  state === 'active'
                    ? 'bg-violet-600/10 border border-violet-500/30'
                    : state === 'completed'
                    ? 'bg-white/[0.02] border border-white/[0.06]'
                    : state === 'failed'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'opacity-40'
                }`}
              >
                {/* State Icon Indicator */}
                <div className="mt-0.5 shrink-0">
                  {state === 'completed' ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : state === 'active' ? (
                    <div className="w-7 h-7 rounded-full bg-violet-600/30 text-cyan-400 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : state === 'failed' ? (
                    <div className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                      <XCircle className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/5 text-gray-500 flex items-center justify-center font-mono text-xs">
                      0{idx + 1}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-bold ${state === 'active' ? 'text-white' : 'text-gray-300'}`}>
                      {stage.title}
                    </h4>
                    <Icon className={`w-4 h-4 ${state === 'active' ? 'text-cyan-400' : 'text-gray-500'}`} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {stage.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
