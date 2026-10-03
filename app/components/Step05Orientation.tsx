'use client';

import React, { useEffect } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { BUCKET_CONFIG, BucketType } from '../data/constants';

interface OrientationBucket {
  key: BucketType;
  title: string;
  sub: string;
  desc: string;
}

const ORIENTATION_BUCKETS: OrientationBucket[] = [
  {
    key: 'banger',
    title: 'Banger',
    sub: 'God-Tier / S-Tier',
    desc: 'The undisputed canon. Pure Weezer magic that defines your entire experience with the band.',
  },
  {
    key: 'slaps',
    title: 'Lowkey Slaps',
    sub: 'Great / A-Tier',
    desc: 'Awesome jams you love hearing, but they might not make an iPod with only 25 total tracks.',
  },
  {
    key: 'mid',
    title: 'Mid',
    sub: 'Solid / B-Tier',
    desc: 'Enjoyable listens and fun album cuts, but never in your everyday rotation.',
  },
  {
    key: 'skip',
    title: 'Skip',
    sub: 'Meh / C-Tier',
    desc: 'Tracks you don’t hate, but secretly skip when no one is watching.',
  },
  {
    key: 'trash',
    title: 'Trash',
    sub: 'Bottom-Tier / D-Tier',
    desc: 'Songs you’d be completely fine never hearing again for the rest of your life.',
  },
];

export default function Step05Orientation() {
  const { navigateTo } = useWeezer();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto px-4">
      {/* BACK BUTTON */}
      <div className="pt-4 flex items-center justify-start">
        <button
          onClick={() => navigateTo('splash')}
          className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          ← Back to Splash
        </button>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter">
          The Rules of <span className="text-[#0072CE]">Engagement.</span>
        </h1>
        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto">
          How to calibrate your 5 buckets during the Gut Check
        </p>
      </div>

      {/* BUCKETS CARDS */}
      <div className="space-y-4">
        {ORIENTATION_BUCKETS.map(({ key, title, sub, desc }) => {
          const cfg = BUCKET_CONFIG[key];
          return (
            <div
              key={key}
              className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-blue-300 transition-all space-y-3"
            >
              {/* TOP ROW: ICON + LARGE BUCKET TITLE */}
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-3xl shrink-0 shadow-sm ${cfg.badgeBg}`}
                >
                  {cfg.emoji}
                </div>

                <div className="flex flex-col min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-none">
                    {title}
                  </h2>
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {sub}
                  </span>
                </div>
              </div>

              {/* CARD BODY: DESCRIPTION */}
              <div className="pt-1 border-t border-slate-100">
                <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* PRO TIP / GUIDANCE CARD */}
      <div className="bg-slate-950 text-white border border-slate-800 rounded-3xl p-5 text-center shadow-lg">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
          💡 Pro Tip: Don’t Overthink It
        </span>
        <p className="text-xs font-medium text-slate-300 max-w-md mx-auto leading-relaxed">
          The Gut Check is designed for fast, instinctual sorting. You can
          fine-tune exact positions in the head-to-head matchup stage!
        </p>
      </div>

      {/* CONTINUATION CTA */}
      <div className="space-y-2 pt-2">
        <button
          onClick={() => navigateTo('triage')}
          className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-[0.99] text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-[0_10px_25px_rgba(0,114,206,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>I'm Ready — Start Triage</span>
          <span className="transform group-hover:translate-x-1 transition-transform">
            🚀
          </span>
        </button>

        <p className="text-center text-[11px] font-bold text-slate-400">
          206 Songs • Rapid Fire Triage Mode
        </p>
      </div>
    </div>
  );
}