'use client';

import React from 'react';
import { useWeezer } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';

/** The dashboard hero's tape strip (StepGarage2's TapeStrip recipe):
 *  yellow label, slight tilt, hard little shadow. */
function TapeStrip({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <span className="inline-block -rotate-2 whitespace-nowrap bg-[#FFE066] px-2.5 py-[5px] text-[10px] font-black uppercase tracking-[0.12em] text-[#231a00] shadow-[0_2px_5px_rgba(0,0,0,0.18)] sm:text-xs sm:tracking-[0.14em]">
        {children}
      </span>
    </div>
  );
}

/** The dashboard hero's button recipe (ink border, hard offset
 *  shadow, press that slides the button onto its shadow), sized for
 *  this page's stacked full-width CTAs. */
const SPLASH_BTN_PRIMARY =
  'w-full cursor-pointer rounded-[14px] border-[2.5px] border-[#0C1220] bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-[3px_3px_0_#0C1220] transition-all hover:bg-sky-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';
const SPLASH_BTN_SECONDARY =
  'w-full cursor-pointer rounded-[14px] border-[2.5px] border-[#0C1220] bg-transparent px-6 py-3 text-xs font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition-all hover:bg-white/60 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';

const ALBUM_PREVIEWS = [
  { title: 'Pinkerton', cover: '/albums/pinkerton.jpg', rot: '-rotate-12 -mr-4 sm:-mr-6', z: 'z-0' },
  { title: 'Green Album', cover: '/albums/green.jpg', rot: '-rotate-6 -mr-4 sm:-mr-6', z: 'z-10' },
  { title: 'The Blue Album', cover: '/albums/blue.jpg', rot: 'rotate-0', z: 'z-20 scale-105' },
  { title: 'Red Album', cover: '/albums/red.jpg', rot: 'rotate-6 -ml-4 sm:-ml-6', z: 'z-10' },
  { title: 'White Album', cover: '/albums/white.jpg', rot: 'rotate-12 -ml-4 sm:-ml-6', z: 'z-0' },
];

export default function Step0Splash() {
  const { navigateTo } = useWeezer();

  return (
    <div className="max-w-xl mx-auto text-center py-0 sm:py-4 space-y-4 sm:space-y-5 animate-in fade-in duration-500">

      {/* HERO SECTION */}
      <div className="space-y-2">
        <div>
          <TapeStrip>All My Favorite Songs</TapeStrip>
          <h1
            className={`mt-3 text-3xl sm:text-4xl text-[#0C1220] tracking-wide leading-tight ${displayFont.className}`}
            style={{ textShadow: '3px 3px 0 rgba(11,30,63,0.35)' }}
          >
            30 Years of Debates.
            <span className="block text-[#0072CE]">One Definitive Ranking.</span>
          </h1>
          <p className="text-xs font-semibold text-[#3D4A63] max-w-md mx-auto mt-2 leading-relaxed">
            Weezer fans have spent decades arguing over albums not named Blue. Help us settle the debate once and for all.
          </p>
        </div>
      </div>

      {/* OVERLAPPING ALBUM ARTWORK FAN VISUAL */}
      <div className="py-1 flex items-center justify-center pointer-events-none select-none">
        <div className="flex items-center justify-center">
          {ALBUM_PREVIEWS.map((album, idx) => (
            <div
              key={idx}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-[3px] border-[#0C1220] ${album.rot} ${album.z} shadow-[3px_3px_0_#0C1220] transition-transform duration-300 shrink-0 bg-slate-900`}
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
      <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] px-4 py-3 space-y-3 max-w-md mx-auto text-left">

        {/* REASON 1: BUILD YOUR CANON */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-[#BDE9FF] text-[#0072CE] rounded-xl border-2 border-[#0C1220] shadow-[2px_2px_0_#0C1220] flex items-center justify-center shrink-0">
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
            <h3 className="text-xs font-black text-[#0C1220] leading-tight">Build Your Personal Rankings</h3>
            <p className="text-[12px] font-medium text-[#3D4A63] mt-0.5 leading-snug">
              Rank 206 canon album songs from Blue through Gold.
            </p>
          </div>
        </div>

        {/* REASON 2: CLASH WITH FRIENDS */}
        <div className="flex items-center gap-3.5 border-t border-[#0C1220]/10 pt-3">
          <div className="w-10 h-10 bg-[#F6A8C1] text-purple-700 rounded-xl border-2 border-[#0C1220] shadow-[2px_2px_0_#0C1220] flex items-center justify-center shrink-0">
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
            <h3 className="text-xs font-black text-[#0C1220] leading-tight">Compare With Friends</h3>
            <p className="text-[12px] font-medium text-[#3D4A63] mt-0.5 leading-snug">
              Compare your rankings with friends to uncover your taste compatibility (or lack thereof).
            </p>
          </div>
        </div>

        {/* REASON 3: GLOBAL CONSENSUS */}
        <div className="flex items-center gap-3.5 border-t border-[#0C1220]/10 pt-3">
          <div className="w-10 h-10 bg-[#8FE3B0] text-emerald-700 rounded-xl border-2 border-[#0C1220] shadow-[2px_2px_0_#0C1220] flex items-center justify-center shrink-0">
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
            <h3 className="text-xs font-black text-[#0C1220] leading-tight">Worldwide Fan Rankings</h3>
            <p className="text-[12px] font-medium text-[#3D4A63] mt-0.5 leading-snug">
              See how you compare to Weezer fans around the world.
            </p>
          </div>
        </div>

      </div>

      {/* CALL TO ACTION BUTTONS */}
      <div className="space-y-2.5 max-w-sm mx-auto pt-1">
        <button
          onClick={() => navigateTo('login', 'signup')}
          className={SPLASH_BTN_PRIMARY}
        >
          Create Account & Start Ranking
        </button>

        <button
          onClick={() => navigateTo('orientation')}
          className={SPLASH_BTN_SECONDARY}
        >
          Start Ranking as a Guest
        </button>

        <p className="text-[11px] font-bold text-[#3D4A63] pt-1">
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