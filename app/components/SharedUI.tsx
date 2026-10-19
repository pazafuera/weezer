'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ALBUMS_BY_ID, FULL_SONG_POOL } from '../data/constants';
import { countCategorizedSongs } from '../context/WeezerContext';
import type { AppStep, TriageValue } from '../context/WeezerContext';

// OFFICIAL WEEZER FLYING-W LOGO
export function FlyingWIcon({ className = "w-8 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 550" className={className} fill="currentColor">
      <path d="M 0,0 L 240,0 L 330,260 L 500,150 L 670,260 L 760,0 L 1000,0 L 1000,65 L 870,65 L 870,125 L 960,125 L 960,190 L 760,190 L 630,540 L 500,310 L 370,540 L 240,190 L 40,190 L 40,125 L 130,125 L 130,65 L 0,65 Z" />
    </svg>
  );
}

// HELP BUTTON — the "?" affordance for the triage step's chrome
// (deck progress row + list progress bar; both modes carry one,
// styled and wired identically from this single component). The
// help sheet itself lives in AppShell; clicking dispatches the
// 'weezer:open-help' window event AppShell listens for — the same
// window-event pattern as the deck tutorial replay
// ('weezer:replay-tutorial'), so no props need plumbing through
// page.tsx.
export function HelpButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('weezer:open-help'))}
      aria-label="Help"
      title="Help"
      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm leading-none shadow-xs transition-colors cursor-pointer"
    >
      ?
    </button>
  );
}

// SORTING-INCOMPLETE NOTICE — the slim amber heads-up at the top
// of the Refine (rank_buckets) and My Rankings / Final Review
// (master) steps when the user got there without finishing triage
// (owner, Oct 18). Both steps unlock on partial sorting, and both
// only ever show the songs sorted so far — the notice says so
// plainly, offers the way back to triage, and otherwise gets out
// of the way: it never blocks, and it is NOT dismissible (it
// renders for exactly as long as the condition is true).
// "Finished" = every catalog song categorized — a real bucket OR
// a "Don't Know It" mark (countCategorizedSongs, the same signal
// the menu and dashboard use); at a full 206 it renders nothing.
// The Keep Sorting action is drilled from page.tsx as
// navigateTo('triage') — the normal navigation path, guards and
// URL sync intact.
export function SortingIncompleteNotice({
  triageMap,
  onKeepSorting,
}: {
  triageMap: Record<string, TriageValue>;
  onKeepSorting: () => void;
}) {
  const sortedCount = countCategorizedSongs(triageMap);
  if (sortedCount >= FULL_SONG_POOL.length) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 shadow-xs">
      <p className="text-xs sm:text-sm font-semibold text-amber-900 leading-relaxed text-center">
        Sorting isn&apos;t finished yet — {sortedCount} of {FULL_SONG_POOL.length} songs
        sorted. You can keep going here, but this only covers the songs
        you&apos;ve sorted so far.{' '}
        <button
          type="button"
          onClick={onKeepSorting}
          className="font-black text-[#0072CE] hover:underline cursor-pointer whitespace-nowrap"
        >
          Keep sorting →
        </button>
      </p>
    </div>
  );
}

// GUARD NOTICE — the explanation that appears on a landing the
// progression guard rewrote (UAT P-1). Before this, tapping a
// locked destination (My Rankings, the Sweater Thread, Refine)
// silently landed the user on an earlier step with no word about
// why — the single mechanism behind most "I keep getting stuck"
// reports. The notice names the page the user asked for, the
// condition that unlocks it, and where they are instead. It is
// dismissible, and context clears it on the next navigation that
// isn't itself a rewrite, so it explains one landing and leaves.
// Copy is derived from the guard map (resolveGuardedStep): the
// only rewrites that exist are rank_buckets → triage and
// master/wrapped → rank_buckets or triage, and every string
// below is true for its pair — the unlock gate for My Rankings
// and the Sweater Thread is a refined list, and Refine is the
// step that produces it; the gate for Refine is one rated song,
// and the Gut Check (triage) is where rating happens.
const GUARD_REQUESTED_NAMES: Partial<Record<AppStep, string>> = {
  master: 'My Rankings',
  wrapped: 'Your Sweater Thread',
  rank_buckets: 'Refine',
};

function guardNoticeText(requested: AppStep, landed: AppStep): string {
  if (requested === 'rank_buckets') {
    return "Refine unlocks once you've rated a song — you're in the Gut Check, where that happens.";
  }
  const name = GUARD_REQUESTED_NAMES[requested] ?? 'That page';
  if (landed === 'rank_buckets') {
    return `${name} unlocks once you've refined your rankings — you're in Refine, the step that unlocks it.`;
  }
  return `${name} unlocks once you've refined your rankings — that starts with sorting songs here in the Gut Check.`;
}

export function GuardNotice({
  notice,
  onDismiss,
}: {
  notice: { requested: AppStep; landed: AppStep } | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 shadow-xs flex items-start gap-2 mb-4">
      <p className="flex-1 text-xs sm:text-sm font-semibold text-amber-900 leading-relaxed">
        {guardNoticeText(notice.requested, notice.landed)}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 w-8 h-8 -mr-1.5 -mt-1 flex items-center justify-center rounded-full text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// BULLETPROOF ARTWORK COMPONENT
export function AlbumArtwork({ albumId, className = "" }: { albumId: string; className?: string }) {
  const album = ALBUMS_BY_ID[albumId];
  const src = album ? album.cover : "/albums/fallback.jpg";
  const alt = album ? album.name : "Unknown Album";
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      onError={(e) => {
        // Prevent infinite loops if the fallback image itself is missing
        if (!e.currentTarget.src.endsWith("/albums/fallback.jpg")) {
          e.currentTarget.src = "/albums/fallback.jpg";
        }
      }}
    />
  );
}

export function AudioPreviewButton({ title, compact = false, large = false }: { title: string; compact?: boolean; large?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clear cached audio when title changes (prevents playing previous song in Gauntlet)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, [title]);

  // Listen for global kill switch
  useEffect(() => {
    const handleKillAudio = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener('kill-all-audio', handleKillAudio);
    return () => window.removeEventListener('kill-all-audio', handleKillAudio);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    window.dispatchEvent(new Event('kill-all-audio'));

    try {
      setIsLoading(true);
      
      if (!audioRef.current) {
        const res = await fetch(`https://itunes.apple.com/search?term=Weezer+${encodeURIComponent(title)}&entity=song&limit=1`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
          audioRef.current = new Audio(data.results[0].previewUrl);
          audioRef.current.onended = () => setIsPlaying(false);
        } else {
          console.warn("No audio preview found for this song.");
          setIsLoading(false);
          return;
        }
      }

      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
        compact 
          ? 'w-7 h-7 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs' 
          : large
          ? 'w-16 h-16 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0072CE]'
          : 'w-10 h-10 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0072CE]'
      } ${
        isPlaying 
          ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 border-amber-500 shadow-sm ring-2 ring-amber-200' 
          : 'text-slate-600'
      }`}
      title="Play 30s Preview"
    >
      {isLoading ? (
        <span className={`block ${large ? 'w-5 h-5' : 'w-3 h-3'} border-2 border-current border-t-transparent rounded-full animate-spin`} />
      ) : isPlaying ? (
        <span className={`font-black leading-none tracking-tighter ${compact ? 'text-[9px]' : large ? 'text-lg' : 'text-xs'}`}>||</span>
      ) : (
        <span className={`font-black leading-none ml-0.5 ${compact ? 'text-[10px]' : large ? 'text-xl' : 'text-sm'}`}>▶</span>
      )}
    </button>
  );
}