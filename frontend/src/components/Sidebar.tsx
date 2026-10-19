import React from 'react';
import { 
  Sparkles, 
  Film, 
  Layers, 
  CheckCircle2, 
  Settings as SettingsIcon, 
  Cpu, 
  HardDrive,
  Activity,
  Zap
} from 'lucide-react';
import { BrowserSystemStatus } from '../types';

interface SidebarProps {
  currentTab: 'upload' | 'queue' | 'history';
  onSelectTab: (tab: 'upload' | 'queue' | 'history') => void;
  onOpenSettings: () => void;
  systemStatus: BrowserSystemStatus | null;
  activeCount: number;
  completedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSettings,
  systemStatus,
  activeCount,
  completedCount,
}) => {
  return (
    <aside className="w-64 bg-[#0c0e14] border-r border-white/5 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">CLIPPER</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">SIDHIQ</span>
              </div>
              <p className="text-[11px] text-cyan-400 font-medium flex items-center space-x-1 mt-0.5">
                <Zap className="w-3 h-3 inline" />
                <span>Serverless Web Edition</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          <button
            onClick={() => onSelectTab('upload')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              currentTab === 'upload'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Sparkles className={`w-4 h-4 ${currentTab === 'upload' ? 'text-purple-400' : 'text-gray-400'}`} />
              <span>New Project</span>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('queue')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              currentTab === 'queue'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Layers className={`w-4 h-4 ${currentTab === 'queue' ? 'text-purple-400' : 'text-gray-400'}`} />
              <span>Active Processing</span>
            </div>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500 text-white animate-pulse">
                {activeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              currentTab === 'history'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center space-x-3">
              <CheckCircle2 className={`w-4 h-4 ${currentTab === 'history' ? 'text-purple-400' : 'text-gray-400'}`} />
              <span>Saved Clips</span>
            </div>
            {completedCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/10 text-gray-300">
                {completedCount}
              </span>
            )}
          </button>

          <div className="pt-4 border-t border-white/5 mt-4">
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
            >
              <SettingsIcon className="w-4 h-4 text-gray-400" />
              <span>Settings & Storage</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Browser Engine Status Footer */}
      <div className="p-4 m-3 rounded-xl bg-[#12141c] border border-white/5 text-xs space-y-2.5">
        <div className="flex items-center justify-between text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
          <span className="flex items-center space-x-1.5">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>Browser Engine</span>
          </span>
          <span className="text-emerald-400 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>Client Native</span>
          </span>
        </div>

        <div className="space-y-1.5 pt-1 text-[11px] text-gray-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Cpu className="w-3 h-3 text-indigo-400" />
              <span>Intelligence</span>
            </span>
            <span className="font-mono text-gray-200 font-medium">
              Heuristic AI
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Reframing</span>
            </span>
            <span className="font-mono text-gray-200 font-medium">
              1080x1920 (9:16)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <HardDrive className="w-3 h-3 text-cyan-400" />
              <span>Storage</span>
            </span>
            <span className="font-mono text-gray-200 font-medium">
              {systemStatus ? `${systemStatus.storageUsageMB} MB` : 'In-Memory'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
