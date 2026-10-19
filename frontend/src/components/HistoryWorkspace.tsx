import React from 'react';
import { 
  Film, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  ArrowRight
} from 'lucide-react';
import { LocalJob } from '../types';

interface HistoryWorkspaceProps {
  jobs: LocalJob[];
  filterStatus?: 'queue' | 'history';
  onSelectJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
}

export const HistoryWorkspace: React.FC<HistoryWorkspaceProps> = ({
  jobs,
  filterStatus,
  onSelectJob,
  onDeleteJob,
}) => {
  const filteredJobs = jobs.filter((j) => {
    if (filterStatus === 'queue') {
      return j.status === 'RUNNING' || j.status === 'QUEUED';
    }
    return j.status === 'COMPLETED' || j.status === 'FAILED' || j.status === 'CANCELLED';
  });

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {filterStatus === 'queue' ? 'Active In-Browser Tasks' : 'Saved Projects & Clips'}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {filterStatus === 'queue'
              ? 'Videos currently being analyzed and rendered on your device.'
              : 'Past video clipping projects stored in your browser session.'}
          </p>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="py-20 text-center space-y-4 rounded-2xl bg-[#0e1017] border border-white/5">
          <div className="w-12 h-12 rounded-2xl bg-white/5 text-gray-500 flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No projects found</h3>
            <p className="text-xs text-gray-500">
              {filterStatus === 'queue'
                ? 'No background tasks running. Ready to process a new video!'
                : 'Process a video to start discovering viral vertical moments.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isRunning = job.status === 'RUNNING' || job.status === 'QUEUED';
            const isCompleted = job.status === 'COMPLETED';

            return (
              <div
                key={job.id}
                className="p-5 rounded-2xl bg-[#0f1118] border border-white/5 hover:border-purple-500/30 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isRunning
                        ? 'bg-purple-500/20 text-purple-400'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isRunning ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h3 className="font-semibold text-white text-base truncate max-w-md">
                      {job.filename}
                    </h3>

                    <div className="flex items-center space-x-3 text-xs text-gray-400 font-mono">
                      <span>{formatDate(job.created_at)}</span>
                      <span>•</span>
                      <span>{formatDuration(job.duration)}</span>
                      {job.resolution && (
                        <>
                          <span>•</span>
                          <span>{job.resolution}</span>
                        </>
                      )}
                      {isCompleted && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{job.clip_count} Clips</span>
                        </>
                      )}
                    </div>

                    {isRunning && (
                      <p className="text-xs text-purple-300 font-medium">
                        {job.stage}: {job.stage_message} ({job.progress_percent.toFixed(0)}%)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => onSelectJob(job.id)}
                    className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <span>{isRunning ? 'View Progress' : 'View Clips'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteJob(job.id)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors"
                    title="Delete files from browser memory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
