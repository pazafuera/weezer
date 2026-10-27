'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import {
  DEPTH_BANDS,
  LORE_ANSWER_UNIVERSE,
  bandForTotal,
  buildRunV2,
  isLoreUnlocked,
  loreGateRemainingAlbums,
  openPromptExtremes,
  openSongDepth,
  openSongQualifies,
  readLoreBest,
  tierForDepth,
  visualRoundQuestion,
  writeLoreBest,
} from '../data/loreGame';
import type { LoreBest, RarityTier, RunItem } from '../data/loreGame';
import {
  matchLoreAnswer,
  matchTableAnswer,
  resolveSongAnswer,
} from '../lib/loreMatch';

const QUESTION_SECONDS = 25;

type Phase = 'intro' | 'playing' | 'reveal' | 'result';

interface AnswerRecord {
  outcome: 'correct' | 'miss' | 'duplicate' | 'trap';
  /** The answer as displayed on the reveal (canonical form). */
  headline: string;
  subline: string;
  /** A cheeky extra line carried by the specific answer played. */
  note?: string;
  /** Trap outcome: the plausible-but-invalid answer's correction. */
  trapNote?: string;
  tier?: RarityTier;
  depthEarned: number;
  /** The Krillion contrast (open prompts only). */
  commonText?: string;
  commonDepth?: number;
  deepestText?: string;
  deepestDepth?: number;
  /** Visual rounds: the moment itself, shown on the reveal. */
  mediaUrl?: string;
  mediaAlt?: string;
  loreLine: string;
  questionPrompt: string;
}

/* ------------------------------------------------------------------ */
/* The descent stage                                                   */
/* ------------------------------------------------------------------ */

/**
 * Per-band layer styling, parallel to DEPTH_BANDS: the surface is
 * bright pop; the '90s layer is warm and xeroxed; the fan-club layer
 * is photocopy gray with halftone dots; the bottom is dense, dark
 * bedrock. CSS gradients only — no image assets.
 */
const BAND_STAGE: {
  layer: string;
  texture?: React.CSSProperties;
  chip: string;
  range: string;
}[] = [
  {
    // Buddy Holly — the bright pop surface.
    layer: 'bg-gradient-to-b from-sky-400 via-sky-500 to-[#0072CE] text-white',
    chip: 'bg-white/20 text-white border-white/50',
    range: 'text-sky-100',
  },
  {
    // Sweater Song — warm '90s xerox paper.
    layer: 'bg-[#f3e5c3] text-amber-950',
    texture: {
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(120,72,20,0.07) 0 2px, transparent 2px 7px)',
    },
    chip: 'bg-amber-900/10 text-amber-900 border-amber-900/30',
    range: 'text-amber-800/70',
  },
  {
    // Pinkerton — indigo night with a rose thread.
    layer: 'bg-indigo-950 text-indigo-50',
    texture: {
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(244,114,182,0.06) 0 10px, transparent 10px 20px)',
    },
    chip: 'bg-pink-400/15 text-pink-200 border-pink-300/40',
    range: 'text-indigo-300',
  },
  {
    // Fan Club — photocopied newsletter gray, halftone dots.
    layer: 'bg-[#e9e6de] text-slate-800',
    texture: {
      backgroundImage:
        'radial-gradient(rgba(30,30,30,0.16) 1px, transparent 1.4px)',
      backgroundSize: '9px 9px',
    },
    chip: 'bg-black/10 text-slate-800 border-black/25',
    range: 'text-slate-500',
  },
  {
    // Karl — charcoal, dense with print texture.
    layer: 'bg-slate-900 text-slate-100',
    texture: {
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 5px), radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)',
      backgroundSize: 'auto, 7px 7px',
    },
    chip: 'bg-white/10 text-slate-100 border-white/30',
    range: 'text-slate-400',
  },
  {
    // GOAT PUNISHMENT — near-black bedrock, amber seams.
    layer: 'bg-[#0b0a08] text-amber-50',
    texture: {
      backgroundImage:
        'repeating-linear-gradient(45deg, rgba(245,158,11,0.07) 0 6px, transparent 6px 12px), radial-gradient(rgba(245,158,11,0.13) 1px, transparent 1.4px)',
      backgroundSize: 'auto, 6px 6px',
    },
    chip: 'bg-amber-400/15 text-amber-300 border-amber-400/50',
    range: 'text-amber-200/60',
  },
];

/**
 * The fanhood cross-section as the stage: six full-width layers
 * stacked top (the hits) to bottom (the bedrock). The layer the
 * running total sits in expands to hold the player marker and
 * whatever card is passed in; after each answer the content plunges
 * — the wrapper re-mounts with a sink animation, and its travel
 * reads bigger the deeper the band it lands in.
 */
function DescentStage({
  total,
  plungeKey,
  children,
}: {
  total: number;
  plungeKey: string | number;
  children?: React.ReactNode;
}) {
  const current = bandForTotal(total);
  return (
    <div className="rounded-3xl overflow-hidden border border-slate-900/25 shadow-md">
      <style>{`
        @keyframes lore-plunge {
          0% { transform: translateY(-16px); opacity: 0.25; }
          60% { transform: translateY(3px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .lore-plunge { animation: lore-plunge 0.75s cubic-bezier(0.22, 0.9, 0.3, 1) both; }
      `}</style>
      {DEPTH_BANDS.map((band, i) => {
        const style = BAND_STAGE[i];
        const isCurrent = band.title === current.title;
        const range =
          band.max === Infinity
            ? `${band.min.toLocaleString()}+ deep`
            : `${band.min.toLocaleString()}–${band.max.toLocaleString()} deep`;
        return (
          <div
            key={band.title}
            className={`${style.layer} px-4 ${isCurrent ? 'py-3.5' : 'py-2'}`}
            style={style.texture}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider">
                {band.title} level
              </span>
              <span className={`text-[10px] font-bold ${style.range}`}>
                {range}
              </span>
            </div>
            {isCurrent && (
              <div key={plungeKey} className="lore-plunge mt-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${style.chip}`}
                >
                  ▼ You — {total.toLocaleString()} deep · {band.title} level
                </span>
                {children}
              </div>
            )}
          </div>
        );
      })}
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
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [usedSongIds, setUsedSongIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const [best, setBest] = useState<LoreBest | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const total = answers.reduce((sum, a) => sum + a.depthEarned, 0);
  const item = run[index];
  const stageRef = useRef<HTMLDivElement>(null);

  // The saved best, read on mount (localStorage is browser-only).
  useEffect(() => {
    setBest(readLoreBest());
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

  const submitRef = useRef<(given: string, timedOut: boolean) => void>(
    () => {}
  );

  const submitAnswer = (given: string, timedOut: boolean) => {
    if (!item || phase !== 'playing') return;
    let record: AnswerRecord;

    if (item.kind === 'visual') {
      const q = visualRoundQuestion(item.round);
      const spec = q.spec;
      if (!spec) return;
      const result = matchLoreAnswer(given, spec, LORE_ANSWER_UNIVERSE);
      const depth = q.depth ?? 0;
      record =
        result.status === 'match'
          ? {
              outcome: 'correct',
              headline: spec.answer,
              subline: '',
              tier: tierForDepth(depth),
              depthEarned: depth,
              mediaUrl: item.round.mediaUrl,
              mediaAlt: item.round.mediaAlt,
              loreLine: q.loreLine,
              questionPrompt: q.prompt,
            }
          : {
              outcome: 'miss',
              headline: spec.answer,
              subline: timedOut ? 'Time ran out.' : '',
              depthEarned: 0,
              mediaUrl: item.round.mediaUrl,
              mediaAlt: item.round.mediaAlt,
              loreLine: q.loreLine,
              questionPrompt: q.prompt,
            };
    } else if (item.prompt.kind === 'table' && item.prompt.answers) {
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
        record = {
          outcome: 'correct',
          headline: played.text,
          subline: '',
          note: played.note,
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
          record = {
            outcome: 'correct',
            headline: resolved.song.title,
            subline: resolved.song.album,
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

    setAnswers((prev) => [...prev, record]);
    setPhase('reveal');
  };
  submitRef.current = submitAnswer;

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
        submitRef.current('', true);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [phase, index]);

  // Landing on the result: persist the best run.
  useEffect(() => {
    if (phase !== 'result') return;
    const current = bandForTotal(total);
    const previous = readLoreBest();
    if (!previous || total > previous.depth) {
      const nextBest = { depth: total, band: current.title };
      writeLoreBest(nextBest);
      setBest(nextBest);
      setIsNewBest(previous !== null && total > previous.depth);
    } else {
      setBest(previous);
      setIsNewBest(false);
    }
    // total is final when the result phase opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startRun = () => {
    setRun(buildRunV2());
    setIndex(0);
    setInput('');
    setAnswers([]);
    setUsedSongIds(new Set());
    setPhase('playing');
  };

  const next = () => {
    if (index + 1 >= run.length) {
      setPhase('result');
    } else {
      setIndex(index + 1);
      setInput('');
      setPhase('playing');
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

  const itemPrompt =
    item?.kind === 'open'
      ? item.prompt.prompt
      : item?.kind === 'visual'
        ? visualRoundQuestion(item.round).prompt
        : '';

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
      <div className="space-y-1 text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
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

  /** The question + answer card, rendered inside the current layer. */
  const stageCard = item && (phase === 'playing' || phase === 'reveal') && (
    <div className="bg-white text-slate-900 border border-slate-200/90 rounded-3xl p-5 shadow-md space-y-4 mt-3 text-left">
      <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug">
        {itemPrompt}
      </h2>

      {phase === 'playing' && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Time left
              </span>
              <span
                className={`text-xs font-black ${
                  secondsLeft <= 6 ? 'text-amber-500' : 'text-slate-500'
                }`}
              >
                {secondsLeft}s
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  secondsLeft <= 6 ? 'bg-amber-400' : 'bg-[#0072CE]'
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
              submitAnswer(input, false);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 text-base font-bold text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 outline-none focus:border-[#0072CE] placeholder:text-slate-400 placeholder:font-medium"
            />
            <button
              type="submit"
              className="bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-sm px-6 py-3.5 rounded-2xl transition-all shadow-md cursor-pointer"
            >
              Dig
            </button>
          </form>
        </>
      )}

      {phase === 'reveal' && lastRecord && (
        <div className="space-y-3">
          {lastRecord.outcome === 'correct' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
              <p className="text-lg font-black text-emerald-900">
                ✓ {lastRecord.headline} — +
                <CountUp value={lastRecord.depthEarned} />
                {lastRecord.tier ? ` · ${lastRecord.tier}!` : ''}
              </p>
              {lastRecord.note && (
                <p className="text-xs font-bold text-emerald-700">
                  {lastRecord.note}
                </p>
              )}
              {lastRecord.subline && (
                <p className="text-xs font-bold text-emerald-700">
                  {lastRecord.subline}
                </p>
              )}
            </div>
          )}
          {lastRecord.outcome === 'trap' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
              <p className="text-lg font-black text-amber-900">
                {lastRecord.headline} — so close, and yet
              </p>
              <p className="text-xs sm:text-sm font-bold text-amber-800 leading-relaxed">
                {lastRecord.trapNote}
              </p>
            </div>
          )}
          {lastRecord.outcome === 'duplicate' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
              <p className="text-lg font-black text-amber-900">
                {lastRecord.headline} — already played
              </p>
              <p className="text-xs font-bold text-amber-700">
                {lastRecord.subline}
              </p>
            </div>
          )}
          {lastRecord.outcome === 'miss' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <p className="text-lg font-black text-slate-900">
                {lastRecord.headline
                  ? `It was ${lastRecord.headline}.`
                  : 'Nothing dug there.'}
              </p>
              {lastRecord.subline && (
                <p className="text-xs font-bold text-slate-500">
                  {lastRecord.subline}
                </p>
              )}
            </div>
          )}

          {lastRecord.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lastRecord.mediaUrl}
              alt={lastRecord.mediaAlt ?? ''}
              loading="lazy"
              className="w-full rounded-2xl border border-slate-200 shadow-sm"
            />
          )}

          {contrastBlock(lastRecord)}

          <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
            {lastRecord.loreLine}
          </p>
          <button
            onClick={next}
            autoFocus
            className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
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
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* HEADER */}
        <div className="pt-1 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Weezer Lore
          </h1>
          <p className="text-sm font-medium text-slate-500">
            How deep is your fanhood?
          </p>
        </div>

        {/* LOCKED — the teaser. Progress toward the gate is named
            by album, never by count: the dashboard's Catalog
            Completion strip already carries those numbers. */}
        {!unlocked && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-950 tracking-tight">
                The lore game is locked
              </h2>
              <span className="text-sm">🔒</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
              Ten prompts, twenty-five seconds each. Any right answer digs —
              but the rarer your answer, the deeper it digs.
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
        )}

        {/* INTRO — unlocked, not yet playing */}
        {unlocked && phase === 'intro' && (
          <>
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
              <h2 className="text-lg font-black text-slate-950 tracking-tight">
                Ten prompts. The rarer the answer, the deeper you dig.
              </h2>
              <div className="space-y-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                <p>Ten prompts, twenty-five seconds each. No way to lose — a miss just digs nothing.</p>
                <p>Every prompt takes more than one right answer. Rivers Cuomo is worth a little. Jason Cropper is worth a fortune.</p>
                <p>Type your answers. Spelling doesn&apos;t have to be perfect.</p>
              </div>
              {best && (
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  Your deepest run so far: {best.depth.toLocaleString()} —{' '}
                  {best.band} level.
                </p>
              )}
              <button
                onClick={startRun}
                className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
              >
                Start digging
              </button>
            </div>
            <DescentStage total={0} plungeKey="intro" />
          </>
        )}

        {/* PLAYING / REVEAL — the descent is the stage */}
        {unlocked && item && (phase === 'playing' || phase === 'reveal') && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Prompt {index + 1} of {run.length}
              </span>
              <span className="text-xs font-black text-slate-500">
                {answers.filter((a) => a.outcome === 'correct').length} dug so
                far
              </span>
            </div>

            <div ref={stageRef}>
              <DescentStage total={total} plungeKey={answers.length}>
                {stageCard}
              </DescentStage>
            </div>
          </>
        )}

        {/* RESULT */}
        {unlocked && phase === 'result' && (
          <>
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                You dug to {total.toLocaleString()}
              </p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                {finalBand.title} level
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                {finalBand.line}
              </p>
              {isNewBest && (
                <p className="text-xs font-black text-amber-400">
                  Your deepest run yet. 🏆
                </p>
              )}
              {!isNewBest && best && best.depth > total && (
                <p className="text-xs font-bold text-slate-400">
                  Your best stands at {best.depth.toLocaleString()} —{' '}
                  {best.band} level.
                </p>
              )}
            </div>

            <DescentStage total={total} plungeKey="result" />

            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-base font-black text-slate-950 tracking-tight">
                Your deepest digs
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
                  Nothing dug this run — the hits are waiting to be named
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
                  className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
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
          </>
        )}
      </div>
    </div>
  );
}
