'use client';
import React, { useState, useRef, useEffect } from 'react';
import { BucketType, Song, BUCKET_CONFIG, BUCKET_TRANSITIONS } from '../data/constants';
import type { TriageValue } from '../context/WeezerContext';
import { FlyingWIcon, AudioPreviewButton, SortingIncompleteNotice } from './SharedUI';
import Step1_5Matchups from './Step1_5Matchups';

const REFINEMENT_STAGES: { bucket: BucketType; title: string; desc: string; nextBtn: string }[] = [
  { bucket: 'banger', title: 'Rank Your Bangers', desc: "These are the absolute best of the best. Rank them, or demote the ones that don't survive the cut!", nextBtn: "Next: Rank Slaps →" },
  { bucket: 'slaps', title: 'Rank Your Lowkey Slaps', desc: "These are great, but not your absolute favorites. Rank them and make sure they belong here.", nextBtn: "Next: Review Mid →" },
  { bucket: 'mid', title: 'Review Your Mid', desc: "These are just okay. Review them to make sure nothing here is actually a hidden gem or total trash.", nextBtn: "Next: Review Skips →" },
  { bucket: 'skip', title: 'Review Your Skips', desc: "You usually skip these. Promote or demote if needed.", nextBtn: "Next: Review Trash →" },
  { bucket: 'trash', title: 'Review Your Trash', desc: "The bottom of the barrel. Make sure you don't actually like any of these before we finalize.", nextBtn: "Generate Final List →" },
]; 

export default function Step2Refine({
  bucketRanks,
  triageMap,
  onUpdateRanks,
  handleFinishBucketRanking,
  onBackToTriage,
  onKeepSorting,
  autoStartMatchups,
  initialStageIdx = 0,
}: {
  bucketRanks: Record<BucketType, Song[]>;
  triageMap: Record<string, TriageValue>;
  onUpdateRanks: (newRanks: Record<BucketType, Song[]>, newMap?: Record<string, TriageValue>) => void;
  handleFinishBucketRanking: () => void;
  onBackToTriage: () => void;
  onKeepSorting: () => void;
  autoStartMatchups: boolean;
  initialStageIdx?: number;
}) {
  const [stageIdx, setStageIdx] = useState(initialStageIdx);

  const [showMatchups, setShowMatchups] = useState(false);

  useEffect(() => {
    setStageIdx(initialStageIdx);
  }, [initialStageIdx]);

  useEffect(() => {
    // Auto-start (flag read once, on mount): fire the matchup pre-sort
    // for the FIRST stage that has matchups (Banger, then Slaps) whose
    // bucket holds ≥2 songs, landing on that stage — a Slaps-heavy
    // user with 0–1 Bangers still gets matchups. If neither matchup
    // stage qualifies, no auto-start: the stage-0 list, as before.
    if (initialStageIdx === 0 && autoStartMatchups) {
      const firstMatchupStage = REFINEMENT_STAGES.findIndex(
        (stage, idx) => idx <= 1 && (bucketRanks[stage.bucket] || []).length >= 2
      );
      if (firstMatchupStage >= 0) {
        setStageIdx(firstMatchupStage);
        setShowMatchups(true);
      }
    }
  }, []);

  const currentStage = REFINEMENT_STAGES[stageIdx] || REFINEMENT_STAGES[0];
  const bucket = currentStage.bucket;

  const songs = bucketRanks[bucket] || [];
  const cfg = BUCKET_CONFIG[bucket];
  const hasSlider = bucket === 'banger' || bucket === 'slaps';
  const transitions = BUCKET_TRANSITIONS[bucket];

  const [pendingMove, setPendingMove] = useState<{ song: Song; targetBucket: BucketType } | null>(null);

  const [dragState, setDragState] = useState<{ bucket: BucketType; songId: string; type: 'mouse' | 'touch' } | null>(null);
  const touchDragState = useRef<{ bucket: BucketType; songId: string; startIndex: number; currentIndex: number; startY: number; isActivated: boolean } | null>(null);

  const triggerHaptic = (duration = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) try { navigator.vibrate(duration); } catch (e) {}
  };

  const handleNext = () => {
    triggerHaptic(20);
    window.scrollTo(0, 0);
    if (stageIdx < REFINEMENT_STAGES.length - 1) {
      const nextIdx = stageIdx + 1;
      setStageIdx(nextIdx);
      setShowMatchups(false);
    } else {
      handleFinishBucketRanking();
    }
  };

  const handleBack = () => {
    triggerHaptic(15);
    window.scrollTo(0, 0);
    if (stageIdx > 0) {
      setStageIdx(prev => prev - 1);
      setShowMatchups(false);
    } else if (onBackToTriage) {
      onBackToTriage();
    }
  };

  const handleDragStart = (e: React.DragEvent, b: BucketType, song: Song) => { 
    triggerHaptic(25); 
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

      const subtitle = dragGhost.querySelector('span.text-\\[10px\\]');
      if (subtitle) subtitle.style.color = '#cbd5e1';

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

    setTimeout(() => setDragState({ bucket: b, songId: song.id, type: 'mouse' }), 0); 
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (targetBucket: BucketType, targetIndex: number) => {
    if (!dragState || dragState.bucket !== targetBucket) return;
    const list = [...bucketRanks[targetBucket]];
    const currentIndex = list.findIndex(s => s.id === dragState.songId);
    if (currentIndex === -1) return;

    const [movedItem] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, movedItem);

    triggerHaptic(15);
    setDragState(null);
    onUpdateRanks({ ...bucketRanks, [targetBucket]: list });
  };

  const handleTouchStart = (e: React.TouchEvent, b: BucketType, song: Song, index: number) => {
    const touch = e.touches[0];
    if (touch) {
      touchDragState.current = { 
        bucket: b, 
        songId: song.id, 
        startIndex: index, 
        currentIndex: index, 
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
        setDragState({ bucket: touchDragState.current.bucket, songId: touchDragState.current.songId, type: 'touch' });
      } else return;
    }

    const edgeThreshold = 120;
    if (touch.clientY < edgeThreshold) window.scrollBy(0, -15);
    else if (touch.clientY > window.innerHeight - edgeThreshold) window.scrollBy(0, 15);

    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardEl = targetEl?.closest('[data-song-card]');
    if (!cardEl) return;

    const targetIndexStr = cardEl.getAttribute('data-index');
    if (targetIndexStr !== null) {
      const targetIndex = parseInt(targetIndexStr, 10);
      if (!isNaN(targetIndex) && targetIndex !== touchDragState.current.currentIndex) {
        triggerHaptic(12);
        const b = touchDragState.current.bucket;
        const list = [...bucketRanks[b]];
        const [moved] = list.splice(touchDragState.current.currentIndex, 1);
        list.splice(targetIndex, 0, moved);
        touchDragState.current.currentIndex = targetIndex;
        onUpdateRanks({ ...bucketRanks, [b]: list });
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchDragState.current) {
      if (touchDragState.current.isActivated) triggerHaptic(15);
      touchDragState.current = null;
      setDragState(null);
    }
  };

  const promptMoveSong = (song: Song, targetBucket: BucketType) => {
    triggerHaptic(10);
    setPendingMove({ song, targetBucket });
  };

  const confirmMoveSong = () => {
    if (!pendingMove) return;
    triggerHaptic(20);

    const { song, targetBucket } = pendingMove;
    const sourceList = bucketRanks[bucket].filter(s => s.id !== song.id);
    const targetList = [...bucketRanks[targetBucket], song];
    const nextTriage = { ...triageMap, [song.id]: targetBucket };

    onUpdateRanks({ ...bucketRanks, [bucket]: sourceList, [targetBucket]: targetList }, nextTriage);
    setPendingMove(null);
  };

  const handleSongTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const card = e.currentTarget.closest('[data-song-card]');
    const previewBtn = card?.querySelector<HTMLButtonElement>('[data-preview-btn] button');
    if (previewBtn) previewBtn.click();
  };

  if (showMatchups && (bucket === 'banger' || bucket === 'slaps') && songs.length >= 2) {
    return (
      <Step1_5Matchups
        songs={songs}
        bucketTitle={bucket === 'banger' ? 'Banger' : 'Slap'}
        onComplete={(sorted) => {
          onUpdateRanks({ ...bucketRanks, [bucket]: sorted });
          setShowMatchups(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-24 relative">

      {/* SORTING-INCOMPLETE NOTICE — tops every refine stage when
          triage isn't finished (renders nothing at 206). The
          matchups interstitial above replaces this whole view
          while it runs; the notice is waiting here when it ends. */}
      <SortingIncompleteNotice triageMap={triageMap} onKeepSorting={onKeepSorting} />

      {/* CUSTOM CONFIRMATION MODAL OVERLAY */}
      {pendingMove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{BUCKET_CONFIG[pendingMove.targetBucket].emoji}</span>
              <h3 className="text-xl font-black text-slate-900">
                Move to {BUCKET_CONFIG[pendingMove.targetBucket].label}?
              </h3>
            </div>
            <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to move <span className="font-bold text-slate-900">"{pendingMove.song.title}"</span>?
              <br /><br />
              <span className="text-xs text-slate-500 flex gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="shrink-0">💡</span> 
                <span>To simply reorder songs within this list, hold and drag the ☰ icon instead.</span>
              </span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPendingMove(null)} className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition cursor-pointer">
                Cancel
              </button>
              <button 
                onClick={confirmMoveSong} 
                className={`flex-1 px-4 py-3 rounded-2xl text-slate-950 font-black shadow-sm transition border-2 cursor-pointer
                  ${pendingMove.targetBucket === 'banger' ? 'bg-blue-300 border-blue-400 hover:bg-blue-400' : ''}
                  ${pendingMove.targetBucket === 'slaps' ? 'bg-emerald-300 border-emerald-400 hover:bg-emerald-400' : ''}
                  ${pendingMove.targetBucket === 'mid' ? 'bg-amber-300 border-amber-400 hover:bg-amber-400' : ''}
                  ${pendingMove.targetBucket === 'skip' ? 'bg-orange-300 border-orange-400 hover:bg-orange-400' : ''}
                  ${pendingMove.targetBucket === 'trash' ? 'bg-rose-300 border-rose-400 hover:bg-rose-400' : ''}
                `}
              >
                Yes, Move It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="text-center space-y-2 px-4 mb-8 pt-2">
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">{currentStage.title}</h1>
        <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-tight">{currentStage.desc}</p>
      </div>

      {/* ACTIVE BUCKET DRAG-AND-DROP CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-xs" onDragOver={hasSlider ? handleDragOver : undefined} onDrop={hasSlider ? () => handleDrop(bucket, songs.length) : undefined}>

        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 px-1">
          <h2 className={`text-sm sm:text-base font-black uppercase tracking-wider ${cfg.color}`}>
            {cfg.emoji} {cfg.label} <span className="text-slate-400">({songs.length})</span>
          </h2>
          
          {/* HELP ME RANK BUTTON */}
          {hasSlider && songs.length >= 2 && (
            <button
              onClick={() => setShowMatchups(true)}
              className="text-[11px] font-black text-[#0072CE] hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl transition cursor-pointer flex gap-1 items-center"
            >
              <span>⚡️</span>
              Help Me Rank
            </button>
          )}
        </div>

        {songs.length === 0 ? (
          <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No songs in {cfg.label}.
          </div>
        ) : (
          <div className="space-y-1.5">
            {songs.map((song, idx) => {
              const isMouseDrag = dragState?.type === 'mouse' && dragState.bucket === bucket && dragState.songId === song.id;
              const isTouchDrag = dragState?.type === 'touch' && dragState.bucket === bucket && dragState.songId === song.id;

              return (
                <div
                  key={song.id}
                  data-song-card="true"
                  data-bucket={bucket}
                  data-index={idx}
                  draggable={hasSlider}
                  onDragStart={hasSlider ? (e) => handleDragStart(e, bucket, song) : undefined}
                  onDragOver={handleDragOver}
                  onDrop={hasSlider ? (e) => { e.stopPropagation(); handleDrop(bucket, idx); } : undefined}
                  className={`rounded-2xl py-2 px-2.5 flex items-center justify-between gap-2 transition-all duration-150 ${
                    isMouseDrag 
                      ? 'opacity-40 border-2 border-dashed border-slate-300 bg-slate-100 scale-[0.98]'
                      : isTouchDrag
                      ? 'bg-slate-900 border-2 border-amber-400 text-white scale-[1.02] shadow-2xl z-30 relative ring-4 ring-amber-400/20'
                      : 'bg-slate-50 border border-slate-200 shadow-2xs hover:border-blue-300 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {hasSlider && (
                      <span className={`w-7 h-7 font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isTouchDrag ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300' : 'bg-[#0072CE] text-white'
                      }`}>
                        #{idx + 1}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3
                        onClick={handleSongTitleClick}
                        className={`text-sm font-bold leading-tight truncate cursor-pointer hover:text-[#0072CE] transition-colors ${
                          isTouchDrag ? 'text-white font-extrabold' : 'text-slate-900'
                        }`}
                        title="Tap to preview audio"
                      >
                        {song.title}
                      </h3>

                      <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                        <div
                          data-preview-btn="true"
                          className="shrink-0 flex items-center justify-center w-3.5 h-3.5 [&_button]:!w-3.5 [&_button]:!h-3.5 [&_button]:!p-0 [&_button]:!min-w-0 [&_button]:!min-h-0 [&_button]:!bg-transparent [&_button]:!border-none [&_svg]:!w-2.5 [&_svg]:!h-2.5"
                        >
                          <AudioPreviewButton title={song.title} />
                        </div>
                        <span className={`text-[10px] font-semibold truncate ${isTouchDrag ? 'text-slate-300' : 'text-slate-500'}`}>
                          {song.album} ({song.year})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <div className="flex items-center gap-1">
                      {transitions.above && (
                        <button
                          type="button"
                          onClick={() => promptMoveSong(song, transitions.above!)}
                          className={`px-1.5 h-7 rounded-md flex items-center justify-center gap-0.5 text-[11px] border font-black transition cursor-pointer ${
                            isTouchDrag ? 'bg-slate-800 border-slate-700 text-white' : BUCKET_CONFIG[transitions.above].badgeBg
                          }`}
                          title={`Promote to ${BUCKET_CONFIG[transitions.above].label}`}
                        >
                          <span className="text-[14px] leading-none -mt-0.5">↑</span>
                          <span className="text-[12px]">{BUCKET_CONFIG[transitions.above].emoji}</span>
                        </button>
                      )}
                      {transitions.below && (
                        <button
                          type="button"
                          onClick={() => promptMoveSong(song, transitions.below!)}
                          className={`px-1.5 h-7 rounded-md flex items-center justify-center gap-0.5 text-[11px] border font-black transition cursor-pointer ${
                            isTouchDrag ? 'bg-slate-800 border-slate-700 text-white' : BUCKET_CONFIG[transitions.below].badgeBg
                          }`}
                          title={`Demote to ${BUCKET_CONFIG[transitions.below].label}`}
                        >
                          <span className="text-[14px] leading-none -mt-0.5">↓</span>
                          <span className="text-[12px]">{BUCKET_CONFIG[transitions.below].emoji}</span>
                        </button>
                      )}
                    </div>

                    {hasSlider && (
                      <span 
                        onTouchStart={(e) => handleTouchStart(e, bucket, song, idx)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={`w-6 h-8 flex items-center justify-center text-lg cursor-grab active:cursor-grabbing select-none touch-none transition-transform ${
                          isTouchDrag ? 'text-amber-400 scale-125' : 'text-slate-400 hover:text-slate-600'
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

      {/* STICKY BOTTOM NAVIGATION CONTROLS */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-3">
        <button
          onClick={handleBack}
          className="bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-700 font-black text-sm px-5 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition transform hover:scale-105 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        <button
          onClick={handleNext}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
        >
          {stageIdx === REFINEMENT_STAGES.length - 1 && <FlyingWIcon className="w-6 h-4 text-slate-950" />}
          <span>{currentStage.nextBtn}</span>
        </button>
      </div>

    </div>
  );
}