import React from 'react';
import { Film, CheckCircle2, AlertTriangle, Sparkles, FolderArchive, Shield } from 'lucide-react';
import { BridgeStatus } from '../api/bridgeClient';

interface NavbarProps {
  currentTab: 'create' | 'history' | 'how-it-works' | 'privacy';
  onSelectTab: (tab: 'create' | 'history' | 'how-it-works' | 'privacy') => void;
  bridgeStatus: BridgeStatus | null;
  savedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  bridgeStatus,
  savedCount
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#090a0f]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          onClick={() => onSelectTab('create')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 p-[1px] shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-all duration-300">
            <div className="w-full h-full bg-[#0d0e14] rounded-[11px] flex items-center justify-center">
              <Film className="w-5 h-5 text-violet-400 group-hover:text-cyan-300 transition-colors" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-wider text-white">CLIPPER</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30">
                SIDHIQ
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium tracking-tight">
              Ultra-Premium Vertical Clipper
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => onSelectTab('create')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'create'
                ? 'bg-white/10 text-white shadow-inner border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Create Clips</span>
          </button>

          <button
            onClick={() => onSelectTab('how-it-works')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'how-it-works'
                ? 'bg-white/10 text-white shadow-inner border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>How It Works</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`relative flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'history'
                ? 'bg-white/10 text-white shadow-inner border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-cyan-400" />
            <span>Saved Projects</span>
            {savedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 font-bold">
                {savedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('privacy')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentTab === 'privacy'
                ? 'bg-white/10 text-white shadow-inner border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Privacy</span>
          </button>
        </nav>

        {/* Bridge Status Indicator */}
        <div className="flex items-center space-x-3">
          {bridgeStatus?.online ? (
            <div 
              title="Companion Bridge Active: Local yt-dlp, FFmpeg & Whisper GPU ready"
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Local Engine Online</span>
            </div>
          ) : (
            <div 
              title="Companion Bridge Offline: Run start_web.bat on your PC to enable local GPU processing"
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Companion Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-white/[0.06] bg-[#0b0d13] px-2 py-1.5 text-xs">
        <button
          onClick={() => onSelectTab('create')}
          className={`flex-1 py-1.5 text-center font-semibold rounded ${
            currentTab === 'create' ? 'text-violet-400 bg-white/5' : 'text-gray-400'
          }`}
        >
          Create
        </button>
        <button
          onClick={() => onSelectTab('how-it-works')}
          className={`flex-1 py-1.5 text-center font-semibold rounded ${
            currentTab === 'how-it-works' ? 'text-violet-400 bg-white/5' : 'text-gray-400'
          }`}
        >
          How It Works
        </button>
        <button
          onClick={() => onSelectTab('history')}
          className={`flex-1 py-1.5 text-center font-semibold rounded ${
            currentTab === 'history' ? 'text-cyan-400 bg-white/5' : 'text-gray-400'
          }`}
        >
          Saved ({savedCount})
        </button>
        <button
          onClick={() => onSelectTab('privacy')}
          className={`flex-1 py-1.5 text-center font-semibold rounded ${
            currentTab === 'privacy' ? 'text-emerald-400 bg-white/5' : 'text-gray-400'
          }`}
        >
          Privacy
        </button>
      </div>
    </header>
  );
};
