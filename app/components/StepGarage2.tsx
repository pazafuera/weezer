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
  finishedAtPhrase,
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
import { FlyingWIcon } from './SharedUI';
import { ERAS } from './shareables/EraDnaCard';
import { displayFont } from './shareables/fonts';
import WeezerOnboardingModal from './WeezerOnboardingModal';

const TOTAL_SONGS = FULL_SONG_POOL.length;

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const POSTER_CARD_SHADOW =
  'shadow-[0_10px_28px_rgba(11,30,63,0.12),0_2px_0_rgba(11,30,63,0.9)]';
const POSTER_HARD_SHADOW = 'shadow-[4px_4px_0_rgba(11,30,63,0.85)]';
const POSTER_BUTTON_SMALL =
  'inline-flex cursor-pointer items-center justify-center rounded-[11px] border-[2.5px] border-[#0C1220] bg-white px-4 py-[9px] text-sm font-black text-[#005CA8] shadow-[2px_2px_0_#0C1220] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';

function SectionHeading({
  children,
  sub,
  tag,
}: {
  children: React.ReactNode;
  sub?: string;
  tag?: React.ReactNode;
}) {
  return (
    <div className="mb-[14px] flex items-end justify-between gap-[14px]">
      <div>
        <h2
          className={`${displayFont.className} text-[clamp(26px,5vw,34px)] leading-none tracking-wide text-[#0C1220]`}
        >
          {children}
        </h2>
        {sub && (
          <p className="mt-1 text-[14.5px] font-semibold leading-snug text-[#3D4A63]">
            {sub}
          </p>
        )}
      </div>
      {tag}
    </div>
  );
}

type PosterTapeTone = 'yellow' | 'blue' | 'pink';

function PosterTape({
  children,
  tone = 'yellow',
}: {
  children: React.ReactNode;
  tone?: PosterTapeTone;
}) {
  const toneClass =
    tone === 'blue'
      ? 'rotate-[1.5deg] bg-[#BDE9FF] text-[#07314f]'
      : tone === 'pink'
        ? '-rotate-[1.5deg] bg-[#F6A8C1] text-[#4a0f28]'
        : '-rotate-2 bg-[#FFE066] text-[#231a00]';
  return (
    <span
      className={`inline-block whitespace-nowrap px-2.5 py-[5px] text-[10px] font-black uppercase tracking-[0.12em] shadow-[0_2px_5px_rgba(0,0,0,0.18)] sm:text-[11px] sm:tracking-[0.14em] ${toneClass}`}
    >
      {children}
    </span>
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

/** The prototype hero's tape strip: yellow label, slight tilt,
 *  hard little shadow — sits above the headline in every hero
 *  state. Recipe from the dashboard prototype's .tape rule. */
function TapeStrip({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <span className="inline-block -rotate-2 whitespace-nowrap bg-[#FFE066] px-2.5 py-[5px] text-[10px] font-black uppercase tracking-[0.12em] text-[#231a00] shadow-[0_2px_5px_rgba(0,0,0,0.18)] sm:text-xs sm:tracking-[0.14em]">
        {children}
      </span>
    </div>
  );
}

/** The prototype .btn treatment for the hero's CTAs: ink border,
 *  hard offset shadow, and a press that slides the button onto
 *  its shadow. Primary stays white; secondary stays ghost. */
const HERO_BTN_PRIMARY =
  'cursor-pointer rounded-[14px] border-[2.5px] border-[#0C1220] bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-[3px_3px_0_#0C1220] transition-all hover:bg-sky-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';
const HERO_BTN_SECONDARY =
  'cursor-pointer rounded-[14px] border-[2.5px] border-[#0C1220] px-6 py-3.5 text-sm font-black text-white shadow-[3px_3px_0_#0C1220] transition-all hover:bg-white/10 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';

/** The five buckets as poster chips (prototype .bucket fills),
 *  shown in the not-started hero under the sub copy. */
const BUCKET_CHIPS = [
  { label: 'Absolute Bangers', color: '#8FE3B0' },
  { label: 'Lowkey Slaps', color: '#BDE9FF' },
  { label: 'Mid', color: '#FFF3B0' },
  { label: 'Skip', color: '#FFD3B6' },
  { label: 'Trash', color: '#F6A8C1' },
];

const HERO_SUB_CLASS =
  'max-w-[34ch] text-base font-semibold leading-[1.45] text-[#EAF7FF] sm:text-lg';

function GarageHero() {
  const { userId, userProfile, triageMap, masterList, navigateTo } =
    useWeezer();
  const categorized = countCategorizedSongs(triageMap);
  const remaining = TOTAL_SONGS - categorized;
  const progress = getProgressState(triageMap, masterList);
  const isDone = categorized >= TOTAL_SONGS;
  const firstName =
    userProfile?.displayName?.trim().split(/\s+/)[0] || null;
  // The finished hero's album-spread fact — the Tribe card's
  // computation (computeTribe in TribeBadgeCard.tsx): distinct
  // albums among the songs bucketed 'banger' or 'slaps'.
  const topAlbumCount = new Set(
    FULL_SONG_POOL.filter(
      (s) => triageMap[s.id] === 'banger' || triageMap[s.id] === 'slaps'
    ).map((s) => s.album)
  ).size;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border-[3px] border-[#0C1220] bg-[#039AD1] text-white shadow-[0_14px_30px_rgba(11,30,63,0.18)]">
      {/* Halftone dots — the share-card poster texture, as a CSS
          overlay (the same trick the poster cards draw by hand).
          Recipe matched to the dashboard prototype's hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.20) 1.6px, transparent 1.7px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="relative flex items-center gap-5 p-6 sm:gap-8 sm:p-9">
        <div className="min-w-0 flex-1 space-y-4">
          {categorized === 0 ? (
            <>
              <TapeStrip>All My Favorite Songs</TapeStrip>
              <h1
                className={`${displayFont.className} text-4xl leading-[0.98] tracking-wide sm:text-5xl`}
                style={{ textShadow: '3px 3px 0 rgba(11,30,63,0.35)' }}
              >
                Every Weezer song. Ranked by you.
              </h1>
              <p className={HERO_SUB_CLASS}>
                Sort all {TOTAL_SONGS} songs into five buckets,
                fine-tune the order, and see what kind of fan you
                are.
              </p>
              <div
                className="flex flex-wrap gap-2"
                aria-label="The five buckets"
              >
                {BUCKET_CHIPS.map((chip) => (
                  <span
                    key={chip.label}
                    className="rounded-full border-[2.5px] border-[#0C1220] px-[13px] py-[7px] text-[13px] font-black text-[#0C1220] shadow-[2px_2px_0_#0C1220]"
                    style={{ backgroundColor: chip.color }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigateTo('triage')}
                  className={HERO_BTN_PRIMARY}
                >
                  Start sorting
                </button>
                {!userId && (
                  <button
                    type="button"
                    onClick={() => navigateTo('login', 'signup')}
                    className={HERO_BTN_SECONDARY}
                  >
                    Create an account
                  </button>
                )}
              </div>
            </>
          ) : isDone ? (
            <>
              <TapeStrip>The Garage — Your Home Base</TapeStrip>
              <h1
                className={`${displayFont.className} text-4xl leading-[0.98] tracking-wide sm:text-5xl`}
                style={{ textShadow: '3px 3px 0 rgba(11,30,63,0.35)' }}
              >
                It&rsquo;s all sorted, {firstName ?? 'there'}.
              </h1>
              <p className={HERO_SUB_CLASS}>
                Every one of the {TOTAL_SONGS} songs, ranked by you.
                {topAlbumCount > 0 && (
                  <>
                    {' '}
                    Your top songs span {topAlbumCount} different
                    albums — no era left behind.
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {progress.isMasterUnlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigateTo('master')}
                      className={HERO_BTN_PRIMARY}
                    >
                      My Rankings
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('rank_buckets')}
                      className={HERO_BTN_SECONDARY}
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
                    className={HERO_BTN_PRIMARY}
                  >
                    Refine your ranking
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <TapeStrip>The Garage — Your Home Base</TapeStrip>
              <h1
                className={`${displayFont.className} text-4xl leading-[0.98] tracking-wide sm:text-5xl`}
                style={{ textShadow: '3px 3px 0 rgba(11,30,63,0.35)' }}
              >
                {categorized} of {TOTAL_SONGS} sorted — {remaining} to
                go.
              </h1>
              <p className={HERO_SUB_CLASS}>
                {categorized} of {TOTAL_SONGS} sorted — {remaining}{' '}
                to go. The finish line is closer than it looks.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigateTo('triage')}
                  className={HERO_BTN_PRIMARY}
                >
                  Keep sorting
                </button>
                {!userId && (
                  <button
                    type="button"
                    onClick={() => navigateTo('login', 'signup')}
                    className={HERO_BTN_SECONDARY}
                  >
                    Create an account to save it
                  </button>
                )}
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
/* The record shelf — the five eras as record spines                   */
/* ------------------------------------------------------------------ */

/** Spine colors are the APP's era colors (the ERAS table in
 *  EraDnaCard) — the same colors the Era DNA card, Fan Stats and
 *  the rest of the site use for these eras. The prototype mock's
 *  spine palette differed; Mark flagged era consistency on
 *  Nov 4, 2026 and the app's palette wins. */
const SHELF_SPINE_COLORS: Record<string, string> = {
  blue: '#d97706',
  y2k: '#059669',
  red: '#dc2626',
  comeback: '#0284c7',
  new: '#9333ea',
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

  const eraStats = ERAS.map((era) => {
    const songs = FULL_SONG_POOL.filter(
      (s) => (s.year || 0) > 0 && era.test(s.year)
    );
    const sorted = songs.filter(
      (s) => triageMap[s.id] !== undefined
    ).length;
    const pct = songs.length
      ? Math.round((sorted / songs.length) * 100)
      : 0;
    return {
      era,
      songs,
      sorted,
      pct,
      label: era.name,
    };
  });
  const allComplete = eraStats.every((stat) => stat.pct === 100);
  const totalSorted = eraStats.reduce(
    (sum, stat) => sum + stat.sorted,
    0
  );
  const completedEra = eraStats.find((stat) => stat.pct === 100);
  const neediestEra = eraStats.reduce((lowest, stat) =>
    stat.pct < lowest.pct ? stat : lowest
  );
  const shelfNote = allComplete
    ? 'Five eras, one shelf — the whole catalog from the Blue Album to today.'
    : totalSorted === 0
      ? null
      : completedEra
        ? `${completedEra.label} is complete. ${neediestEra.label} needs the most love.`
        : `${neediestEra.label} needs the most love.`;

  return (
    <section>
      <SectionHeading
        sub={
          allComplete
            ? 'Every era, on the record. Tap a spine to open that era’s songs.'
            : 'Some eras are done. Some are still on the turntable.'
        }
        tag={
          allComplete ? (
            <PosterTape tone="blue">All eras complete</PosterTape>
          ) : undefined
        }
      >
        The record shelf
      </SectionHeading>
      <div
        className={`rounded-[18px] border-[3px] border-[#0C1220] bg-white p-[18px_16px_14px] ${POSTER_CARD_SHADOW}`}
      >
        <div className="flex gap-2">
          {eraStats.map(({ era, songs, sorted, pct, label }) => {
            const spineColor =
              SHELF_SPINE_COLORS[era.key] ?? era.color;
            return (
              <button
                key={era.key}
                type="button"
                onClick={() => jumpToAlbum(songs[0]?.album)}
                aria-label={`Jump to the ${label} in Sort — ${sorted} of ${songs.length} sorted`}
                className="relative flex h-[178px] min-w-0 flex-1 cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-[8px_8px_4px_4px] border-[2.5px] border-[#0C1220] px-1 py-3 pb-2.5 text-center text-[#0C1220] transition-transform duration-150 hover:-translate-y-[5px] active:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072CE] focus-visible:ring-offset-2 min-[521px]:h-[196px]"
                style={{ backgroundColor: `${spineColor}24` }}
              >
                {/* The fill IS the reading (Mark, Nov 4, 2026: the
                    solid full-height spines "didn't make sense" —
                    maybe "column charts where the solid color
                    fills the shape based on percentage sorted").
                    The era color rises from the bottom to exactly
                    the % sorted, so the shape itself is the chart;
                    the pill repeats the number in figures. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 transition-[height] duration-700"
                  style={{
                    height: `${pct}%`,
                    backgroundColor: spineColor,
                  }}
                />
                <span className="relative whitespace-nowrap rounded-full bg-white/90 px-[7px] py-[3px] text-[11px] font-black leading-none text-[#0C1220]">
                  {pct}%
                </span>
                <span
                  className={`${displayFont.className} relative flex-1 text-[14.5px] leading-[1.1] tracking-[0.04em] text-white [writing-mode:vertical-rl] min-[521px]:text-[16.5px]`}
                  style={{
                    textShadow:
                      '1px 0 0 #0C1220, -1px 0 0 #0C1220, 0 1px 0 #0C1220, 0 -1px 0 #0C1220',
                  }}
                >
                  {label}
                </span>
                <span
                  className="relative text-[10px] font-extrabold leading-[1.25] text-white max-[520px]:hidden"
                  style={{
                    textShadow:
                      '1px 0 0 #0C1220, -1px 0 0 #0C1220, 0 1px 0 #0C1220, 0 -1px 0 #0C1220',
                  }}
                >
                  {pct === 100 ? 'Fully sorted' : 'Still sorting'}
                </span>
              </button>
            );
          })}
        </div>
        {shelfNote && (
          <p className="mx-[2px] mb-[2px] mt-3 text-[13.5px] font-semibold leading-snug text-[#3D4A63]">
            {shelfNote}
          </p>
        )}
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
    <div
      role="img"
      aria-label={`Journey progress: ${total.toLocaleString()} points, at ${stop.title}`}
      className="mx-1 mb-[26px] mt-[26px]"
    >
      <div className="relative h-3 rounded-full border-2 border-white/25 bg-[#22386B]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#FFC72C] transition-all duration-[1200ms] ease-out"
          style={{ width: `${pos}%` }}
        />
        {TOTAL_STOPS.map((s, i) => {
          const done = i <= reachedIdx;
          return (
            <span
              key={s.title}
              aria-hidden
              className={`absolute top-1/2 z-[2] h-4 w-4 -translate-y-1/2 rounded-full border-[3px] ${
                done
                  ? 'border-[#FFC72C] bg-[#FFC72C]'
                  : 'border-[#8FA8D8] bg-[#22386B]'
              }`}
              style={{
                left:
                  i === TOTAL_STOPS.length - 1
                    ? undefined
                    : `calc(${(i / (TOTAL_STOPS.length - 1)) * 100}% - 8px)`,
                right: i === TOTAL_STOPS.length - 1 ? '-8px' : undefined,
              }}
            />
          );
        })}
        <span
          aria-hidden
          className="absolute top-1/2 z-[3] grid h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
          style={{ left: `${pos}%` }}
        >
          <FlyingWIcon className="h-auto w-[24px] text-[#0072CE]" />
        </span>
      </div>
    </div>
  );
}

const GAME_BUTTON_GOLD =
  'inline-flex w-full cursor-pointer items-center justify-center rounded-[14px] border-[2.5px] border-[#0C1220] bg-[#FFC72C] px-[26px] py-4 text-lg font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';
const GAME_HALFTONE_STYLE = {
  backgroundImage:
    'radial-gradient(rgba(255,255,255,0.09) 1.4px, transparent 1.5px)',
  backgroundSize: '16px 16px',
} as const;

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
        className={`relative w-full cursor-pointer overflow-hidden rounded-[26px] border-[3px] border-[#0C1220] bg-[#0B1E3F] p-[26px_22px_24px] text-left text-white ${POSTER_CARD_SHADOW} sm:p-[30px_28px_26px]`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={GAME_HALFTONE_STYLE}
        />
        <span className="relative flex flex-col">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#0C1220] px-2.5 py-[5px] text-[11px] font-black uppercase tracking-[0.1em] text-white">
            Locked 🔒
          </span>
          <span
            className={`${displayFont.className} mt-3 text-[clamp(28px,5.6vw,38px)] leading-[1.02] tracking-wide`}
          >
            Can You Get Back to the Shack?
          </span>
          <span className="mt-2 max-w-lg text-[16.5px] font-semibold leading-[1.45] text-[#D7E6FA]">
            {remainingAlbums.length === 2
              ? 'The game unlocks once you\u2019ve sorted the Blue Album and Pinkerton.'
              : remainingAlbums[0] === 'Pinkerton'
                ? 'The Blue Album is sorted — Pinkerton is all that stands between you and the game.'
                : 'Pinkerton is sorted — the Blue Album is all that stands between you and the game.'}
          </span>
          <span className="mt-[18px] inline-flex w-full items-center justify-center rounded-[14px] border-[2.5px] border-[#0a1430] bg-[#42557E] px-[22px] py-[14px] text-base font-black text-[#B9C8E2] shadow-[2px_2px_0_#0a1430]">
            Keep sorting →
          </span>
        </span>
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
  const roundNumber = upNextIdx >= 0 ? upNextIdx + 1 : played + 1;

  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-[26px] border-[3px] border-[#0C1220] bg-[#0B1E3F] p-[26px_22px_24px] text-white ${POSTER_CARD_SHADOW} sm:p-[30px_28px_26px]`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={GAME_HALFTONE_STYLE}
      />
      <div className="relative flex flex-1 flex-col">
        <div>
          <PosterTape tone="pink">The game</PosterTape>
        </div>
        <h2
          className={`${displayFont.className} mt-3 text-[clamp(28px,5.6vw,38px)] leading-[1.02] tracking-wide`}
        >
          Can You Get Back to the Shack?
        </h2>

        {!awaitingStanding && !allPlayed && (
          <p className="mt-2 text-[19px] font-extrabold leading-snug text-[#FFC72C]">
            Round {roundNumber} is up next.
          </p>
        )}

        {display ? (
          <div>
            <p className="mt-2 text-[16.5px] font-semibold leading-[1.45] text-[#D7E6FA]">
              {allPlayed
                ? finishedAtPhrase(display.stop)
                : youreAtPhrase(display.stop)}{' '}
              — {display.depth.toLocaleString()} points.
            </p>
            <JourneyBar total={display.depth} />
            {allPlayed ? (
              <p className="mb-[18px] rounded-[10px] border-[1.5px] border-dashed border-white/40 bg-white/10 px-3 py-[9px] text-center text-[14.5px] font-extrabold leading-snug text-white">
                All five rounds are in. That&rsquo;s the final score.
              </p>
            ) : (
              next && (
                <p className="mb-[18px] rounded-[10px] border-[1.5px] border-dashed border-white/40 bg-white/10 px-3 py-[9px] text-center text-[14.5px] font-extrabold leading-snug text-white">
                  {next.pointsTo.toLocaleString()} points to {next.title}.
                </p>
              )
            )}
          </div>
        ) : awaitingStanding ? (
          <p className="mt-2 max-w-lg text-[16.5px] font-semibold leading-[1.45] text-[#D7E6FA]">
            Loading your standing…
          </p>
        ) : (
          <p className="mt-2 max-w-lg text-[16.5px] font-semibold leading-[1.45] text-[#D7E6FA]">
            Five rounds. Thirty-five questions. One trip through Weezer
            history.
          </p>
        )}

        {awaitingStanding ? null : allPlayed ? (
          <button
            type="button"
            onClick={() => openLeaderboard((s) => navigateTo(s))}
            className={`${GAME_BUTTON_GOLD} mt-auto`}
          >
            See the leaderboard
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo('lore')}
            className={`${GAME_BUTTON_GOLD} mt-auto`}
          >
            Play Round {roundNumber}
          </button>
        )}
      </div>
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
  /** Anchor key of the matching library item on the Shareables
   *  page (its data-shareable value) — tapping the tile hands the
   *  key over via sessionStorage and the page scrolls to it. */
  jump: string;
}[] = [
  {
    title: 'Top 10',
    line: 'Your ten best, on one card.',
    tileClass: 'bg-[#039AD1] hover:bg-[#0284b5]',
    titleClass: 'text-white',
    lineClass: 'text-sky-100',
    jump: 'top10',
  },
  {
    title: 'Tier List',
    line: 'All 206, tier by tier.',
    tileClass: 'bg-white hover:bg-slate-50',
    titleClass: 'text-slate-950',
    lineClass: 'text-slate-500',
    jump: 'tier-songs',
  },
  {
    title: 'Your Tribe',
    line: 'What kind of fan are you?',
    tileClass: 'bg-[#8A44F2] hover:bg-[#7c35dd]',
    titleClass: 'text-white',
    lineClass: 'text-violet-100',
    jump: 'tribe',
  },
  {
    title: 'Era DNA',
    line: 'Five eras, one fan.',
    tileClass: 'bg-slate-900 hover:bg-slate-950',
    titleClass: 'text-white',
    lineClass: 'text-slate-400',
    jump: 'era-dna',
  },
  {
    title: 'Game Card',
    line: 'Your road back, on a card.',
    tileClass: 'bg-slate-950 hover:bg-black',
    titleClass: 'text-amber-400',
    lineClass: 'text-slate-400',
    jump: 'game',
  },
];

const THREAD_DECO_STYLE = {
  background:
    'repeating-radial-gradient(circle at center, rgba(246,168,193,0.5) 0 3px, transparent 3px 12px)',
} as const;

function ThreadSection() {
  const { userId, triageMap, masterList, navigateTo } = useWeezer();
  const progress = getProgressState(triageMap, masterList);
  const categorized = countCategorizedSongs(triageMap);
  const isSortingComplete = categorized >= TOTAL_SONGS;
  const isGuestTeaser = !userId && categorized === 0;

  /** Share-tile jump: hand the tile's anchor key to the
   *  Shareables page via sessionStorage — the same hand-off
   *  pattern as the shelf's weezer-triage-jump-album — so the
   *  page lands on the tapped card instead of its top. */
  const openShareTile = (jump: string) => {
    try {
      window.sessionStorage.setItem('weezer-shareables-jump', jump);
    } catch {
      /* sessionStorage unavailable — navigate without the jump */
    }
    navigateTo('shareables');
  };

  if (!progress.isWrappedUnlocked) {
    /* The Thread isn't compiled until the ranking is refined, so
       an incomplete dashboard gets the honest teaser, not a link
       the guard would bounce. Sorted-but-unrefined names its own
       unlock, since "the last song" is already sorted there. */
    return (
      <section>
        <SectionHeading sub="Your ranking, ready to share.">
          Show it off
        </SectionHeading>
        <div
          className={`relative overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-[#0C1220] p-6 text-white ${POSTER_CARD_SHADOW} sm:p-[22px]`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[30px] -top-[30px] h-[170px] w-[170px] rounded-full"
            style={THREAD_DECO_STYLE}
          />
          <div className="relative">
            {isGuestTeaser ? (
              <PosterTape tone="pink">At the end</PosterTape>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0C1220] px-2.5 py-[5px] text-[11px] font-black uppercase tracking-[0.1em] text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  aria-hidden
                >
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Locked
              </span>
            )}
            <h3
              className={`${displayFont.className} mt-[10px] max-w-[22ch] text-[clamp(24px,5vw,30px)] leading-[1.1] tracking-wide`}
            >
              Your Sweater Thread
            </h3>
            <p className="mb-[18px] max-w-[44ch] font-semibold leading-[1.5] text-[#C9D6EA]">
              {isSortingComplete
                ? 'Your Thread unravels once your ranking is refined.'
                : 'Your Thread unravels when the last song is sorted.'}
            </p>
            {isSortingComplete && (
              <button
                type="button"
                onClick={() => navigateTo('rank_buckets')}
                className={POSTER_BUTTON_SMALL}
              >
                Refine your ranking →
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading sub="Your ranking, ready to share.">
        Show it off
      </SectionHeading>
      <button
        type="button"
        onClick={() => navigateTo('wrapped')}
        className={`relative w-full cursor-pointer overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-[#0C1220] p-[30px_26px] text-left text-white ${POSTER_CARD_SHADOW} sm:p-[34px_30px]`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-[30px] -top-[30px] h-[170px] w-[170px] rounded-full"
          style={THREAD_DECO_STYLE}
        />
        <span className="relative block">
          <PosterTape>The main event</PosterTape>
          <span
            className={`${displayFont.className} mt-[10px] block max-w-[26ch] text-[clamp(27px,5.4vw,36px)] leading-[1.1] tracking-wide`}
          >
            Your Sweater Thread
          </span>
          <span className="mb-[18px] block max-w-[44ch] font-semibold leading-[1.5] text-[#C9D6EA]">
            Your whole ranking, unraveled — eras, tiers, and the songs
            that define you.
          </span>
          <span className={POSTER_BUTTON_SMALL}>Take a look →</span>
        </span>
      </button>

      <div className="mt-4 flex snap-x snap-mandatory gap-[14px] overflow-x-auto px-[2px] pb-[14px] pt-[6px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SHARE_TILES.map((tile) => (
          <button
            key={tile.title}
            type="button"
            onClick={() => openShareTile(tile.jump)}
            className={`flex min-h-[120px] w-40 shrink-0 cursor-pointer snap-start flex-col justify-between overflow-hidden rounded-[14px] border-[3px] border-[#0C1220] p-4 text-left ${POSTER_HARD_SHADOW} transition-transform duration-150 hover:-translate-y-1 hover:-rotate-[0.5deg] active:translate-x-[2px] active:translate-y-[2px] ${tile.tileClass}`}
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
      className={`w-full cursor-pointer rounded-[18px] border-[3px] border-[#0C1220] bg-white p-[30px_26px] text-left text-[#0C1220] ${POSTER_CARD_SHADOW} transition-transform duration-150 hover:-translate-y-[3px] sm:p-[34px_30px]`}
    >
      <h2
        className={`${displayFont.className} text-[clamp(27px,5.4vw,36px)] leading-[1.1] tracking-wide`}
      >
        Weezerverse
      </h2>
      <p className="mb-[18px] mt-[6px] max-w-[44ch] text-[16.5px] font-semibold leading-[1.5] text-[#3D4A63]">
        See how your taste stacks up against every other fan.
      </p>
      <span className={POSTER_BUTTON_SMALL}>Take a look →</span>
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
    <section>
      <SectionHeading sub="You ranked yours. Here’s everyone else.">
        In the fandom
      </SectionHeading>
      {/* Fan Stats used to share this grid as a small card; it is
          now the full-width feature card above the game, so the
          grid is gone and Fan Friends stands as a full-width row
          alongside the Leaderboard row. */}
      <button
        type="button"
        onClick={() => navigateTo(userId ? 'friends' : 'login')}
        className={`flex w-full cursor-pointer items-start gap-4 rounded-[18px] border-[3px] border-[#0C1220] bg-white p-5 text-left text-[#0C1220] ${POSTER_CARD_SHADOW} transition-transform duration-150 hover:-translate-y-[3px] active:translate-y-0`}
      >
        <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[14px] border-[2.5px] border-[#0C1220] bg-[#FF6B4A] text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-[26px] w-[26px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
            <circle cx="17.5" cy="9" r="2.6" />
            <path d="M16 15.2c2.6.3 4.6 1.9 5.3 4.8" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`${displayFont.className} block text-[21px] leading-tight tracking-wide`}
          >
            Fan Friends
          </span>
          <span className="mt-[5px] block text-[14.5px] font-semibold leading-[1.45] text-[#3D4A63]">
            {!userId
              ? 'Sign in to compare rankings with friends.'
              : friendsCount > 0
                ? `You're comparing rankings with ${friendsCount} friend${friendsCount === 1 ? '' : 's'}.`
                : 'See what your friends are ranking.'}
          </span>
        </span>
        <span
          className={`${displayFont.className} ml-auto flex-none self-center text-[22px] leading-none text-[#0072CE]`}
          aria-hidden
        >
          →
        </span>
      </button>

      <button
        type="button"
        onClick={() => openLeaderboard((s) => navigateTo(s))}
        className={`mt-[14px] flex w-full cursor-pointer items-center gap-[14px] rounded-[18px] border-[3px] border-[#0C1220] bg-[#FFC72C] p-[18px_20px] text-left text-[#0C1220] ${POSTER_CARD_SHADOW} transition-transform duration-150 hover:-translate-y-[3px]`}
      >
        <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[14px] border-[2.5px] border-[#0C1220] bg-[#0C1220] text-[#FFC72C]">
          <svg
            viewBox="0 0 24 24"
            className="h-[26px] w-[26px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
            <path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.6 3.5 4 3.5M17 6h3a1 1 0 0 1 1 1c0 2-1.6 3.5-4 3.5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`${displayFont.className} block text-[21px] leading-tight tracking-wide`}
          >
            Leaderboard
          </span>
          <span className="mt-[3px] block text-sm font-bold leading-snug text-[#4d3a00]">
            See how your score stacks up against Weezer fans
            everywhere.
          </span>
        </span>
        <span
          className={`${displayFont.className} ml-auto flex-none self-center text-[22px] leading-none`}
          aria-hidden
        >
          →
        </span>
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Destinations grid                                                   */
/* ------------------------------------------------------------------ */

const DESTINATION_STYLES: Record<
  string,
  { color: string; icon: React.ReactNode }
> = {
  Sort: {
    color: '#0072CE',
    icon: (
      <>
        <path d="M12 3v10m0 0 4-4m-4 4-4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </>
    ),
  },
  Refine: {
    color: '#039AD1',
    icon: (
      <>
        <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
        <circle cx="16" cy="8" r="2.2" />
        <circle cx="8" cy="16" r="2.2" />
      </>
    ),
  },
  'My Rankings': {
    color: '#5B2A86',
    icon: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </>
    ),
  },
  'Sweater Thread': {
    color: '#D6336C',
    icon: (
      <>
        <path d="M4 5c6 0 6 4 12 4 3 0 4-1.5 4-3" />
        <path d="M20 19c-6 0-6-4-12-4-3 0-4 1.5-4 3" />
        <circle cx="4" cy="5" r="1.6" />
        <circle cx="20" cy="19" r="1.6" />
      </>
    ),
  },
  'The Game': {
    color: '#12295A',
    icon: (
      <>
        <path d="M6 12h4m-2-2v4" />
        <circle cx="15.5" cy="10.5" r=".8" />
        <circle cx="18" cy="13.5" r=".8" />
        <path d="M17.3 5H6.7a5 5 0 0 0-5 5v3.2A2.8 2.8 0 0 0 7 14.6L8.6 12h6.8l1.6 2.6a2.8 2.8 0 0 0 5.3-1.4V10a5 5 0 0 0-5-5Z" />
      </>
    ),
  },
  Weezerverse: {
    color: '#E4572E',
    icon: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  },
  'Fan Friends': {
    color: '#C1272D',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
        <circle cx="17.5" cy="9" r="2.6" />
        <path d="M16 15.2c2.6.3 4.6 1.9 5.3 4.8" />
      </>
    ),
  },
  Shareables: {
    color: '#2E933C',
    icon: (
      <>
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
      </>
    ),
  },
  Leaderboard: {
    color: '#E8A800',
    icon: (
      <>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.6 3.5 4 3.5M17 6h3a1 1 0 0 1 1 1c0 2-1.6 3.5-4 3.5" />
      </>
    ),
  },
};

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
      label: 'Weezerverse',
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
    <section>
      <SectionHeading sub="The whole site, one tap away.">
        Everywhere you can go
      </SectionHeading>
      <div className="grid grid-cols-2 gap-3 min-[720px]:grid-cols-3">
        {tiles.map((tile) => {
          const style = DESTINATION_STYLES[tile.label];
          return (
            <button
              key={tile.label}
              type="button"
              onClick={tile.action}
              className={`flex cursor-pointer flex-col gap-[10px] rounded-[18px] border-[3px] border-[#0C1220] bg-white p-[18px_16px] text-left text-[#0C1220] ${POSTER_HARD_SHADOW} transition-all duration-[130ms] hover:-translate-x-[1px] hover:-translate-y-[3px] hover:shadow-[6px_7px_0_rgba(11,30,63,0.85)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)]`}
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-[12px] border-[2.5px] border-[#0C1220] text-white"
                style={{ backgroundColor: style?.color }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {style?.icon}
                </svg>
              </span>
              <span
                className={`${displayFont.className} block break-words text-[19px] leading-[1.05] tracking-wide`}
              >
                {tile.label}
              </span>
              <span className="block text-[13px] font-semibold leading-[1.4] text-[#3D4A63]">
                {tile.caption}
              </span>
            </button>
          );
        })}
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
    /* The prototype page backdrop bleeds through AppShell's main
       padding: negative margins match that padding at each
       breakpoint, and the inner wrapper restores the same inset
       while holding the content at max-w-5xl. AppShell's main caps
       at max-w-5xl on small screens and lg:max-w-6xl on large;
       its width handling is prop-driven, not step-driven, so the
       content cap lives here. */
    <div
      className="-mx-4 -my-4 bg-[#DCEEF8] sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-[34px] px-4 pb-24 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <GarageHero />
        <ProfileSetupBanner />
        <EraShelf />
        <ThreadSection />
        <FanStatsFeature />
        <GameCard />
        <FandomSection />
        <DestinationsGrid />
      </div>
    </div>
  );
}
