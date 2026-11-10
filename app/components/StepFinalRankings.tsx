'use client';

/**
 * StepFinalRankings — the read-only final rankings page
 * (owner, Nov 9, 2026).
 *
 * Links to a fan's final rankings used to land on Final
 * Review — the editing surface, drag handles and all. This
 * page is the opposite: just the list, in order, no sorting,
 * no dragging, with the two prompts that belong at the end
 * of the project — share your cards, and see your Sweater
 * Thread. Editing still lives in Final Review ('master');
 * a quiet link at the bottom opens it.
 *
 * Data: masterList is the bucketed songs in rank order
 * (unknowns are excluded from it by construction), so the
 * rows number 1..N straight down. Songs marked "Don't Know
 * It" were never ranked and sit in a muted tail list.
 */

import React, { useMemo } from 'react';
import {
  BUCKET_CONFIG,
  FULL_SONG_POOL,
  type BucketType,
  type Song,
} from '../data/constants';
import { getProgressState, type AppStep, type TriageValue } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';

interface StepFinalRankingsProps {
  masterList: Song[];
  triageMap: Record<string, TriageValue>;
  setStep: (step: AppStep) => void;
}

export default function StepFinalRankings({
  masterList,
  triageMap,
  setStep,
}: StepFinalRankingsProps) {
  // Progress is derived from the ranking data, the same
  // way AppShell derives it — the context does not carry
  // a progress object (a first version of this page read
  // one off the context and crashed on render).
  const progress = getProgressState(triageMap, masterList);
  const total = FULL_SONG_POOL.length;
  const complete = masterList.length >= total;
  const topSong = masterList[0] ?? null;

  const unknowns = useMemo(
    () => FULL_SONG_POOL.filter((s) => triageMap[s.id] === 'unknown'),
    [triageMap]
  );

  const headlineShadow =
    '2px 0 0 #0C1220, -2px 0 0 #0C1220, 0 2px 0 #0C1220, 0 -2px 0 #0C1220, 2px 2px 0 #0C1220, -2px -2px 0 #0C1220, 2px -2px 0 #0C1220, -2px 2px 0 #0C1220, 0 3px 0 #0C1220';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-12 sm:px-6">
      {/* The header — poster blue, the project's done (or
          nearly). No controls up here; it's a headline. */}
      <section className="relative overflow-hidden rounded-[22px] border-[3px] border-[#0C1220] bg-[#039AD1] px-5 pb-5 pt-6 shadow-[6px_6px_0_rgba(12,18,32,0.9)] sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/75">
            {complete ? 'The final list' : 'Your rankings so far'}
          </p>
          <h1
            className={`${displayFont.className} mt-2 text-[34px] leading-[1.02] text-white sm:text-[42px]`}
            style={{ textShadow: headlineShadow }}
          >
            {complete
              ? `All ${total}, ranked.`
              : `${masterList.length} of ${total} ranked.`}
          </h1>
          {complete && topSong ? (
            <p className="mt-2.5 text-sm font-bold leading-relaxed text-white/90">
              #1 is {topSong.title}. Every song, in your order.
            </p>
          ) : (
            <>
              <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-[#FFC72C]"
                  style={{
                    width: `${Math.round((masterList.length / total) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm font-bold text-white/90">
                Keep sorting to finish the list.
              </p>
            </>
          )}
        </div>
      </section>

      {/* The prompts. Finished: share + the Thread (the two
          things the owner asked this page to prompt). Not
          finished: back to the sort first. */}
      {masterList.length > 0 && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {complete ? (
            <>
              <button
                type="button"
                onClick={() => setStep('shareables')}
                className="flex-1 rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-5 py-3 text-sm font-black text-[#0C1220] shadow-[4px_4px_0_rgba(12,18,32,0.9)] transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                Share your cards
              </button>
              <button
                type="button"
                onClick={() => setStep('wrapped')}
                className="flex-1 rounded-full border-[3px] border-[#0C1220] bg-white px-5 py-3 text-sm font-black text-[#0C1220] shadow-[4px_4px_0_rgba(12,18,32,0.9)] transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                See your Sweater Thread
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('triage')}
                className="flex-1 rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-5 py-3 text-sm font-black text-[#0C1220] shadow-[4px_4px_0_rgba(12,18,32,0.9)] transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                Keep sorting
              </button>
              {progress.isWrappedUnlocked && (
                <button
                  type="button"
                  onClick={() => setStep('wrapped')}
                  className="flex-1 rounded-full border-[3px] border-[#0C1220] bg-white px-5 py-3 text-sm font-black text-[#0C1220] shadow-[4px_4px_0_rgba(12,18,32,0.9)] transition-transform hover:-translate-y-0.5 cursor-pointer"
                >
                  See your Sweater Thread
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* The list itself — read-only rows: rank, title,
          album, bucket pill. Nothing here moves. */}
      {masterList.length === 0 ? (
        <section className="rounded-[18px] border-[3px] border-[#0C1220] bg-white px-5 py-8 text-center shadow-[4px_4px_0_rgba(11,30,63,0.85)]">
          <p className="text-sm font-bold text-[#3D4A63]">
            Nothing ranked yet.
          </p>
          <button
            type="button"
            onClick={() => setStep('triage')}
            className="mt-4 rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-5 py-2.5 text-sm font-black text-[#0C1220] cursor-pointer"
          >
            Start sorting
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-white shadow-[4px_4px_0_rgba(11,30,63,0.85)]">
          <div className="divide-y divide-slate-200">
            {masterList.map((song, i) => {
              const bucket = triageMap[song.id] as BucketType | undefined;
              const cfg = bucket ? BUCKET_CONFIG[bucket] : null;
              return (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span
                    className={`flex h-6 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                      i < 3
                        ? 'bg-[#FFC72C] text-[#0C1220]'
                        : 'bg-[#E8EEF6] text-[#3D4A63]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-[#0C1220]">
                      {song.title}
                    </p>
                    <p className="text-[11px] font-bold leading-tight text-[#3D4A63]">
                      {song.album}
                    </p>
                  </div>
                  {cfg && (
                    <span
                      className={`flex w-fit shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black leading-none ${cfg.badgeBg} !border-[1.5px] !border-[#0C1220]`}
                    >
                      <span className="text-[10px]">{cfg.emoji}</span>
                      <span>{cfg.label}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Songs the fan said they don't know — never ranked,
          listed plainly so the count honestly adds up. */}
      {unknowns.length > 0 && (
        <section className="rounded-[18px] border-2 border-dashed border-[#3D4A63]/40 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#3D4A63]">
            Not ranked — you don&rsquo;t know these ({unknowns.length})
          </p>
          <p className="mt-1.5 text-xs font-bold leading-relaxed text-[#3D4A63]">
            {unknowns.map((s) => s.title).join(' · ')}
          </p>
        </section>
      )}

      {/* The one door back to the editor, kept quiet —
          this page is for looking, not fixing. */}
      {progress.isMasterUnlocked && masterList.length > 0 && (
        <p className="pt-1 text-center">
          <button
            type="button"
            onClick={() => setStep('master')}
            className="text-xs font-black text-[#0072CE] hover:underline cursor-pointer"
          >
            Need to change something? Open Final Review →
          </button>
        </p>
      )}
    </div>
  );
}
