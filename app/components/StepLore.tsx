'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import {
  DEPTH_BANDS,
  TIER_TAGLINES,
  answerCoverFor,
  bandForTotal,
  buildRunV2,
  isLoreUnlocked,
  loreGateRemainingAlbums,
  openPromptAnswerTable,
  openPromptExtremes,
  openSongDepth,
  openSongQualifies,
  tierForDepth,
  titleForDepth,
} from '../data/loreGame';
import type { RarityTier, RunItem } from '../data/loreGame';
import {
  matchTableAnswer,
  resolveSongAnswer,
} from '../lib/loreMatch';
import { readFanhood, settleFanhoodRun } from '../lib/fanhood';
import type { FanhoodDeepest, FanhoodRecord } from '../lib/fanhood';

const QUESTION_SECONDS = 25;
const PREVIEW_SECONDS = 3;

type Phase =
  | 'intro'
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
}[] = [
  {
    // Buddy Holly — bright radio-blue.
    layer: 'bg-gradient-to-b from-[#039AD1] to-[#0277b6] text-[#eaf7ff]',
    chip: 'bg-white text-[#0277b6]',
    range: 'text-white/70',
    texture: "UNDONE · BUDDY HOLLY · SAY IT AIN'T SO · UNDONE ·",
  },
  {
    // Sweater Song — flannel tan.
    layer: 'bg-gradient-to-b from-[#f3e9d2] to-[#e7d7ae] text-[#4a3a17]',
    chip: 'bg-[#4a3a17] text-[#f3e9d2]',
    range: 'text-[#4a3a17]/60',
    texture: "FLANNEL · '94 · MTV · THE RENTALS ·",
  },
  {
    // Pinkerton — dark maroon.
    layer: 'bg-gradient-to-b from-[#5b2333] to-[#401826] text-[#f6d9de]',
    chip: 'bg-[#f6d9de] text-[#5b2333]',
    range: 'text-[#f6d9de]/60',
    texture: 'EL SCORCHO · ACROSS THE SEA ·',
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
   band the marker interpolates across that layer's height (inset
   10%–90% so it never hugs a boundary); the bedrock band, whose
   depth range is open-ended, interpolates up to a soft cap. */
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
 * An exponential approach to the ceiling keeps cheap answers brisk
 * while giving the deepest pulls room to register: about 736ms at
 * +20, 1,314ms at +200, 1,955ms at +550, and 2,367ms at +1,200.
 */
export function plungeDurationForDepth(depth: number): number {
  if (depth <= 0) return 550;
  return Math.round(650 + 1850 * (1 - Math.exp(-depth / 450)));
}

function depthToY(depth: number): number {
  for (let i = 0; i < DEPTH_BANDS.length; i++) {
    const band = DEPTH_BANDS[i];
    const isLast = i === DEPTH_BANDS.length - 1;
    if (depth <= band.max || isLast) {
      const span = isLast ? BEDROCK_DEPTH_CAP - band.min : band.max - band.min;
      const t = Math.min(1, Math.max(0, (depth - band.min) / span));
      return LAYER_TOPS[i] + LAYER_HEIGHTS[i] * (0.1 + 0.8 * t);
    }
  }
  return STAGE_HEIGHT;
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
              <div className="absolute inset-x-3.5 top-2.5 flex items-start justify-between gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[9.5px] font-black tracking-[0.14em] ${style.chip}`}
                >
                  {band.title}
                </span>
                <span
                  className={`text-[9.5px] font-extrabold tracking-[0.08em] ${style.range}`}
                >
                  {range}
                </span>
              </div>
              <div className="pointer-events-none absolute left-2 top-16 whitespace-nowrap text-sm font-black tracking-[0.06em] opacity-[0.12]">
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
          className="absolute left-[35px] top-0 z-10 w-0 border-l-[3px] border-dashed border-white/50"
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
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[3px] border-[#111111] bg-[#FFD23F] text-xs font-black text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
                =w=
              </div>
              <div className="whitespace-nowrap rounded-full bg-[#111111] px-2.5 py-1 text-[10.5px] font-black tracking-[0.05em] text-[#FFD23F] shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
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
            className="absolute left-[76px] z-20"
            style={{
              top: markerY,
              transition: reducedMotion
                ? 'none'
                : `top ${moveMs}ms cubic-bezier(0.22, 0.9, 0.3, 1)`,
            }}
          >
            <div style={{ transform: 'translateY(-260%)' }}>
              <div className="whitespace-nowrap rounded-full bg-[#111111]/90 px-3 py-1.5 text-[11px] font-black tracking-wide text-white shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                “{fallingTag}” ▼
              </div>
            </div>
          </div>
        )}

        {/* The burst chip, riding the plunge */}
        {burst && (
          <div
            className="absolute left-[76px] z-20"
            style={{
              top: markerY,
              transition: reducedMotion
                ? 'none'
                : `top ${moveMs}ms cubic-bezier(0.22, 0.9, 0.3, 1)`,
            }}
          >
            <div style={{ transform: 'translateY(-135%)' }}>
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

export default function StepLore() {
  const { triageMap, navigateTo } = useWeezer();
  const unlocked = isLoreUnlocked(triageMap);
  const remainingAlbums = loreGateRemainingAlbums(triageMap);

  const [phase, setPhase] = useState<Phase>('intro');
  const [run, setRun] = useState<RunItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [previewLeft, setPreviewLeft] = useState(PREVIEW_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [usedSongIds, setUsedSongIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const [fanhood, setFanhood] = useState<FanhoodRecord | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
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
  const [openDigPromptId, setOpenDigPromptId] = useState<string | null>(null);

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

    if (item.prompt.kind === 'table' && item.prompt.answers) {
      const prompt = item.prompt;
      const tableAnswers = item.prompt.answers;
      const extremes = openPromptExtremes(prompt);
      const entries = tableAnswers.map((a) => ({
        spec: { answer: a.text, aliases: a.aliases },
        trap: a.trapNote !== undefined,
      }));
      const result = matchTableAnswer(given, entries);
      const contrast = {
        commonText: extremes.common.text,
        commonDepth: extremes.common.depth,
        deepestText: extremes.deepest.text,
        deepestDepth: extremes.deepest.depth,
      };
      if (result.status === 'match') {
        const played = tableAnswers[result.index];
        const cover = answerCoverFor(prompt, played.text);
        record = {
          outcome: 'correct',
          headline: played.text,
          subline: '',
          note: played.note,
          coverSrc: cover?.src,
          coverAlbum: cover?.album,
          tier: tierForDepth(played.depth),
          depthEarned: played.depth,
          ...contrast,
          loreLine: prompt.loreLine,
          questionPrompt: prompt.prompt,
        };
      } else if (result.status === 'trap') {
        const played = tableAnswers[result.index];
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
        record = {
          outcome: 'miss',
          headline: '',
          subline: timedOut ? 'Time ran out.' : '',
          depthEarned: 0,
          ...contrast,
          loreLine: prompt.loreLine,
          questionPrompt: prompt.prompt,
        };
      }
    } else {
      const prompt = item.prompt;
      const extremes = openPromptExtremes(prompt);
      const contrast = {
        commonText: extremes.common.text,
        commonDepth: extremes.common.depth,
        deepestText: extremes.deepest.text,
        deepestDepth: extremes.deepest.depth,
      };
      const resolved = resolveSongAnswer(given, FULL_SONG_POOL, usedSongIds);
      if (resolved.status === 'duplicate' && resolved.song) {
        record = {
          outcome: 'duplicate',
          headline: resolved.song.title,
          subline: 'You already played that one this run — no depth for repeats.',
          depthEarned: 0,
          ...contrast,
          loreLine: prompt.loreLine,
          questionPrompt: prompt.prompt,
        };
      } else if (resolved.status === 'match' && resolved.song) {
        const trapNote = prompt.songTraps?.[resolved.song.id];
        if (trapNote) {
          record = {
            outcome: 'trap',
            headline: resolved.song.title,
            subline: '',
            trapNote,
            depthEarned: 0,
            ...contrast,
            loreLine: prompt.loreLine,
            questionPrompt: prompt.prompt,
          };
        } else if (openSongQualifies(prompt, resolved.song)) {
          const nextUsed = new Set(usedSongIds);
          nextUsed.add(resolved.song.id);
          setUsedSongIds(nextUsed);
          const depth = openSongDepth(prompt, resolved.song);
          const cover = answerCoverFor(
            prompt,
            resolved.song.title,
            resolved.song
          );
          record = {
            outcome: 'correct',
            headline: resolved.song.title,
            subline: resolved.song.album,
            coverSrc: cover?.src,
            coverAlbum: cover?.album,
            tier: tierForDepth(depth),
            depthEarned: depth,
            ...contrast,
            loreLine: prompt.loreLine,
            questionPrompt: prompt.prompt,
          };
        } else {
          record = {
            outcome: 'miss',
            headline: '',
            subline: `${resolved.song.title} is a real one, but it doesn't fit this prompt.`,
            depthEarned: 0,
            ...contrast,
            loreLine: prompt.loreLine,
            questionPrompt: prompt.prompt,
          };
        }
      } else {
        record = {
          outcome: 'miss',
          headline: '',
          subline: timedOut ? 'Time ran out.' : '',
          depthEarned: 0,
          ...contrast,
          loreLine: prompt.loreLine,
          questionPrompt: prompt.prompt,
        };
      }
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

  // Landing on the result: settle the run against the established
  // fanhood. A deeper run replaces the record — including this
  // run's deepest single answer, the brag the Thread and the
  // Shareables card quote; a shallower run leaves it standing.
  useEffect(() => {
    if (phase !== 'result') return;
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
    const settled = settleFanhoodRun(total, runDeepest);
    setFanhood(settled.record);
    setIsNewBest(settled.isNewBest);
    // total and answers are final when the result phase opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startRun = () => {
    setRun(buildRunV2());
    setIndex(0);
    setInput('');
    setAnswers([]);
    setUsedSongIds(new Set());
    setHint(null);
    setPendingRecord(null);
    setPlungeDepth(0);
    setPlungeMs(PLUNGE_MS);
    setTickingTotal(0);
    plungeFromRef.current = 0;
    plungeTargetRef.current = 0;
    setStageTotal(0);
    setOpenDigPromptId(null);
    attemptsRef.current = 0;
    setPhase('preview');
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
            reclaimed space goes straight to the descent. */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 pb-2">
          <h1 className="truncate text-sm sm:text-base font-black tracking-tight text-slate-950">
            How Rare a Weezer Fan Are You?
          </h1>
          {fanhood && (
            <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black whitespace-nowrap text-white">
              Best · {fanhood.bestDepth.toLocaleString()} ·{' '}
              {titleForDepth(fanhood.bestDepth)}
            </span>
          )}
        </div>

        {/* LOCKED — the teaser. Progress toward the gate is named
            by album, never by count: the dashboard's Catalog
            Completion strip already carries those numbers. */}
        {!unlocked && (
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 pb-8">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-950 tracking-tight">
                This game is locked
              </h2>
              <span className="text-sm">🔒</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
              Ten prompts, twenty-five seconds each. Any right answer drops
              you — but the rarer your answer, the deeper you sink.
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

        {/* INTRO — unlocked, not yet playing: the marker waits at
            the surface and the start card sits on the stage. */}
        {unlocked && phase === 'intro' && (
          <div className="flex flex-1 flex-col">
          <DescentStage
            total={0}
            burst={null}
            shake={false}
            animKey={0}
            reducedMotion={reducedMotion}
            viewH={480}
            focusTop={false}
            fill
          >
            <div
              className={`rounded-3xl border p-5 space-y-3 text-left ${CARD_THEMES[0].root}`}
            >
              <h2 className="text-lg font-black tracking-tight">
                Ten prompts. The rarer the answer, the deeper you sink.
              </h2>
              <div
                className={`space-y-1.5 text-xs sm:text-sm font-medium leading-relaxed ${CARD_THEMES[0].body}`}
              >
                <p>Ten prompts, twenty-five seconds each. A wrong guess just wiggles — keep guessing till you land one or the clock runs out.</p>
                <p>Every prompt takes more than one right answer. Rivers Cuomo is worth a little. Jason Cropper is worth a fortune.</p>
                <p>Type your answers. Spelling doesn&apos;t have to be perfect.</p>
              </div>
              {fanhood && (
                <p
                  className={`text-xs sm:text-sm font-bold ${CARD_THEMES[0].strong}`}
                >
                  Your fanhood so far: you&apos;re a{' '}
                  {titleForDepth(fanhood.bestDepth)} —{' '}
                  {fanhood.bestDepth.toLocaleString()} deep.
                </p>
              )}
              <button
                onClick={startRun}
                className={`w-full sm:w-auto font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer ${CARD_THEMES[0].dig}`}
              >
                Start descending
              </button>
            </div>
          </DescentStage>
          </div>
        )}

        {/* PLAYING / LEAVING / PLUNGING / REVEAL — the descent is
            the stage. During 'plunging' the card is gone entirely:
            nothing stands between the player and the drop. */}
        {unlocked && item && (phase === 'preview' || phase === 'playing' || phase === 'leaving' || phase === 'plunging' || phase === 'reveal') && (
          <div ref={stageRef} className="flex flex-1 flex-col">
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
        {unlocked && phase === 'result' && (
          <>
          <div className="w-full space-y-6 px-4 sm:px-6 pb-10">
            {/* THE VERDICT — the results lead with what the run
                says you ARE: Mark's fanhood ladder (titleForDepth),
                not the layer the marker landed in. The banner keeps
                the final layer's art and its warm line underneath. */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 shadow-md space-y-3 ${BAND_STAGE[finalBandIdx].layer}`}
              style={BAND_STAGE[finalBandIdx].textureStyle}
            >
              <p className="text-[11px] font-black uppercase tracking-wider opacity-70">
                You&apos;re a
              </p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
                {titleForDepth(total)}
              </h2>
              <p className="text-base sm:text-lg font-black">
                {total.toLocaleString()} deep
              </p>
              <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-80">
                {finalBand.line}
              </p>
              {isNewBest && (
                <p className="text-xs font-black">
                  Your deepest run yet — this is your fanhood now. 🏆
                </p>
              )}
              {!isNewBest && fanhood && fanhood.bestDepth > total && (
                <p className="text-xs font-bold opacity-70">
                  Your fanhood stands at{' '}
                  {titleForDepth(fanhood.bestDepth)} —{' '}
                  {fanhood.bestDepth.toLocaleString()} deep.
                </p>
              )}
            </div>

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
                  Nothing landed this run — the hits are waiting to be named
                  next time.
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
                  onClick={startRun}
                  className={`w-full sm:w-auto font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer ${finalTheme.dig}`}
                >
                  Play again
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
              <div className="divide-y divide-slate-100">
                {run.map((runItem, runIndex) => {
                  const record = answers[runIndex];
                  const table = openPromptAnswerTable(runItem.prompt);
                  const isOpen = openDigPromptId === runItem.prompt.id;
                  return (
                    <div key={runItem.prompt.id} className="py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDigPromptId(isOpen ? null : runItem.prompt.id)
                        }
                        aria-expanded={isOpen}
                        className="flex w-full items-start justify-between gap-3 text-left cursor-pointer"
                      >
                        <span>
                          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Question {runIndex + 1}
                          </span>
                          <span className="block text-sm font-black text-slate-900 leading-snug">
                            {runItem.prompt.prompt}
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-500">
                            {record?.outcome === 'correct'
                              ? `You landed ${record.headline} · +${record.depthEarned}`
                              : 'Nothing landed'}
                          </span>
                        </span>
                        <span className="shrink-0 text-lg font-black text-[#0072CE]" aria-hidden="true">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-4 rounded-2xl bg-slate-50 p-3.5">
                          {(['Super rare', 'Rare', 'Uncommon', 'Common'] as RarityTier[])
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
                                      record?.outcome === 'correct' &&
                                      record.headline === row.text;
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
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
