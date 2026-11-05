'use client';
import React, { useState, useRef, useEffect } from 'react';
import { BucketType, Song, BUCKET_CONFIG } from '../data/constants';
import { AudioPreviewButton, FlyingWIcon, SortingIncompleteNotice } from './SharedUI';
import { getRankedSongs } from '@/utils/rankingUtils';
import type { TriageValue } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';

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

  // ── DRAG-TO-REORDER (owner, Nov 5) ─────────────────────────────
  // Replaces the ↑/↓ arrow buttons, ported from Refine's drag
  // (Step2Refine): the same ☰ handle, the same custom drag ghost,
  // the same touch mechanics (elementFromPoint over
  // [data-song-card] rows). One mechanical difference, forced by
  // this page's update path: Refine writes a whole reordered list
  // in a single update, but Final Review's only write paths are
  // the arrows' own functions — moveSong below, which is the
  // arrow handlers' logic verbatim:
  //
  // BOUNDARY MOVES (UAT P-12) — the rankable rows live in two
  // bucket blocks (Banger, then Lowkey Slaps), so a step whose
  // neighbor sits in a DIFFERENT bucket is exactly a block
  // boundary. A plain master-list swap there used to silently
  // revert on the next normalize, because the bucket never
  // changed. So a boundary step changes the BUCKET through the
  // same write path triage uses (setSongBucket →
  // reconcileMasterList), and the established seating rule
  // applies — promotion seats at the END of the block above,
  // demotion at the START of the block below — while Refine,
  // which derives its lists from the same triageMap + master
  // list, agrees. Steps inside a block are the plain
  // moveMasterSong swap.
  //
  // A drag applies moveSong one adjacent step at a time: touch
  // steps fire per move event, like Refine's live reorder; a
  // mouse drop records a step plan and the effect under it walks
  // the song to the drop row one arrow-step per render. Every
  // step is an update the arrows themselves would have made,
  // through the same normalize/save path — ordering semantics
  // and persistence are unchanged. The arrows' enablement rules
  // bind the drag too: no stepping up from row 0 (the context
  // no-ops it), and no stepping down from the last rankable row
  // (its ↓ was disabled: below Slaps sits Mid, which carries no
  // rank — a one-way demotion out of the ranked region is not
  // this control's job). Rows that had no arrows (the "-" chip
  // buckets) get no drag handle — movement eligibility is
  // unchanged.
  const [dragState, setDragState] = useState<{ songId: string; type: 'mouse' | 'touch' } | null>(null);
  const touchDragState = useRef<{ songId: string; startY: number; isActivated: boolean } | null>(null);
  const [stepPlan, setStepPlan] = useState<{ songId: string; targetIndex: number } | null>(null);

  const moveSong = (song: Song, idx: number, dir: 'up' | 'down') => {
    const bucket = triageMap[song.id];
    const neighborBucket =
      dir === 'up'
        ? idx > 0
          ? triageMap[rankedSongs[idx - 1].id]
          : undefined
        : idx < rankedSongs.length - 1
          ? triageMap[rankedSongs[idx + 1].id]
          : undefined;
    if (
      neighborBucket !== undefined &&
      neighborBucket !== 'unknown' &&
      neighborBucket !== bucket
    ) {
      setSongBucket(song.id, neighborBucket);
    } else {
      moveMasterSong(idx, dir);
    }
  };

  // Step-plan pump (mouse drops): one arrow-step per render
  // until the dragged song reaches the drop row or an arrow
  // guard stops it.
  useEffect(() => {
    if (!stepPlan) return;
    const idx = rankedSongs.findIndex((s) => s.id === stepPlan.songId);
    if (idx === -1 || idx === stepPlan.targetIndex) {
      setStepPlan(null);
      return;
    }
    if (stepPlan.targetIndex < idx) {
      moveSong(rankedSongs[idx], idx, 'up');
    } else if (idx < lastRankableIndex) {
      moveSong(rankedSongs[idx], idx, 'down');
    } else {
      setStepPlan(null);
    }
  });

  const handleDragStart = (e: React.DragEvent, song: Song) => {
    triggerHaptic(25);
    setStepPlan(null);
    const target = e.currentTarget as HTMLElement;

    try {
      const dragGhost = target.cloneNode(true) as HTMLElement;
      dragGhost.style.width = `${target.offsetWidth}px`;
      dragGhost.style.height = `${target.offsetHeight}px`;

      dragGhost.style.backgroundColor = '#0f172a';
      dragGhost.style.borderColor = '#fbbf24';
      dragGhost.style.borderWidth = '2px';
      dragGhost.style.borderStyle = 'solid';
      dragGhost.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.5)';
      dragGhost.style.borderRadius = '1rem';

      const h3 = dragGhost.querySelector('h3');
      if (h3) { h3.style.color = 'white'; h3.style.fontWeight = '800'; }

      // Refine's ghost recolors its album line via
      // 'span.text-[10px]'; here the bucket badge's emoji span
      // carries that class first, so the port targets the album
      // line by its truncate class instead (the row's only
      // span.truncate).
      const subtitle = dragGhost.querySelector('span.truncate');
      if (subtitle) (subtitle as HTMLElement).style.color = '#cbd5e1';

      const rankBadge = dragGhost.querySelector('span.w-7');
      if (rankBadge) {
        (rankBadge as HTMLElement).style.backgroundColor = '#fbbf24';
        (rankBadge as HTMLElement).style.color = '#020617';
      }

      const hamburger = dragGhost.querySelector('.cursor-grab');
      if (hamburger) {
        (hamburger as HTMLElement).style.color = '#fbbf24';
        (hamburger as HTMLElement).style.transform = 'scale(1.25)';
      }

      dragGhost.style.position = 'absolute';
      dragGhost.style.top = '-9999px';
      dragGhost.style.left = '-9999px';
      document.body.appendChild(dragGhost);

      const offsetX = e.nativeEvent.offsetX || 30;
      const offsetY = e.nativeEvent.offsetY || 30;
      e.dataTransfer.setDragImage(dragGhost, offsetX, offsetY);

      setTimeout(() => {
        if (document.body.contains(dragGhost)) document.body.removeChild(dragGhost);
      }, 50);
    } catch (err) {
      console.error("Failed to generate custom drag image:", err);
    }

    setTimeout(() => setDragState({ songId: song.id, type: 'mouse' }), 0);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (targetIndex: number) => {
    if (!dragState || dragState.type !== 'mouse') return;
    triggerHaptic(15);
    const songId = dragState.songId;
    setDragState(null);
    setStepPlan({ songId, targetIndex });
  };

  const handleTouchStart = (e: React.TouchEvent, song: Song) => {
    const touch = e.touches[0];
    if (touch) {
      touchDragState.current = {
        songId: song.id,
        startY: touch.clientY,
        isActivated: false
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragState.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const deltaY = Math.abs(touch.clientY - touchDragState.current.startY);
    if (!touchDragState.current.isActivated) {
      if (deltaY > 8) {
        touchDragState.current.isActivated = true;
        triggerHaptic(25);
        setStepPlan(null);
        setDragState({ songId: touchDragState.current.songId, type: 'touch' });
      } else return;
    }

    const edgeThreshold = 120;
    if (touch.clientY < edgeThreshold) window.scrollBy(0, -15);
    else if (touch.clientY > window.innerHeight - edgeThreshold) window.scrollBy(0, 15);

    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardEl = targetEl?.closest('[data-song-card]');
    if (!cardEl) return;

    const targetIndexStr = cardEl.getAttribute('data-index');
    if (targetIndexStr === null) return;
    const targetIndex = parseInt(targetIndexStr, 10);
    if (isNaN(targetIndex)) return;

    const songIdx = rankedSongs.findIndex((s) => s.id === touchDragState.current!.songId);
    if (songIdx === -1 || targetIndex === songIdx) return;

    // One arrow-step toward the row under the finger (the
    // update path moves one row per write — see moveSong).
    if (targetIndex < songIdx) {
      triggerHaptic(12);
      moveSong(rankedSongs[songIdx], songIdx, 'up');
    } else if (songIdx < lastRankableIndex) {
      triggerHaptic(12);
      moveSong(rankedSongs[songIdx], songIdx, 'down');
    }
  };

  const handleTouchEnd = () => {
    if (touchDragState.current) {
      if (touchDragState.current.isActivated) triggerHaptic(15);
      touchDragState.current = null;
      setDragState(null);
    }
  };

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
        <h1 className={`${displayFont.className} text-[32px] text-[#0C1220]`}>
          Final Review
        </h1>
        <p className="text-sm font-bold text-[#3D4A63] max-w-sm mx-auto leading-tight">
          Make any final tweaks to your top rankings. If a song is in the wrong bucket, go back to fix it!
        </p>
      </div>

      <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] p-3 sm:p-5 shadow-[4px_4px_0_rgba(11,30,63,0.85)]">
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
        <div className="space-y-1.5" onDragOver={handleDragOver} onDrop={() => handleDrop(rankedSongs.length - 1)}>
          {rankedSongs.map((song, idx) => {
            const bucket = triageMap[song.id];
            // rankedSongs only holds real buckets (getRankedSongs), so
            // 'unknown'/missing can't occur — narrow for the config lookup.
            if (bucket === undefined || bucket === 'unknown') return null;
            const isRankable = bucket === 'banger' || bucket === 'slaps';
            const cfg = BUCKET_CONFIG[bucket];

            const isMouseDrag = dragState?.type === 'mouse' && dragState.songId === song.id;
            const isTouchDrag = dragState?.type === 'touch' && dragState.songId === song.id;

            return (
              <div
                key={song.id}
                data-song-card="true"
                data-index={idx}
                draggable={isRankable}
                onDragStart={isRankable ? (e) => handleDragStart(e, song) : undefined}
                onDragEnd={() => setDragState(null)}
                onDragOver={handleDragOver}
                onDrop={(e) => { e.stopPropagation(); handleDrop(idx); }}
                className={`rounded-2xl p-2.5 flex items-center justify-between gap-3 transition-all duration-150 ${
                  isMouseDrag
                    ? 'opacity-40 border-2 border-dashed border-slate-300 bg-slate-100 scale-[0.98]'
                    : isTouchDrag
                    ? 'bg-slate-900 border-2 border-amber-400 scale-[1.02] shadow-2xl z-30 relative ring-4 ring-amber-400/20'
                    : 'bg-white border-2 border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]'
                }`}
              >

                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* ONLY SHOW RANK NUMBERS FOR TOP TWO BUCKETS */}
                  {isRankable ? (
                    <span className={`w-7 h-7 font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 shadow-2xs transition-colors ${
                      isTouchDrag ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300' : 'bg-[#0072CE] text-white'
                    }`}>
                      #{rankNumberById.get(song.id)}
                    </span>
                  ) : (
                    <span className="w-7 h-7 bg-slate-200 text-[#3D4A63] font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 shadow-2xs">
                      -
                    </span>
                  )}

                  <div className="min-w-0 text-left flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-0.5">
                      {/* Titles never truncate (owner, Nov 5): with
                          the arrows gone the title block has the
                          width — long titles wrap to a second
                          line instead of ellipsizing. */}
                      <h3 className={`text-sm font-bold leading-tight min-w-0 ${isTouchDrag ? 'text-white font-extrabold' : 'text-[#0C1220]'}`}>{song.title}</h3>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${cfg.badgeBg} !border-[1.5px] !border-[#0C1220] w-fit leading-none flex items-center gap-1`}>
                        <span className="text-[10px]">{cfg.emoji}</span> <span>{cfg.label}</span>
                      </span>
                    </div>
                    {/* The small play control, exactly as Refine's
                        rows render it (owner, Nov 5) — it replaces
                        the large standalone button that used to sit
                        on the row's right side. */}
                    <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                      <div
                        data-preview-btn="true"
                        className="shrink-0 flex items-center justify-center w-3.5 h-3.5 [&_button]:!w-3.5 [&_button]:!h-3.5 [&_button]:!p-0 [&_button]:!min-w-0 [&_button]:!min-h-0 [&_button]:!bg-transparent [&_button]:!border-none [&_svg]:!w-2.5 [&_svg]:!h-2.5"
                      >
                        <AudioPreviewButton title={song.title} />
                      </div>
                      <span className={`text-[10px] font-semibold truncate ${isTouchDrag ? 'text-slate-300' : 'text-[#3D4A63]'}`}>{song.album} ({song.year})</span>
                    </div>
                  </div>
                </div>

                {/* DRAG HANDLE — rankable rows only, mirroring the
                    arrows' eligibility: the "-" chip rows never
                    had a reorder control and still don't. */}
                <div className="flex items-center shrink-0">
                  {isRankable && (
                    <span
                      onTouchStart={(e) => handleTouchStart(e, song)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className={`w-6 h-8 flex items-center justify-center text-lg cursor-grab active:cursor-grabbing select-none touch-none transition-transform ${
                        isTouchDrag ? 'text-amber-400 scale-125' : 'text-[#0C1220]'
                      }`}
                    >
                      ☰
                    </span>
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
          className="bg-white hover:bg-slate-100 text-[#0C1220] font-black text-sm px-4 py-4 rounded-full shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)] cursor-pointer border-[3px] border-[#0C1220] whitespace-nowrap shrink-0"
        >
          ← Back
        </button>
        <button
          onClick={() => { triggerHaptic(20); setStep('wrapped'); }}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-5 sm:px-8 py-4 rounded-full shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)] cursor-pointer border-[3px] border-[#0C1220] flex items-center gap-2.5 whitespace-nowrap shrink-0"
        >
          <FlyingWIcon className="w-6 h-4 text-slate-950" />
          <span>Generate Weezer Wrapped →</span>
        </button>
      </div>

    </div>
  );
}
