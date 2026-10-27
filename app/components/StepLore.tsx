'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import {
  DEPTH_BANDS,
  LORE_ANSWER_UNIVERSE,
  LoreQuestion,
  bandForTotal,
  buildRun,
  exampleSongFor,
  isLoreUnlocked,
  loreGateRemainingAlbums,
  readLoreBest,
  songDepth,
  songQualifies,
  writeLoreBest,
} from '../data/loreGame';
import type { LoreBest } from '../data/loreGame';
import { matchLoreAnswer, resolveSongAnswer } from '../lib/loreMatch';

const QUESTION_SECONDS = 25;

type Phase = 'intro' | 'playing' | 'reveal' | 'result';

interface AnswerRecord {
  outcome: 'correct' | 'miss' | 'duplicate';
  /** The answer as displayed on the reveal (canonical form). */
  headline: string;
  /** Extra context: a near-miss note, or the example on a song miss. */
  subline: string;
  depthEarned: number;
  loreLine: string;
  questionPrompt: string;
}

/**
 * The fanhood strata, labeled on the visual itself (band name +
 * depth range on every row — no legend living elsewhere). The row
 * for the band the running total sits in carries the marker.
 */
function StrataMeter({ total }: { total: number }) {
  const current = bandForTotal(total);
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-xs space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Depth so far
        </span>
        <span className="text-sm font-black text-slate-950">
          {total.toLocaleString()}{' '}
          <span className="text-[#0072CE]">· {current.title} level</span>
        </span>
      </div>
      {DEPTH_BANDS.map((band) => {
        const isCurrent = band.title === current.title;
        const range =
          band.max === Infinity
            ? `${band.min.toLocaleString()}+`
            : `${band.min.toLocaleString()}–${band.max.toLocaleString()}`;
        return (
          <div
            key={band.title}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 border ${
              isCurrent
                ? 'bg-[#E0F2FE] border-[#0072CE]/40'
                : 'bg-slate-50 border-slate-100'
            }`}
          >
            <span
              className={`text-xs font-black ${
                isCurrent ? 'text-[#0072CE]' : 'text-slate-500'
              }`}
            >
              {band.title}
              {isCurrent && (
                <span className="ml-2 text-[10px] font-black uppercase tracking-wider">
                  ▼ you are here
                </span>
              )}
            </span>
            <span
              className={`text-[10px] font-bold ${
                isCurrent ? 'text-[#0072CE]' : 'text-slate-400'
              }`}
            >
              {range}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StepLore() {
  const { triageMap, navigateTo } = useWeezer();
  const unlocked = isLoreUnlocked(triageMap);
  const remainingAlbums = loreGateRemainingAlbums(triageMap);

  const [phase, setPhase] = useState<Phase>('intro');
  const [run, setRun] = useState<LoreQuestion[]>([]);
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
  const question = run[index];

  // The saved best, read on mount (localStorage is browser-only).
  useEffect(() => {
    setBest(readLoreBest());
  }, []);

  const submitRef = useRef<(given: string, timedOut: boolean) => void>(
    () => {}
  );

  const submitAnswer = (given: string, timedOut: boolean) => {
    if (!question || phase !== 'playing') return;
    let record: AnswerRecord;

    if (question.type === 'lore' && question.spec) {
      const result = matchLoreAnswer(given, question.spec, LORE_ANSWER_UNIVERSE);
      if (result.status === 'match') {
        record = {
          outcome: 'correct',
          headline: question.spec.answer,
          subline: '',
          depthEarned: question.depth ?? 0,
          loreLine: question.loreLine,
          questionPrompt: question.prompt,
        };
      } else {
        record = {
          outcome: 'miss',
          headline: question.spec.answer,
          subline: timedOut ? 'Time ran out.' : '',
          depthEarned: 0,
          loreLine: question.loreLine,
          questionPrompt: question.prompt,
        };
      }
    } else if (question.type === 'song' && question.constraint) {
      const example = exampleSongFor(question);
      const exampleLine = example
        ? `One that works: ${example.title} — ${songDepth(example)} deep.`
        : '';
      const resolved = resolveSongAnswer(given, FULL_SONG_POOL, usedSongIds);
      if (resolved.status === 'duplicate' && resolved.song) {
        record = {
          outcome: 'duplicate',
          headline: resolved.song.title,
          subline: 'You already played that one this run — no depth for repeats.',
          depthEarned: 0,
          loreLine: question.loreLine,
          questionPrompt: question.prompt,
        };
      } else if (resolved.status === 'match' && resolved.song) {
        if (songQualifies(question.constraint, resolved.song)) {
          const nextUsed = new Set(usedSongIds);
          nextUsed.add(resolved.song.id);
          setUsedSongIds(nextUsed);
          record = {
            outcome: 'correct',
            headline: resolved.song.title,
            subline: `${resolved.song.album} · ${songDepth(resolved.song)} deep`,
            depthEarned: songDepth(resolved.song),
            loreLine: question.loreLine,
            questionPrompt: question.prompt,
          };
        } else {
          record = {
            outcome: 'miss',
            headline: example ? example.title : '',
            subline: `${resolved.song.title} is a real one, but it doesn't fit this prompt. ${exampleLine}`,
            depthEarned: 0,
            loreLine: question.loreLine,
            questionPrompt: question.prompt,
          };
        }
      } else {
        record = {
          outcome: 'miss',
          headline: example ? example.title : '',
          subline: timedOut ? `Time ran out. ${exampleLine}` : exampleLine,
          depthEarned: 0,
          loreLine: question.loreLine,
          questionPrompt: question.prompt,
        };
      }
    } else {
      return;
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
      const next = { depth: total, band: current.title };
      writeLoreBest(next);
      setBest(next);
      setIsNewBest(previous !== null && total > previous.depth);
    } else {
      setBest(previous);
      setIsNewBest(false);
    }
    // total is final when the result phase opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startRun = () => {
    setRun(buildRun());
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
  const finalBand = bandForTotal(total);

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
              Ten questions, twenty-five seconds each. Hits count — but the
              more obscure your answers, the deeper into Weezer lore you dig.
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
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
            <h2 className="text-lg font-black text-slate-950 tracking-tight">
              Ten questions. How deep do you dig?
            </h2>
            <div className="space-y-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
              <p>Ten questions, twenty-five seconds each. No way to lose — a miss just digs nothing.</p>
              <p>Type your answers. Spelling doesn&apos;t have to be perfect.</p>
              <p>Hits count too — but obscure answers dig much, much deeper.</p>
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
        )}

        {/* PLAYING / REVEAL */}
        {unlocked && question && (phase === 'playing' || phase === 'reveal') && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Question {index + 1} of {run.length}
              </span>
              <span className="text-xs font-black text-slate-500">
                {answers.filter((a) => a.outcome === 'correct').length} dug so
                far
              </span>
            </div>

            <StrataMeter total={total} />

            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug">
                {question.prompt}
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
                        ✓ {lastRecord.headline} — +{lastRecord.depthEarned}
                      </p>
                      {lastRecord.subline && (
                        <p className="text-xs font-bold text-emerald-700">
                          {lastRecord.subline}
                        </p>
                      )}
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

            <StrataMeter total={total} />

            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-base font-black text-slate-950 tracking-tight">
                Your deepest digs
              </h3>
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
