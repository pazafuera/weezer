'use client';

import React from 'react';
import { useWeezer } from '../context/WeezerContext';

const ALBUM_PREVIEWS = [
  { title: 'Pinkerton', cover: '/albums/pinkerton.jpg', rot: '-rotate-12 -mr-4 sm:-mr-6', z: 'z-0' },
  { title: 'Green Album', cover: '/albums/green.jpg', rot: '-rotate-6 -mr-4 sm:-mr-6', z: 'z-10' },
  { title: 'The Blue Album', cover: '/albums/blue.jpg', rot: 'rotate-0', z: 'z-20 scale-105 shadow-xl ring-2 ring-blue-500/50' },
  { title: 'Red Album', cover: '/albums/red.jpg', rot: 'rotate-6 -ml-4 sm:-ml-6', z: 'z-10' },
  { title: 'White Album', cover: '/albums/white.jpg', rot: 'rotate-12 -ml-4 sm:-ml-6', z: 'z-0' },
];

export default function Step0Splash() {
  const { navigateTo } = useWeezer();

  return (
    <div className="max-w-xl mx-auto text-center py-2 sm:py-6 space-y-6 animate-in fade-in duration-500">
      
      {/* HERO SECTION */}
      <div className="space-y-3 pt-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight">
            30 Years of Debates.
            <span className="block text-[#0072CE]">One Definitive Ranking.</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            Weezer fans have spent decades arguing over albums not named Blue. Help us settle the debate once and for all.
          </p>
        </div>
      </div>

      {/* OVERLAPPING ALBUM ARTWORK FAN VISUAL */}
      <div className="py-3 flex items-center justify-center pointer-events-none select-none">
        <div className="flex items-center justify-center">
          {ALBUM_PREVIEWS.map((album, idx) => (
            <div
              key={idx}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white/90 ${album.rot} ${album.z} shadow-lg transition-transform duration-300 shrink-0 bg-slate-900`}
            >
              <img
                src={album.cover}
                alt={album.title}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* STACKED REASONS TO PARTICIPATE */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 max-w-md mx-auto text-left">
        
        {/* REASON 1: BUILD YOUR CANON */}
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
            <h3 className="text-xs font-black text-slate-900 leading-tight">Build Your Personal Rankings</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5 leading-snug">
              Rank 206 canon album songs from Blue through Gold.
            </p>
          </div>
        </div>

        {/* REASON 2: CLASH WITH FRIENDS */}
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
            <h3 className="text-xs font-black text-slate-900 leading-tight">Compare With Friends</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5 leading-snug">
              Compare your rankings with friends to uncover your taste compatibility (or lack thereof).
            </p>
          </div>
        </div>

        {/* REASON 3: GLOBAL CONSENSUS */}
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
            <h3 className="text-xs font-black text-slate-900 leading-tight">Worldwide Fan Rankings</h3>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5 leading-snug">
              See how you compare to Weezer fans around the world.
            </p>
          </div>
        </div>

      </div>

      {/* CALL TO ACTION BUTTONS */}
      <div className="space-y-2.5 max-w-sm mx-auto pt-1">
        <button
          onClick={() => navigateTo('login', 'signup')}
          className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 px-6 rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer text-sm"
        >
          Create Account & Start Ranking
        </button>

        <button
          onClick={() => navigateTo('orientation')}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-3 px-6 rounded-2xl transition-all cursor-pointer text-xs"
        >
          Start Ranking as a Guest
        </button>

        <p className="text-[11px] font-bold text-slate-400 pt-1">
          Already have an account?{' '}
          <button
            onClick={() => navigateTo('login', 'login')}
            className="text-[#0072CE] hover:underline cursor-pointer font-black"
          >
            Sign In
          </button>
        </p>
      </div>

    </div>
  );
}