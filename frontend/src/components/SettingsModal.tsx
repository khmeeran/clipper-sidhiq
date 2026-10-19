import React, { useState } from 'react';
import { X, Save, Check, HardDrive, Trash2 } from 'lucide-react';
import { ClientSettings, BrowserSystemStatus } from '../types';
import { clearAllLocalJobs } from '../engine/storageManager';

interface SettingsModalProps {
  settings: ClientSettings;
  systemStatus: BrowserSystemStatus | null;
  onSave: (newSettings: ClientSettings) => void;
  onClose: () => void;
  onClearedStorage?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  systemStatus,
  onSave,
  onClose,
  onClearedStorage,
}) => {
  const [formData, setFormData] = useState<ClientSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleClearCache = async () => {
    if (!confirm('Clear all locally cached video clips and temporary browser data?')) return;
    setClearing(true);
    await clearAllLocalJobs();
    setClearing(false);
    onClearedStorage?.();
    alert('Local browser storage cleared.');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0e1017] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white">Browser Studio Settings</h2>
            <p className="text-xs text-gray-400">Configure client rendering options and local storage</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reframing Style */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Default Reframing (9:16 Portrait)</label>
            <select
              value={formData.reframing_mode}
              onChange={(e) => setFormData({ ...formData, reframing_mode: e.target.value as any })}
              className="w-full bg-[#141620] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="blur_background">Blurred Canvas (Ideal for 16:9 widescreen)</option>
              <option value="center_crop">Center Crop (Direct optical center 9:16)</option>
            </select>
          </div>

          {/* Subtitle Theme */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Captions Style</label>
            <select
              value={formData.subtitle_style}
              onChange={(e) => setFormData({ ...formData, subtitle_style: e.target.value as any })}
              className="w-full bg-[#141620] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="violet_glow">Electric Violet (High Contrast Stroke)</option>
              <option value="radiant_gold">Radiant Gold / Warm Yellow</option>
              <option value="clean_white">Clean Minimal White</option>
            </select>
          </div>

          {/* Subtitle Safe Margin */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-300">Vertical Safe Zone Margin</span>
              <span className="font-mono text-purple-400 font-bold">{formData.margin_v} px</span>
            </div>
            <input
              type="range"
              min="250"
              max="550"
              step="10"
              value={formData.margin_v}
              onChange={(e) => setFormData({ ...formData, margin_v: parseInt(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <p className="text-[11px] text-gray-500">
              Positions captions safely above mobile app navigation and buttons.
            </p>
          </div>

          {/* Browser Storage Box */}
          <div className="p-4 rounded-xl bg-[#12141c] border border-white/5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-200 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Browser Storage Usage</span>
              </span>
              <span className="font-mono text-gray-300">
                {systemStatus ? `${systemStatus.storageUsageMB} MB / ${systemStatus.storageQuotaMB} MB` : 'In-Memory'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-gray-400">
                All media stays in your browser's private sandbox.
              </p>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={clearing}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>{clearing ? 'Clearing...' : 'Clear Cache'}</span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center space-x-2 transition-all"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
