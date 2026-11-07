'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ALBUMS_BY_ID, FULL_SONG_POOL } from '../data/constants';
import { PREVIEW_MAP } from '../data/previewMap';
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

// UNIFORM SHARE BUTTON (owner, Nov 5): ONE button style for
// every save/share action — the Sweater Thread's SHARE MY
// RESULTS hero (Step4Wrapped's SmartShareModule) and the
// shareable cards' Share button (ShareablesGallery's LibraryItem
// and ThumbnailItem modal). Brand-blue fill, white font-black
// text, 3px ink border, hard offset shadow, and the Round 1
// press recipe (active translate + shadow shrink) are defined
// HERE, once; call sites add only their size/layout and the
// state background. The resting fill is deliberately NOT in
// this string — the gallery buttons flip to emerald/rose on
// saved/failed, and their conditional background composition
// (default 'bg-[#0072CE] hover:bg-blue-600') picks the fill
// exactly as it did before this string existed. No icon or
// emoji rides on either button (the 📸 is gone — also owner,
// Nov 5).
export const SHARE_BUTTON_CLASS =
  'text-white font-black border-[3px] border-[#0C1220] shadow-[3px_3px_0_#0C1220] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220] cursor-pointer';

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
      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm leading-none shadow-xs transition-colors cursor-pointer border-2 border-[#0C1220]"
    >
      ?
    </button>
  );
}

// SORTING-INCOMPLETE NOTICE — the amber heads-up at the top of
// every Refine stage list (rank_buckets) and of My Rankings /
// Final Review (master) when the user got there without finishing
// triage (owner, Oct 18). Both steps unlock on partial sorting,
// and both only ever show the songs sorted so far — the notice
// says so plainly and offers the way back to triage. It never
// blocks, and it is NOT dismissible (it renders for exactly as
// long as the condition is true).
// Nov 3 (owner): the original slim pale-amber banner was too easy
// to miss, and the copy rambled — the notice is now a solid amber
// block with dark text and a strong border, and the copy is two
// short sentences. One refinement surface deliberately does NOT
// carry it: the matchups interstitial (Step1_5Matchups) is a
// fixed-height (80vh) full-view takeover with no room for a
// banner inside its head-to-head layout — the notice brackets it
// instead, sitting on the stage list the user came from and the
// one they return to.
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
    <div className="bg-amber-400 border-[3px] border-[#0C1220] rounded-2xl px-4 py-3 shadow-[2px_2px_0_rgba(11,30,63,0.85)]">
      <p className="text-sm sm:text-base font-bold text-slate-950 leading-snug text-center">
        You haven&apos;t finished sorting — {sortedCount} of {FULL_SONG_POOL.length} songs
        sorted. This page only covers the songs you&apos;ve sorted so far.{' '}
        <button
          type="button"
          onClick={onKeepSorting}
          className="font-black text-[#0072CE] underline underline-offset-2 hover:text-blue-800 cursor-pointer whitespace-nowrap"
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

// Save-failure notice, same banner pattern as GuardNotice above:
// renders when the rankings sync gives up after its retries (see
// WeezerContext's syncNotice). The unsaved changes are retained
// and retried on the next edit or flush — this banner exists so a
// failed save is never silent (Oct 22 save-race fix).
export function SyncNotice({
  show,
  onDismiss,
}: {
  show: boolean;
  onDismiss: () => void;
}) {
  if (!show) return null;
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 shadow-xs flex items-start gap-2 mb-4">
      <p className="flex-1 text-xs sm:text-sm font-semibold text-rose-900 leading-relaxed">
        Your latest ranking changes haven&apos;t saved yet — check your
        connection. They&apos;re still on this device and the app will keep
        trying.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 w-8 h-8 -mr-1.5 -mt-1 flex items-center justify-center rounded-full text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
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

// FALLBACK PREVIEW PICK — only for songs with no PREVIEW_MAP entry.
// Mirrors the resolver's rules (preview_map_resolver.py): a live search
// result is admitted only when its artist is Weezer, its base title
// matches, and version qualifiers (demo / hindi / teaser / live / …)
// are penalized. Anything less is how the button used to end up
// playing tribute acts and alternate mixes.
function normPreviewText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function previewBaseTitle(s: string): string {
  let t = s || '';
  let prev = '';
  while (prev !== t) {
    prev = t;
    t = t.replace(/\s*[\(\[][^\(\)\[\]]*[\)\]]\s*$/, '').trim();
  }
  t = t.replace(/\s+(feat\.?|ft\.)\s+.*$/i, '').trim();
  return normPreviewText(t);
}

const PREVIEW_QUALIFIER_PENALTIES: Array<[string, number]> = [
  ['pre production', 100],
  ['demo', 100],
  ['hindi', 100],
  ['teaser', 100],
  ['instrumental', 100],
  ['karaoke', 100],
  ['radio remix', 80],
  ['acoustic', 60],
  ['live', 120],
  ['remix', 40],
  ['mix', 30],
  ['single version', 5],
  ['bonus track', 5],
  ['rarities version', 5],
];

function previewQualifierPenalty(rawTitle: string): number {
  const n = ` ${normPreviewText(rawTitle)} `;
  let pen = 0;
  const hit = new Set<string>();
  for (const [token, p] of PREVIEW_QUALIFIER_PENALTIES) {
    if (n.includes(` ${token} `)) {
      if (token === 'mix' && hit.has('remix')) continue;
      if (token === 'remix' && hit.has('radio remix')) continue;
      pen += p;
      hit.add(token);
    }
  }
  return pen;
}

function pickFallbackPreview(results: any[], title: string, album?: string): string | null {
  const songBase = previewBaseTitle(title);
  let bestUrl: string | null = null;
  let bestScore = Infinity;
  for (const r of results || []) {
    if (!r || !r.previewUrl) continue;
    if (normPreviewText(r.artistName) !== 'weezer') continue;
    const trackBase = previewBaseTitle(r.trackName);
    let tier: number;
    if (trackBase === songBase) tier = 0;
    else if (
      trackBase.startsWith(songBase) || trackBase.endsWith(songBase) ||
      songBase.startsWith(trackBase) || songBase.endsWith(trackBase)
    ) tier = 8;
    else continue;
    let coll = 14;
    if (album && normPreviewText(r.collectionName).includes(normPreviewText(album))) coll = 2;
    const score = tier * 1000 + previewQualifierPenalty(r.trackName) * 10 + coll;
    if (score < bestScore) {
      bestScore = score;
      bestUrl = r.previewUrl;
    }
  }
  return bestUrl;
}

export function AudioPreviewButton({ id, title, album, compact = false, large = false }: { id: string; title: string; album?: string; compact?: boolean; large?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clear cached audio when the song changes (prevents playing previous song in Gauntlet)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, [id]);

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
        // Verified map first — no live search for mapped songs. The
        // old limit=1 first-result fetch played tribute acts and
        // alternate mixes whenever search ranking felt like it.
        let previewUrl: string | null = PREVIEW_MAP[id]?.previewUrl ?? null;

        if (!previewUrl) {
          const res = await fetch(`https://itunes.apple.com/search?term=Weezer+${encodeURIComponent(title)}&entity=song&limit=25`);
          const data = await res.json();
          previewUrl = pickFallbackPreview(data.results || [], title, album);
        }

        if (previewUrl) {
          audioRef.current = new Audio(previewUrl);
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