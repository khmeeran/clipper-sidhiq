import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { HeroWorkspace } from './components/HeroWorkspace';
import { HowItWorksSection } from './components/HowItWorksSection';
import { ProcessingWorkspace } from './components/ProcessingWorkspace';
import { ResultsWorkspace } from './components/ResultsWorkspace';
import { HistoryWorkspace } from './components/HistoryWorkspace';
import { PrivacySection } from './components/PrivacySection';
import { 
  checkBridgeHealth, 
  startCreateClipsPipeline, 
  getPipelineJobStatus, 
  cancelPipelineJob, 
  getCompletedProjectsList, 
  uploadLocalFileToBridge,
  BridgeStatus, 
  PipelineJob, 
  CompletedProject 
} from './api/bridgeClient';

export function App() {
  const [currentTab, setCurrentTab] = useState<'create' | 'history' | 'how-it-works' | 'privacy'>('create');
  const [viewState, setViewState] = useState<'hero' | 'processing' | 'results'>('hero');
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [savedProjects, setSavedProjects] = useState<CompletedProject[]>([]);
  const [currentJob, setCurrentJob] = useState<PipelineJob | null>(null);
  const pollingTimerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Initial health check
    checkBridgeHealth().then(status => {
      setBridgeStatus(status);
    });

    // 2. Load existing projects
    loadProjects();

    // 3. Periodic health refresh
    const healthInterval = setInterval(() => {
      checkBridgeHealth().then(setBridgeStatus);
    }, 8000);

    return () => {
      clearInterval(healthInterval);
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const loadProjects = async () => {
    try {
      const list = await getCompletedProjectsList();
      setSavedProjects(list);
    } catch (_) {}
  };

  const startJobPolling = (jobId: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    let consecutiveErrors = 0;

    pollingTimerRef.current = setInterval(async () => {
      const res = await getPipelineJobStatus(jobId);
      if (res.ok && res.job) {
        consecutiveErrors = 0;
        setCurrentJob(res.job);

        if (res.job.status === 'COMPLETED') {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
          setViewState('results');
          loadProjects();
        } else if (res.job.status === 'FAILED' || res.job.status === 'CANCELLED') {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      } else {
        consecutiveErrors++;
        // If companion bridge is temporarily unreachable, show recovery status without aborting immediately
        if (consecutiveErrors >= 4 && consecutiveErrors < 30) {
          setCurrentJob(prev => prev ? {
            ...prev,
            stageMessage: `Companion connection interrupted (attempt ${consecutiveErrors}/30). Reconnecting...`
          } : null);
        } else if (consecutiveErrors >= 30) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
          setCurrentJob(prev => prev ? {
            ...prev,
            status: 'FAILED',
            stageMessage: 'Lost connection to Companion Bridge. Please ensure start_web.bat is running and try again.',
            error: 'Companion service stopped responding.'
          } : null);
        }
      }
    }, 800);
  };

  const handleSubmitUrl = async (url: string) => {
    // If bridge is offline, alert user
    if (bridgeStatus && !bridgeStatus.online) {
      alert('Local Companion Bridge is offline. Please run start_web.bat or start.bat in the project directory to launch the engine.');
      return;
    }

    setViewState('processing');
    setCurrentJob({
      id: `pending_${Date.now()}`,
      status: 'RUNNING',
      stage: 'DOWNLOADING',
      stageMessage: 'Initializing downloader with bundled yt-dlp & FFmpeg...',
      percent: 5,
      videoName: url.includes('v=') ? 'YouTube Video' : 'Online Video'
    });

    const res = await startCreateClipsPipeline(url);
    if (res.ok && res.jobId) {
      startJobPolling(res.jobId);
    } else {
      setCurrentJob(prev => ({
        id: prev?.id || 'error',
        status: 'FAILED',
        stage: 'FAILED',
        stageMessage: 'Failed to initiate download.',
        percent: 0,
        error: res.error || 'Could not connect to downloader.'
      }));
    }
  };

  const handleUploadFile = async (file: File) => {
    if (bridgeStatus && !bridgeStatus.online) {
      alert('Local Companion Bridge is offline. Please run start_web.bat or start.bat in the project directory to enable local processing.');
      return;
    }

    setViewState('processing');
    setCurrentJob({
      id: `pending_${Date.now()}`,
      status: 'RUNNING',
      stage: 'DOWNLOADING',
      stageMessage: `Uploading local file: ${file.name}...`,
      percent: 10,
      videoName: file.name
    });

    const uploadRes = await uploadLocalFileToBridge(file);
    if (!uploadRes.ok || !uploadRes.filePath) {
      setCurrentJob(prev => ({
        id: prev?.id || 'error',
        status: 'FAILED',
        stage: 'FAILED',
        stageMessage: 'Local file upload failed.',
        percent: 0,
        error: uploadRes.error || 'Failed to stage file for clipping.'
      }));
      return;
    }

    const res = await startCreateClipsPipeline('', uploadRes.filePath);
    if (res.ok && res.jobId) {
      startJobPolling(res.jobId);
    } else {
      setCurrentJob(prev => ({
        id: prev?.id || 'error',
        status: 'FAILED',
        stage: 'FAILED',
        stageMessage: 'Failed to start clipping engine.',
        percent: 0,
        error: res.error || 'Could not start processing.'
      }));
    }
  };

  const handleCancelJob = async () => {
    if (currentJob?.id) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
      await cancelPipelineJob(currentJob.id);
      setCurrentJob(prev => prev ? {
        ...prev,
        status: 'CANCELLED',
        stage: 'CANCELLED',
        stageMessage: 'Processing cancelled by user.'
      } : null);
    }
  };

  const handleSelectSavedProject = (job: PipelineJob) => {
    setCurrentJob(job);
    setViewState('results');
    setCurrentTab('create');
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col font-sans selection:bg-violet-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'create' && viewState !== 'processing') {
            // Keep results if available, else hero
          }
        }}
        bridgeStatus={bridgeStatus}
        savedCount={savedProjects.length}
      />

      {/* Main Workspace Body */}
      <main className="flex-1">
        {currentTab === 'how-it-works' && (
          <div className="py-8">
            <HowItWorksSection onGetStarted={() => setCurrentTab('create')} />
          </div>
        )}

        {currentTab === 'privacy' && (
          <div className="py-8">
            <PrivacySection />
          </div>
        )}

        {currentTab === 'history' && (
          <HistoryWorkspace
            projects={savedProjects}
            onSelectProject={handleSelectSavedProject}
            onCreateNew={() => {
              setCurrentTab('create');
              setViewState('hero');
            }}
          />
        )}

        {currentTab === 'create' && (
          <>
            {viewState === 'hero' && (
              <>
                <HeroWorkspace
                  onSubmitUrl={handleSubmitUrl}
                  onUploadFile={handleUploadFile}
                  bridgeStatus={bridgeStatus}
                  onOpenHowItWorks={() => setCurrentTab('how-it-works')}
                />
                <div className="border-t border-white/[0.06] bg-[#0b0d13]/50">
                  <HowItWorksSection />
                </div>
                <div className="border-t border-white/[0.06]">
                  <PrivacySection />
                </div>
              </>
            )}

            {viewState === 'processing' && currentJob && (
              <ProcessingWorkspace
                job={currentJob}
                onCancel={handleCancelJob}
                onReset={() => {
                  setViewState('hero');
                  setCurrentJob(null);
                }}
              />
            )}

            {viewState === 'results' && currentJob && (
              <ResultsWorkspace
                job={currentJob}
                onNewProject={() => {
                  setViewState('hero');
                  setCurrentJob(null);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#07080c] py-8 px-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-gray-300">Clipper Sidhiq</span>
            <span>—</span>
            <span>Automated Vertical Video Engine</span>
          </div>
          <div>
            100% Local GPU/CPU Reframing & Timestamped Subtitles
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
