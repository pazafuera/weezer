'use client';

import React from 'react';
import { FlyingWIcon, AlbumArtwork } from './SharedUI';

const FEATURED_ALBUM_IDS = [
  'blue',
  'pinkerton',
  'green',
  'ok-human',
  'white',
  'maladroit',
];

export default function Step0Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-12 sm:space-y-16 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl mx-auto px-4">
      {/* HERO HEADER */}
      <div className="text-center pt-6 sm:pt-8 space-y-4">
        <div className="flex justify-center mb-2">
          <div className="relative inline-block">
            <div className="absolute -inset-2 bg-blue-500/20 blur-xl rounded-full" />
            <div className="relative w-20 h-20 bg-[#0072CE] text-white rounded-3xl flex items-center justify-center shadow-2xl border-4 border-blue-200/50 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <FlyingWIcon className="w-13 h-13 drop-shadow-md" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tighter leading-[1.05]">
          All My Favorite <span className="text-[#0072CE]">Songs.</span>
        </h1>

        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
          The Definitive Weezer Song Ranking Project
        </p>

        <p className="text-sm sm:text-base font-medium text-slate-600 max-w-lg mx-auto leading-relaxed pt-1">
          30+ years of record debates. Zero consensus. Help build the community
          rankings across 206 canonical tracks, b-sides, and rarities.
        </p>
      </div>

      {/* ALBUM ARTWORK MOSAIC */}
      <div className="relative">
        <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 py-2 overflow-hidden px-4">
          {FEATURED_ALBUM_IDS.map((albumId, idx) => (
            <div
              key={albumId}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl border-2 border-white transform hover:-translate-y-2 hover:z-20 transition-all duration-200 shrink-0 bg-slate-800"
              style={{
                transform: `rotate(${
                  (idx % 2 === 0 ? 1 : -1) * (idx + 1) * 2.5
                }deg)`,
              }}
            >
              <AlbumArtwork
                albumId={albumId}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* GAMEPLAY LOOP CARDS */}
      <div className="space-y-4">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            How The Project Works
          </span>
        </div>

        {/* STEP 1: GUT CHECK */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#0072CE] text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              1
            </div>
            <h3 className="text-lg font-black text-slate-950 tracking-tight">
              The Gut Check
            </h3>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
            Rapidly sort 206 songs into 5 instant buckets (Banger, Lowkey Slaps,
            Mid, Skip, Trash) based on pure instinct.
          </p>
        </div>

        {/* STEP 2: HEAD-TO-HEAD MATCHUPS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-amber-300 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-500 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              2
            </div>
            <h3 className="text-lg font-black text-slate-950 tracking-tight">
              Head-to-Head Refinement
            </h3>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
            Run quick head-to-head comparisons inside your top buckets to build
            your precise #1 to #206 master ranking list.
          </p>
        </div>

        {/* STEP 3: SWEATER THREAD */}
        <div className="bg-slate-950 border border-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              3
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-tight">
                The Sweater Thread
              </h3>
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-300 leading-relaxed">
            Unlock your Fandom Archetype, Taste DNA, Blue vs. Pinkerton
            tug-of-war, Listening Age, and compare your rankings against
            community consensus.
          </p>
        </div>
      </div>

      {/* PRIMARY CTA */}
      <div className="space-y-2 text-center pt-2">
        <button
          onClick={onStart}
          className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-[0.99] text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-[0_10px_25px_rgba(0,114,206,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>Start The Project</span>
          <span className="transform group-hover:translate-x-1 transition-transform">
            🤘
          </span>
        </button>

        <p className="text-[11px] font-bold text-slate-400">
          Takes ~3 minutes • Unsaved local progress or sign in to sync
        </p>
      </div>
    </div>
  );
}
