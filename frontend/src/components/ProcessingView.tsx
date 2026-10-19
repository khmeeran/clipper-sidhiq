import React, { useEffect, useState } from 'react';
import { 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Film, 
  Activity, 
  Brain, 
  Filter, 
  Sparkles
} from 'lucide-react';
import { LocalJob, JobStage } from '../types';

interface ProcessingViewProps {
  job: LocalJob;
  onCancelJob: () => void;
  onViewResults: () => void;
}

const STAGES: { key: JobStage; label: string; icon: any }[] = [
  { key: 'INGESTING', label: 'Media Ingestion', icon: Film },
  { key: 'ANALYZING', label: 'Audio Envelope & Silence Gating', icon: Activity },
  { key: 'TRANSCRIBING', label: 'Dialogue Timing Alignment', icon: Brain },
  { key: 'SELECTING', label: 'Adaptive Heuristic Discovery', icon: Filter },
  { key: 'RENDERING', label: 'Vertical Reframing & Captions', icon: Sparkles },
];

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  job,
  onCancelJob,
  onViewResults,
}) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      if (job.completed_at && job.created_at) {
        setElapsed(Math.round((job.completed_at - job.created_at) / 1000));
      }
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - job.created_at) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [job.created_at, job.status, job.completed_at]);

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const getStageIndex = (stage: JobStage): number => {
    const idx = STAGES.findIndex((s) => s.key === stage);
    return idx === -1 ? 0 : idx;
  };

  const currentIdx = getStageIndex(job.stage);

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 space-y-8">
      {/* Header Card */}
      <div className="p-6 rounded-2xl bg-[#10121a] border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Live In-Browser Execution
            </span>
            <h2 className="text-xl font-bold text-white truncate max-w-md">
              {job.filename}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>{formatElapsed(elapsed)}</span>
            </div>

            {job.status === 'RUNNING' && (
              <button
                onClick={onCancelJob}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
              >
                Cancel Job
              </button>
            )}
          </div>
        </div>

        {/* Real Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">{job.stage_message || 'Processing in browser...'}</span>
            <span className="font-mono text-purple-300 font-semibold">{job.progress_percent.toFixed(0)}%</span>
          </div>

          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-sm shadow-purple-500/50"
              style={{ width: `${Math.max(2, Math.min(100, job.progress_percent))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Stage Stepper */}
      <div className="p-6 rounded-2xl bg-[#0e1017] border border-white/5 space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Client Pipeline Stages
        </h3>

        <div className="space-y-3">
          {STAGES.map((st, idx) => {
            const Icon = st.icon;
            const isFinished = currentIdx > idx || job.status === 'COMPLETED';
            const isCurrent = currentIdx === idx && job.status === 'RUNNING';
            const isPending = currentIdx < idx && job.status !== 'COMPLETED';

            return (
              <div
                key={st.key}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-purple-500/10 border-purple-500/30 text-white'
                    : isFinished
                    ? 'bg-white/[0.02] border-white/5 text-gray-300'
                    : 'bg-transparent border-transparent text-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isCurrent
                        ? 'bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30'
                        : isFinished
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-white/5 text-gray-600'
                    }`}
                  >
                    {isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    ) : isFinished ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{st.label}</span>
                </div>

                <div className="text-xs font-mono">
                  {isFinished && <span className="text-emerald-400">Complete</span>}
                  {isCurrent && <span className="text-purple-300 animate-pulse">Running...</span>}
                  {isPending && <span className="text-gray-600">Pending</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion or Error State Actions */}
      {job.status === 'COMPLETED' && (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white">Browser Video Clipping Complete!</h4>
            <p className="text-sm text-gray-300">
              Generated {job.clip_count} vertical 1080x1920 clips with synchronized captions directly on your device.
            </p>
          </div>
          <button
            onClick={onViewResults}
            className="py-3 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 transition-all"
          >
            View & Download Clips ({job.clip_count})
          </button>
        </div>
      )}

      {job.status === 'FAILED' && (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-white">Browser Pipeline Interrupted</h4>
          <p className="text-sm text-rose-300 font-mono bg-rose-950/40 p-3 rounded-lg text-left">
            {job.error_message || 'An error occurred during in-browser video processing.'}
          </p>
        </div>
      )}

      {job.status === 'CANCELLED' && (
        <div className="p-6 rounded-2xl bg-gray-800/40 border border-white/5 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-white/5 text-gray-400 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Job Cancelled</h4>
          <p className="text-xs text-gray-400">Processing was stopped and local memory was released.</p>
        </div>
      )}
    </div>
  );
};
