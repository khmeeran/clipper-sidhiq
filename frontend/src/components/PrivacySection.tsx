import React from 'react';
import { ShieldCheck, HardDrive, Cpu, Lock } from 'lucide-react';

export const PrivacySection: React.FC = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-b from-[#13151f] via-[#0e1017] to-[#090a0f] border border-white/[0.08] p-8 sm:p-12 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Privacy & Local Processing
            </h2>
            <p className="text-sm text-gray-400">
              Honest, transparent architecture designed for creator confidentiality.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center space-x-2 text-emerald-400 text-sm font-bold mb-2">
              <Cpu className="w-4 h-4" />
              <span>Local Hardware Processing</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              When processing via Clipper Sidhiq's local companion, audio transcription (Whisper) and vertical video rendering run on your own machine’s GPU and CPU. No cloud rendering servers are used.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center space-x-2 text-cyan-400 text-sm font-bold mb-2">
              <HardDrive className="w-4 h-4" />
              <span>Direct Local Storage</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Downloaded videos, generated 1080×1920 clips, transcripts, and ZIP archives are stored directly in your local project <code className="text-gray-300">downloads/</code> folder.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center space-x-2 text-violet-400 text-sm font-bold mb-2">
              <Lock className="w-4 h-4" />
              <span>Zero Account or Cloud Lock-in</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              No subscription, API keys, tracking cookies, or mandatory user accounts required. You own 100% of your exported content and transcripts.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.06] text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Note regarding external video URLs:</strong> When you provide a public streaming video URL (e.g. YouTube), your local network fetches the stream directly from the content host to save the source video file to your disk before running offline processing.
        </div>
      </div>
    </section>
  );
};
