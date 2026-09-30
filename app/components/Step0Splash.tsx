'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useWeezer } from '../context/WeezerContext';
import { FlyingWIcon } from './SharedUI';

export default function Step00Splash() {
  const router = useRouter();
  const { navigateTo } = useWeezer();

  return (
    <div className="max-w-xl mx-auto text-center py-2 sm:py-6 space-y-5 animate-in fade-in duration-500">
      
      {/* HERO SECTION */}
      <div className="space-y-3">
        <div className="w-16 h-16 bg-[#0072CE] text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <FlyingWIcon className="w-10 h-10 text-white drop-shadow-md" />
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight">
            30 Years of Debates.
            <span className="block text-[#0072CE]">One Definitive Canon.</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            Weezer fans have spent decades arguing over Pinkerton vs. Blue, late-era gems, and unreleased lore. Settle the debate once and for all.
          </p>
        </div>
      </div>

      {/* STACKED REASONS TO PARTICIPATE WITH CLEAN SVG ICONS */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 max-w-md mx-auto text-left">
        
        {/* REASON 1: BUILD YOUR CANON (MUSIC / LIST ICON) */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-blue-100 text-[#0072CE] rounded-xl flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-2"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 leading-tight">Build Your Canon</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug">
              Order your personal 1–206 master song list from Blue through SZNZ.
            </p>
          </div>
        </div>

        {/* REASON 2: CLASH WITH FRIENDS (SWORDS / MATCHUP ICON) */}
        <div className="flex items-center gap-3.5 border-t border-slate-200/60 pt-3">
          <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 leading-tight">Clash With Friends</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug">
              Compare taste alignment scores and uncover your biggest track wars.
            </p>
          </div>
        </div>

        {/* REASON 3: GLOBAL CONSENSUS (GLOBE ICON) */}
        <div className="flex items-center gap-3.5 border-t border-slate-200/60 pt-3">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a2.5 2.5 0 002.5-2.5V7a2 2 0 00-2-2h-2c-.53 0-1.04-.21-1.414-.586l-.828-.828A2 2 0 0010.828 3H9a2 2 0 00-2 2v1.935z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 leading-tight">Global Consensus</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug">
              Contribute to live worldwide fan rankings and demographic stats.
            </p>
          </div>
        </div>

      </div>

      {/* CALL TO ACTION BUTTONS */}
      <div className="space-y-2.5 max-w-sm mx-auto pt-1">
        <button
          onClick={() => router.push('/login')}
          className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 px-6 rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer text-sm"
        >
          Create Account & Join Settle The Canon 🚀
        </button>

        <button
          onClick={() => navigateTo('triage')}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-3 px-6 rounded-2xl transition-all cursor-pointer text-xs"
        >
          Start Sorting as Guest 👤
        </button>

        <p className="text-[11px] font-bold text-slate-400 pt-1">
          Already have an account?{' '}
          <button
            onClick={() => router.push('/login')}
            className="text-[#0072CE] hover:underline cursor-pointer font-black"
          >
            Sign In
          </button>
        </p>
      </div>

    </div>
  );
}