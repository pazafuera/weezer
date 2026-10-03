'use client';

import React, { useEffect } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { BUCKET_CONFIG, BucketType } from '../data/constants';
import { FlyingWIcon } from './SharedUI';

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
    desc: 'Pure magic that defines your entire experience with Weezer.',
  },
  {
    key: 'slaps',
    title: 'Lowkey Slaps',
    sub: 'Great / A-Tier',
    desc: 'Awesome jams, but they would not make your iPod if it could only hold 25 total tracks.',
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
    desc: 'Songs you kinda wish Rivers had never written.',
  },
];

export default function StepSignupSuccess() {
  const { userProfile, navigateTo } = useWeezer();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const displayName =
    userProfile?.displayName ||
    (userProfile?.username ? `@${userProfile.username}` : 'Weezer Fan');

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto px-4">
      {/* ACCOUNT CONFIRMATION BANNER */}
      <div className="text-center space-y-3 pt-4">
        <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 border-2 border-emerald-400">
          <FlyingWIcon className="w-10 h-10 text-white drop-shadow-sm" />
        </div>

        <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-200">
          Account Created
        </span>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter">
          Welcome, <span className="text-[#0072CE]">{displayName}</span>!
        </h1>

        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto">
          You're ready to get ranking.
        </p>
      </div>

      {/* SECTION HEADER & SUCCINCT PRO-TIP */}
      <div className="space-y-2.5 text-center pt-2">
      <h2 className="text-base sm:text-xl font-black text-slate-950 tracking-tight">
  First, you'll put songs into one of the following buckets.
</h2>


      </div>

      {/* BUCKET CARDS */}
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

      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 w-full text-amber-950">
  <p className="text-s font-bold leading-snug">
    💡 <span className="font-black">Pro Tip:</span> Go with your gut! You'll fine-tune exact rankings later.
  </p>
</div>

      {/* CONTINUATION CTA */}
      <div className="pt-2">
        <button
          onClick={() => navigateTo('triage')}
          className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-[0.99] text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-[0_10px_25px_rgba(0,114,206,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>I'm Ready — Start Triage</span>
          <span className="transform group-hover:translate-x-1 transition-transform">
            ⚡️
          </span>
        </button>
      </div>
    </div>
  );
}