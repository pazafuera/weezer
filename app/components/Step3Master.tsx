'use client';
import React from 'react';
import { BucketType, Song, BUCKET_CONFIG } from '../data/constants';
import { AudioPreviewButton, FlyingWIcon, SortingIncompleteNotice } from './SharedUI';
import { getRankedSongs } from '@/utils/rankingUtils';
import type { TriageValue } from '../context/WeezerContext';

export default function Step3Master({
  masterList,
  triageMap,
  moveMasterSong,
  setSongBucket,
  setStep,
  onBack,
  onKeepSorting
}: {
  masterList: Song[];
  triageMap: Record<string, TriageValue>;
  moveMasterSong: (idx: number, dir: 'up'|'down') => void;
  setSongBucket: (id: string, bucket: TriageValue) => void;
  setStep: (s: 'wrapped') => void;
  onBack: () => void;
  onKeepSorting: () => void;
}) {
  const triggerHaptic = (duration = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) try { navigator.vibrate(duration); } catch (e) {}
  };

  // Final Review only lists explicitly ranked songs. A song missing from the
  // triage map is unranked — never infer a bucket (especially Trash) for it.
  const rankedSongs = getRankedSongs(masterList, triageMap);

  // Find the index of the very last rankable song (so we can disable the down arrow on it)
  const lastRankableIndex = rankedSongs.map(s => triageMap[s.id]).findLastIndex(b => b === 'banger' || b === 'slaps');

  // Displayed rank numbers count ONLY the rankable songs (Banger/Slaps —
  // the songs that actually carry a master-list rank), in order. Using
  // the row index instead leaked inflated numbers deep into the list
  // whenever unrankable songs sat above a rankable one (e.g. after a
  // song was promoted to Banger from a lower section in triage).
  const rankNumberById = new Map<string, number>();
  rankedSongs.forEach((s) => {
    const b = triageMap[s.id];
    if (b === 'banger' || b === 'slaps') {
      rankNumberById.set(s.id, rankNumberById.size + 1);
    }
  });

  return (
    <div className="space-y-6 pb-24">

      {/* SORTING-INCOMPLETE NOTICE — in-flow above the header when
          triage isn't finished (renders nothing at 206). In-flow
          on purpose: the list derivation above and the fixed
          floating action bar below are both untouched by it. */}
      <SortingIncompleteNotice triageMap={triageMap} onKeepSorting={onKeepSorting} />

      {/* SHARP, SUCCINCT HEADER — no step pill, no top-left back
          link (owner, Oct 18): Back now lives in the floating bar
          at the bottom, next to the Wrapped button. */}
      <div className="text-center space-y-2 px-4 mb-8 pt-2">
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">
          Final Review
        </h1>
        <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-tight">
          Make any final tweaks to your top rankings. If a song is in the wrong bucket, go back to fix it!
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-xs">
        {rankedSongs.length === 0 ? (
          /* Reachable in an edge state (a master list whose songs
             are all un-bucketed after a data heal): the list used
             to render as a blank white card with no explanation. */
          <div className="py-10 text-center space-y-3">
            <p className="text-base font-black text-slate-950">
              Nothing to review yet
            </p>
            <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-snug">
              Songs you put in real buckets during sorting and
              Refine show up here for their final check.
            </p>
            <button
              onClick={() => { triggerHaptic(15); onKeepSorting(); }}
              className="bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm px-6 py-3 rounded-full transition-colors cursor-pointer"
            >
              Keep sorting →
            </button>
          </div>
        ) : (
        <div className="space-y-1.5">
          {rankedSongs.map((song, idx) => {
            const bucket = triageMap[song.id];
            // rankedSongs only holds real buckets (getRankedSongs), so
            // 'unknown'/missing can't occur — narrow for the config lookup.
            if (bucket === undefined || bucket === 'unknown') return null;
            const isRankable = bucket === 'banger' || bucket === 'slaps';
            const cfg = BUCKET_CONFIG[bucket];

            // BOUNDARY MOVES (UAT P-12) — the arrows live only on
            // the rankable rows (Banger / Lowkey Slaps), and the
            // list is bucket-block ordered, so a rankable row's
            // neighbor in a DIFFERENT bucket is exactly the block
            // boundary: ↑ on the first Slaps song, ↓ on the last
            // Banger. Those presses used to swap the master list
            // across the boundary and then silently revert on the
            // next normalize, because the bucket never changed.
            // Now a boundary press changes the BUCKET through the
            // same write path triage uses (setSongBucket →
            // reconcileMasterList), so the established seating
            // rule applies — promotion seats at the END of the
            // block above, demotion at the START of the block
            // below — and Refine, which derives its lists from
            // the same triageMap + master list, agrees. Presses
            // inside a block keep the plain reorder. (The ↓ on
            // the last rankable row stays disabled, as before:
            // below Slaps sits Mid, which carries no rank and no
            // arrows — a one-way demotion out of the ranked
            // region is not this control's job.)
            const aboveBucket =
              idx > 0 ? triageMap[rankedSongs[idx - 1].id] : undefined;
            const belowBucket =
              idx < rankedSongs.length - 1
                ? triageMap[rankedSongs[idx + 1].id]
                : undefined;
            const handleMoveUp = () => {
              triggerHaptic(10);
              if (
                aboveBucket !== undefined &&
                aboveBucket !== 'unknown' &&
                aboveBucket !== bucket
              ) {
                setSongBucket(song.id, aboveBucket);
              } else {
                moveMasterSong(idx, 'up');
              }
            };
            const handleMoveDown = () => {
              triggerHaptic(10);
              if (
                belowBucket !== undefined &&
                belowBucket !== 'unknown' &&
                belowBucket !== bucket
              ) {
                setSongBucket(song.id, belowBucket);
              } else {
                moveMasterSong(idx, 'down');
              }
            };
            
            return (
              <div key={song.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between gap-3 hover:border-blue-300 transition-colors">
                
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* ONLY SHOW RANK NUMBERS FOR TOP TWO BUCKETS */}
                  {isRankable ? (
                    <span className="w-7 h-7 bg-[#0072CE] text-white font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 shadow-2xs">
                      #{rankNumberById.get(song.id)}
                    </span>
                  ) : (
                    <span className="w-7 h-7 bg-slate-200 text-slate-400 font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 shadow-2xs opacity-50">
                      -
                    </span>
                  )}
                  
                  <div className="min-w-0 text-left flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">{song.title}</h3>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${cfg.badgeBg} w-fit leading-none flex items-center gap-1`}>
                        <span className="text-[10px]">{cfg.emoji}</span> <span>{cfg.label}</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 block truncate">{song.album} ({song.year})</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                <AudioPreviewButton title={song.title} />
                  
                  {/* ONLY SHOW UP/DOWN ARROWS FOR TOP TWO BUCKETS */}
                  {isRankable && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={handleMoveUp}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-800 font-black text-sm flex items-center justify-center border border-slate-300 cursor-pointer shadow-2xs transition-colors"
                      >
                        ↑
                      </button>
                      <button
                        onClick={handleMoveDown}
                        disabled={idx >= lastRankableIndex}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-800 font-black text-sm flex items-center justify-center border border-slate-300 cursor-pointer shadow-2xs transition-colors"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* FLOATING ACTION BAR — the Wrapped CTA plus Back (owner,
          Oct 18: the top-left back link moved down here). Back runs
          the same onBack the top link used — page.tsx wires it to
          closeMaster, the origin-aware return. */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-2 max-w-[calc(100vw-1rem)]">
        <button
          onClick={() => { triggerHaptic(15); onBack(); }}
          className="bg-white hover:bg-slate-100 text-slate-700 font-black text-sm px-4 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition cursor-pointer border-2 border-slate-200 whitespace-nowrap shrink-0"
        >
          ← Back
        </button>
        <button
          onClick={() => { triggerHaptic(20); setStep('wrapped'); }}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-5 sm:px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap shrink-0"
        >
          <FlyingWIcon className="w-6 h-4 text-slate-950" />
          <span>Generate Weezer Wrapped →</span>
        </button>
      </div>

    </div>
  );
}
