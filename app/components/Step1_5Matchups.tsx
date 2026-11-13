'use client';

import React, { useState, useEffect } from 'react';
import { Song } from '../data/constants';
import { AudioPreviewButton, SortingIncompleteNotice } from './SharedUI';
import type { TriageValue } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';

export default function Step1_5Matchups({
  songs,
  bucketTitle,
  onComplete,
  triageMap,
  onKeepSorting
}: {
  songs: Song[];
  bucketTitle: string;
  onComplete: (sortedSongs: Song[]) => void;
  /** When provided, the sorting-incomplete notice renders INSIDE
   *  the takeover (owner ruling, Nov 7, 2026 — it previously only
   *  bracketed the takeover on the stage list). The notice
   *  self-gates at a full 206 and is non-dismissible, exactly as
   *  on the Refine stage lists and Final Review. */
  triageMap?: Record<string, TriageValue>;
  onKeepSorting?: () => void;
}) {
  const [round, setRound] = useState(1);
  const [working, setWorking] = useState<Song[]>([]);
  const [cursor, setCursor] = useState(0);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);

  // Dynamic round calculation: Min 10, Max 20, or half the bucket size
  const totalRounds = Math.min(Math.max(10, Math.ceil(songs.length / 2)), 20);

  // NEIGHBOR SWEEP (Nov 12, 2026) — replaces the random-pair Elo
  // engine. The old model drew random pairs, scored them in a
  // fresh Elo table, and overwrote the bucket order with the
  // session result: on a big bucket a 20-pick session touched
  // barely half the songs, and re-running it re-shuffled instead
  // of refining. Now the session works on the bucket's CURRENT
  // order: it presents neighboring songs (positions cursor and
  // cursor + 1), and picking the lower one swaps the pair —
  // every pick is a small, real improvement to the order, and
  // the next session starts from wherever the order now stands,
  // so sessions compound. The sweep starts at a random offset
  // each session (a big bucket gets a different stretch covered
  // each time) and wraps to the top when it runs off the end;
  // it never pairs the last song against the first.
  useEffect(() => {
    if (songs.length < 2) {
      onComplete(songs);
      return;
    }
    setWorking([...songs]);
    setCursor(Math.floor(Math.random() * (songs.length - 1)));
    setRound(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs]);

  const currentPair: [Song, Song] | null =
    working.length >= 2 && cursor + 1 < working.length
      ? [working[cursor], working[cursor + 1]]
      : null;

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
      // Picking the upper song holds the pair as-is; picking the
      // lower one swaps them, so the winner climbs one spot.
      const next = [...working];
      if (winnerIdx === 1) {
        const tmp = next[cursor];
        next[cursor] = next[cursor + 1];
        next[cursor + 1] = tmp;
      }
      if (round >= totalRounds) {
        onComplete(next);
      } else {
        setWorking(next);
        let nextCursor = cursor + 2;
        if (nextCursor + 1 >= next.length) nextCursor = 0;
        setCursor(nextCursor);
        setRound(prev => prev + 1);
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
      {triageMap && onKeepSorting && (
        <div className="shrink-0 mb-4">
          <SortingIncompleteNotice triageMap={triageMap} onKeepSorting={onKeepSorting} />
        </div>
      )}
      <div className="text-center mb-4 mt-2 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
          Matchup {round} of {totalRounds}
        </span>
        <h2 className={`${displayFont.className} text-[27px] text-[#0C1220] mt-1`}>Which {bucketTitle} is Better?</h2>
        <p className="text-sm font-bold text-[#3D4A63]">Tap your favorite — winners climb.</p>
      </div>

      <div className="flex-1 flex flex-col gap-4 relative min-h-0">
        {/* OPTION A */}
        <div
          onClick={() => handlePick(0)}
          onKeyDown={(e) => handleCardKeyDown(e, 0)}
          role="button"
          tabIndex={0}
          className={`flex-1 rounded-[18px] border-[3px] px-4 pt-3 pb-6 sm:px-6 sm:pt-5 sm:pb-8 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${
            animating === 'left' ? 'bg-[#0072CE] border-[#0072CE] text-white scale-105 shadow-2xl z-10' :
            animating === 'right' ? 'bg-slate-100 border-slate-200 opacity-40 scale-95' :
            'bg-white border-[#0C1220] shadow-[4px_4px_0_rgba(11,30,63,0.85)]'
          }`}
        >
          {/* shrink-0 on the title is load-bearing: in a
              flex column, line-clamp's overflow:hidden makes
              the title the one child the layout may shrink —
              when the Nov 5, 2026 refresh added album covers
              inside this fixed 80vh stack, the column started
              crushing the title to zero and the songs went
              nameless on phone heights. The covers came back
              out on Nov 12, 2026 (owner: this experience must
              never scroll), restoring the fit — and the
              shrink-0 guards stay, so no future addition can
              silently eat the title again. */}
          <h3 className={`${displayFont.className} shrink-0 text-2xl sm:text-3xl leading-tight text-center mb-2 line-clamp-3 ${animating === 'left' ? 'text-white' : 'text-[#0C1220]'}`}>
            {currentPair[0].title}
          </h3>
          <p className={`shrink-0 text-xs font-bold uppercase tracking-widest mb-4 ${animating === 'left' ? 'text-blue-200' : 'text-[#3D4A63]'}`}>
            {currentPair[0].album}
          </p>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <AudioPreviewButton id={currentPair[0].id} title={currentPair[0].title} album={currentPair[0].album} />
          </div>
        </div>

        {/* VS GRAPHIC — a rotated tape chip since the Round 2
            refresh (was a slate circle); same centered anchor
            between the two cards. */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-3 bg-[#FFE066] text-[#231a00] font-black uppercase tracking-[0.14em] text-sm px-4 py-[7px] border-[2.5px] border-[#0C1220] shadow-[0_2px_5px_rgba(0,0,0,0.18)] z-20 pointer-events-none flex items-center justify-center">
          VS
        </div>

        {/* OPTION B */}
        <div
          onClick={() => handlePick(1)}
          onKeyDown={(e) => handleCardKeyDown(e, 1)}
          role="button"
          tabIndex={0}
          className={`flex-1 rounded-[18px] border-[3px] px-4 pt-6 pb-3 sm:px-6 sm:pt-8 sm:pb-5 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden ${
            animating === 'right' ? 'bg-amber-400 border-amber-500 text-slate-900 scale-105 shadow-2xl z-10' :
            animating === 'left' ? 'bg-slate-100 border-slate-200 opacity-40 scale-95' :
            'bg-white border-[#0C1220] shadow-[4px_4px_0_rgba(11,30,63,0.85)]'
          }`}
        >
          <h3 className={`${displayFont.className} shrink-0 text-2xl sm:text-3xl leading-tight text-center mb-2 line-clamp-3 text-[#0C1220]`}>
            {currentPair[1].title}
          </h3>
          <p className={`shrink-0 text-xs font-bold uppercase tracking-widest mb-4 ${animating === 'right' ? 'text-amber-700' : 'text-[#3D4A63]'}`}>
            {currentPair[1].album}
          </p>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <AudioPreviewButton id={currentPair[1].id} title={currentPair[1].title} album={currentPair[1].album} />
          </div>
        </div>
      </div>
      
      <div className="text-center mt-4 shrink-0">
        {/* The only exit this interstitial has — before any pick it
            is honestly "Skip Pre-Sort"; after picks exist, every
            pick has already improved the working order (each one
            is a swap, not a score in some table), so exiting
            KEEPS them and the label says that. */}
        <button
          onClick={() => onComplete(working.length >= 2 ? working : songs)}
          className="min-h-[44px] px-4 text-sm font-black text-[#3D4A63] underline underline-offset-4 hover:text-[#0C1220] cursor-pointer"
        >
          {round <= 1
            ? 'Skip Pre-Sort'
            : `Exit and keep ${round - 1} pick${round - 1 === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}