'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import {
  DEPTH_BANDS,
  FANHOOD_TOTAL_LADDER,
  LORE_GAMES,
  TIER_TAGLINES,
  answerCoverFor,
  bandForTotal,
  bandsEnteredBetween,
  buildGameRun,
  isLoreUnlocked,
  loreGateRemainingAlbums,
  loreGameById,
  openAnswerEntries,
  openAnswerKey,
  openAnswerSong,
  openPromptAnswerTable,
  openPromptExtremes,
  promptById,
  tierForDepth,
  titleForDepth,
  totalTierRangeLabel,
} from '../data/loreGame';
import type {
  LoreGameId,
  OpenPrompt,
  RarityTier,
  RunItem,
} from '../data/loreGame';
import {
  matchTableAnswer,
  resolveSongAnswer,
} from '../lib/loreMatch';
import {
  fanhoodDisplay,
  fanhoodGamesPlayed,
  fanhoodStandingLine,
  gameCanStart,
  readFanhood,
  recordGameResult,
  seriesRowState,
} from '../lib/fanhood';
import { displayFont } from './shareables/fonts';
import { syncFanhoodAfterRun } from '../lib/fanhoodSync';
import FanhoodLeaderboard from './FanhoodLeaderboard';
import type {
  FanhoodDeepest,
  FanhoodGameLogEntry,
  FanhoodRecord,
} from '../lib/fanhood';

const QUESTION_SECONDS = 25;
const PREVIEW_SECONDS = 3;

/** Picker strata (mock v2, approved Oct 27, 2026; rail balls
 *  mock v3, Oct 28): the ladder strip's rungs and the series
 *  rail's balls deepen as the descent does — sky at the surface
 *  to near-black bedrock. Parallel to FANHOOD_TOTAL_LADDER /
 *  LORE_GAMES by index. */
const LADDER_RUNG_BG = ['#38bdf8', '#0284c7', '#0369a1', '#1e3a5f', '#020617'];
const SERIES_BALL_BG = ['#38bdf8', '#0284c7', '#0369a1', '#1e3a5f', '#0f172a'];

/** The start gate's four rules (mock v2, generic per Mark: no
 *  prompt teasers — a one-and-done game's card is not a study
 *  guide). Lead-ins render in black, the rest in body gray. */
const GATE_RULES: { icon: string; lead: string; rest: string }[] = [
  {
    icon: '❓',
    lead: 'Seven prompts.',
    rest: "Each one different — you won't see them coming, and that's the point.",
  },
  {
    icon: '⏱️',
    lead: 'Twenty-five seconds each.',
    rest: 'A wrong guess just wiggles — keep guessing until you land an answer or time runs out.',
  },
  {
    icon: '⬇️',
    lead: 'Rare answers sink you deeper.',
    rest: 'The obvious answer scores a little. The one nobody else knows scores a lot.',
  },
  {
    icon: '🔒',
    lead: 'This game counts once.',
    rest: 'Your score locks in when it ends and adds to your fanhood. No replays — but nothing starts until you say go.',
  },
];

type Phase =
  | 'intro'
  | 'ready'
  | 'preview'
  | 'playing'
  | 'leaving'
  | 'plunging'
  | 'reveal'
  | 'result';

/** Generic wrong-guess lines, rotated per attempt (natural phrasing,
    no stats-speak — Mark's copy rule). Trap and near-miss guesses
    carry their own specific hints instead. */
const GENERIC_HINTS = [
  'Not that one — try again.',
  'Nope. Have another go.',
  'Keep going — try a different answer.',
];

interface AnswerRecord {
  outcome: 'correct' | 'miss' | 'duplicate' | 'trap';
  /** The answer as displayed on the reveal (canonical form). */
  headline: string;
  subline: string;
  /** A cheeky extra line carried by the specific answer played. */
  note?: string;
  /** Trap outcome: the plausible-but-invalid answer's correction. */
  trapNote?: string;
  /** Scoring reveals only: the album cover the answer resolves to. */
  coverSrc?: string;
  coverAlbum?: string;
  tier?: RarityTier;
  depthEarned: number;
  /** The Krillion contrast (open prompts only). */
  commonText?: string;
  commonDepth?: number;
  deepestText?: string;
  deepestDepth?: number;
  loreLine: string;
  questionPrompt: string;
}

/* ------------------------------------------------------------------ */
/* The descent stage (v3 — the descent is the screen)                  */
/* ------------------------------------------------------------------ */

/**
 * Per-band layer styling, parallel to DEPTH_BANDS, following the
 * approved mock: bright radio-blue at the surface, flannel tan for
 * the '90s layer, dark Pinkerton maroon, photocopied-note purple
 * with ruled lines for the Fan Club, archive dark-green for Karl,
 * and near-black bedrock. Each layer carries the mock's faint
 * era-texture type.
 */
const BAND_STAGE: {
  layer: string;
  chip: string;
  range: string;
  texture: string;
  textureStyle?: React.CSSProperties;
  /** A large, soft album cover ghosted into the layer — only where
      a layer maps unambiguously to one album (Oct 27, 2026). */
  coverSrc?: string;
}[] = [
  {
    // Buddy Holly — bright radio-blue. The layer IS the Blue Album
    // era, so its cover ghosts the background.
    layer: 'bg-gradient-to-b from-[#039AD1] to-[#0277b6] text-[#eaf7ff]',
    chip: 'bg-white text-[#0277b6]',
    range: 'text-white/70',
    texture: "UNDONE · BUDDY HOLLY · SAY IT AIN'T SO · UNDONE ·",
    coverSrc: '/albums/blue.jpg',
  },
  {
    // Sweater Song — flannel tan.
    layer: 'bg-gradient-to-b from-[#f3e9d2] to-[#e7d7ae] text-[#4a3a17]',
    chip: 'bg-[#4a3a17] text-[#f3e9d2]',
    range: 'text-[#4a3a17]/60',
    texture: "FLANNEL · '94 · MTV · THE RENTALS ·",
  },
  {
    // Pinkerton — dark maroon, the album's own cover ghosted in.
    layer: 'bg-gradient-to-b from-[#5b2333] to-[#401826] text-[#f6d9de]',
    chip: 'bg-[#f6d9de] text-[#5b2333]',
    range: 'text-[#f6d9de]/60',
    texture: 'EL SCORCHO · ACROSS THE SEA ·',
    coverSrc: '/albums/pinkerton.jpg',
  },
  {
    // Fan Club — photocopied-note purple, ruled lines.
    layer: 'bg-[#3d348b] text-[#dcd6ff]',
    chip: 'bg-[#dcd6ff] text-[#3d348b]',
    range: 'text-[#dcd6ff]/60',
    texture: 'MYKEL & CARLI · =w= · NEWSLETTER #1 ·',
    textureStyle: {
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 26px)',
    },
  },
  {
    // Karl — archive dark-green.
    layer: 'bg-gradient-to-b from-[#14261c] to-[#0c1a12] text-[#b9e7c9]',
    chip: 'bg-[#b9e7c9] text-[#14261c]',
    range: 'text-[#b9e7c9]/60',
    texture: "KARL'S CORNER · THE FIFTH WEEZER · ARCHIVE ·",
  },
  {
    // GOAT PUNISHMENT — near-black bedrock.
    layer: 'bg-[#060607] text-[#8f8fa3]',
    chip: 'bg-[#26262e] text-[#c9c9d6] border border-[#3a3a46]',
    range: 'text-[#8f8fa3]/70',
    texture: '🐐 · NIRVANA COVERS · 1998 ·',
    textureStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 50% 0%, rgba(70,70,88,0.5) 0%, rgba(6,6,7,0) 70%)',
    },
  },
];

/**
 * Card themes, re-skinned per depth band (mock frames 1 vs 3): a
 * white card at the surface bands, a dark plum card through
 * Pinkerton / Fan Club, the archive-green dark card at Karl, and a
 * warm gold-accented dark card in the bedrock.
 */
interface CardTheme {
  root: string;
  label: string;
  body: string;
  strong: string;
  timerTrack: string;
  timerFill: string;
  timerFillLow: string;
  seconds: string;
  secondsLow: string;
  input: string;
  dig: string;
  contrast: string;
  lore: string;
  correctBox: string;
  correctTitle: string;
  correctSub: string;
  trapBox: string;
  trapTitle: string;
  trapSub: string;
  missBox: string;
  missTitle: string;
  missSub: string;
  next: string;
}

const CARD_THEMES: CardTheme[] = [
  {
    // Surface bands — the mock's light card.
    root: 'bg-white text-slate-900 border-slate-200/90',
    label: 'text-slate-400',
    body: 'text-slate-500',
    strong: 'text-slate-700',
    timerTrack: 'bg-slate-100',
    timerFill: 'bg-[#0072CE]',
    timerFillLow: 'bg-amber-400',
    seconds: 'text-slate-500',
    secondsLow: 'text-amber-500',
    input:
      'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0072CE]',
    dig: 'bg-[#0072CE] hover:bg-blue-700 text-white shadow-md',
    contrast: 'text-slate-500',
    lore: 'text-slate-500',
    correctBox: 'bg-emerald-50 border-emerald-200',
    correctTitle: 'text-emerald-900',
    correctSub: 'text-emerald-700',
    trapBox: 'bg-amber-50 border-amber-200',
    trapTitle: 'text-amber-900',
    trapSub: 'text-amber-800',
    missBox: 'bg-slate-50 border-slate-200',
    missTitle: 'text-slate-900',
    missSub: 'text-slate-500',
    next: 'bg-[#0072CE] hover:bg-blue-700 text-white shadow-md',
  },
  {
    // Pinkerton / Fan Club — dark plum.
    root: 'bg-[#211423] text-[#f6e8ee] border-[#4a2b3d]',
    label: 'text-pink-200/50',
    body: 'text-pink-100/60',
    strong: 'text-pink-50',
    timerTrack: 'bg-white/10',
    timerFill: 'bg-pink-300',
    timerFillLow: 'bg-amber-300',
    seconds: 'text-pink-200/70',
    secondsLow: 'text-amber-300',
    input:
      'bg-black/30 border-[#4a2b3d] text-white placeholder:text-pink-200/40 focus:border-pink-300',
    dig: 'bg-pink-300 hover:bg-pink-200 text-[#401826] shadow-md',
    contrast: 'text-pink-100/60',
    lore: 'text-pink-100/60',
    correctBox: 'bg-emerald-400/10 border-emerald-300/30',
    correctTitle: 'text-emerald-200',
    correctSub: 'text-emerald-200/70',
    trapBox: 'bg-amber-400/10 border-amber-300/30',
    trapTitle: 'text-amber-200',
    trapSub: 'text-amber-200/80',
    missBox: 'bg-white/5 border-white/15',
    missTitle: 'text-pink-50',
    missSub: 'text-pink-100/60',
    next: 'bg-pink-300 hover:bg-pink-200 text-[#401826] shadow-md',
  },
  {
    // Karl — the mock's archive-green dark card.
    root: 'bg-[#101418] text-[#eef3ee] border-[#2b3a30]',
    label: 'text-[#7be495]/60',
    body: 'text-[#b9e7c9]/60',
    strong: 'text-[#eef3ee]',
    timerTrack: 'bg-[#223028]',
    timerFill: 'bg-[#7be495]',
    timerFillLow: 'bg-amber-300',
    seconds: 'text-[#b9e7c9]/70',
    secondsLow: 'text-amber-300',
    input:
      'bg-[#0a0f0c] border-[#2b3a30] text-[#eef3ee] placeholder:text-[#7be495]/35 focus:border-[#7be495]',
    dig: 'bg-[#7be495] hover:bg-[#93eda9] text-[#0c1a12] shadow-md',
    contrast: 'text-[#b9e7c9]/60',
    lore: 'text-[#b9e7c9]/60',
    correctBox: 'bg-emerald-400/10 border-emerald-300/30',
    correctTitle: 'text-emerald-200',
    correctSub: 'text-emerald-200/70',
    trapBox: 'bg-amber-400/10 border-amber-300/30',
    trapTitle: 'text-amber-200',
    trapSub: 'text-amber-200/80',
    missBox: 'bg-white/5 border-white/15',
    missTitle: 'text-[#eef3ee]',
    missSub: 'text-[#b9e7c9]/60',
    next: 'bg-[#7be495] hover:bg-[#93eda9] text-[#0c1a12] shadow-md',
  },
  {
    // GOAT PUNISHMENT — warm dark card, gold accents (mock frame 2).
    root: 'bg-[#12100a] text-[#f5ecd8] border-[#4a3f22]',
    label: 'text-[#FFD23F]/50',
    body: 'text-[#cbbf9f]/70',
    strong: 'text-[#f5ecd8]',
    timerTrack: 'bg-white/10',
    timerFill: 'bg-[#FFD23F]',
    timerFillLow: 'bg-amber-300',
    seconds: 'text-[#cbbf9f]/80',
    secondsLow: 'text-amber-300',
    input:
      'bg-black/40 border-[#4a3f22] text-[#f5ecd8] placeholder:text-[#cbbf9f]/40 focus:border-[#FFD23F]',
    dig: 'bg-[#FFD23F] hover:bg-[#ffdb5c] text-[#111111] shadow-md',
    contrast: 'text-[#cbbf9f]/70',
    lore: 'text-[#cbbf9f]/70',
    correctBox: 'bg-emerald-400/10 border-emerald-300/30',
    correctTitle: 'text-emerald-200',
    correctSub: 'text-emerald-200/70',
    trapBox: 'bg-amber-400/10 border-amber-300/30',
    trapTitle: 'text-amber-200',
    trapSub: 'text-amber-200/80',
    missBox: 'bg-white/5 border-white/15',
    missTitle: 'text-[#f5ecd8]',
    missSub: 'text-[#cbbf9f]/60',
    next: 'bg-[#FFD23F] hover:bg-[#ffdb5c] text-[#111111] shadow-md',
  },
];

/** Which card theme each depth band uses, parallel to DEPTH_BANDS. */
const BAND_CARD_THEME = [0, 0, 1, 1, 2, 3];

/* Stage geometry: the column is ~6x the visible window. Within a
   band the marker interpolates from a 76px top inset (clear of the
   layer's header zone) to 90% of the layer's height (so it never
   hugs a boundary); the bedrock band, whose depth range is
   open-ended, interpolates up to a soft cap. */
const LAYER_HEIGHTS = [420, 460, 500, 520, 540, 560];
const LAYER_TOPS: number[] = (() => {
  const tops: number[] = [];
  let acc = 0;
  for (const h of LAYER_HEIGHTS) {
    tops.push(acc);
    acc += h;
  }
  return tops;
})();
const STAGE_HEIGHT = LAYER_HEIGHTS.reduce((a, b) => a + b, 0);
const BEDROCK_DEPTH_CAP = 6500;
const PLUNGE_MS = 900;

/**
 * How long a scoring plunge lasts, scaled by the depth just earned.
 * Slowed down substantially Oct 27, 2026 (Mark: even the v6 falls
 * didn't REGISTER — he couldn't tell he was going deeper). The same
 * exponential shape, re-tuned: about 1,214ms at +20, 2,056ms at
 * +200, 3,034ms at +550, and 3,737ms at +1,200.
 */
export function plungeDurationForDepth(depth: number): number {
  if (depth <= 0) return 550;
  return Math.round(1100 + 2900 * (1 - Math.exp(-depth / 500)));
}

/**
 * The marker's within-layer travel band. The TOP inset is a clear
 * header zone (Oct 27, 2026 — Mark's screenshot: at depth 0 the
 * marker sat ON the "Buddy Holly" chip): each layer's chip + range
 * row lives in its top ~44px, so the marker's interpolation starts
 * 76px down and the tag/burst flip below the marker when it lands
 * in the top zone (see DescentStage). The bottom stays at 90% so
 * the marker never hugs the next layer's header either.
 */
const MARKER_TOP_INSET = 76;
const MARKER_BOTTOM_FRACTION = 0.9;

function bandIndexForDepth(depth: number): number {
  for (let i = 0; i < DEPTH_BANDS.length; i++) {
    if (depth <= DEPTH_BANDS[i].max || i === DEPTH_BANDS.length - 1) return i;
  }
  return DEPTH_BANDS.length - 1;
}

function depthToY(depth: number): number {
  const i = bandIndexForDepth(depth);
  const band = DEPTH_BANDS[i];
  const isLast = i === DEPTH_BANDS.length - 1;
  const span = isLast ? BEDROCK_DEPTH_CAP - band.min : band.max - band.min;
  const t = Math.min(1, Math.max(0, (depth - band.min) / span));
  const travel =
    LAYER_HEIGHTS[i] * MARKER_BOTTOM_FRACTION - MARKER_TOP_INSET;
  return LAYER_TOPS[i] + MARKER_TOP_INSET + travel * t;
}

interface BurstInfo {
  tier?: RarityTier;
  depth: number;
  headline: string;
}

/**
 * The fanhood cross-section as a full-screen stage: a tall column of
 * the six layers inside a clipped window. The player marker lives
 * IN the column at the Y its total depth maps to, with a dashed
 * trail from the surface; the camera is a translateY on the column
 * (transitioned over ~900ms) that keeps the marker in frame — so a
 * scoring answer visibly plunges marker and camera together, while
 * a 0-point answer just shakes the marker in place. `children` is
 * the bottom-pinned card (intro / question / reveal), themed by the
 * caller to the band the player is currently in.
 */
function DescentStage({
  total,
  displayTotal,
  burst,
  burstDelayMs,
  flash,
  fallingTag,
  plunging,
  shake,
  animKey,
  reducedMotion,
  viewH,
  focusTop,
  fill,
  camMs,
  children,
}: {
  total: number;
  /** Label-only depth, ticking up while the marker falls. */
  displayTotal?: number;
  burst: BurstInfo | null;
  /** When the burst pop starts, timed to finish as the marker lands. */
  burstDelayMs?: number;
  /** A layer-name flash, shown while the plunge crosses into a new
      layer (scheduled by the parent; renders centered, huge). */
  flash?: { title: string; key: number; durMs: number } | null;
  /** The submitted answer, riding the marker down during the plunge. */
  fallingTag?: string | null;
  /** True while a plunge is in flight (the camera anchor drops so
      the marker visibly falls on screen — see the v7 notes). */
  plunging?: boolean;
  shake: boolean;
  animKey: number;
  reducedMotion: boolean;
  viewH: number;
  focusTop: boolean;
  /** Fill the parent box instead of using a fixed pixel height. */
  fill?: boolean;
  /** Camera transition duration (defaults to the plunge length). */
  camMs?: number;
  children?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [autoH, setAutoH] = useState(0);
  useEffect(() => {
    if (!fill) return;
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setAutoH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const effH = fill && autoH > 0 ? autoH : viewH;

  const markerY = depthToY(total);
  // Overlap rule (Oct 27, 2026): when the marker lands in a layer's
  // top zone, the falling tag and the burst stack BELOW the marker
  // instead of above it — above would park them in the layer's
  // header zone, on top of its name chip (Mark's screenshot: the
  // marker covering the "Buddy Holly" chip at depth 0).
  const markerOffsetInLayer =
    markerY - LAYER_TOPS[bandIndexForDepth(total)];
  const ridersBelow = markerOffsetInLayer < 150;
  // v7: while plunging, the anchor drops to 78% of the window, so
  // the marker's SCREEN position falls as the column transitions —
  // at the old fixed 42% anchor the marker stayed pinned and only
  // the (mostly flat) layers drifted past, which read as no motion.
  const anchor = focusTop ? 96 : plunging ? effH * 0.78 : effH * 0.42;
  const camY = Math.min(
    Math.max(markerY - anchor, 0),
    STAGE_HEIGHT - effH
  );
  const moveMs = reducedMotion ? 0 : (camMs ?? PLUNGE_MS);
  return (
    <div
      ref={rootRef}
      className={
        fill
          ? 'relative min-h-0 flex-1 overflow-hidden'
          : 'relative overflow-hidden rounded-3xl border border-slate-900/25 shadow-md'
      }
      style={fill ? undefined : { height: viewH }}
    >
      <style>{`
        @keyframes lore-burst-pop {
          0% { transform: scale(0.5) rotate(4deg); opacity: 0; }
          60% { transform: scale(1.08) rotate(-4deg); opacity: 1; }
          100% { transform: scale(1) rotate(-3deg); opacity: 1; }
        }
        .lore-burst { animation: lore-burst-pop 0.45s cubic-bezier(0.22, 0.9, 0.3, 1) 0.35s both; }
        @keyframes lore-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(3px); }
        }
        .lore-shake { animation: lore-shake 0.45s ease-in-out both; }
        @keyframes lore-card-in {
          from { transform: translateY(14px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .lore-card-in { animation: lore-card-in 0.35s ease-out 0.15s both; }
        @keyframes lore-card-out {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(16px); opacity: 0; }
        }
        .lore-card-out { animation: lore-card-out 0.25s ease-in both; }
        @keyframes lore-flash {
          0% { opacity: 0; transform: scale(0.92) translateY(10px); }
          16% { opacity: 1; transform: scale(1) translateY(0); }
          78% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.02) translateY(-6px); }
        }
        .lore-flash { animation-name: lore-flash; animation-timing-function: ease-out; animation-fill-mode: both; }
        @media (prefers-reduced-motion: reduce) {
          .lore-burst, .lore-shake, .lore-card-in, .lore-card-out, .lore-flash { animation: none !important; }
        }
      `}</style>

      {/* The strata column (the camera) */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: STAGE_HEIGHT,
          transformOrigin: 'top center',
          transform: `translateY(${-camY}px)`,
          transition: reducedMotion
            ? 'none'
            : `transform ${camMs ?? PLUNGE_MS}ms cubic-bezier(0.22, 0.9, 0.3, 1)`,
        }}
      >
        {DEPTH_BANDS.map((band, i) => {
          const style = BAND_STAGE[i];
          const unvisited = band.min > total;
          const range =
            band.max === Infinity
              ? `${band.min.toLocaleString()}+`
              : `${band.min.toLocaleString()}–${band.max.toLocaleString()}`;
          return (
            <div
              key={band.title}
              className={`absolute inset-x-0 overflow-hidden ${style.layer}`}
              style={{
                top: LAYER_TOPS[i],
                height: LAYER_HEIGHTS[i],
                filter: unvisited
                  ? 'brightness(0.78) saturate(0.85)'
                  : undefined,
              }}
            >
              {style.textureStyle && (
                <div className="absolute inset-0" style={style.textureStyle} />
              )}
              {style.coverSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={style.coverSrc}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-0 h-full w-auto max-w-none object-cover opacity-[0.16]"
                  style={{
                    maskImage:
                      'linear-gradient(to left, black 45%, transparent 94%)',
                    WebkitMaskImage:
                      'linear-gradient(to left, black 45%, transparent 94%)',
                  }}
                />
              )}
              {/* The layer's name as a large watermark — presence
                  (Oct 27, 2026: the layers read "small and
                  insignificant" as flat bands). */}
              <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[54px] font-black uppercase leading-none tracking-tight opacity-[0.09] sm:text-[64px]">
                {band.title}
              </div>
              <div className="absolute inset-x-3.5 top-2.5 flex items-start justify-between gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-black tracking-[0.14em] ${style.chip}`}
                >
                  {band.title}
                </span>
                <span
                  className={`text-[11px] font-extrabold tracking-[0.08em] ${style.range}`}
                >
                  {range}
                </span>
              </div>
              <div className="pointer-events-none absolute left-2 top-[76px] whitespace-nowrap text-lg font-black tracking-[0.06em] opacity-[0.16]">
                {style.texture}
              </div>
              {unvisited && (
                <div className="absolute inset-x-0 bottom-2.5 text-center text-[10px] font-black tracking-[0.22em] opacity-50">
                  {i === DEPTH_BANDS.length - 1
                    ? '▼ THE BEDROCK ▼'
                    : "▼ WHAT'S DOWN THERE? ▼"}
                </div>
              )}
            </div>
          );
        })}

        {/* The descent trail: surface to marker */}
        <div
          className="absolute left-[37px] top-0 z-10 w-0 border-l-[3px] border-dashed border-white/50"
          style={{ height: markerY }}
        />

        {/* The player marker */}
        <div
          className="absolute left-3.5 z-20"
          style={{
            top: markerY,
            // v7: the marker's own position transitions too — at the
            // surface the camera is clamped at 0, so without this the
            // marker teleported instead of falling on early answers.
            transition: reducedMotion
              ? 'none'
              : `top ${moveMs}ms cubic-bezier(0.22, 0.9, 0.3, 1)`,
          }}
        >
          <div
            key={`shake-${animKey}`}
            className={shake && !reducedMotion ? 'lore-shake' : undefined}
          >
            <div className="flex -translate-y-1/2 items-center gap-[7px]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-[#111111] bg-[#FFD23F] text-sm font-black text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
                =w=
              </div>
              <div className="whitespace-nowrap rounded-full bg-[#111111] px-3 py-1.5 text-xs font-black tracking-[0.05em] text-[#FFD23F] shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                YOU · {(displayTotal ?? total).toLocaleString()} DEEP
              </div>
            </div>
          </div>
        </div>

        {/* The falling answer tag (v7): the player's own answer,
            riding just above the marker for the whole plunge. Even
            where the world motion reads subtle, a labeled object
            travelling the full distance cannot be missed. */}
        {fallingTag && (
          <div
            className="absolute left-[84px] z-20"
            style={{
              top: markerY,
              transition: reducedMotion
                ? 'none'
                : `top ${moveMs}ms cubic-bezier(0.22, 0.9, 0.3, 1)`,
            }}
          >
            <div
              style={{
                transform: ridersBelow
                  ? 'translateY(370%)'
                  : 'translateY(-260%)',
              }}
            >
              <div className="whitespace-nowrap rounded-full bg-[#111111]/90 px-3 py-1.5 text-[11px] font-black tracking-wide text-white shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                “{fallingTag}” ▼
              </div>
            </div>
          </div>
        )}

        {/* The burst chip, riding the plunge */}
        {burst && (
          <div
            className="absolute left-[84px] z-20"
            style={{
              top: markerY,
              transition: reducedMotion
                ? 'none'
                : `top ${moveMs}ms cubic-bezier(0.22, 0.9, 0.3, 1)`,
            }}
          >
            <div
              style={{
                transform: ridersBelow
                  ? 'translateY(55%)'
                  : 'translateY(-135%)',
              }}
            >
              <div
                key={`burst-${animKey}`}
                className={`rounded-2xl bg-[#FFD23F] px-3 py-2.5 text-[#111111] shadow-[0_14px_34px_rgba(0,0,0,0.5)] ${
                  reducedMotion ? '' : 'lore-burst'
                }`}
                style={{
                  animationDelay: reducedMotion
                    ? undefined
                    : `${Math.max(0, (burstDelayMs ?? PLUNGE_MS) - 450)}ms`,
                }}
              >
                <div className="whitespace-nowrap text-[10px] font-black tracking-[0.16em]">
                  {burst.tier ? `${burst.tier.toUpperCase()} · ` : ''}+
                  {burst.depth.toLocaleString()}
                </div>
                <div className="whitespace-nowrap text-lg font-black leading-tight">
                  {burst.headline}!
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The layer-name flash: as the plunge crosses into a new
          layer, its name fills the stage for a beat — the descent
          registering, layer by layer. Pointer-events none; the fall
          never pauses for it. */}
      {flash && (
        <div
          key={flash.key}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-6"
        >
          <div
            className="lore-flash rounded-3xl bg-black/45 px-7 py-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
            style={{ animationDuration: `${flash.durMs}ms` }}
          >
            <div className="text-[10px] font-black tracking-[0.34em] text-white/65">
              ▼ NOW ENTERING ▼
            </div>
            <div className="mt-1 text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-5xl">
              {flash.title}
            </div>
          </div>
        </div>
      )}

      {/* The bottom-pinned card */}
      {children && (
        <div
          className="absolute inset-x-3 bottom-3 z-30 overflow-y-auto rounded-3xl shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
          style={{ maxHeight: effH - 92 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** The depth-earned number, counting up on the reveal. */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setDisplay(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 650;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

/**
 * The "Every answer" tables for a set of prompts: each prompt
 * opens to its full answer table (deepest first, grouped by tier),
 * with the player's landed answer highlighted. Shared by the
 * results screen (this run's answers) and the picker (a locked
 * game's recorded log).
 */
function PromptAnswerTables({
  items,
}: {
  items: {
    prompt: OpenPrompt;
    landedText: string | null;
    landedDepth: number;
  }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="divide-y divide-slate-100">
      {items.map(({ prompt, landedText, landedDepth }, i) => {
        const table = openPromptAnswerTable(prompt);
        const isOpen = openId === prompt.id;
        return (
          <div key={prompt.id} className="py-3 first:pt-0 last:pb-0">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : prompt.id)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-3 text-left cursor-pointer"
            >
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Question {i + 1}
                </span>
                <span className="block text-sm font-black text-slate-900 leading-snug">
                  {prompt.prompt}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-500">
                  {landedText
                    ? `You landed ${landedText} · +${landedDepth}`
                    : 'Nothing landed'}
                </span>
              </span>
              <span
                className="shrink-0 text-lg font-black text-[#0072CE]"
                aria-hidden="true"
              >
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-4 rounded-2xl bg-slate-50 p-3.5">
                {(
                  ['Super rare', 'Rare', 'Uncommon', 'Common'] as RarityTier[]
                )
                  .map((tier) => ({
                    tier,
                    rows: table.filter((row) => row.tier === tier),
                  }))
                  .filter((group) => group.rows.length > 0)
                  .map((group) => (
                    <div key={group.tier} className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {group.tier}
                      </p>
                      <div className="space-y-1">
                        {group.rows.map((row) => {
                          const isPlayers =
                            landedText !== null && landedText === row.text;
                          return (
                            <div
                              key={row.text}
                              className={`flex items-baseline justify-between gap-3 rounded-xl px-2.5 py-1.5 ${
                                isPlayers
                                  ? 'bg-[#FFD23F] text-slate-950 shadow-sm'
                                  : 'text-slate-700'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-bold">
                                {row.text}
                                {isPlayers ? ' · you' : ''}
                              </span>
                              <span className="shrink-0 text-xs sm:text-sm font-black">
                                {row.depth}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StepLore() {
  const { triageMap, navigateTo, userId } = useWeezer();
  const unlocked = isLoreUnlocked(triageMap);

  useEffect(() => {
    const open = () => {
      try {
        window.sessionStorage.removeItem('weezer:open-leaderboard');
      } catch {
        /* private mode — the event path still works */
      }
      setShowBoard(true);
      setPhase('intro');
      setActiveGameId(null);
      setGateGameId(null);
    };
    let flagged = false;
    try {
      flagged =
        window.sessionStorage.getItem('weezer:open-leaderboard') === '1';
    } catch {
      flagged = false;
    }
    if (flagged) open();
    window.addEventListener('weezer:open-leaderboard', open);
    return () => window.removeEventListener('weezer:open-leaderboard', open);
  }, []);
  const remainingAlbums = loreGateRemainingAlbums(triageMap);

  const [phase, setPhase] = useState<Phase>('intro');
  const [run, setRun] = useState<RunItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [previewLeft, setPreviewLeft] = useState(PREVIEW_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [usedAnswerKeys, setUsedAnswerKeys] = useState<ReadonlySet<string>>(
    new Set()
  );
  const [fanhood, setFanhood] = useState<FanhoodRecord | null>(null);
  // The game currently being played (or just finished). One-and-done:
  // the picker never starts a game the record already holds, so a
  // non-null activeGameId at the result means THIS run is the one
  // that gets recorded.
  const [activeGameId, setActiveGameId] = useState<LoreGameId | null>(null);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  // The leaderboard is a third view over the picker (Stage 3): the
  // picker's own button flips it, and the app menu asks for it via
  // the 'weezer:open-leaderboard' event / session flag below.
  const [showBoard, setShowBoard] = useState(false);
  // Which played game's "Every answer" tables are open in the picker.
  const [pickerOpenGameId, setPickerOpenGameId] =
    useState<LoreGameId | null>(null);
  // The start gate's game (phase 'ready'): Play selects it, Start
  // begins its run, Not now returns to the picker untouched.
  const [gateGameId, setGateGameId] = useState<LoreGameId | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Guessing loop (v4): a wrong guess never ends the question — it
  // wiggles the input and leaves a hint; only an acceptable answer
  // (or the clock) ends it. Attempts live in a ref: counted, never
  // displayed, reset per question.
  const [hint, setHint] = useState<string | null>(null);
  const [wiggle, setWiggle] = useState(0);
  const attemptsRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Plunge choreography (v4): the finished record waits here while
  // the card exits, and is committed (starting the plunge) only
  // when the 'plunging' phase begins.
  const [pendingRecord, setPendingRecord] = useState<AnswerRecord | null>(
    null
  );
  const [plungeDepth, setPlungeDepth] = useState(0);
  const [plungeMs, setPlungeMs] = useState(PLUNGE_MS);
  const [tickingTotal, setTickingTotal] = useState(0);
  // Layer-name flashes during a plunge (Oct 27, 2026): each layer
  // the fall crosses into gets its name flashed large mid-fall.
  const [layerFlash, setLayerFlash] = useState<{
    title: string;
    key: number;
    durMs: number;
  } | null>(null);
  const plungeFromRef = useRef(0);
  // v7: the stage's geometry total lags the answers total during a
  // plunge — it is only advanced a frame after the plunging phase
  // paints, so the column/marker transitions start from a painted
  // start value rather than a same-batch start=end commit.
  const [stageTotal, setStageTotal] = useState(0);
  const plungeTargetRef = useRef(0);

  const total = answers.reduce((sum, a) => sum + a.depthEarned, 0);
  const item = run[index];
  const stageRef = useRef<HTMLDivElement>(null);

  // The established fanhood, read on mount (localStorage is
  // browser-only). Legacy best-score values migrate on read — see
  // app/lib/fanhood.ts.
  useEffect(() => {
    setFanhood(readFanhood());
  }, []);

  // Reduced motion: the plunge becomes an instant jump.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // When a reveal moves the player into a deeper layer, keep the
  // stage in view on small screens.
  const currentBandTitle = bandForTotal(total).title;
  useEffect(() => {
    if (phase === 'reveal') {
      stageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [phase, currentBandTitle]);

  const timeoutRef = useRef<() => void>(() => {});

  /** Judges one answer exactly as the game always has — the record
      it builds is the reveal's content when the question ends, and
      the hint source when it doesn't. */
  const evaluateAnswer = (given: string, timedOut: boolean) => {
    if (!item) return null;
    let record: AnswerRecord;

    // Five-game rebuild (Oct 27, 2026): every prompt — songs
    // included — scores by TABLE MEMBERSHIP ONLY. One matcher over
    // the prompt's rows (canonical text + aliases + derived song
    // variants); a catalog song that isn't in the table doesn't
    // score, and a beyond-the-catalog row in the table does.
    const prompt = item.prompt;
    const extremes = openPromptExtremes(prompt);
    const contrast = {
      commonText: extremes.common.text,
      commonDepth: extremes.common.depth,
      deepestText: extremes.deepest.text,
      deepestDepth: extremes.deepest.depth,
    };
    const result = matchTableAnswer(given, openAnswerEntries(prompt));

    if (result.status === 'match') {
      const played = prompt.answers[result.index];
      const key = openAnswerKey(played);
      if (usedAnswerKeys.has(key)) {
        record = {
          outcome: 'duplicate',
          headline: played.text,
          subline:
            'You already played that one this run — no depth for repeats.',
          depthEarned: 0,
          ...contrast,
          loreLine: prompt.loreLine,
          questionPrompt: prompt.prompt,
        };
      } else {
        const nextUsed = new Set(usedAnswerKeys);
        nextUsed.add(key);
        setUsedAnswerKeys(nextUsed);
        const song = openAnswerSong(played);
        const cover = answerCoverFor(prompt, played.text);
        record = {
          outcome: 'correct',
          headline: played.text,
          subline: song ? song.album : '',
          note: played.note,
          coverSrc: cover?.src,
          coverAlbum: cover?.album,
          tier: tierForDepth(played.depth),
          depthEarned: played.depth,
          ...contrast,
          loreLine: prompt.loreLine,
          questionPrompt: prompt.prompt,
        };
      }
    } else if (result.status === 'trap') {
      const played = prompt.answers[result.index];
      record = {
        outcome: 'trap',
        headline: played.text,
        subline: '',
        trapNote: played.trapNote,
        depthEarned: 0,
        ...contrast,
        loreLine: prompt.loreLine,
        questionPrompt: prompt.prompt,
      };
    } else {
      // A miss. When the guess names a real catalog song that
      // simply isn't in this prompt's table, say so — the kindest
      // hint the game has.
      let subline = timedOut ? 'Time ran out.' : '';
      if (!timedOut) {
        const resolved = resolveSongAnswer(given, FULL_SONG_POOL, new Set());
        if (resolved.status === 'match' && resolved.song) {
          const inTable = prompt.answers.some(
            (a) => openAnswerKey(a) === `song:${resolved.song!.id}`
          );
          if (!inTable) {
            subline = `${resolved.song.title} is a real one, but it doesn't fit this prompt.`;
          }
        }
      }
      record = {
        outcome: 'miss',
        headline: '',
        subline,
        depthEarned: 0,
        ...contrast,
        loreLine: prompt.loreLine,
        questionPrompt: prompt.prompt,
      };
    }

    return record;
  };

  /** Ends the question: the card exits first, then the plunge (or
      the marker shake, on a 0-point timeout miss), then the reveal
      pops up. The record is committed when the plunge starts, so
      the marker doesn't move while the card is still leaving. */
  const endQuestion = (record: AnswerRecord) => {
    setHint(null);
    setPendingRecord(record);
    setPhase('leaving');
  };

  /** A wrong guess: wiggle the input, leave a hint, keep the clock
      and the question exactly where they are. Traps hint with
      their own correction; near-misses hint with the line the
      reveal would have carried; anything else gets a generic. */
  const wrongGuess = (record: AnswerRecord) => {
    const attempt = attemptsRef.current;
    attemptsRef.current += 1;
    if (record.outcome === 'trap' && record.trapNote) {
      setHint(record.trapNote);
    } else if (record.subline) {
      setHint(record.subline);
    } else {
      setHint(GENERIC_HINTS[attempt % GENERIC_HINTS.length]);
    }
    setInput('');
    setWiggle((w) => w + 1);
  };

  const handleGuess = () => {
    if (phase !== 'playing' || !item) return;
    if (input.trim() === '') return;
    const record = evaluateAnswer(input, false);
    if (!record) return;
    if (record.outcome === 'correct') {
      endQuestion(record);
    } else {
      wrongGuess(record);
    }
  };

  const handleTimeout = () => {
    if (phase !== 'playing' || !item) return;
    const record = evaluateAnswer('', true);
    if (record) endQuestion(record);
  };
  timeoutRef.current = handleTimeout;

  // Choreography sequencing: 'leaving' (card exit, ~250ms) commits
  // the pending record and opens 'plunging'; 'plunging' runs the
  // plunge's length (or a shorter beat for a 0-point shake), then
  // the reveal pops in.
  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(
      () => {
        if (pendingRecord) {
          plungeFromRef.current = total;
          plungeTargetRef.current = total + pendingRecord.depthEarned;
          setTickingTotal(total);
          setPlungeMs(plungeDurationForDepth(pendingRecord.depthEarned));
          setAnswers((prev) => [...prev, pendingRecord]);
          setPlungeDepth(pendingRecord.depthEarned);
          setPendingRecord(null);
        }
        setPhase('plunging');
      },
      reducedMotion ? 30 : 250
    );
    return () => clearTimeout(t);
    // `total` is the pre-commit total here by construction: the
    // pending record has not been added to `answers` yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pendingRecord, reducedMotion]);

  useEffect(() => {
    if (phase !== 'plunging') return;
    const t = setTimeout(
      () => setPhase('reveal'),
      // +60ms: the target commit lands a frame into the phase
      // (below), and the reveal should follow the fall, not tie it.
      reducedMotion ? 40 : plungeMs + 60
    );
    return () => clearTimeout(t);
  }, [phase, plungeMs, reducedMotion]);

  // v7: advance the stage geometry to the plunge target only after
  // the plunging phase has painted at the start value (double rAF),
  // so the column transform and the marker/tag `top` transitions
  // observably run from start to end. Reduced motion jumps at once.
  useEffect(() => {
    if (phase !== 'plunging') return;
    const target = plungeTargetRef.current;
    if (reducedMotion || plungeDepth <= 0) {
      setStageTotal(target);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setStageTotal(target));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [phase, plungeDepth, reducedMotion]);

  // While the marker falls, the depth label counts up with it. The
  // count uses the same plunge duration; cleanup cancels the frame
  // loop whenever the phase moves on or the component unmounts.
  useEffect(() => {
    if (phase !== 'plunging') return;
    if (reducedMotion) {
      setTickingTotal(total);
      return;
    }
    let raf = 0;
    const from = plungeFromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / plungeMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setTickingTotal(Math.round(from + (total - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, plungeMs, reducedMotion, total]);

  // Layer-flash scheduling: when a plunge crosses into new layers,
  // flash each entered layer's name as its boundary passes. Timing
  // is proportional to depth (the camera's easing makes it
  // approximate — legibility is the point, not surveying). At most
  // two boundaries can be crossed by one answer (max +1,200 against
  // floors at 200/500/1,500/3,000/5,000), so every crossing is
  // shown; a flash lasts 700ms, shortened only when the next
  // boundary follows quickly. No new phases — the fall never waits.
  useEffect(() => {
    if (phase !== 'plunging') return;
    if (reducedMotion || plungeDepth <= 0) {
      setLayerFlash(null);
      return;
    }
    const from = plungeFromRef.current;
    const to = plungeTargetRef.current;
    if (to <= from) return;
    const entered = bandsEnteredBetween(from, to);
    if (entered.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    entered.forEach((entry, i) => {
      const startMs = Math.round(
        (plungeMs * (entry.atDepth - from)) / (to - from)
      );
      const nextStart =
        i + 1 < entered.length
          ? Math.round(
              (plungeMs * (entered[i + 1].atDepth - from)) / (to - from)
            )
          : plungeMs;
      const durMs = Math.max(
        320,
        Math.min(700, nextStart - startMs, plungeMs - startMs)
      );
      timers.push(
        setTimeout(
          () =>
            setLayerFlash({ title: entry.title, key: entry.index, durMs }),
          startMs
        )
      );
      timers.push(
        setTimeout(
          () =>
            setLayerFlash((cur) =>
              cur && cur.key === entry.index ? null : cur
            ),
          startMs + durMs
        )
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      setLayerFlash(null);
    };
  }, [phase, plungeDepth, plungeMs, reducedMotion]);

  // A wrong guess leaves the cursor in the input, ready for the
  // next try.
  useEffect(() => {
    if (wiggle > 0) inputRef.current?.focus();
  }, [wiggle]);

  // Krillion's preview beat: the prompt is read-only for three
  // seconds, with no input and no 25-second clock, then play opens.
  useEffect(() => {
    if (phase !== 'preview') return;
    const deadline = Date.now() + PREVIEW_SECONDS * 1000;
    setPreviewLeft(PREVIEW_SECONDS);
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
      );
      setPreviewLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        setPhase('playing');
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, index]);

  // The 25-second clock, alive only while a question is open. It
  // runs off a deadline timestamp so a backgrounded tab can't stretch
  // it; hitting zero submits an empty answer.
  useEffect(() => {
    if (phase !== 'playing') return;
    const deadline = Date.now() + QUESTION_SECONDS * 1000;
    setSecondsLeft(QUESTION_SECONDS);
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
      );
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        timeoutRef.current();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [phase, index]);

  // Landing on the result: THE COMMIT POINT. A finished game
  // records its result exactly once — score, deepest answer, and
  // the per-prompt log — into the fanhood (recordGameResult
  // refuses a game that already has a result, so this can never
  // overwrite). A started-but-unfinished game never reaches this
  // effect and does not consume the play. Signed in: the record
  // also goes to the account, so the fanhood follows the player
  // (fire-and-forget; silent no-op for guests/failures).
  useEffect(() => {
    if (phase !== 'result' || !activeGameId) return;
    const top = [...answers]
      .filter((a) => a.depthEarned > 0)
      .sort((a, b) => b.depthEarned - a.depthEarned)[0];
    const runDeepest: FanhoodDeepest | null = top
      ? {
          answer: top.headline,
          promptLabel: top.questionPrompt,
          depth: top.depthEarned,
        }
      : null;
    const log: FanhoodGameLogEntry[] = run.map((runItem, i) => ({
      promptId: runItem.prompt.id,
      answer: answers[i]?.outcome === 'correct' ? answers[i].headline : null,
      depth: answers[i]?.depthEarned ?? 0,
    }));
    const before = readFanhood();
    setAlreadyRecorded(!!before?.games[activeGameId]);
    const { record } = recordGameResult(activeGameId, {
      score: total,
      deepest: runDeepest,
      log,
    });
    setFanhood(record);
    void syncFanhoodAfterRun(userId, record);
    // total, answers and run are final when the result phase opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = (gameId: LoreGameId) => {
    setActiveGameId(gameId);
    setAlreadyRecorded(false);
    setRun(buildGameRun(gameId));
    setIndex(0);
    setInput('');
    setAnswers([]);
    setUsedAnswerKeys(new Set());
    setHint(null);
    setPendingRecord(null);
    setPlungeDepth(0);
    setPlungeMs(PLUNGE_MS);
    setTickingTotal(0);
    plungeFromRef.current = 0;
    plungeTargetRef.current = 0;
    setStageTotal(0);
    attemptsRef.current = 0;
    setPhase('preview');
  };

  const backToGames = () => {
    setActiveGameId(null);
    setPhase('intro');
  };

  // The start gate: Play opens the ready card — the run, its
  // preview beat and its clock begin only at the gate's Start.
  const openGate = (gameId: LoreGameId) => {
    if (!gameCanStart(fanhood, gameId)) return;
    setGateGameId(gameId);
    setPhase('ready');
  };

  const startGatedGame = () => {
    if (!gateGameId) return;
    const id = gateGameId;
    setGateGameId(null);
    startGame(id);
  };

  const leaveGate = () => {
    setGateGameId(null);
    setPhase('intro');
  };

  const next = () => {
    if (index + 1 >= run.length) {
      // The run ends straight at the results — the zoom-out that
      // used to sit between was cut in v8 (Mark rejected it from
      // a screenshot: a skinny ribbon and a detached chip).
      setPhase('result');
    } else {
      setIndex(index + 1);
      setInput('');
      setHint(null);
      attemptsRef.current = 0;
      setPhase('preview');
    }
  };

  const lastRecord = answers[answers.length - 1];
  // Fanhood level-up (Oct 27, 2026): if the last scoring answer
  // carried the total across a fanhood-title threshold, the reveal
  // names the new territory.
  const leveledUpTitle =
    lastRecord && lastRecord.depthEarned > 0
      ? (() => {
          const before = titleForDepth(total - lastRecord.depthEarned);
          const after = titleForDepth(total);
          return before !== after ? after : null;
        })()
      : null;
  const deepest = [...answers]
    .filter((a) => a.depthEarned > 0)
    .sort((a, b) => b.depthEarned - a.depthEarned)
    .slice(0, 3);
  const rarest = [...answers]
    .filter((a) => a.depthEarned > 0)
    .sort((a, b) => b.depthEarned - a.depthEarned)[0];
  const finalBand = bandForTotal(total);
  const finalBandIdx = DEPTH_BANDS.findIndex(
    (b) => b.title === finalBand.title
  );
  const currentBandIdx = DEPTH_BANDS.findIndex(
    (b) => b.title === currentBandTitle
  );
  const theme = CARD_THEMES[BAND_CARD_THEME[currentBandIdx]];
  const finalTheme = CARD_THEMES[BAND_CARD_THEME[finalBandIdx]];

  const itemPrompt = item ? item.prompt.prompt : '';

  /** The Krillion contrast, shown on every open-prompt reveal. */
  const contrastBlock = (record: AnswerRecord) => {
    if (record.commonText === undefined || record.deepestText === undefined) {
      return null;
    }
    const isDeepest =
      record.outcome === 'correct' && record.headline === record.deepestText;
    const isCommon =
      record.outcome === 'correct' && record.headline === record.commonText;
    return (
      <div
        className={`space-y-1 text-xs sm:text-sm font-medium leading-relaxed ${theme.contrast}`}
      >
        <p>
          {isCommon
            ? 'Most fans say exactly that.'
            : `Most fans say ${record.commonText} — ${record.commonDepth} deep.`}
        </p>
        <p>
          {isDeepest
            ? 'And that is the deepest answer there is for this one. Nothing under it.'
            : `Deepest possible: ${record.deepestText} — ${record.deepestDepth} deep.`}
        </p>
      </div>
    );
  };

  /** The question + answer card, pinned to the bottom of the stage
      and themed to the band the player is currently in. */
  const stageCard = item && (phase === 'preview' || phase === 'playing' || phase === 'leaving' || phase === 'reveal') && (
    <div
      key={index}
      className={`rounded-3xl border p-4 sm:p-5 space-y-3.5 text-left ${theme.root} ${
        reducedMotion
          ? ''
          : phase === 'leaving'
            ? 'lore-card-out'
            : 'lore-card-in'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-black uppercase tracking-[0.14em] ${theme.label}`}
        >
          Question {index + 1} of {run.length}
        </span>
        <span
          className={`text-[10px] font-black uppercase tracking-[0.14em] ${theme.label}`}
        >
          {answers.filter((a) => a.outcome === 'correct').length} landed
        </span>
      </div>

      {phase === 'preview' || phase === 'playing' || phase === 'leaving' ? (
        <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
          {itemPrompt}
        </h2>
      ) : (
        <p className="text-sm font-bold leading-snug opacity-80">
          {itemPrompt}
        </p>
      )}

      {phase === 'preview' && (
        <div className="flex justify-center pt-1">
          <span
            className={`rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] ${theme.input}`}
            aria-live="polite"
          >
            The clock starts in {previewLeft}
          </span>
        </div>
      )}

      {(phase === 'playing' || phase === 'leaving') && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${theme.label}`}
              >
                Time left
              </span>
              <span
                className={`text-xs font-black ${
                  secondsLeft <= 6 ? theme.secondsLow : theme.seconds
                }`}
              >
                {secondsLeft}s
              </span>
            </div>
            <div
              className={`w-full h-2 rounded-full overflow-hidden ${theme.timerTrack}`}
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  secondsLeft <= 6 ? theme.timerFillLow : theme.timerFill
                }`}
                style={{
                  width: `${(secondsLeft / QUESTION_SECONDS) * 100}%`,
                }}
              />
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGuess();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div
              key={wiggle}
              className={`flex-1 ${
                wiggle > 0 && !reducedMotion ? 'lore-shake' : ''
              }`}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={`w-full text-base font-bold border-2 rounded-2xl px-4 py-3.5 outline-none placeholder:font-medium ${theme.input}`}
              />
            </div>
            <button
              type="submit"
              className={`font-black text-sm px-6 py-3.5 rounded-2xl transition-all active:scale-95 cursor-pointer ${theme.dig}`}
            >
              Descend
            </button>
          </form>

          {hint && (
            <p
              className={`text-xs sm:text-sm font-bold leading-relaxed ${theme.body}`}
            >
              {hint}
            </p>
          )}
        </>
      )}

      {phase === 'reveal' && lastRecord && (
        <div className="space-y-3">
          {leveledUpTitle && (
            <div className="rounded-2xl bg-[#FFD23F] px-3.5 py-2.5 text-center shadow-md">
              <p className="text-sm font-black text-[#111111]">
                That&apos;s {leveledUpTitle} territory.
              </p>
            </div>
          )}
          {lastRecord.outcome === 'correct' && (
            <div
              className={`border rounded-2xl p-3.5 space-y-1 ${theme.correctBox}`}
            >
              <p
                className={`text-base sm:text-lg font-black ${theme.correctTitle}`}
              >
                ✓ {lastRecord.headline} — +
                <CountUp value={lastRecord.depthEarned} />
                {lastRecord.tier ? ` · ${lastRecord.tier}!` : ''}
              </p>
              {lastRecord.note && (
                <p className={`text-xs font-bold ${theme.correctSub}`}>
                  {lastRecord.note}
                </p>
              )}
              {lastRecord.subline && (
                <p className={`text-xs font-bold ${theme.correctSub}`}>
                  {lastRecord.subline}
                </p>
              )}
              {lastRecord.tier && (
                <p className={`text-xs sm:text-sm font-bold ${theme.correctSub}`}>
                  {TIER_TAGLINES[lastRecord.tier]}
                </p>
              )}
              {lastRecord.coverSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lastRecord.coverSrc}
                  alt={`${lastRecord.coverAlbum ?? 'Album'} cover`}
                  className="h-44 w-44 max-h-48 rounded-2xl border border-black/10 object-cover shadow-md"
                  loading="lazy"
                />
              )}
            </div>
          )}
          {lastRecord.outcome === 'trap' && (
            <div
              className={`border rounded-2xl p-3.5 space-y-1 ${theme.trapBox}`}
            >
              <p className={`text-base sm:text-lg font-black ${theme.trapTitle}`}>
                {lastRecord.headline} — so close, and yet
              </p>
              <p
                className={`text-xs sm:text-sm font-bold leading-relaxed ${theme.trapSub}`}
              >
                {lastRecord.trapNote}
              </p>
            </div>
          )}
          {lastRecord.outcome === 'duplicate' && (
            <div
              className={`border rounded-2xl p-3.5 space-y-1 ${theme.trapBox}`}
            >
              <p className={`text-base sm:text-lg font-black ${theme.trapTitle}`}>
                {lastRecord.headline} — already played
              </p>
              <p className={`text-xs font-bold ${theme.trapSub}`}>
                {lastRecord.subline}
              </p>
            </div>
          )}
          {lastRecord.outcome === 'miss' && (
            <div
              className={`border rounded-2xl p-3.5 space-y-1 ${theme.missBox}`}
            >
              <p className={`text-base sm:text-lg font-black ${theme.missTitle}`}>
                {lastRecord.headline
                  ? `It was ${lastRecord.headline}.`
                  : 'Nothing landed there.'}
              </p>
              {lastRecord.subline && (
                <p className={`text-xs font-bold ${theme.missSub}`}>
                  {lastRecord.subline}
                </p>
              )}
            </div>
          )}

          {contrastBlock(lastRecord)}

          <p
            className={`text-xs sm:text-sm font-medium leading-relaxed ${theme.lore}`}
          >
            {lastRecord.loreLine}
          </p>
          <button
            onClick={next}
            autoFocus
            className={`w-full sm:w-auto font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer ${theme.next}`}
          >
            {index + 1 >= run.length
              ? 'See where you landed →'
              : 'Next question →'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex w-full flex-1 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex w-full flex-1 flex-col">
        {/* HEADER — one compact row (Mark, Oct 27: the old two-line
            title block ate ~200px above the stage and its subtitle
            duplicated the intro card's headline). Small game name on
            the left; the established fanhood rides on the right.
            The stage below is flex-1 with a measured height, so the
            reclaimed space goes straight to the descent. Mock v3:
            on the picker itself the row steps aside for the big
            display title inside the picker — every other phase
            (and the locked view and the board) keeps this row. */}
        {!(unlocked && !showBoard && phase === 'intro') && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 pb-2">
          <h1 className="truncate text-sm sm:text-base font-black tracking-tight text-slate-950">
            How Deep Is Your Fanhood?
          </h1>
          {(() => {
            const display = fanhoodDisplay(fanhood);
            if (!display) return null;
            return (
              <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black whitespace-nowrap text-white">
                Fanhood ·{' '}
                {display.depth.toLocaleString()} · {display.title}
              </span>
            );
          })()}
        </div>
        )}

        {/* LOCKED — the teaser. Progress toward the gate is named
            by album, never by count: the dashboard's Catalog
            Completion strip already carries those numbers. */}
        {/* THE LEADERBOARD — its own view over the picker */}
        {showBoard && (
          <FanhoodLeaderboard onBack={() => setShowBoard(false)} />
        )}

        {!unlocked && !showBoard && (
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 pb-8">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-950 tracking-tight">
                This game is locked
              </h2>
              <span className="text-sm">🔒</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
              Five games, seven prompts each, twenty-five seconds a prompt.
              Any right answer drops you — but the rarer your answer,
              the deeper you sink.
            </p>
            <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
              {remainingAlbums.length === 2
                ? 'It unlocks once you\u2019ve sorted two albums in the Gut Check: the Blue Album and Pinkerton.'
                : remainingAlbums[0] === 'Pinkerton'
                  ? 'The Blue Album is in the books. Pinkerton is all that\u2019s left — sort it in the Gut Check and the game opens.'
                  : 'Pinkerton is in the books. The Blue Album is all that\u2019s left — sort it in the Gut Check and the game opens.'}
            </p>
            <p className="text-xs font-bold text-slate-400 leading-relaxed">
              Where fans land: Buddy Holly · Sweater Song · Pinkerton · Fan
              Club · Karl · GOAT PUNISHMENT
            </p>
            <button
              onClick={() => navigateTo('triage')}
              className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
            >
              Go to the Gut Check →
            </button>
          </div>
          </div>
        )}

        {/* THE PICKER — unlocked, not playing (mock v3, Oct 28,
            2026): the big display title, ONE combined block (how
            it works + the ladder + the standing line), then the
            five games as a single series — played in order, each
            finish unlocking the next. Played games never reopen
            for play (one-and-done); their "Every answer" tables
            stay viewable from their row. */}
        {unlocked && !showBoard && phase === 'intro' && (
          <div className="w-full space-y-4 px-4 sm:px-6 pb-10">
            <h1
              className={`${displayFont.className} px-1 pt-1 text-[37px] leading-[1.08] text-slate-950`}
            >
              How Deep Is Your Fanhood?
            </h1>

            {/* THE COMBINED BLOCK — the explainer, the ladder and
                the player's standing in one dark container. It
                renders in every fanhood state; the standing line
                is simply absent until a first game is finished. */}
            <div className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-md">
              <div className="p-5 pb-1.5">
                <h2
                  className={`${displayFont.className} text-[21px] leading-none`}
                >
                  How it works
                </h2>
                <ol className="mt-3.5 space-y-2.5">
                  {[
                    {
                      lead: 'Five games, played in order.',
                      rest: 'Each finish unlocks the next. Seven prompts a game, twenty-five seconds a prompt.',
                    },
                    {
                      lead: 'Guess until you land one.',
                      rest: 'Every prompt takes more than one right answer — and the rarer yours is, the deeper you sink.',
                    },
                    {
                      lead: 'Each game counts once.',
                      rest: 'When it ends, your score locks in and adds to your fanhood. There are no replays.',
                    },
                  ].map((step, i) => (
                    <li
                      key={step.lead}
                      className="flex gap-2.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-200"
                    >
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#039AD1] text-[12px] font-black text-white">
                        {i + 1}
                      </span>
                      <span>
                        <strong className="font-black text-white">
                          {step.lead}
                        </strong>{' '}
                        {step.rest}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3.5 text-xs font-semibold text-slate-400">
                  Type your answers — spelling doesn&apos;t have to be
                  perfect.
                </p>
              </div>
              <p className="border-t border-white/15 px-5 pt-3 pb-2.5 text-xs font-bold leading-relaxed text-slate-300">
                Your five scores add up to one fanhood. This is where the
                total lands you:
              </p>
              {FANHOOD_TOTAL_LADDER.map((tier, i) => (
                <div
                  key={tier.title}
                  className="flex items-baseline justify-between gap-3 px-5 py-2"
                  style={{ backgroundColor: LADDER_RUNG_BG[i] }}
                >
                  <span
                    className={`${displayFont.className} text-[15px] leading-none text-white`}
                    style={
                      i === FANHOOD_TOTAL_LADDER.length - 1
                        ? { color: '#fbbf24' }
                        : undefined
                    }
                  >
                    {tier.title}
                  </span>
                  <span className="text-[11px] font-extrabold text-white/85">
                    {totalTierRangeLabel(i)}
                  </span>
                </div>
              ))}
              {(() => {
                const line = fanhoodStandingLine(fanhood);
                if (!line) return null;
                return (
                  <div className="flex items-center gap-2 px-5 pt-2.5 pb-4">
                    <span
                      aria-hidden
                      className="h-[9px] w-[9px] shrink-0 rounded-full bg-[#fbbf24]"
                    />
                    <p className="text-xs font-bold text-slate-200">{line}</p>
                  </div>
                );
              })()}
            </div>

            {/* THE SERIES — one card, five rows on a numbered rail
                that deepens game by game. Only the up-next row can
                open the start gate; locked rows name the game in
                front of them. */}
            <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 pt-3.5 pb-3">
                <h2
                  className={`${displayFont.className} text-[17px] leading-none text-slate-950`}
                >
                  The Series
                </h2>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
                  {fanhoodGamesPlayed(fanhood)} of 5 played
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {LORE_GAMES.map((game, gameIndex) => {
                  const result = fanhood?.games[game.id];
                  const state = seriesRowState(fanhood, game.id);
                  const tablesOpen = pickerOpenGameId === game.id;
                  return (
                    <div
                      key={game.id}
                      className={`flex gap-3 px-5 py-4 ${
                        state === 'locked' ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center self-stretch">
                        <span
                          className="z-[1] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-black text-white"
                          style={{
                            backgroundColor: SERIES_BALL_BG[gameIndex],
                          }}
                        >
                          {state === 'played' ? '✓' : gameIndex + 1}
                        </span>
                        {gameIndex < LORE_GAMES.length - 1 && (
                          <span
                            aria-hidden
                            className="mt-1 w-[3px] flex-1 rounded bg-slate-200"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3
                            className={`${displayFont.className} text-[19px] leading-tight text-slate-950`}
                          >
                            {game.name}
                          </h3>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                              state === 'played'
                                ? 'bg-green-100 text-green-700'
                                : state === 'up-next'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {state === 'played'
                              ? 'Played'
                              : state === 'up-next'
                                ? 'Up next'
                                : 'Locked'}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-500">
                          {game.promise}
                        </p>
                        {state === 'played' && result && (
                          <>
                            <p className="mt-2 text-sm font-black text-slate-900">
                              Your score: {result.score.toLocaleString()} ·
                              Game verdict — {titleForDepth(result.score)}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setPickerOpenGameId(
                                  tablesOpen ? null : game.id
                                )
                              }
                              aria-expanded={tablesOpen}
                              className="mt-1.5 inline-block cursor-pointer text-xs font-black text-[#0072CE] hover:underline"
                            >
                              {tablesOpen
                                ? 'Hide every answer'
                                : 'See every answer'}
                            </button>
                            {tablesOpen && (
                              <PromptAnswerTables
                                items={game.promptIds.map((promptId) => {
                                  const entry = result.log.find(
                                    (e) => e.promptId === promptId
                                  );
                                  return {
                                    prompt: promptById(promptId),
                                    landedText: entry?.answer ?? null,
                                    landedDepth: entry?.depth ?? 0,
                                  };
                                })}
                              />
                            )}
                          </>
                        )}
                        {state === 'up-next' && (
                          <button
                            onClick={() => openGate(game.id)}
                            className="mt-3 w-full cursor-pointer rounded-[13px] bg-[#0072CE] px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
                          >
                            Play {game.name}
                          </button>
                        )}
                        {state === 'locked' && (
                          <p className="mt-1.5 text-xs font-bold text-slate-400">
                            🔒 Finish {LORE_GAMES[gameIndex - 1].name} to
                            unlock
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowBoard(true)}
              className="flex w-full items-center justify-between gap-3 bg-white border border-slate-200/90 hover:border-slate-300 rounded-3xl p-5 shadow-xs transition-all cursor-pointer text-left"
            >
              <span>
                <span className="block text-base font-black tracking-tight text-slate-950">
                  Fanhood Leaderboard
                </span>
                <span className="block text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                  Worldwide and friends standings, game by game.
                </span>
              </span>
              <span className="shrink-0 text-sm font-black text-[#0072CE]">
                →
              </span>
            </button>
          </div>
        )}

        {/* THE START GATE — Play opens this ready card, never the
            clock: a one-and-done game starts only when the player
            says go. Leaving it starts nothing and consumes nothing,
            and a played game can never reach it. */}
        {unlocked && !showBoard && phase === 'ready' && gateGameId && (
          <div className="w-full px-4 sm:px-6 pb-10">
            {(() => {
              const game = loreGameById(gateGameId);
              const gameNumber =
                LORE_GAMES.findIndex((g) => g.id === game.id) + 1;
              return (
                <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
                  <div className="bg-[#1e3a5f] p-5 text-white">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                      Game {gameNumber} of 5
                    </p>
                    <h2
                      className={`${displayFont.className} mt-1.5 text-[27px] leading-none`}
                    >
                      {game.name}
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-white/85">
                      {game.promise}
                    </p>
                  </div>
                  <div className="p-5">
                    <div className="divide-y divide-slate-100">
                      {GATE_RULES.map((rule) => (
                        <div
                          key={rule.lead}
                          className="flex gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <span aria-hidden className="text-base leading-snug">
                            {rule.icon}
                          </span>
                          <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-600">
                            <strong className="font-black text-slate-950">
                              {rule.lead}
                            </strong>{' '}
                            {rule.rest}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={startGatedGame}
                      className="mt-4 w-full bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-sm px-5 py-3.5 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      Start {game.name}
                    </button>
                    <button
                      onClick={leaveGate}
                      className="mt-2.5 w-full py-1 text-center text-xs font-extrabold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* PLAYING / LEAVING / PLUNGING / REVEAL — the descent is
            the stage. During 'plunging' the card is gone entirely:
            nothing stands between the player and the drop. */}
        {unlocked && !showBoard && item && (phase === 'preview' || phase === 'playing' || phase === 'leaving' || phase === 'plunging' || phase === 'reveal') && (
          <div ref={stageRef} className="flex flex-1 flex-col">
            <DescentStage
              total={stageTotal}
              displayTotal={phase === 'plunging' ? tickingTotal : total}
              burstDelayMs={plungeMs}
              flash={phase === 'plunging' ? layerFlash : null}
              plunging={phase === 'plunging'}
              fallingTag={
                phase === 'plunging' &&
                lastRecord &&
                lastRecord.depthEarned > 0
                  ? lastRecord.headline
                  : null
              }
              fill
              burst={
                (phase === 'plunging' || phase === 'reveal') &&
                lastRecord &&
                lastRecord.depthEarned > 0
                  ? {
                      tier: lastRecord.tier,
                      depth: lastRecord.depthEarned,
                      headline: lastRecord.headline,
                    }
                  : null
              }
              shake={
                (phase === 'plunging' || phase === 'reveal') &&
                !!lastRecord &&
                lastRecord.depthEarned === 0
              }
              animKey={answers.length}
              reducedMotion={reducedMotion}
              viewH={phase === 'reveal' ? 600 : 480}
              focusTop={phase === 'reveal'}
              camMs={phase === 'reveal' ? 400 : plungeMs}
            >
              {phase === 'plunging' ? undefined : stageCard}
            </DescentStage>
          </div>
        )}

        {/* RESULT */}
        {unlocked && !showBoard && phase === 'result' && (
          <>
          <div className="w-full space-y-6 px-4 sm:px-6 pb-10">
            {/* THE VERDICT — the results lead with the GAME's own
                verdict, labeled as one so it never reads as a claim
                about the whole fanhood: the per-game ladder names
                it (titleForDepth on this game's score), the banner
                keeps the final layer's art, and the fanhood strip
                under it carries the compound story separately. */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 shadow-md space-y-3 ${BAND_STAGE[finalBandIdx].layer}`}
              style={BAND_STAGE[finalBandIdx].textureStyle}
            >
              <p className="text-[11px] font-black uppercase tracking-wider opacity-70">
                {activeGameId
                  ? `${loreGameById(activeGameId).name} · Game verdict`
                  : 'Game verdict'}
              </p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
                You&apos;re a {titleForDepth(total)}
              </h2>
              <p className="text-base sm:text-lg font-black">
                {total.toLocaleString()} deep
              </p>
              <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-80">
                {finalBand.line}
              </p>
              {alreadyRecorded ? (
                <p className="text-xs font-bold opacity-70">
                  This game was already on your card — a finished
                  game&apos;s score never changes, so this run added
                  nothing.
                </p>
              ) : (
                <p className="text-xs font-black">
                  Locked in — this score is on your card for good. 🏆
                </p>
              )}
            </div>

            {/* THE FANHOOD STRIP — the compound total on its own
                ladder, labeled as the fanhood (never as a verdict
                on this game). */}
            {(() => {
              const display = fanhoodDisplay(fanhood);
              if (!display) return null;
              return (
                <div className="bg-slate-950 text-white rounded-3xl p-5 shadow-md space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                    Your fanhood
                  </p>
                  <p className="text-base sm:text-lg font-black leading-snug">
                    You&apos;re a {display.title} —{' '}
                    {display.depth.toLocaleString()} deep across{' '}
                    {display.gamesPlayed} of 5 games.
                  </p>
                  <p className="text-xs font-bold text-white/60">
                    {display.gamesPlayed >= 5
                      ? 'All five games are in. That is the whole card.'
                      : 'Every game left on the picker adds its score to that total.'}
                  </p>
                </div>
              );
            })()}

            <DescentStage
              total={total}
              burst={null}
              shake={false}
              animKey={0}
              reducedMotion={reducedMotion}
              viewH={480}
              focusTop={false}
            />

            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-base font-black text-slate-950 tracking-tight">
                Your deepest drops
              </h3>
              {rarest && (
                <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
                  Your rarest pull: {rarest.headline}
                  {rarest.tier ? ` — ${rarest.tier}` : ''}, worth{' '}
                  {rarest.depthEarned.toLocaleString()}.
                </p>
              )}
              {deepest.length === 0 ? (
                <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                  Nothing landed this time — every answer is in the tables
                  below.
                </p>
              ) : (
                <div className="space-y-2">
                  {deepest.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-black text-slate-900">
                        {a.headline}
                      </span>
                      <span className="text-sm font-black text-[#0072CE] shrink-0">
                        +{a.depthEarned}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={backToGames}
                  className={`w-full sm:w-auto font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer ${finalTheme.dig}`}
                >
                  Back to the games
                </button>
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="w-full sm:w-auto bg-white border-2 border-slate-200 hover:border-slate-300 active:scale-95 text-slate-700 font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
              <div>
                <h3 className="text-base font-black text-slate-950 tracking-tight">
                  Every answer
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                  Open a prompt to see every answer that would have landed, deepest first.
                </p>
              </div>
              <PromptAnswerTables
                items={run.map((runItem, runIndex) => ({
                  prompt: runItem.prompt,
                  landedText:
                    answers[runIndex]?.outcome === 'correct'
                      ? answers[runIndex].headline
                      : null,
                  landedDepth: answers[runIndex]?.depthEarned ?? 0,
                }))}
              />
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
