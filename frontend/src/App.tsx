import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { UploadWorkspace } from './components/UploadWorkspace';
import { ProcessingView } from './components/ProcessingView';
import { ResultsGrid } from './components/ResultsGrid';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { SettingsModal } from './components/SettingsModal';
import { HistoryWorkspace } from './components/HistoryWorkspace';
import { LocalJob, LocalRenderedClip, BrowserSystemStatus, ClientSettings } from './types';
import { ClientClipperPipeline } from './engine/clientOrchestrator';
import { 
  getBrowserStorageEstimate, 
  loadJobsFromIndexedDB, 
  deleteJobFromIndexedDB, 
  performRetentionCleanup 
} from './engine/storageManager';

export function App() {
  const [currentTab, setCurrentTab] = useState<'upload' | 'queue' | 'history' | 'processing' | 'results'>('upload');
  const [jobs, setJobs] = useState<LocalJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<LocalJob | null>(null);
  const [currentClips, setCurrentClips] = useState<LocalRenderedClip[]>([]);
  
  const [systemStatus, setSystemStatus] = useState<BrowserSystemStatus | null>(null);
  const [settings, setSettings] = useState<ClientSettings>({
    reframing_mode: 'blur_background',
    subtitle_style: 'violet_glow',
    min_clip_score: 6.5,
    margin_v: 380,
    retention_hours: 6.0
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [playingClip, setPlayingClip] = useState<LocalRenderedClip | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const activePipelineRef = useRef<ClientClipperPipeline | null>(null);

  useEffect(() => {
    // 1. Check browser capabilities and storage
    updateSystemStatus();

    // 2. Load cached jobs from IndexedDB
    loadSavedJobs();

    // 3. Best-effort retention cleanup for jobs older than 6 hours
    performRetentionCleanup(settings.retention_hours);
  }, []);

  const updateSystemStatus = async () => {
    const storage = await getBrowserStorageEstimate();
    const hasWebCodecs = typeof window !== 'undefined' && 'VideoEncoder' in window;
    const hasWebAudio = typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
    const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    setSystemStatus({
      webCodecsSupported: hasWebCodecs,
      webAudioSupported: hasWebAudio,
      speechRecognitionSupported: hasSpeech,
      storageUsageMB: storage.usageMB,
      storageQuotaMB: storage.quotaMB,
      storagePercentUsed: storage.percentUsed,
      engine: hasWebCodecs ? 'WebCodecs Hardware (Client)' : 'Canvas + MediaRecorder (Client)'
    });
  };

  const loadSavedJobs = async () => {
    try {
      const saved = await loadJobsFromIndexedDB();
      if (saved && saved.length > 0) {
        const mapped: LocalJob[] = saved.map(s => ({
          id: s.id,
          filename: s.filename,
          status: 'COMPLETED',
          stage: 'COMPLETED',
          progress_percent: 100,
          stage_message: 'Completed in previous session',
          duration: s.duration,
          resolution: s.resolution,
          file_size_bytes: s.file_size_bytes,
          created_at: s.created_at,
          completed_at: s.completed_at,
          clip_count: s.clip_count,
          clips: s.clips || []
        }));
        setJobs(mapped);
      }
    } catch (_) {}
  };

  const handleStartProcessing = async (file: File, options: Record<string, any>) => {
    setIsProcessing(true);
    const pipeline = new ClientClipperPipeline();
    activePipelineRef.current = pipeline;

    setCurrentTab('processing');

    try {
      const completedJob = await pipeline.run(
        file,
        {
          reframingMode: options.reframingMode || settings.reframing_mode,
          subtitleStyle: options.subtitleStyle || settings.subtitle_style,
          minScore: options.minScore || settings.min_clip_score,
        },
        (updatedJob) => {
          setCurrentJob({ ...updatedJob });
          setActiveJobId(updatedJob.id);
          setJobs(prev => {
            const idx = prev.findIndex(j => j.id === updatedJob.id);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = { ...updatedJob };
              return copy;
            }
            return [updatedJob, ...prev];
          });
        }
      );

      setCurrentJob(completedJob);
      setCurrentClips(completedJob.clips);
      setActiveJobId(completedJob.id);
      setIsProcessing(false);
      updateSystemStatus();
    } catch (err: any) {
      setIsProcessing(false);
      console.error('In-browser processing error:', err);
    }
  };

  const handleCancelJob = () => {
    if (activePipelineRef.current) {
      activePipelineRef.current.cancel();
      activePipelineRef.current = null;
    }
    setIsProcessing(false);
    if (currentJob) {
      const cancelled = {
        ...currentJob,
        status: 'CANCELLED' as const,
        stage: 'CANCELLED' as const,
        stage_message: 'Processing cancelled by user'
      };
      setCurrentJob(cancelled);
    }
  };

  const handleClearJob = async (jobId: string) => {
    await deleteJobFromIndexedDB(jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    if (activeJobId === jobId) {
      setActiveJobId(null);
      setCurrentJob(null);
      setCurrentClips([]);
      setCurrentTab('upload');
    }
    updateSystemStatus();
  };

  const handleSelectJob = (jobId: string) => {
    const j = jobs.find(item => item.id === jobId);
    if (!j) return;
    setActiveJobId(jobId);
    setCurrentJob(j);
    setCurrentClips(j.clips || []);
    if (j.status === 'COMPLETED') {
      setCurrentTab('results');
    } else {
      setCurrentTab('processing');
    }
  };

  const activeCount = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'QUEUED').length;
  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090a0f] text-gray-100 font-sans">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab === 'processing' || currentTab === 'results' ? 'queue' : currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        systemStatus={systemStatus}
        activeCount={activeCount}
        completedCount={completedCount}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 h-full overflow-y-auto bg-gradient-to-b from-[#090a0f] via-[#0b0d13] to-[#08090d]">
        {currentTab === 'upload' && (
          <UploadWorkspace
            onStartProcessing={handleStartProcessing}
            isProcessing={isProcessing}
            systemStatus={systemStatus}
            settings={settings}
          />
        )}

        {currentTab === 'processing' && currentJob && (
          <ProcessingView
            job={currentJob}
            onCancelJob={handleCancelJob}
            onViewResults={() => setCurrentTab('results')}
          />
        )}

        {currentTab === 'results' && currentJob && (
          <ResultsGrid
            job={currentJob}
            clips={currentClips}
            onPlayClip={(clip) => setPlayingClip(clip)}
            onClearJob={handleClearJob}
          />
        )}

        {(currentTab === 'queue' || currentTab === 'history') && (
          <HistoryWorkspace
            jobs={jobs}
            filterStatus={currentTab}
            onSelectJob={handleSelectJob}
            onDeleteJob={handleClearJob}
          />
        )}
      </main>

      {/* Video Preview Modal */}
      {playingClip && (
        <VideoPlayerModal
          clip={playingClip}
          onClose={() => setPlayingClip(null)}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          systemStatus={systemStatus}
          onSave={(newS) => {
            setSettings(newS);
            updateSystemStatus();
          }}
          onClose={() => setIsSettingsOpen(false)}
          onClearedStorage={() => {
            setJobs([]);
            setCurrentJob(null);
            setCurrentClips([]);
            updateSystemStatus();
          }}
        />
      )}
    </div>
  );
}

export default App;
