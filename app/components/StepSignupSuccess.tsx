'use client';

import React from 'react';
import { useWeezer } from '../context/WeezerContext';
import { FlyingWIcon } from './SharedUI';

export default function StepSignupSuccess() {
  const { userProfile, navigateTo } = useWeezer();

  const displayName =
    userProfile?.displayName || userProfile?.username || 'Weezer Fan';

  return (
    <div className="max-w-md mx-auto py-10 px-4 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* SUCCESS BADGE & ICON */}
      <div className="space-y-3">
        <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 border-4 border-emerald-400/50">
          <FlyingWIcon className="w-12 h-8 text-white drop-shadow-md" />
        </div>

        <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-200">
          Account Created ✓
        </span>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight">
          Welcome, <span className="text-[#0072CE]">{displayName}</span>!
        </h1>

        <p className="text-sm font-semibold text-slate-500 max-w-sm mx-auto leading-relaxed">
          Your handle is claimed and your profile is ready. Time to establish your definitive canon.
        </p>
      </div>

      {/* PRIMARY & SECONDARY NEXT STEPS */}
      <div className="space-y-3 pt-2">
        {/* PRIMARY CTA: START RANKING */}
        <button
          onClick={() => navigateTo('triage')}
          className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-95 text-white font-black text-base py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer border border-blue-400/30 flex items-center justify-center gap-2 group"
        >
          <span>Start The Gut Check →</span>
        </button>

        {/* SECONDARY CTA: GO TO GARAGE */}
        <button
          onClick={() => navigateTo('dashboard')}
          className="w-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-extrabold text-sm py-3.5 px-6 rounded-2xl transition-all cursor-pointer border border-slate-200"
        >
          Go to Your Garage
        </button>
      </div>

      {/* QUICK HIGHLIGHT CARDS */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200/80">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-left">
          <span className="text-lg">⚡</span>
          <h3 className="font-extrabold text-xs text-slate-900 mt-1">
            206 Songs
          </h3>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            Rapid 5-tier sorting
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-left">
          <span className="text-lg">📊</span>
          <h3 className="font-extrabold text-xs text-slate-900 mt-1">
            Taste DNA
          </h3>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            Compare with friends
          </p>
        </div>
      </div>
    </div>
  );
}