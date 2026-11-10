'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import {
  DEPTH_BANDS,
  LORE_GAMES,
  TIER_TAGLINES,
  TOTAL_STOPS,
  answerCoverFor,
  bandForTotal,
  buildGameRun,
  finishedAtPhrase,
  loreGameById,
  nextStopForTotal,
  openAnswerEntries,
  openAnswerKey,
  openAnswerSong,
  openPromptAnswerTable,
  openPromptExtremes,
  promptById,
  stopForTotal,
  tierForDepth,
  youreAtPhrase,
} from '../data/loreGame';
import type {
  LoreGame,
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
  fanhoodTotal,
  gameCanStart,
  readFanhood,
  recordGameResult,
  seriesRowState,
} from '../lib/fanhood';
import { displayFont } from './shareables/fonts';
import { syncFanhoodAfterRun } from '../lib/fanhoodSync';
import { trackAnalytics } from '../lib/analytics';
import { supabase } from '../../utils/supabase';
import {
  parseLeaderboardRows,
  type LeaderboardEntry,
} from '../lib/leaderboard';
import FanhoodLeaderboard from './FanhoodLeaderboard';
import ShellClaimCard from './ShellClaimCard';
import type {
  FanhoodDeepest,
  FanhoodGameLogEntry,
  FanhoodRecord,
} from '../lib/fanhood';

const QUESTION_SECONDS = 25;
const PREVIEW_SECONDS = 3;

/** The start gate's three rules (Nov 1, 2026 rebuild: stakes
 *  first, mechanics concrete, lock-in as commitment — the old
 *  variety rule and four-rule set are gone). Verbatim copy.
 *  Plain text rows since Nov 3, 2026 — the rule icons are gone
 *  (Mark overruled keeping them). */
const GATE_RULES: { text: string }[] = [
  {
    text: '25 seconds a question. Wrong guesses cost nothing — keep guessing.',
  },
  {
    text: 'Rarer answers move you further. The obvious ones barely move you.',
  },
  {
    text: 'Your score locks in when the round ends. One run — make it count.',
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
 * the Island layer, dark Pinkerton maroon, photocopied-note purple
 * with ruled lines for the Tar Pits, archive dark-green for the
 * Garage, and near-black bedrock for the Shack. Each layer carries
 * the mock's faint era-texture type.
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
    // Arnold's Drive-In — bright radio-blue. The layer IS the Blue
    // Album era, so its cover ghosts the background.
    layer: 'bg-gradient-to-b from-[#039AD1] to-[#0277b6] text-[#eaf7ff]',
    chip: 'bg-white text-[#0277b6]',
    range: 'text-white/70',
    texture: "UNDONE · BUDDY HOLLY · SAY IT AIN'T SO · UNDONE ·",
    coverSrc: '/albums/blue.jpg',
  },
  {
    // Island in the Sun — flannel tan.
    layer: 'bg-gradient-to-b from-[#f3e9d2] to-[#e7d7ae] text-[#4a3a17]',
    chip: 'bg-[#4a3a17] text-[#f3e9d2]',
    range: 'text-[#4a3a17]/60',
    texture: "FLANNEL · '94 · MTV · THE RENTALS ·",
  },
  {
    // Across the Sea — dark maroon, Pinkerton's own cover ghosted in.
    layer: 'bg-gradient-to-b from-[#5b2333] to-[#401826] text-[#f6d9de]',
    chip: 'bg-[#f6d9de] text-[#5b2333]',
    range: 'text-[#f6d9de]/60',
    texture: 'EL SCORCHO · ACROSS THE SEA ·',
    coverSrc: '/albums/pinkerton.jpg',
  },
  {
    // La Brea Tar Pits — photocopied-note purple, ruled lines.
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
    // The Garage — archive dark-green.
    layer: 'bg-gradient-to-b from-[#14261c] to-[#0c1a12] text-[#b9e7c9]',
    chip: 'bg-[#b9e7c9] text-[#14261c]',
    range: 'text-[#b9e7c9]/60',
    texture: "KARL'S CORNER · THE FIFTH WEEZER · ARCHIVE ·",
  },
  {
    // The Shack — near-black bedrock.
    layer: 'bg-[#060607] text-[#8f8fa3]',
    chip: 'bg-[#26262e] text-[#c9c9d6] border border-[#3a3a46]',
    range: 'text-[#8f8fa3]/70',
    texture: 'THE LIGHTNING STRAP · 1992 ·',
    textureStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 50% 0%, rgba(70,70,88,0.5) 0%, rgba(6,6,7,0) 70%)',
    },
  },
];

/**
 * Card themes, re-skinned per stop (mock frames 1 vs 3): a
 * white card at the surface stops, a dark plum card through
 * Across the Sea / the Tar Pits, the archive-green dark card at
 * the Garage, and a warm gold-accented dark card in the bedrock.
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
    // Across the Sea / Tar Pits — dark plum.
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
    // The Garage — the mock's archive-green dark card.
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
    // The Shack — warm dark card, gold accents (mock frame 2).
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

/**
 * Where a STANDING total sits in the column, on the total
 * ladder (TOTAL_STOPS) rather than the run scale: the layer of
 * the stop the total has reached, interpolated within the
 * layer by progress toward the next stop's floor — the same
 * 76px-inset → 90% travel depthToY uses, so the results map's
 * geometry is the game's own, zoomed out. At the Shack there
 * is no next floor: the marker rests at the travel band's end.
 */
function standingToStageY(total: number): number {
  const stop = stopForTotal(total);
  const i = TOTAL_STOPS.findIndex((s) => s.title === stop.title);
  const next = TOTAL_STOPS[i + 1];
  const t = next
    ? Math.min(1, Math.max(0, (total - stop.min) / (next.min - stop.min)))
    : 1;
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
 * The journey cross-section as a full-screen stage: a tall column of
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
  fallingTag,
  plunging,
  shake,
  animKey,
  reducedMotion,
  viewH,
  focusTop,
  fill,
  camMs,
  journeyMap,
  children,
}: {
  total: number;
  /** Label-only depth, ticking up while the marker falls. */
  displayTotal?: number;
  burst: BurstInfo | null;
  /** When the burst pop starts, timed to finish as the marker lands. */
  burstDelayMs?: number;
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
  /** Results-screen map mode: render the WHOLE column scaled
      into the panel, the marker placed by the STANDING total
      (the `total` prop, on the TOTAL_STOPS ladder) with the
      stops labeled — see the journeyMap branch below. */
  journeyMap?: boolean;
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

  // The card tray (below) is a scroll container capped at
  // effH - 92, and a rich reveal — headline, album cover,
  // contrast, lore, button — can be taller than the cap. When
  // the reveal lands, its Next button's autoFocus makes the
  // browser scroll the tray to the focused button, so the
  // panel reads from the BOTTOM: the headline scrolled away
  // and the cover clipped at the tray's top edge (Mark's
  // screenshot, Nov 3, 2026 — mobile and desktop alike).
  // focusTop flips true in the same commit the reveal mounts,
  // and this layout effect runs after the focus scroll, so
  // the reveal always starts at the top of the tray and flows
  // down, cover fully visible.
  const cardScrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (focusTop && cardScrollRef.current) {
      cardScrollRef.current.scrollTop = 0;
    }
  }, [focusTop]);

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

  // JOURNEY MAP (results screen only, Nov 3, 2026 — Mark: the
  // gameplay-scale window "doesn't tell the user how far/close
  // they are to getting back to the shack"). The whole 3,000px
  // column scales into the panel: every band at its true
  // LAYER_HEIGHTS proportion, the trail from the surface, and
  // the marker placed by the STANDING total (standingToStageY)
  // so one glance reads the whole trip — where you are, how
  // much road is left. The stops are labeled HERE ONLY (small
  // chips that read on light and dark bands alike); the in-run
  // stage stays unnamed. What doesn't survive the zoom: the
  // texture watermark type (76px furniture in ~70–90px bands)
  // and the "▼ WHAT'S DOWN THERE? ▼" footers — both noise at
  // this scale, and the labels carry the information instead.
  // Cover ghosts and texture overlays stay. Bands past the
  // standing dim like unvisited layers do in the run.
  if (journeyMap) {
    const mapScale = effH / STAGE_HEIGHT;
    const standingIdx = TOTAL_STOPS.findIndex(
      (s) => s.title === stopForTotal(total).title
    );
    // Clamp so the 48px marker never clips the panel's edges
    // (a 0 total would otherwise park its center 12px down).
    const mapMarkerY = Math.min(
      Math.max(standingToStageY(total) * mapScale, 26),
      effH - 26
    );
    return (
      <div
        className="relative overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] shadow-[6px_6px_0_#0C1220]"
        style={{ height: viewH }}
      >
        {DEPTH_BANDS.map((band, i) => {
          const style = BAND_STAGE[i];
          const unreached = i > standingIdx;
          return (
            <div
              key={band.title}
              className={`absolute inset-x-0 overflow-hidden ${style.layer}`}
              style={{
                top: LAYER_TOPS[i] * mapScale,
                height: LAYER_HEIGHTS[i] * mapScale,
                filter: unreached
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
              <span className="absolute right-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                {TOTAL_STOPS[i].title}
              </span>
            </div>
          );
        })}

        {/* The descent trail: surface to marker */}
        <div
          className="absolute left-[37px] top-0 z-10 w-0 border-l-[3px] border-dashed border-white/50"
          style={{ height: mapMarkerY }}
        />

        {/* The player marker, at the standing's position */}
        <div
          className="absolute left-3.5 z-20"
          style={{ top: mapMarkerY }}
        >
          <div className="flex -translate-y-1/2 items-center gap-[7px]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-[#111111] bg-[#FFD23F] text-sm font-black text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
              =w=
            </div>
            <div className="whitespace-nowrap rounded-full bg-[#111111] px-3 py-1.5 text-xs font-black tracking-[0.05em] text-[#FFD23F] shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
              YOU · {(displayTotal ?? total).toLocaleString()} POINTS
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        @media (prefers-reduced-motion: reduce) {
          .lore-burst, .lore-shake, .lore-card-in, .lore-card-out { animation: none !important; }
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
              {/* The layers are UNNAMED (Nov 1, 2026): colors and
                  era textures only — the stops live on the one
                  ladder (picker journey + results standing), never
                  on the run's own scale. */}
              <div className="pointer-events-none absolute left-2 top-[76px] whitespace-nowrap text-lg font-black tracking-[0.06em] opacity-[0.16]">
                {style.texture}
              </div>
              {unvisited && (
                <div className="absolute inset-x-0 bottom-2.5 text-center text-[10px] font-black tracking-[0.22em] opacity-50">
                  {i === DEPTH_BANDS.length - 1
                    ? '▼ THE FINAL LAYER ▼'
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
                YOU · {(displayTotal ?? total).toLocaleString()} POINTS
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

      {/* The bottom-pinned card */}
      {children && (
        <div
          ref={cardScrollRef}
          className="absolute inset-x-0 bottom-3 z-30 mx-auto w-full max-w-2xl overflow-y-auto px-3"
          style={{ maxHeight: effH - 92 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The game-world backdrop (desktop layout pass, Nov 3, 2026;
 * gradient revision the same night — Mark: the stacked bands
 * read as weird stripes, "can we do a gradient maybe?"): ONE
 * smooth vertical linear-gradient, so on a wide screen the
 * capped, centered content columns sit IN the world instead
 * of on a blank page. The stops sit at each layer's center
 * in the descent column's own proportions (LAYER_HEIGHTS over
 * STAGE_HEIGHT). No hard band edges and no texture overlays
 * back here — the ruled lines and radial glow belong to the
 * real stage only. Fully responsive — the gradient spans
 * whatever width the bleed gives it — and purely decorative:
 * aria-hidden, pointer-events-none, low opacity, so every
 * card and line of text on top stays readable. During a run
 * the play stage covers the middle and the gradient shows in
 * its flanks. On a phone the capped columns fill the width
 * and the backdrop is simply the page's tint.
 *
 * Color revision (later the same night — Mark: the original
 * six-color melt through every era's color was "too much"):
 * ONE color family — blue. Pale sky at the top (light enough
 * for the dark picker headline to read cleanly), deepening
 * through the stage's radio blue and the brand blue to a
 * deep navy at the bottom, so the page still descends
 * light → dark without the rainbow.
 */
const BACKDROP_COLORS = [
  '#a8dcf5', // pale sky — the top of the descent
  '#0389c4', // radio blue (the stage's own top layer)
  '#0072ce', // brand blue
  '#005b9f', // deepened brand blue
  '#0e2f52', // navy (kin to the gate's #1e3a5f, darker)
  '#050d1a', // near-black navy bedrock
];

function GradientBackdrop() {
  const stops: string[] = [];
  let acc = 0;
  LAYER_HEIGHTS.forEach((h, i) => {
    const center = ((acc + h / 2) / STAGE_HEIGHT) * 100;
    stops.push(`${BACKDROP_COLORS[i]} ${center.toFixed(1)}%`);
    acc += h;
  });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-30"
    >
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})`,
        }}
      />
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
 * opens to its full answer table (rarest first, grouped by tier),
 * with the player's landed answer highlighted. Shared by the
 * results screen (this run's answers) and the picker (a played
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
  const { navigateTo, userId } = useWeezer();
  // The game is the front door (owner, Nov 9, 2026): the old
  // Blue + Pinkerton triage gate is gone — anyone who lands
  // here can play, sort or no sort. The pitch for the Gut
  // Check moved to the results screen and the claim card.

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

  // The board's rows, fetched once here: the inline board
  // renders them, and the up-next round card reads the
  // per-round high score off them (owner, Nov 9, 2026). Null
  // while loading; the board shows its loading state and the
  // card simply omits the high until the rows land.
  const [boardEntries, setBoardEntries] = useState<
    LeaderboardEntry[] | null
  >(null);
  const [boardFailed, setBoardFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          'get_fanhood_leaderboard'
        );
        if (cancelled) return;
        if (error) {
          setBoardFailed(true);
          setBoardEntries([]);
          return;
        }
        setBoardEntries(parseLeaderboardRows(data));
      } catch {
        if (!cancelled) {
          setBoardFailed(true);
          setBoardEntries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const roundHigh = (gameId: LoreGameId): number | null => {
    if (!boardEntries) return null;
    let high: number | null = null;
    for (const entry of boardEntries) {
      const score = entry.gameScores[gameId];
      if (typeof score === 'number' && (high === null || score > high)) {
        high = score;
      }
    }
    return high;
  };
  const pointsPossible = (game: LoreGame): number =>
    game.promptIds.reduce(
      (sum, promptId) =>
        sum + openPromptExtremes(promptById(promptId)).deepest.depth,
      0
    );
  // The game currently being played (or just finished). One-and-done:
  // the picker never starts a game the record already holds, so a
  // non-null activeGameId at the result means THIS run is the one
  // that gets recorded.
  const [activeGameId, setActiveGameId] = useState<LoreGameId | null>(null);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  // The standing totals either side of the just-finished round,
  // snapshotted at the commit point below: the results screen's
  // ONE ladder reads the standing off these (before → after), so
  // a round that carries the player into a new stop can say so.
  const [resultStanding, setResultStanding] = useState<{
    before: number;
    after: number;
  } | null>(null);
  // The leaderboard is a third view over the picker (Stage 3): the
  // picker's own button flips it, and the app menu asks for it via
  // the 'weezer:open-leaderboard' event / session flag below.
  const [showBoard, setShowBoard] = useState(false);
  // Which played game's "Every answer" tables are open in the picker.
  const [pickerOpenGameId, setPickerOpenGameId] =
    useState<LoreGameId | null>(null);
  // The Rounds swipe deck (mock v6, Oct 31, 2026): the deck opens
  // centered on the up-next game, and the dots + caption under it
  // track whichever card sits nearest the center as the player
  // swipes.
  const deckRef = useRef<HTMLDivElement>(null);
  const deckCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckScrollRaf = useRef(0);
  const [deckIndex, setDeckIndex] = useState(0);
  const deckUpNextIndex = (() => {
    const idx = LORE_GAMES.findIndex(
      (g) => seriesRowState(fanhood, g.id) === 'up-next'
    );
    return idx >= 0 ? idx : LORE_GAMES.length - 1;
  })();

  // Center the up-next card whenever the picker comes into view
  // (first mount, and returning from a run or the gate — the
  // record has moved on by then, so the centering follows it).
  useEffect(() => {
    if (phase !== 'intro' || showBoard) return;
    const deck = deckRef.current;
    const card = deckCardRefs.current[deckUpNextIndex];
    if (!deck || !card) return;
    const deckRect = deck.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    deck.scrollLeft +=
      cardRect.left +
      cardRect.width / 2 -
      (deckRect.left + deckRect.width / 2);
    setDeckIndex(deckUpNextIndex);
  }, [phase, showBoard, deckUpNextIndex]);

  // Screen changes inside this step (picker → gate → run →
  // results → board) never change the app step, so the
  // context's step-change scroll-to-top never fires and the
  // window keeps the picker's scroll — tapping Play Round 1
  // landed mid-page on the gate (owner report, Nov 9, 2026).
  // Entering a new screen starts at the top. The run's own
  // phases count as ONE screen: the plunge choreography
  // scrolls the stage itself. The mount render is skipped —
  // the app-level navigation owns the arrival scroll.
  const screenKey = showBoard
    ? 'board'
    : phase === 'intro'
      ? 'picker'
      : phase === 'ready'
        ? 'gate'
        : phase === 'result'
          ? 'result'
          : 'run';
  const mountedScreenRef = useRef(true);
  useEffect(() => {
    if (mountedScreenRef.current) {
      mountedScreenRef.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [screenKey]);

  const handleDeckScroll = () => {
    if (deckScrollRaf.current) return;
    deckScrollRaf.current = requestAnimationFrame(() => {
      deckScrollRaf.current = 0;
      const deck = deckRef.current;
      if (!deck) return;
      const deckRect = deck.getBoundingClientRect();
      const center = deckRect.left + deckRect.width / 2;
      let best = 0;
      let bestDist = Infinity;
      deckCardRefs.current.forEach((card, i) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setDeckIndex((prev) => (prev === best ? prev : best));
    });
  };
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
            'You already played that one this run — no points for repeats.',
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
    trackAnalytics('game_completed');
    const { record } = recordGameResult(activeGameId, {
      score: total,
      deepest: runDeepest,
      log,
    });
    setResultStanding({
      before: fanhoodTotal(before),
      after: fanhoodTotal(record),
    });
    setFanhood(record);
    void syncFanhoodAfterRun(userId, record);
    // total, answers and run are final when the result phase opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = (gameId: LoreGameId) => {
    trackAnalytics('game_started');
    setActiveGameId(gameId);
    setAlreadyRecorded(false);
    setResultStanding(null);
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
  // (The reveal used to carry a title level-up banner here; it
  // named the run's band — a second scale — so the one-ladder
  // reframe cut it rather than say the standing twice.)
  const deepest = [...answers]
    .filter((a) => a.depthEarned > 0)
    .sort((a, b) => b.depthEarned - a.depthEarned)
    .slice(0, 3);
  const rarest = [...answers]
    .filter((a) => a.depthEarned > 0)
    .sort((a, b) => b.depthEarned - a.depthEarned)[0];
  const currentBandIdx = DEPTH_BANDS.findIndex(
    (b) => b.title === currentBandTitle
  );
  const theme = CARD_THEMES[BAND_CARD_THEME[currentBandIdx]];
  // The results screen reads ONE ladder (Nov 1, 2026): the round
  // reports its points, and the standing — the total's stop,
  // before vs after this round — is the only stop named. The
  // banner art follows the standing stop's layer (TOTAL_STOPS and
  // DEPTH_BANDS share their order). Before the commit snapshot
  // lands, the after-total falls back to the pre-run record plus
  // this round's score.
  const resultAfterTotal =
    resultStanding?.after ?? fanhoodTotal(fanhood) + total;
  const resultBeforeTotal = resultStanding?.before ?? fanhoodTotal(fanhood);
  const resultStop = stopForTotal(resultAfterTotal);
  const resultStopBefore = stopForTotal(resultBeforeTotal);
  const resultStopIdx = TOTAL_STOPS.findIndex(
    (s) => s.title === resultStop.title
  );
  const resultCrossed =
    resultStopIdx >
    TOTAL_STOPS.findIndex((s) => s.title === resultStopBefore.title);
  const resultNext = nextStopForTotal(resultAfterTotal);
  const resultNextThreshold = resultNext
    ? TOTAL_STOPS.find((s) => s.title === resultNext.title)?.min
    : undefined;
  // The finished state on this screen: this round may have been
  // the last of the five, in which case no "next stop" exists to
  // chase. The fanhood state swaps to the post-round record at
  // the commit point above; until that state lands, the
  // after-count is synthesized the way resultAfterTotal
  // synthesizes the after-total — the pre-round count plus this
  // round when the record doesn't hold it yet. (Once the swap
  // lands, the record holds the game and the plus-one is zero,
  // so the count is the same on both renders.)
  const resultGamesAfter =
    fanhoodGamesPlayed(fanhood) +
    (activeGameId && !fanhood?.games[activeGameId] ? 1 : 0);
  const resultAllPlayed = resultGamesAfter >= LORE_GAMES.length;
  // The strip's standing sentence: a round that carried the
  // player into a new stop announces the arrival; otherwise the
  // standing is restated — in the finished form once the series
  // is complete, the present form while the road is still open.
  const resultStandingLine = resultCrossed
    ? `You made it ${resultStop.phrase}.`
    : resultAllPlayed
      ? `${finishedAtPhrase(resultStop.title)}.`
      : `${youreAtPhrase(resultStop.title)}.`;

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
            : `Most fans say ${record.commonText} — ${record.commonDepth} points.`}
        </p>
        <p>
          {isDeepest
            ? 'And that is the rarest answer there is for this one.'
            : `Rarest possible: ${record.deepestText} — ${record.deepestDepth} points.`}
        </p>
      </div>
    );
  };

  /** The question + answer card, pinned to the bottom of the stage
      and themed to the band the player is currently in. */
  const stageCard = item && (phase === 'preview' || phase === 'playing' || phase === 'leaving' || phase === 'reveal') && (
    <div
      key={index}
      className={`rounded-3xl border p-4 sm:p-5 space-y-3.5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.5)] ${theme.root} ${
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
              Answer
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
          {lastRecord.outcome === 'correct' && (
            <div className={`border rounded-2xl p-3.5 ${theme.correctBox}`}>
              {/* Compact reveal art (Mark, Nov 3, 2026): the cover
                  used to render as a large block under the answer
                  text and ate the panel. Now the header zone is a
                  row — headline, note, subline and tagline on the
                  left, the cover as a small thumbnail on the
                  right — and the facts below keep the full width. */}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
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
                </div>
                {lastRecord.coverSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lastRecord.coverSrc}
                    alt={`${lastRecord.coverAlbum ?? 'Album'} cover`}
                    className="h-28 w-28 shrink-0 rounded-xl border border-black/10 object-cover shadow-md"
                    loading="lazy"
                  />
                )}
              </div>
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

  /* THE PICKER BLOCKS (mock v5, Oct 30, 2026; rounds revised
     to mock v6, Oct 31, 2026; de-duplicated Nov 3, 2026) —
     defined once here and rendered in the intro below in one
     fixed order. The journey card is the old levels card and
     the standing line merged into one route map (one ladder,
     each fact stated once); the rounds are a swipe deck of
     state-tinted cards (v6: the vertical stack of rows read
     as a wall of text); the leaderboard entry carries its new
     title. The old explainer card is gone — the start gate
     carries the rules now. */
  const pickerPlayedAny = fanhoodGamesPlayed(fanhood) > 0;
  // The finished state: every round in the series has a result,
  // so no more points exist — the journey card stops talking
  // like a trip in progress (same derivation the rounds header
  // counts with: fanhoodGamesPlayed against the series length).
  const pickerAllPlayed =
    fanhoodGamesPlayed(fanhood) >= LORE_GAMES.length;
  const journeyTotal = fanhoodTotal(fanhood);
  const journeyStop = stopForTotal(journeyTotal);
  const journeyNext = nextStopForTotal(journeyTotal);
  const journeyStopIndex = TOTAL_STOPS.findIndex(
    (s) => s.title === journeyStop.title
  );
  const journeyLegPct = journeyNext
    ? Math.round(
        ((journeyTotal - journeyStop.min) /
          (TOTAL_STOPS[journeyStopIndex + 1].min - journeyStop.min)) *
          100
      )
    : 100;
  const pickerJourneyCard = (
    <div className="overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-[#0C1220] text-white shadow-[6px_6px_0_#039AD1]">
      <div className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p
              className={`${displayFont.className} text-[40px] leading-none text-white`}
            >
              {journeyTotal.toLocaleString('en-US')}
            </p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
              {pickerAllPlayed ? 'Final score' : 'Points so far'}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.14]">
          <div
            className="h-full rounded-full bg-[#FFD23F]"
            style={{ width: `${journeyLegPct}%` }}
          />
        </div>
        <div className="mt-3 border-t border-white/[0.14] pt-1.5">
          {TOTAL_STOPS.map((stop, i) => {
            const status =
              i < journeyStopIndex
                ? 'reached'
                : i === journeyStopIndex
                  ? 'here'
                  : i === journeyStopIndex + 1
                    ? 'next'
                    : 'future';
            return (
              <div
                key={stop.title}
                className="relative flex items-center gap-3 py-2"
              >
                {i < TOTAL_STOPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-[-12px] left-[10px] top-[34px] w-[2px] bg-white/10"
                  />
                )}
                <span
                  className={`z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-extrabold ${
                    status === 'reached'
                      ? 'border-[#0072CE] bg-[#0072CE] text-white'
                      : status === 'here'
                        ? 'border-[#FFD23F] bg-[#FFD23F] text-[#0C1220]'
                        : 'border-[#3D4A63] bg-[#0C1220] text-[#8b98ad]'
                  }`}
                  style={
                    status === 'here'
                      ? { boxShadow: '0 0 0 4px rgba(255,210,63,.25)' }
                      : undefined
                  }
                >
                  {status === 'reached'
                    ? '✓'
                    : status === 'here'
                      ? '●'
                      : i + 1}
                </span>
                <span
                  className={`text-base font-bold ${
                    status === 'reached'
                      ? 'text-slate-100'
                      : status === 'here'
                        ? 'text-white'
                        : 'text-[#9aa7ba]'
                  }`}
                >
                  {stop.title}
                </span>
                {/* No here/goal pills on the route rows
                    (owner, Nov 9, 2026): the gold marker
                    already says where you stand — the pills
                    restated it. */}
                {status === 'next' && journeyNext && !pickerAllPlayed && (
                  <span className="ml-auto shrink-0 text-[13px] font-bold text-[#FFD23F]">
                    {journeyNext.pointsTo.toLocaleString('en-US')} to go
                  </span>
                )}
                <span
                  className={`${status === 'next' && !pickerAllPlayed ? '' : 'ml-auto'} shrink-0 text-sm font-bold text-slate-400`}
                >
                  {i === 0 ? 'START' : stop.min.toLocaleString('en-US')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const pickerRoundsSection = (
    <div>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="leading-none">
          <span
            className={`${displayFont.className} inline-block -rotate-1 bg-[#FFE066] px-[13px] pb-[3px] pt-[5px] text-[19px] leading-none tracking-[0.03em] text-[#0C1220] shadow-[2px_2px_0_rgba(12,18,32,0.35)]`}
          >
            The Rounds
          </span>
        </h2>
        <span className="text-[13px] font-bold text-[#3D4A63]">
          {fanhoodGamesPlayed(fanhood)} of 5 played
        </span>
      </div>
      <div
        ref={deckRef}
        onScroll={handleDeckScroll}
        role="region"
        aria-label="The Rounds — swipe to browse the five rounds"
        className="lore-deck-scroll mt-3 flex snap-x snap-mandatory items-stretch gap-2.5 overflow-x-auto px-[8%] pb-2 pt-1 sm:px-[calc((100%_-_380px)/2)] lg:px-[calc((100%_-_420px)/2)]"
      >
        {LORE_GAMES.map((game, gameIndex) => {
          const result = fanhood?.games[game.id];
          const state = seriesRowState(fanhood, game.id);
          const tablesOpen = pickerOpenGameId === game.id;
          return (
            <div
              key={game.id}
              ref={(el) => {
                deckCardRefs.current[gameIndex] = el;
              }}
              className="flex min-h-[196px] flex-[0_0_84%] snap-center flex-col rounded-[18px] border-[3px] border-[#0C1220] bg-white p-[18px] shadow-[4px_4px_0_#0C1220] sm:flex-[0_0_380px] lg:flex-[0_0_420px]"
            >
              <div className="flex items-center justify-end gap-2">
                <span
                  className={`shrink-0 rounded-full border-2 border-[#0C1220] px-2.5 py-1 text-[11px] font-extrabold tracking-[0.05em] ${
                    state === 'played'
                      ? 'bg-green-600 text-white'
                      : state === 'up-next'
                        ? 'bg-[#0072CE] text-white'
                        : 'bg-white text-[#3D4A63]'
                  }`}
                >
                  {state === 'played'
                    ? 'ROUND COMPLETE'
                    : state === 'up-next'
                      ? pickerPlayedAny
                        ? 'UP NEXT'
                        : 'START HERE'
                      : 'LOCKED'}
                </span>
              </div>
              <h3
                className={`${displayFont.className} mt-2.5 text-[30px] leading-[1.12] ${
                  state === 'locked' ? 'text-[#5b6b84]' : 'text-[#0C1220]'
                }`}
              >
                Round {gameIndex + 1}
              </h3>
              {state === 'played' && result && (
                <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-[#3D4A63]">
                  {result.score.toLocaleString()} points
                </p>
              )}
              <div className="flex-1" />
              {state === 'played' && result && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPickerOpenGameId(tablesOpen ? null : game.id)
                    }
                    aria-expanded={tablesOpen}
                    className="mt-3 inline-block cursor-pointer self-start text-[15px] font-black text-[#0072CE] hover:underline"
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
                <>
                  {/* The round's stakes, one quiet line
                      (owner, Nov 9, 2026): what's possible,
                      and the score to beat once anyone has
                      posted one. */}
                  <div className="mt-3 space-y-0.5 text-[13px] font-bold leading-snug text-[#3D4A63]">
                    <p>{pointsPossible(game).toLocaleString()} points possible</p>
                    {roundHigh(game.id) !== null && (
                      <p>
                        High score{' '}
                        {roundHigh(game.id)!.toLocaleString()}
                      </p>
                    )}
                  </div>
                <button
                  onClick={() => openGate(game.id)}
                  className="mt-3 w-full cursor-pointer rounded-[14px] border-[3px] border-[#0C1220] bg-[#0072CE] px-5 py-3 text-[15px] font-black text-white shadow-[3px_3px_0_#0C1220] transition-all hover:bg-blue-700 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]"
                >
                  Play Round {gameIndex + 1}
                </button>
                </>
              )}
              {state === 'locked' && (
                <p className="text-[15px] font-bold text-[#3D4A63]">
                  Finish Round {gameIndex} to unlock.
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div
        aria-hidden
        className="mt-1 flex items-center justify-center gap-1.5"
      >
        {LORE_GAMES.map((game, i) => (
          <span
            key={game.id}
            className={`h-[7px] rounded-full transition-all ${
              i === deckIndex ? 'w-5 bg-[#0C1220]' : 'w-[7px] bg-[#0C1220]/25'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-center text-[12.5px] font-bold uppercase tracking-[0.03em] text-[#3D4A63]">
        {`Round ${deckIndex + 1} of 5 · Swipe to browse`}
      </p>
    </div>
  );

  // The board lives on the game page now (owner, Nov 9,
  // 2026): the full leaderboard renders inline under the
  // rounds, in the rounds' own section dress. The standalone
  // board view still exists behind the menu row and the
  // dashboard's finished-state button.
  const pickerLeaderboardSection = (
    <div>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="leading-none">
          <span
            className={`${displayFont.className} inline-block -rotate-1 bg-[#FFE066] px-[13px] pb-[3px] pt-[5px] text-[19px] leading-none tracking-[0.03em] text-[#0C1220] shadow-[2px_2px_0_rgba(12,18,32,0.35)]`}
          >
            Leaderboard
          </span>
        </h2>
      </div>
      <div className="mt-4">
        <FanhoodLeaderboard
          embedded
          onBack={() => setShowBoard(false)}
          providedEntries={boardEntries}
          providedLoadFailed={boardFailed}
        />
      </div>
    </div>
  );

  // Desktop layout pass (Nov 3, 2026): the slim header row caps
  // to the column of the surface beneath it — the play stage's
  // 900px while a run is on, the reading column's max-w-2xl
  // otherwise — so the standing chip aligns with the content
  // edge instead of the viewport edge. Full width on a phone
  // either way.
  const inPlayPhase =
    phase === 'preview' ||
    phase === 'playing' ||
    phase === 'leaving' ||
    phase === 'plunging' ||
    phase === 'reveal';

  return (
    /* Backdrop split by phase (game restyle, Nov 5): the reading
       surfaces — picker, gate, results, leaderboard, locked
       teaser — sit on the shell's poster backdrop (#DCEEF8 +
       dots, showing through this root's transparency), so the
       game reads as part of the site. ONLY the in-run phases
       keep the Nov 5 treatment: the bg-slate-100 backing below
       is deliberate because the GradientBackdrop is translucent
       (opacity-30) and composites over whatever sits behind it;
       change that composite and the descent world's colors
       shift. In-run, the slate backing + gradient render exactly
       as before. */
    <div
      className={`relative flex w-full flex-1 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 ${
        inPlayPhase ? 'bg-slate-100' : ''
      }`}
    >
      {inPlayPhase && <GradientBackdrop />}
      <div className="relative flex w-full flex-1 flex-col">
        {/* HEADER — one compact row (Mark, Oct 27: the old two-line
            title block ate ~200px above the stage and its subtitle
            duplicated the intro card's headline). The stage below
            is flex-1 with a measured height, so the reclaimed
            space goes straight to the descent. Mock v3: on the
            picker itself the row steps aside for the big display
            title inside the picker — every other phase (and the
            locked view and the board) keeps this row.
            Title treatment (Mark, Nov 3, 2026): the game name is
            now LARGE and CENTERED above the card. The established
            fanhood still rides on the right; from md up an
            invisible twin of the chip balances it on the left so
            the title is truly centered, and below md the title
            centers in the space the chip leaves — the chip
            always keeps its room and the title steps down a size
            rather than crowd it. */}
        {(showBoard || phase !== 'intro') && (
          (() => {
            const display = fanhoodDisplay(fanhood);
            // In the ready phase the chip moves into the gate
            // card's header band (Nov 3, 2026) — never both. In
            // the result phase the results standing block states
            // the stop and the total itself (Nov 3, 2026 de-dup),
            // so the chip steps aside there too. On the board
            // (Nov 6, 2026) the chip steps aside as well: the
            // leaderboard carries the standing as a labeled line
            // above the board instead of an unlabeled pill
            // duplicating the player's own row.
            const chipText =
              display && phase !== 'ready' && phase !== 'result' && !showBoard
                ? `${display.stop} · ${display.depth.toLocaleString()}`
                : null;
            return (
              <div className={`mx-auto flex w-full items-center gap-3 px-4 pt-3 pb-2 sm:px-6 ${inPlayPhase ? 'max-w-[900px]' : 'max-w-2xl'}`}>
                {chipText && (
                  <span
                    aria-hidden
                    className="invisible hidden shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black whitespace-nowrap text-white md:block"
                  >
                    {chipText}
                  </span>
                )}
                <h1
                  className={`${displayFont.className} min-w-0 flex-1 truncate text-center leading-none tracking-[0.01em] text-slate-950 ${
                    chipText
                      ? 'text-[23px] min-[420px]:text-[26px] sm:text-[31px]'
                      : 'text-[31px] sm:text-[34px]'
                  }`}
                >
                  Back to the Shack
                </h1>
                {chipText && (
                  <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black whitespace-nowrap text-white">
                    {chipText}
                  </span>
                )}
              </div>
            );
          })()
        )}

        {/* THE PICKER — not playing (mock v5, Oct 30,
            2026; rounds deck, mock v6, Oct 31; de-duplicated
            Nov 3, 2026): no banner — the headline is the header
            now, centered and two-tier. One fixed order for every
            player: headline, journey card, the Rounds deck, the
            leaderboard entry. */}
        {/* THE LEADERBOARD — its own view over the picker.
            (Restored Nov 9, 2026: the ungate edit's slice
            clipped this mount along with the locked view —
            the menu row set showBoard and nothing rendered.
            A harness pin now guards the mount.) */}
        {showBoard && (
          <FanhoodLeaderboard
            onBack={() => setShowBoard(false)}
            providedEntries={boardEntries}
            providedLoadFailed={boardFailed}
          />
        )}

        {!showBoard && phase === 'intro' && (
          <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-10 sm:px-6">
            <div className="relative mt-5 overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-[#039AD1] px-[18px] pb-5 pt-4 text-center shadow-[6px_6px_0_#0C1220] sm:mt-7">
              {/* Halftone dots — the share page's card texture
                  (white dots, 20px grid), as a CSS overlay. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div className="relative">
                <h1 aria-label="Can You Get Back to the Shack?">
                  <span
                    className={`${displayFont.className} inline-block -rotate-2 bg-[#FFE066] px-4 pb-[5px] pt-[7px] text-[15px] uppercase leading-none tracking-[0.18em] text-[#0C1220] shadow-[2px_2px_0_rgba(12,18,32,0.35)]`}
                  >
                    Can you get
                  </span>
                  <span
                    className={`${displayFont.className} mt-3.5 block whitespace-nowrap text-[min(8.6vw,42px)] uppercase leading-[1.04] text-white`}
                    style={{
                      WebkitTextStroke: '1.5px #0C1220',
                      textShadow: '4px 4px 0 #0C1220',
                    }}
                  >
                    Back to the Shack?
                  </span>
                </h1>
                <p
                  className="mt-3 text-[15px] font-bold leading-snug text-white"
                  style={{ textShadow: '1px 1px 0 rgba(12,18,32,0.4)' }}
                >
                  <span className="block">
                    Five rounds. Thirty-five questions.
                  </span>
                  <span className="block">
                    One trip through Weezer history.
                  </span>
                </p>
              </div>
            </div>
            {pickerJourneyCard}
            {pickerRoundsSection}
            {pickerLeaderboardSection}
          </div>
        )}

        {/* THE START GATE — Play opens this ready card, never the
            clock: a one-and-done game starts only when the player
            says go. Leaving it starts nothing and consumes nothing,
            and a played game can never reach it. */}
        {!showBoard && phase === 'ready' && gateGameId && (
          <div className="mx-auto w-full max-w-2xl px-4 pb-10 sm:px-6">
            {(() => {
              const game = loreGameById(gateGameId);
              const gameNumber =
                LORE_GAMES.findIndex((g) => g.id === game.id) + 1;
              return (
                <div className="overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-white shadow-[6px_6px_0_#0C1220]">
                  <div className="relative overflow-hidden bg-[#039AD1] p-5 text-center text-white">
                    {/* Halftone dots — the share page's card
                        texture, as on the picker panel. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundImage:
                          'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
                        backgroundSize: '20px 20px',
                      }}
                    />
                    <div className="relative">
                      <span
                        className={`${displayFont.className} inline-block rounded-full bg-[#0C1220] px-[13px] pb-[4px] pt-[6px] text-[12.5px] uppercase leading-none tracking-[0.2em] text-white`}
                      >
                        Round {gameNumber} of 5
                      </span>
                      <h2
                        className={`${displayFont.className} mt-2.5 text-[34px] leading-none text-white`}
                        style={{
                          WebkitTextStroke: '1.5px #0C1220',
                          textShadow: '4px 4px 0 #0C1220',
                        }}
                      >
                        Round {gameNumber}
                      </h2>
                      <p className="mt-2 text-sm font-bold leading-snug text-white">
                        Every point moves you closer to the Shack.
                      </p>
                      {/* The standing chip rides inside the gate's
                          header band, centered under the lead line
                          (Nov 3, 2026) — the slim header's chip steps
                          aside in the ready phase so the standing is
                          never stated twice on one screen. */}
                      {(() => {
                        const display = fanhoodDisplay(fanhood);
                        if (!display) return null;
                        return (
                          <span className="mt-3 inline-block rounded-full border-[2.5px] border-[#0C1220] bg-white px-3 py-[5px] text-[11px] font-black whitespace-nowrap text-[#0C1220] shadow-[2px_2px_0_#0C1220]">
                            {display.stop} ·{' '}
                            {display.depth.toLocaleString()}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="divide-y divide-[#0C1220]/10">
                      {GATE_RULES.map((rule) => (
                        <div
                          key={rule.text}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <p className="text-[15px] sm:text-base font-medium leading-relaxed text-[#3D4A63]">
                            {rule.text}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="flex gap-1.5" aria-hidden>
                        {LORE_GAMES.map((g) => {
                          const done = !!fanhood?.games[g.id];
                          const current = g.id === gateGameId;
                          return (
                            <span
                              key={g.id}
                              className={`h-[7px] flex-1 rounded-full border-2 border-[#0C1220] ${
                                current
                                  ? 'bg-[#0072CE]'
                                  : done
                                    ? 'bg-[#0C1220]'
                                    : 'bg-white'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={startGatedGame}
                      className="mt-4 w-full cursor-pointer rounded-[14px] border-[3px] border-[#0C1220] bg-[#0072CE] px-5 py-3.5 text-sm font-black text-white shadow-[4px_4px_0_#0C1220] transition-all hover:bg-blue-700 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]"
                    >
                      Start Round {gameNumber}
                    </button>
                    <button
                      onClick={leaveGate}
                      className="mt-2.5 w-full py-1 text-center text-xs font-extrabold text-[#3D4A63] hover:text-[#0C1220] cursor-pointer"
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
        {!showBoard && item && (phase === 'preview' || phase === 'playing' || phase === 'leaving' || phase === 'plunging' || phase === 'reveal') && (
          <div ref={stageRef} className="mx-auto flex w-full max-w-[900px] flex-1 flex-col">
            <DescentStage
              total={stageTotal}
              displayTotal={phase === 'plunging' ? tickingTotal : total}
              burstDelayMs={plungeMs}
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
        {!showBoard && phase === 'result' && (
          <>
          <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 sm:px-6">
            {/* THE RESULT — one card (owner, Nov 9, 2026): the
                round's points and the standing/distance read
                together in a single card, in the site's flat
                poster blue. The stop-hued gradient banner is
                gone — it didn't fit the site; the journey map
                below keeps the true band colors. The standing
                lives in the ink panel inside this card. */}
            <div className="relative overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-[#039AD1] p-6 text-white shadow-[6px_6px_0_#0C1220] space-y-3">
              {/* Poster halftone dots — the picker panel's
                  overlay, carried here so the two game cards
                  speak the same language. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <span
                className={`${displayFont.className} relative inline-block rounded-full bg-[#0C1220] px-3 py-[5px] text-[12px] uppercase leading-none tracking-[0.16em] text-white`}
              >
                {activeGameId
                  ? `ROUND ${LORE_GAMES.findIndex((g) => g.id === activeGameId) + 1} OF 5 — FINISHED`
                  : 'ROUND FINISHED'}
              </span>
              {/* De-dup (Nov 3, 2026): the headline is the
                  points alone — the eyebrow above already names
                  the round, and "Round 1: 4,040" read as one
                  continuous number. */}
              <h2
                className={`${displayFont.className} relative text-4xl sm:text-5xl leading-none text-white`}
                style={{
                  WebkitTextStroke: '1.5px #0C1220',
                  textShadow: '4px 4px 0 #0C1220',
                }}
              >
                {`${total.toLocaleString()} points.`}
              </h2>
              {alreadyRecorded ? (
                <p className="relative text-xs font-bold opacity-70">
                  This round was already on your card — a finished
                  round&apos;s score never changes, so this run added
                  nothing.
                </p>
              ) : (
                <p className="relative text-xs font-black">
                  Locked in — this score is on your card for good.
                </p>
              )}

            {/* THE STANDING — an ink panel inside the result
                card (one card, owner Nov 9, 2026). A round that
                carried the player into a new stop says "You made
                it…"; otherwise it restates where the standing
                sits. The distance sentence names its scale and
                the stop's total-scale threshold. */}
            <div className="relative rounded-[14px] bg-[#0C1220] p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE066]">
                Your standing
              </p>
              <p
                className={`${displayFont.className} text-xl leading-snug`}
              >
                {resultStandingLine}
              </p>
              {/* The total line renders only when it adds
                  information: after Round 1 the total EQUALS the
                  headline's score, so stating it again would just
                  repeat the banner (de-dup, Nov 3, 2026). */}
              {resultAfterTotal !== total && (
                <p className="text-xs font-bold text-white/60">
                  {resultAfterTotal.toLocaleString()} total points.
                </p>
              )}
              {resultAllPlayed ? (
                <p className="text-xs font-bold text-white/60">
                  All five rounds are in. That&rsquo;s the final score.
                </p>
              ) : (
                resultNext && (
                  <p className="text-xs font-bold text-white/60">
                    {`Next stop for your standing: ${resultNext.title} — ${resultNextThreshold?.toLocaleString()} total, ${resultNext.pointsTo.toLocaleString()} to go.`}
                  </p>
                )
              )}
            </div>
            </div>

            {/* THE CLAIM — moved up to the score (owner,
                Nov 9, 2026): a guest's save-your-score moment
                belongs with the score, not buried under the
                answer cards. Renders only for an unclaimed
                guest with a finished round; nothing for
                everyone else. */}
            <ShellClaimCard />

            {/* THE JOURNEY MAP — the whole descent zoomed out,
                the marker at the STANDING's position (the
                after-total, not this round's score), so the
                panel reads as progress toward the Shack. */}
            <DescentStage
              total={resultAfterTotal}
              burst={null}
              shake={false}
              animKey={0}
              reducedMotion={reducedMotion}
              viewH={480}
              focusTop={false}
              journeyMap
            />

            <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] p-5 shadow-[4px_4px_0_#0C1220] space-y-3">
              <h3
                className={`${displayFont.className} text-[19px] leading-tight text-[#0C1220]`}
              >
                Your best answers this round
              </h3>
              {rarest && (
                <p className="text-xs sm:text-sm font-bold text-[#3D4A63] leading-relaxed">
                  Your rarest pull: {rarest.headline}
                  {rarest.tier ? ` — ${rarest.tier}` : ''}, worth{' '}
                  {rarest.depthEarned.toLocaleString()}.
                </p>
              )}
              {deepest.length === 0 ? (
                <p className="text-xs sm:text-sm font-medium text-[#3D4A63] leading-relaxed">
                  Nothing landed this time — every answer is in the tables
                  below.
                </p>
              ) : (
                <div className="space-y-2">
                  {deepest.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-3 border-b border-[#0C1220]/10 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-black text-[#0C1220]">
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
                {/* The per-band plum borrow (resultTheme.dig)
                    retires here (game restyle, Nov 5): both exits
                    take the standard poster buttons, blue primary
                    + white secondary, like the rest of the site. */}
                <button
                  onClick={backToGames}
                  className="w-full sm:w-auto font-black text-xs sm:text-sm px-5 py-3 rounded-[14px] border-[3px] border-[#0C1220] bg-[#0072CE] text-white shadow-[4px_4px_0_#0C1220] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220] cursor-pointer"
                >
                  Back to the rounds
                </button>
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="w-full sm:w-auto bg-white border-[3px] border-[#0C1220] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220] shadow-[4px_4px_0_#0C1220] text-[#0C1220] font-black text-xs sm:text-sm px-5 py-3 rounded-[14px] transition-all cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] p-5 shadow-[4px_4px_0_#0C1220] space-y-3">
              <div>
                <h3
                  className={`${displayFont.className} text-[19px] leading-tight text-[#0C1220]`}
                >
                  Every answer
                </h3>
                <p className="text-xs sm:text-sm font-medium text-[#3D4A63] leading-relaxed">
                  Open a prompt to see every answer that would have landed, rarest first.
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
