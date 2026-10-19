'use client';

import React, { useState, useEffect } from 'react';
import { Song } from '../data/constants';
import { AudioPreviewButton } from './SharedUI';

const K_FACTOR = 32;

export default function Step1_5Matchups({
  songs,
  bucketTitle,
  onComplete
}: {
  songs: Song[];
  bucketTitle: string;
  onComplete: (sortedSongs: Song[]) => void;
}) {
  const [round, setRound] = useState(1);
  const [elos, setElos] = useState<Record<string, number>>({});
  const [currentPair, setCurrentPair] = useState<[Song, Song] | null>(null);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);

  // Dynamic round calculation: Min 10, Max 20, or half the bucket size
  const totalRounds = Math.min(Math.max(10, Math.ceil(songs.length / 2)), 20);

  useEffect(() => {
    if (songs.length < 2) {
      onComplete(songs);
      return;
    }
    const initialElos: Record<string, number> = {};
    songs.forEach(s => initialElos[s.id] = 1000);
    setElos(initialElos);
    pickRandomPair(songs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs]);

  const pickRandomPair = (pool: Song[]) => {
    const idx1 = Math.floor(Math.random() * pool.length);
    let idx2 = Math.floor(Math.random() * pool.length);
    while (idx1 === idx2) idx2 = Math.floor(Math.random() * pool.length);
    setCurrentPair([pool[idx1], pool[idx2]]);
  };

  const handlePick = (winnerIdx: 0 | 1) => {
    if (!currentPair || animating) return;
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kill-all-audio'));
    }

    setAnimating(winnerIdx === 0 ? 'left' : 'right');
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch (e) { /* ignore */ }
    }

    setTimeout(() => {
      const winner = currentPair[winnerIdx];
      const loser = currentPair[winnerIdx === 0 ? 1 : 0];

      const rA = elos[winner.id] || 1000;
      const rB = elos[loser.id] || 1000;

      const expectedA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
      const expectedB = 1 / (1 + Math.pow(10, (rA - rB) / 400));

      const newElos = {
        ...elos,
        [winner.id]: rA + K_FACTOR * (1 - expectedA),
        [loser.id]: rB + K_FACTOR * (0 - expectedB)
      };
      
      setElos(newElos);

      if (round >= totalRounds) {
        const sorted = [...songs].sort((a, b) => (newElos[b.id] || 1000) - (newElos[a.id] || 1000));
        onComplete(sorted);
      } else {
        setRound(prev => prev + 1);
        pickRandomPair(songs);
        setAnimating(null);
      }
    }, 400);
  };

  // The cards are role="button" divs — give them the keyboard
  // behaviour the role promises (they were tap/click-only, so a
  // keyboard user had no way to pick at all).
  const handleCardKeyDown = (e: React.KeyboardEvent, idx: 0 | 1) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePick(idx);
    }
  };

  if (!currentPair) return null;

  return (
    <div className="flex flex-col h-[80vh] py-6 px-4 max-w-lg mx-auto animate-in fade-in duration-500">
      <div className="text-center mb-6 mt-3 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Matchup {round} of {totalRounds}
        </span>
        <h2 className="text-2xl font-black text-slate-900 mt-1">Which {bucketTitle} is Better?</h2>
        <p className="text-sm font-bold text-slate-500">Tap your favorite to give it a boost.</p>
      </div>

      <div className="flex-1 flex flex-col gap-4 relative min-h-0">
        {/* OPTION A */}
        <div
          onClick={() => handlePick(0)}
          onKeyDown={(e) => handleCardKeyDown(e, 0)}
          role="button"
          tabIndex={0}
          className={`flex-1 rounded-3xl border-2 px-4 pt-4 pb-10 sm:px-6 sm:pt-6 sm:pb-12 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${
            animating === 'left' ? 'bg-[#0072CE] border-[#0072CE] text-white scale-105 shadow-2xl z-10' :
            animating === 'right' ? 'bg-slate-100 border-slate-200 opacity-40 scale-95' :
            'bg-white border-slate-200 hover:border-blue-300 shadow-sm'
          }`}
        >
          <h3 className={`text-2xl sm:text-3xl font-black tracking-tighter leading-tight text-center mb-2 line-clamp-3 ${animating === 'left' ? 'text-white' : 'text-slate-900'}`}>
            {currentPair[0].title}
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${animating === 'left' ? 'text-blue-200' : 'text-slate-400'}`}>
            {currentPair[0].album}
          </p>
          
          <div onClick={(e) => e.stopPropagation()}>
            <AudioPreviewButton title={currentPair[0].title} />
          </div>
        </div>

        {/* VS GRAPHIC */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-sm shadow-xl z-20 border-4 border-slate-50 pointer-events-none">
          VS
        </div>

        {/* OPTION B */}
        <div
          onClick={() => handlePick(1)}
          onKeyDown={(e) => handleCardKeyDown(e, 1)}
          role="button"
          tabIndex={0}
          className={`flex-1 rounded-3xl border-2 px-4 pt-10 pb-4 sm:px-6 sm:pt-12 sm:pb-6 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${
            animating === 'right' ? 'bg-amber-400 border-amber-500 text-slate-900 scale-105 shadow-2xl z-10' :
            animating === 'left' ? 'bg-slate-100 border-slate-200 opacity-40 scale-95' :
            'bg-white border-slate-200 hover:border-amber-300 shadow-sm'
          }`}
        >
          <h3 className="text-2xl sm:text-3xl font-black tracking-tighter leading-tight text-center mb-2 line-clamp-3">
            {currentPair[1].title}
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${animating === 'right' ? 'text-amber-700' : 'text-slate-400'}`}>
            {currentPair[1].album}
          </p>
          
          <div onClick={(e) => e.stopPropagation()}>
            <AudioPreviewButton title={currentPair[1].title} />
          </div>
        </div>
      </div>
      
      <div className="text-center mt-6 shrink-0">
        {/* The only exit this interstitial has — before any pick it
            is honestly "Skip Pre-Sort"; after picks exist, the same
            control abandons the session and its results are lost,
            so the label says exactly that instead of inviting a
            tap under a false name. (Abandoning loses only the
            matchup session; the bucket work outside persists.) */}
        <button
          onClick={() => onComplete(songs)}
          className="min-h-[44px] px-4 text-sm font-black text-slate-500 underline underline-offset-4 hover:text-slate-700 cursor-pointer"
        >
          {round <= 1
            ? 'Skip Pre-Sort'
            : `Exit and discard ${round - 1} pick${round - 1 === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}