import React from 'react';
import { Link2, Sparkles, Smartphone, Download, ArrowRight } from 'lucide-react';

interface HowItWorksSectionProps {
  onGetStarted?: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ onGetStarted }) => {
  const steps = [
    {
      num: '01',
      title: 'Add Your Video',
      description: 'Paste any supported video link or select a video file directly from your computer.',
      icon: Link2,
      accent: 'from-violet-500 to-indigo-500',
      badge: 'Step 1'
    },
    {
      num: '02',
      title: 'Transcribe & Find Moments',
      description: 'Clipper analyzes speech, transcribes dialogue with exact timestamps, and identifies high-impact moments.',
      icon: Sparkles,
      accent: 'from-indigo-500 to-cyan-500',
      badge: 'Step 2'
    },
    {
      num: '03',
      title: 'Create Vertical Clips',
      description: 'Your key moments are transformed into full 1080×1920 vertical videos with blurred background framing.',
      icon: Smartphone,
      accent: 'from-cyan-500 to-teal-500',
      badge: 'Step 3'
    },
    {
      num: '04',
      title: 'Preview & Download',
      description: 'Watch your clips in the browser, download individual MP4s, get full transcripts, or export a single ZIP archive.',
      icon: Download,
      accent: 'from-teal-500 to-emerald-500',
      badge: 'Step 4'
    }
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Simple 4-Step Process</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Turn Long Videos Into Ready-to-Share Clips
        </h2>
        <p className="mt-4 text-base sm:text-lg text-gray-400">
          Turn long videos into short, meaningful vertical clips with timestamped transcripts and downloadable subtitles — using a simple workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="relative rounded-2xl bg-gradient-to-b from-[#13151f] to-[#0c0e14] border border-white/[0.08] p-6 hover:border-violet-500/30 transition-all duration-300 group shadow-lg shadow-black/40"
            >
              <div className="flex items-center justify-between mb-5">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${step.accent} flex items-center justify-center text-white shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black text-white/10 group-hover:text-white/20 transition-colors font-mono">
                  {step.num}
                </span>
              </div>

              <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-1.5">
                {step.badge}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>

      {onGetStarted && (
        <div className="mt-12 text-center">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-violet-600/30 transition-all hover:scale-[1.02]"
          >
            <span>Create Your First Clip</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
};
