'use client';

/**
 * StepGarage2 — the "fan headquarters" dashboard. Built as a LIVE
 * PROTOTYPE step (key: 'garage2') next to the old dashboard from
 * the Muse artifact design Mark approved on Nov 4, 2026
 * (poster-system hero, era shelf, Thread + shareables, Fan Stats
 * feature, game card, fandom row, destinations grid — sorting
 * first, Thread and Fan Stats promoted above the game on Mark's
 * direction later that day). That evening Mark promoted it to
 * THE dashboard: page.tsx renders this component for the
 * 'dashboard' step as well as the 'garage2' alias (his bookmark),
 * and the old StepDashboard stays in the tree, unreferenced, for
 * rollback.
 *
 * Every number on the page is real state from the existing
 * contexts/libs — nothing is hard-coded. Sections are small
 * sub-components in this file so they can be lifted out one by
 * one when the retrofit happens.
 */

import React, { useEffect, useState } from 'react';
import {
  useWeezer,
  countCategorizedSongs,
  getProgressState,
} from '../context/WeezerContext';
import type { AppStep } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import {
  LORE_GAMES,
  TOTAL_STOPS,
  isLoreUnlocked,
  loreGateRemainingAlbums,
  nextStopForTotal,
  stopForTotal,
  youreAtPhrase,
} from '../data/loreGame';
import {
  fanhoodDisplay,
  fanhoodGamesPlayed,
  seriesRowState,
  useFanhood,
} from '../lib/fanhood';
import { fanhoodReconcileSettled } from '../lib/fanhoodSync';
import { ERAS } from './shareables/EraDnaCard';
import { displayFont } from './shareables/fonts';
import WeezerOnboardingModal from './WeezerOnboardingModal';

const TOTAL_SONGS = FULL_SONG_POOL.length;

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className={`${displayFont.className} text-2xl tracking-wide text-slate-950`}
    >
      {children}
    </h2>
  );
}

/** The leaderboard lives inside the lore step: set the session flag
 *  (a fresh mount reads it), fire the event (an already-mounted
 *  lore step hears it), then navigate — the exact order the
 *  AppShell menu's Leaderboard row uses. */
function openLeaderboard(navigateTo: (step: AppStep) => void) {
  try {
    window.sessionStorage.setItem('weezer:open-leaderboard', '1');
  } catch {
    /* private mode — the event path still works */
  }
  window.dispatchEvent(new CustomEvent('weezer:open-leaderboard'));
  navigateTo('lore');
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function ProgressRing({
  fraction,
  complete,
}: {
  fraction: number;
  complete: boolean;
}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="9"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {complete && (
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">
          ✓
        </span>
      )}
    </div>
  );
}

function GarageHero() {
  const { userId, userProfile, triageMap, masterList, navigateTo } =
    useWeezer();
  const categorized = countCategorizedSongs(triageMap);
  const remaining = TOTAL_SONGS - categorized;
  const progress = getProgressState(triageMap, masterList);
  const isDone = categorized >= TOTAL_SONGS;
  const firstName =
    userProfile?.displayName?.trim().split(/\s+/)[0] || null;

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#039AD1] text-white shadow-md">
      {/* Halftone dots — the share-card poster texture, as a CSS
          overlay (the same trick the poster cards draw by hand). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.22) 1.5px, transparent 1.6px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="relative flex items-center gap-5 p-6 sm:gap-8 sm:p-9">
        <div className="min-w-0 flex-1 space-y-4">
          {categorized === 0 ? (
            <>
              <h1
                className={`${displayFont.className} text-4xl leading-[1.05] tracking-wide sm:text-5xl`}
              >
                Every Weezer song. Ranked by you.
              </h1>
              <p className="max-w-md text-sm font-medium leading-relaxed text-sky-50 sm:text-base">
                Sort all {TOTAL_SONGS} songs into five buckets —
                Absolute Bangers, Lowkey Slaps, Mid, Skip, and Trash
                — then fine-tune the order and see what kind of fan
                you are.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigateTo('triage')}
                  className="cursor-pointer rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-md transition-all hover:bg-sky-50 active:scale-95"
                >
                  Start sorting
                </button>
                {!userId && (
                  <button
                    type="button"
                    onClick={() => navigateTo('login', 'signup')}
                    className="cursor-pointer rounded-2xl border-2 border-white px-6 py-3.5 text-sm font-black text-white transition-all hover:bg-white/10 active:scale-95"
                  >
                    Create an account
                  </button>
                )}
              </div>
            </>
          ) : isDone ? (
            <>
              <h1
                className={`${displayFont.className} text-4xl leading-[1.05] tracking-wide sm:text-5xl`}
              >
                It&rsquo;s all sorted, {firstName ?? 'there'}.
              </h1>
              <p className="max-w-md text-sm font-medium leading-relaxed text-sky-50 sm:text-base">
                Every one of the {TOTAL_SONGS} songs, ranked by you.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {progress.isMasterUnlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigateTo('master')}
                      className="cursor-pointer rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-md transition-all hover:bg-sky-50 active:scale-95"
                    >
                      My Rankings
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('rank_buckets')}
                      className="cursor-pointer rounded-2xl border-2 border-white px-6 py-3.5 text-sm font-black text-white transition-all hover:bg-white/10 active:scale-95"
                    >
                      Refine your ranking
                    </button>
                  </>
                ) : (
                  /* Sorted but not yet refined: My Rankings is
                     still guard-locked, so Refine — the step that
                     unlocks it — is the hero's one honest action. */
                  <button
                    type="button"
                    onClick={() => navigateTo('rank_buckets')}
                    className="cursor-pointer rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-md transition-all hover:bg-sky-50 active:scale-95"
                  >
                    Refine your ranking
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h1
                className={`${displayFont.className} text-4xl leading-[1.05] tracking-wide sm:text-5xl`}
              >
                {categorized} of {TOTAL_SONGS} sorted — {remaining} to
                go.
              </h1>
              <p className="max-w-md text-sm font-medium leading-relaxed text-sky-50 sm:text-base">
                Pick up right where you left off.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigateTo('triage')}
                  className="cursor-pointer rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-md transition-all hover:bg-sky-50 active:scale-95"
                >
                  Keep sorting
                </button>
              </div>
            </>
          )}
        </div>
        <ProgressRing
          fraction={categorized / TOTAL_SONGS}
          complete={isDone}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Your shelf — the five eras as record spines                         */
/* ------------------------------------------------------------------ */

/** Short spine names for the eras; the era definitions themselves
 *  (year tests, catalog membership) are the app's ERAS table. */
const SHELF_LABELS: Record<string, string> = {
  blue: 'Blue Era',
  y2k: 'Y2K',
  red: 'Red Era',
  comeback: 'Comeback',
  new: 'New Horizons',
};

function EraShelf() {
  const { triageMap, navigateTo } = useWeezer();

  /** The dashboard's album jump, reused whole: hand the album to
   *  the triage step through sessionStorage and let the deck/list
   *  land on it. An era taps through to its first album in the
   *  pool's order. */
  const jumpToAlbum = (albumName: string | undefined) => {
    if (albumName) {
      try {
        window.sessionStorage.setItem(
          'weezer-triage-jump-album',
          albumName
        );
      } catch {
        /* sessionStorage unavailable — navigate without the jump */
      }
    }
    navigateTo('triage');
  };

  return (
    <section className="space-y-3">
      <SectionHeading>Your shelf</SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ERAS.map((era) => {
          const songs = FULL_SONG_POOL.filter(
            (s) => (s.year || 0) > 0 && era.test(s.year)
          );
          const sorted = songs.filter(
            (s) => triageMap[s.id] !== undefined
          ).length;
          const pct = songs.length
            ? Math.round((sorted / songs.length) * 100)
            : 0;
          return (
            <button
              key={era.key}
              type="button"
              onClick={() => jumpToAlbum(songs[0]?.album)}
              aria-label={`Jump to the ${SHELF_LABELS[era.key] ?? era.name} in Sort — ${sorted} of ${songs.length} sorted`}
              className="group flex cursor-pointer overflow-hidden rounded-3xl border-2 border-slate-200/90 bg-white text-left shadow-xs transition-all hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072CE] focus-visible:ring-offset-1"
            >
              <span
                aria-hidden
                className="w-2.5 shrink-0"
                style={{ backgroundColor: era.color }}
              />
              <span className="min-w-0 flex-1 space-y-1.5 p-4">
                <span
                  className={`${displayFont.className} block text-lg leading-tight tracking-wide text-slate-950 group-hover:text-[#0072CE]`}
                >
                  {SHELF_LABELS[era.key] ?? era.name}
                </span>
                <span className="block text-[11px] font-bold tracking-wide text-slate-400">
                  {era.label}
                </span>
                <span className="block text-xs font-black text-slate-900">
                  {sorted} of {songs.length} sorted
                </span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: era.color,
                    }}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The game card                                                       */
/* ------------------------------------------------------------------ */

/** Where a total sits on the six-stop road, as a 0–100 position:
 *  the reached stop's slot plus the fraction of the leg toward
 *  the next stop. */
function journeyPosition(total: number): number {
  const stop = stopForTotal(total);
  const idx = TOTAL_STOPS.findIndex((s) => s.title === stop.title);
  const next = TOTAL_STOPS[idx + 1];
  if (!next) return 100;
  const frac = Math.min(
    1,
    Math.max(0, (total - stop.min) / (next.min - stop.min))
  );
  return ((idx + frac) / (TOTAL_STOPS.length - 1)) * 100;
}

function JourneyBar({ total }: { total: number }) {
  const stop = stopForTotal(total);
  const reachedIdx = TOTAL_STOPS.findIndex((s) => s.title === stop.title);
  const pos = journeyPosition(total);
  return (
    <div className="space-y-1.5">
      <div className="relative h-2 rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-all duration-700 ease-out"
          style={{ width: `${pos}%` }}
        />
        {TOTAL_STOPS.map((s, i) => (
          <span
            key={s.title}
            aria-hidden
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              i <= reachedIdx ? 'bg-amber-400' : 'bg-white/25'
            }`}
            style={{ left: `${(i / (TOTAL_STOPS.length - 1)) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold tracking-wide text-slate-500">
        <span>{TOTAL_STOPS[0].title}</span>
        <span>{TOTAL_STOPS[TOTAL_STOPS.length - 1].title}</span>
      </div>
    </div>
  );
}

function GameCard() {
  const { userId, triageMap, navigateTo } = useWeezer();
  const record = useFanhood();
  const unlocked = isLoreUnlocked(triageMap);

  /* The record every fanhood surface reads is the DEVICE record;
     a signed-in player's account record merges into it once per
     session (WeezerContext's init fires reconcileAccountFanhood,
     fire-and-forget). This card is a deep-link surface: on a fresh
     origin the device record starts empty, so "no games yet" is
     indistinguishable from "the merge hasn't landed" — and the
     card presented the never-played pitch as fact while the
     account already held finished games (Mark's preview retest,
     Nov 4, 2026). Kick the same reconcile from here and hold a
     loading state until it settles; only a settled-empty record
     earns the pitch. Guests have no account merge to wait for. */
  const [standingSettled, setStandingSettled] = useState(false);
  useEffect(() => {
    if (!userId) {
      setStandingSettled(false);
      return;
    }
    let live = true;
    setStandingSettled(false);
    void fanhoodReconcileSettled(userId).then(() => {
      if (live) setStandingSettled(true);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  if (!unlocked) {
    const remainingAlbums = loreGateRemainingAlbums(triageMap);
    return (
      <button
        type="button"
        onClick={() => navigateTo('triage')}
        className="group w-full cursor-pointer space-y-2 rounded-[2rem] bg-slate-950 p-6 text-left shadow-md transition-all sm:p-8"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            className={`${displayFont.className} text-2xl tracking-wide text-white sm:text-3xl`}
          >
            Can You Get Back to the Shack?
          </h2>
          <span className="shrink-0 text-xs font-black text-slate-500">
            Locked 🔒
          </span>
        </div>
        <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-400">
          {remainingAlbums.length === 2
            ? 'The game unlocks once you\u2019ve sorted the Blue Album and Pinkerton.'
            : remainingAlbums[0] === 'Pinkerton'
              ? 'The Blue Album is sorted — Pinkerton is all that stands between you and the game.'
              : 'Pinkerton is sorted — the Blue Album is all that stands between you and the game.'}
        </p>
        <div className="pt-1 text-xs font-black text-amber-400 group-hover:underline">
          Keep sorting →
        </div>
      </button>
    );
  }

  const display = fanhoodDisplay(record);
  const played = fanhoodGamesPlayed(record);
  const allPlayed = played >= LORE_GAMES.length;
  const upNextIdx = LORE_GAMES.findIndex(
    (g) => seriesRowState(record, g.id) === 'up-next'
  );
  const next = display ? nextStopForTotal(display.depth) : null;
  // Signed in, nothing on the device record yet, and the account
  // merge still in flight: the standing is unresolved, not absent.
  const awaitingStanding = !!userId && !display && !standingSettled;

  return (
    <section className="space-y-4 rounded-[2rem] bg-slate-950 p-6 shadow-md sm:p-8">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        The game
      </p>
      <h2
        className={`${displayFont.className} text-3xl leading-tight tracking-wide text-white sm:text-4xl`}
      >
        Can You Get Back to the Shack?
      </h2>

      {display ? (
        <div className="space-y-3">
          <p className="text-base font-bold text-white">
            {youreAtPhrase(display.stop)} —{' '}
            {display.depth.toLocaleString()} points.
          </p>
          <JourneyBar total={display.depth} />
          {next && (
            <p className="text-sm font-medium text-slate-400">
              {next.pointsTo.toLocaleString()} points to {next.title}.
            </p>
          )}
        </div>
      ) : awaitingStanding ? (
        <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-400">
          Loading your standing…
        </p>
      ) : (
        <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-400">
          Five rounds. Thirty-five questions. One trip through Weezer
          history.
        </p>
      )}

      {awaitingStanding ? null : allPlayed ? (
        <button
          type="button"
          onClick={() => openLeaderboard((s) => navigateTo(s))}
          className="cursor-pointer rounded-2xl bg-amber-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-md transition-all hover:bg-amber-300 active:scale-95"
        >
          See the leaderboard
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigateTo('lore')}
          className="cursor-pointer rounded-2xl bg-amber-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-md transition-all hover:bg-amber-300 active:scale-95"
        >
          Play Round {upNextIdx >= 0 ? upNextIdx + 1 : played + 1}
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sweater Thread + shareables                                         */
/* ------------------------------------------------------------------ */

const SHARE_TILES: {
  title: string;
  line: string;
  tileClass: string;
  titleClass: string;
  lineClass: string;
}[] = [
  {
    title: 'Top 10',
    line: 'Your ten best, on one card.',
    tileClass: 'bg-[#039AD1] hover:bg-[#0284b5]',
    titleClass: 'text-white',
    lineClass: 'text-sky-100',
  },
  {
    title: 'Tier List',
    line: 'All 206, tier by tier.',
    tileClass: 'bg-white border-2 border-slate-200 hover:border-slate-300',
    titleClass: 'text-slate-950',
    lineClass: 'text-slate-500',
  },
  {
    title: 'Your Tribe',
    line: 'What kind of fan are you?',
    tileClass: 'bg-[#8A44F2] hover:bg-[#7c35dd]',
    titleClass: 'text-white',
    lineClass: 'text-violet-100',
  },
  {
    title: 'Era DNA',
    line: 'Five eras, one fan.',
    tileClass: 'bg-slate-900 hover:bg-slate-950',
    titleClass: 'text-white',
    lineClass: 'text-slate-400',
  },
  {
    title: 'Game Card',
    line: 'Your road back, on a card.',
    tileClass: 'bg-slate-950 hover:bg-black',
    titleClass: 'text-amber-400',
    lineClass: 'text-slate-400',
  },
];

function ThreadSection() {
  const { triageMap, masterList, navigateTo } = useWeezer();
  const progress = getProgressState(triageMap, masterList);
  const isSortingComplete =
    countCategorizedSongs(triageMap) >= TOTAL_SONGS;

  if (!progress.isWrappedUnlocked) {
    /* The Thread isn't compiled until the ranking is refined, so
       an incomplete dashboard gets the honest teaser, not a link
       the guard would bounce. Sorted-but-unrefined names its own
       unlock, since "the last song" is already sorted there. */
    return (
      <section className="space-y-2 rounded-[2rem] border-2 border-slate-200/90 bg-white p-6 shadow-xs sm:p-8">
        <h2
          className={`${displayFont.className} text-2xl tracking-wide text-slate-950`}
        >
          Your Sweater Thread
        </h2>
        <p className="text-sm font-medium leading-relaxed text-slate-500">
          {isSortingComplete
            ? 'Your Thread unravels once your ranking is refined.'
            : 'Your Thread unravels when the last song is sorted.'}
        </p>
        {isSortingComplete && (
          <button
            type="button"
            onClick={() => navigateTo('rank_buckets')}
            className="cursor-pointer pt-0.5 text-xs font-black text-[#0072CE] hover:underline"
          >
            Refine your ranking →
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => navigateTo('wrapped')}
        className="group w-full cursor-pointer space-y-2 rounded-[2rem] border-2 border-slate-200/90 bg-white p-6 text-left shadow-xs transition-all hover:border-blue-300 sm:p-8"
      >
        <h2
          className={`${displayFont.className} text-2xl tracking-wide text-slate-950 group-hover:text-[#0072CE] sm:text-3xl`}
        >
          Your Sweater Thread
        </h2>
        <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-500">
          Your whole ranking, unraveled — eras, tiers, and the songs
          that define you.
        </p>
        <div className="pt-1 text-xs font-black text-[#0072CE] group-hover:underline">
          Take a look →
        </div>
      </button>

      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SHARE_TILES.map((tile) => (
          <button
            key={tile.title}
            type="button"
            onClick={() => navigateTo('shareables')}
            className={`flex min-h-[120px] w-40 shrink-0 cursor-pointer flex-col justify-between rounded-3xl p-4 text-left shadow-xs transition-all active:scale-95 ${tile.tileClass}`}
          >
            <span
              className={`${displayFont.className} text-xl leading-tight tracking-wide ${tile.titleClass}`}
            >
              {tile.title}
            </span>
            <span
              className={`text-xs font-semibold leading-snug ${tile.lineClass}`}
            >
              {tile.line}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fan Stats — feature card                                            */
/* ------------------------------------------------------------------ */

/** Fan Stats as a full-width feature card, built to the Thread
 *  card's exact pattern so the two read as a matched pair of
 *  doorways — both promoted above the game (Mark, Nov 4, 2026). */
function FanStatsFeature() {
  const { navigateTo } = useWeezer();

  return (
    <button
      type="button"
      onClick={() => navigateTo('fan_stats')}
      className="group w-full cursor-pointer space-y-2 rounded-[2rem] border-2 border-slate-200/90 bg-white p-6 text-left shadow-xs transition-all hover:border-blue-300 sm:p-8"
    >
      <h2
        className={`${displayFont.className} text-2xl tracking-wide text-slate-950 group-hover:text-[#0072CE] sm:text-3xl`}
      >
        Fan Stats
      </h2>
      <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-500">
        See how your taste stacks up against every other fan.
      </p>
      <div className="pt-1 text-xs font-black text-[#0072CE] group-hover:underline">
        Take a look →
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* In the fandom                                                       */
/* ------------------------------------------------------------------ */

function FandomSection() {
  const { userId, friendsList, navigateTo } = useWeezer();
  const friendsCount =
    userId && Array.isArray(friendsList) ? friendsList.length : 0;

  return (
    <section className="space-y-3">
      <SectionHeading>In the fandom</SectionHeading>
      {/* Fan Stats used to share this grid as a small card; it is
          now the full-width feature card above the game, so the
          grid is gone and Fan Friends stands as a full-width row
          alongside the Leaderboard row. */}
      <button
        type="button"
        onClick={() => navigateTo(userId ? 'friends' : 'login')}
        className="group w-full cursor-pointer space-y-1.5 rounded-3xl border-2 border-slate-200/90 bg-white p-5 text-left shadow-xs transition-all hover:border-slate-300"
      >
        <h3 className="text-base font-black text-slate-950 group-hover:text-[#0072CE]">
          Fan Friends
        </h3>
        <p className="text-xs font-medium leading-relaxed text-slate-500 sm:text-sm">
          {!userId
            ? 'Sign in to compare rankings with friends.'
            : friendsCount > 0
              ? `You're comparing rankings with ${friendsCount} friend${friendsCount === 1 ? '' : 's'}.`
              : 'See what your friends are ranking.'}
        </p>
        <div className="pt-1 text-xs font-black text-[#0072CE] group-hover:underline">
          {userId ? 'Take a look →' : 'Sign in →'}
        </div>
      </button>

      <button
        type="button"
        onClick={() => openLeaderboard((s) => navigateTo(s))}
        className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-3xl border-2 border-slate-200/90 bg-white p-5 text-left shadow-xs transition-all hover:border-slate-300"
      >
        <span className="space-y-1">
          <span className="block text-base font-black text-slate-950 group-hover:text-[#0072CE]">
            Leaderboard
          </span>
          <span className="block text-xs font-medium text-slate-500 sm:text-sm">
            See how your score stacks up against Weezer fans
            everywhere.
          </span>
        </span>
        <span className="shrink-0 text-xs font-black text-[#0072CE] group-hover:underline">
          View →
        </span>
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Destinations grid                                                   */
/* ------------------------------------------------------------------ */

function DestinationsGrid() {
  const { userId, navigateTo } = useWeezer();
  const tiles: { label: string; caption: string; action: () => void }[] = [
    {
      label: 'Sort',
      caption: 'Bucket all 206',
      action: () => navigateTo('triage'),
    },
    {
      label: 'Refine',
      caption: 'Head-to-head matchups',
      action: () => navigateTo('rank_buckets'),
    },
    {
      label: 'My Rankings',
      caption: 'Your 1–206 list',
      action: () => navigateTo('master'),
    },
    {
      label: 'Sweater Thread',
      caption: 'Your ranking, unraveled',
      action: () => navigateTo('wrapped'),
    },
    {
      label: 'The Game',
      caption: 'Back to the Shack',
      action: () => navigateTo('lore'),
    },
    {
      label: 'Fan Stats',
      caption: 'Every fan, one picture',
      action: () => navigateTo('fan_stats'),
    },
    {
      label: 'Fan Friends',
      caption: 'Compare rankings',
      action: () => navigateTo(userId ? 'friends' : 'login'),
    },
    {
      label: 'Shareables',
      caption: 'Cards to share',
      action: () => navigateTo('shareables'),
    },
    {
      label: 'Leaderboard',
      caption: 'Game standings',
      action: () => openLeaderboard((s) => navigateTo(s)),
    },
  ];

  return (
    <section className="space-y-3">
      <SectionHeading>Jump to</SectionHeading>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            onClick={tile.action}
            className="group cursor-pointer rounded-3xl border-2 border-slate-200/90 bg-white p-4 text-left shadow-xs transition-all hover:border-blue-300 active:scale-95"
          >
            <span
              className={`${displayFont.className} block text-base leading-tight tracking-wide text-slate-950 group-hover:text-[#0072CE] sm:text-lg`}
            >
              {tile.label}
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-400">
              {tile.caption}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Profile setup — parity port from the old dashboard                  */
/* ------------------------------------------------------------------ */

/** The old dashboard was the ONLY host of the first-run profile
 *  prompt: a signed-in user with no username yet got the "Claim
 *  Your Weezer Song Ranking Username" banner, opening
 *  WeezerOnboardingModal — and the sign-up flow auto-bounces new
 *  users to the dashboard, so this banner is the landing behavior
 *  that flow depends on. Its onSuccess also pushes the local
 *  rankings to the account (syncRankingsToDatabase). Ported
 *  verbatim (banner classes/copy, modal props, success handler)
 *  so the promotion changes none of it. The modal stays mounted
 *  always, exactly as the old dashboard mounted it; only the
 *  banner is conditional. */
function ProfileSetupBanner() {
  const {
    userId,
    userProfile,
    setUserProfile,
    triageMap,
    masterList,
    syncRankingsToDatabase,
  } = useWeezer();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  return (
    <>
      <WeezerOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        currentUserId={userId}
        onSuccess={(newProfile) => {
          setUserProfile(newProfile);
          syncRankingsToDatabase(triageMap, masterList);
        }}
      />

      {userId && !userProfile?.username && (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="font-extrabold text-amber-950 text-sm sm:text-base">
              Claim Your Weezer Song Ranking Username
            </h3>
            <p className="text-xs font-medium text-amber-900/80 leading-relaxed">
              Set up your profile so you can save rankings and compare with friends.
            </p>
          </div>

          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs px-4 py-3 rounded-xl transition-all shadow-md cursor-pointer shrink-0 text-center"
          >
            Setup Profile
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The step                                                            */
/* ------------------------------------------------------------------ */

export default function StepGarage2() {
  return (
    /* AppShell's main caps at max-w-5xl on small screens and
       lg:max-w-6xl on large; this wrapper holds the prototype at
       max-w-5xl at every width (AppShell's width handling is
       prop-driven, not step-driven, so the cap lives here). */
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GarageHero />
      <ProfileSetupBanner />
      <EraShelf />
      <ThreadSection />
      <FanStatsFeature />
      <GameCard />
      <FandomSection />
      <DestinationsGrid />
    </div>
  );
}
