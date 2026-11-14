'use client';
import React, { useState, useRef, useEffect } from 'react';
import { BucketType, Song, BUCKET_CONFIG, BUCKET_TRANSITIONS } from '../data/constants';
import { getProgressState, type TriageValue } from '../context/WeezerContext';
import { FlyingWIcon, AudioPreviewButton, SortingIncompleteNotice } from './SharedUI';
import { getRankedSongs, seatMovedSongInBucket } from '@/utils/rankingUtils';
import Step1_5Matchups from './Step1_5Matchups';
import Step1_5SplitPass from './Step1_5SplitPass';
import RefineToolsModule, { type RefineMode } from './RefineToolsModule';
import { displayFont } from './shareables/fonts';

// The bucket band's pastel strip (Round 2): the -100 tint of the
// bucket's own badge family in BUCKET_CONFIG (badgeBg's bg token),
// worn as a framed band above the stage list.
// Plural bucket names for the split pass's copy ("Split the
// Mids", "Best Slaps").
const SPLIT_PLURAL: Record<BucketType, string> = {
  banger: 'Bangers',
  slaps: 'Slaps',
  mid: 'Mids',
  skip: 'Skips',
  trash: 'Trash'
};

const BAND_BG: Record<BucketType, string> = {
  banger: 'bg-emerald-100',
  slaps: 'bg-blue-100',
  mid: 'bg-amber-100',
  skip: 'bg-orange-100',
  trash: 'bg-rose-100',
};

// The stage band's label (owner, Nov 7): the band drops "Lowkey"
// — it renders "SLAPS (n)" — so the label and the Help Me Rank
// button each fit on one line at phone widths. BAND CONTEXT ONLY:
// BUCKET_CONFIG's 'Lowkey Slaps' label still names the bucket
// everywhere else (triage, tier names, Thread copy, the promote /
// demote controls below).
const BAND_LABEL: Record<BucketType, string> = {
  banger: 'Banger',
  slaps: 'Slaps',
  mid: 'Mid',
  skip: 'Skip',
  trash: 'Trash',
};

const REFINEMENT_STAGES: { bucket: BucketType; title: string; desc: string; nextBtn: string; rankTitle?: string }[] = [
  { bucket: 'banger', title: 'Rank Your Bangers', desc: "To you, these songs are the best of the best.", nextBtn: "Next: Rank Slaps →" },
  { bucket: 'slaps', title: 'Rank Your Slaps', desc: "You think these songs rock, but they wouldn't make your 20-song mixtape.", nextBtn: "Next: Review Mid →" },
  { bucket: 'mid', title: 'Review Your Mids', desc: "These are good jams but wouldn't make your Spotify playlist.", nextBtn: "Next: Review Skips →", rankTitle: 'Rank Your Mids' },
  { bucket: 'skip', title: 'Review Your Skips', desc: "These are songs you skip when no one is watching.", nextBtn: "Next: Review Trash →", rankTitle: 'Rank Your Skips' },
  { bucket: 'trash', title: 'Review Your Trash', desc: "These are songs you'd be fine never hearing again.", nextBtn: "Generate Final List →", rankTitle: 'Rank Your Trash' },
];

// STAGE RESUME (Nov 6, 2026): stageIdx is component state, so a
// full page reload — iOS discarding the backgrounded app while the
// owner flips between apps — remounted Refine at stage 0 (Bangers)
// even mid-work on a later stage. The stage now persists in
// sessionStorage (the same session-scoped lifetime the app already
// uses for weezer-pending-scroll-restore). Restore rule, applied
// in the state initializer below:
// - A deliberate landing stage (initialStageIdx > 0 — Final
//   Review's Back, the Wrapped edit-intent) always wins; the
//   persisted value is never read.
// - A fresh matchup entry (autoStartMatchups armed) never reads
//   it either — the pre-sort decides the landing — and entering
//   that way clears it.
// - Otherwise (a reload/remount mid-work) the persisted stage is
//   restored.
// The persisted value is cleared when Refine completes (the last
// stage's Generate button) and on a fresh matchup entry; ordinary
// exits (back to triage, keep sorting) leave it in place, so
// coming back resumes the stage the work was on.
const REFINE_STAGE_KEY = 'weezer-refine-stage';

function readPersistedRefineStage(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(REFINE_STAGE_KEY);
    if (raw === null) return null;
    const idx = Number.parseInt(raw, 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= REFINEMENT_STAGES.length) return null;
    return idx;
  } catch {
    return null;
  }
}

function persistRefineStage(idx: number) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(REFINE_STAGE_KEY, String(idx));
  } catch {
    /* storage unavailable — resume simply won't survive a reload */
  }
}

function clearPersistedRefineStage() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(REFINE_STAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export default function Step2Refine({
  bucketRanks,
  triageMap,
  masterList,
  onUpdateRanks,
  handleFinishBucketRanking,
  onBackToTriage,
  onKeepSorting,
  autoStartMatchups,
  initialStageIdx = 0,
  onStageChange,
  lowerRankOptIns,
  onToggleLowerRank,
  openTools,
  onConsumeOpenTools,
}: {
  bucketRanks: Record<BucketType, Song[]>;
  triageMap: Record<string, TriageValue>;
  masterList: Song[];
  onUpdateRanks: (newRanks: Record<BucketType, Song[]>, newMap?: Record<string, TriageValue>) => void;
  handleFinishBucketRanking: () => void;
  onBackToTriage: () => void;
  onKeepSorting: () => void;
  autoStartMatchups: boolean;
  initialStageIdx?: number;
  onStageChange?: (idx: number) => void;
  lowerRankOptIns: BucketType[];
  onToggleLowerRank: (bucket: BucketType, on: boolean) => void;
  /** Armed by the My Rankings prompt's deep link: land with
   *  the tools module open on its tool step. Consumed on
   *  sight (onConsumeOpenTools clears the context flag). */
  openTools: boolean;
  onConsumeOpenTools: () => void;
}) {
  // Set inside the initializer when the stage came from
  // sessionStorage, so the prop-sync effect below doesn't stomp
  // the restore with the mount-time prop (0) on its first run.
  const restoredStageRef = useRef(false);
  const [stageIdx, setStageIdx] = useState(() => {
    if (initialStageIdx > 0) return initialStageIdx;
    if (autoStartMatchups) return 0;
    const persisted = readPersistedRefineStage();
    if (persisted !== null) {
      restoredStageRef.current = true;
      return persisted;
    }
    return initialStageIdx;
  });
  // The prop-sync effect skips exactly its mount run when the
  // initializer restored a persisted stage; later prop changes
  // (a deliberate landing while mounted) apply normally.
  const skipPropSyncRef = useRef(restoredStageRef.current);

  // Stage moves go through here so the context copy stays current:
  // a return landing (Final Review's Back) reads it back as
  // initialStageIdx and lands on the stage the user left.
  const goToStage = (idx: number) => {
    setStageIdx(idx);
    persistRefineStage(idx);
    onStageChange?.(idx);
  };

  const [showMatchups, setShowMatchups] = useState(false);
  const [showSplit, setShowSplit] = useState(false);

  useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false;
      return;
    }
    setStageIdx(initialStageIdx);
    persistRefineStage(initialStageIdx);
  }, [initialStageIdx]);

  useEffect(() => {
    // Auto-start (flag read once, on mount): fire the matchup pre-sort
    // for the FIRST stage that has matchups (Banger, then Slaps) whose
    // bucket holds ≥2 songs, landing on that stage — a Slaps-heavy
    // user with 0–1 Bangers still gets matchups. If neither matchup
    // stage qualifies, no auto-start: the stage-0 list, as before.
    if (initialStageIdx === 0 && autoStartMatchups) {
      // Fresh entry: any resume point from earlier work is stale
      // (goToStage below re-persists the stage it lands on).
      clearPersistedRefineStage();
      const firstMatchupStage = REFINEMENT_STAGES.findIndex(
        (stage, idx) => idx <= 1 && (bucketRanks[stage.bucket] || []).length >= 2
      );
      if (firstMatchupStage >= 0) {
        goToStage(firstMatchupStage);
        setShowMatchups(true);
      }
    }
  }, []);

  const currentStage = REFINEMENT_STAGES[stageIdx] || REFINEMENT_STAGES[0];
  // An opted-in lower stage speaks the ranking language
  // (Rank Your Mids…), not the review language.
  const stageTitle =
    lowerRankOptIns.includes(currentStage.bucket) && currentStage.rankTitle
      ? currentStage.rankTitle
      : currentStage.title;
  // The subhead is the explainer only, in both modes: the
  // "put them in rank order / promote or demote" instruction
  // tail retired Nov 14, 2026 — the tools module under the
  // header carries the ranking ask now (owner).
  const stageDesc = currentStage.desc;
  const bucket = currentStage.bucket;

  const songs = bucketRanks[bucket] || [];

  // TRUE OVERALL RANK NUMBERS (owner, Nov 5): the chip on a stage
  // row shows the song's rank in the overall ranking — the same
  // number Final Review shows for it — not its position within
  // this bucket (his #1 Slap is his #21 song overall). Derived
  // from the exact source Final Review uses — getRankedSongs over
  // the master list, counting only the rankable buckets (Banger /
  // Lowkey Slaps) in order — so the two pages can never disagree.
  // Display-only: no ordering, data, or state changes. The
  // within-bucket index remains as a defensive fallback for a
  // song with no master-list position (unreachable in normal
  // flow: bucketRanks is itself derived from the master list).
  const rankNumberById = new Map<string, number>();
  getRankedSongs(masterList, triageMap).forEach((s) => {
    const b = triageMap[s.id];
    if (b === 'banger' || b === 'slaps') {
      rankNumberById.set(s.id, rankNumberById.size + 1);
    }
  });

  const cfg = BUCKET_CONFIG[bucket];
  // Bangers and Slaps are ranked by the project itself: they
  // carry rank numbers. A lower bucket joins the ordering
  // when its Rank toggle is on (downstream ranking, Nov 12,
  // 2026) — drag, the handle, and Help Me Rank all follow
  // canOrder, so a ranked lower bucket gets the matchup
  // sorter just like Bangers and Slaps (owner, Nov 12). The
  // rank chip stays with the two buckets that carry ranks.
  const isRankableBucket = bucket === 'banger' || bucket === 'slaps';
  const optedIn = !isRankableBucket && lowerRankOptIns.includes(bucket);
  const canOrder = isRankableBucket || optedIn;
  // THE MICRO-PROGRAM MODULE (owner, Nov 14, 2026) — the
  // Nov 12 Rank/Review toggle and the Nov 13 tools row are
  // replaced by one guided, collapsible module under the
  // header (RefineToolsModule): step 1 asks rank-or-review
  // once per lower bucket, step 2 offers the tools, and the
  // resting state is a slim collapsed strip so the song list
  // sits high. The mode itself still rides the existing
  // opt-in flag (canOrder above); what's new is a device-
  // local record of DECISIONS, so "chose Review" is
  // distinguishable from "never asked" and step 1 only
  // greets the undecided.
  const showModule =
    songs.length > 0 &&
    (isRankableBucket || getProgressState(triageMap, masterList).isTriageComplete);
  const [modeDecisions, setModeDecisions] = useState<Partial<Record<BucketType, RefineMode>>>({});
  const [decisionsLoaded, setDecisionsLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('weezer-refine-decisions');
      if (raw) setModeDecisions(JSON.parse(raw));
    } catch { /* storage unavailable — step 1 just asks again */ }
    setDecisionsLoaded(true);
  }, []);
  const moduleMode: RefineMode | null = isRankableBucket
    ? 'rank'
    : optedIn
      ? 'rank'
      : (modeDecisions[bucket] ?? null);
  // SEQUENTIAL GATING (owner, Nov 14, 2026): a lower bucket
  // is only OFFERED ranking once the lower bucket before it
  // (Mid → Skip → Trash) has been ranked. An empty previous
  // bucket never locks. A bucket already opted in keeps its
  // ranking even if the one before it is later un-ranked.
  const LOWER_SEQ: BucketType[] = ['mid', 'skip', 'trash'];
  const prevLower: BucketType | undefined = !isRankableBucket
    ? LOWER_SEQ[LOWER_SEQ.indexOf(bucket) - 1]
    : undefined;
  const rankLocked =
    !!prevLower &&
    !optedIn &&
    (bucketRanks[prevLower] || []).length > 0 &&
    !lowerRankOptIns.includes(prevLower);
  const [moduleOpen, setModuleOpen] = useState(false);
  // Landings: an undecided lower bucket opens on its
  // question; anything already decided lands collapsed.
  useEffect(() => {
    if (!decisionsLoaded) return;
    setModuleOpen(!isRankableBucket && moduleMode === null && showModule && !rankLocked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, decisionsLoaded]);
  // The My Rankings prompt arms openTools: land on the tools.
  useEffect(() => {
    if (openTools) {
      setModuleOpen(true);
      onConsumeOpenTools();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTools]);
  // TOOL-USE MEMORY (owner, Nov 14, 2026): once a tool has
  // actually been used in a bucket — a matchup session that
  // changed the order, or an applied split pass — the module
  // speaks as a returning state ("drag to refine further, or
  // use the tools again") instead of a fresh start. Device-
  // local, like the mode decisions.
  const [toolUse, setToolUse] = useState<Partial<Record<BucketType, boolean>>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem('weezer-refine-tooluse');
      if (raw) setToolUse(JSON.parse(raw));
    } catch { /* storage unavailable */ }
  }, []);
  const markToolUsed = (b: BucketType) => {
    setToolUse((prev) => {
      if (prev[b]) return prev;
      const next = { ...prev, [b]: true };
      try { localStorage.setItem('weezer-refine-tooluse', JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };
  const chooseRefineMode = (m: RefineMode) => {
    if (m === 'rank' && rankLocked) return;
    triggerHaptic(10);
    if (!isRankableBucket) {
      onToggleLowerRank(bucket, m === 'rank');
      const next = { ...modeDecisions, [bucket]: m };
      setModeDecisions(next);
      try { localStorage.setItem('weezer-refine-decisions', JSON.stringify(next)); } catch { /* best-effort */ }
    }
    if (m === 'review') setModuleOpen(false);
  };
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
      goToStage(stageIdx + 1);
      setShowMatchups(false);
    } else {
      // Refine is complete: the resume point has done its job.
      clearPersistedRefineStage();
      handleFinishBucketRanking();
    }
  };

  const handleBack = () => {
    triggerHaptic(15);
    window.scrollTo(0, 0);
    if (stageIdx > 0) {
      goToStage(stageIdx - 1);
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
    // SEATING (owner, Nov 7): a demotion lands at the TOP of the
    // bucket it drops into; a promotion lands at the BOTTOM of the
    // bucket it rises into. The rule lives in seatMovedSongInBucket
    // (rankingUtils) — the old unconditional append here put songs
    // demoted out of Bangers at the bottom of Slaps.
    const targetList = seatMovedSongInBucket(bucketRanks[targetBucket], song, bucket, targetBucket);
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

  // THE SPLIT PASS takeover (Nov 13, 2026): coarse-sort game
  // for big buckets — see Step1_5SplitPass. onApply writes the
  // new order but keeps the takeover open (its done panel
  // offers to split a third); onExit closes it.
  if (showSplit && canOrder && songs.length > 30) {
    return (
      <Step1_5SplitPass
        songs={songs}
        bucket={bucket}
        plural={SPLIT_PLURAL[bucket]}
        onApply={(sorted) => {
          markToolUsed(bucket);
          onUpdateRanks({ ...bucketRanks, [bucket]: sorted });
        }}
        onExit={() => setShowSplit(false)}
        triageMap={triageMap}
        onKeepSorting={onKeepSorting}
      />
    );
  }

  if (showMatchups && canOrder && songs.length >= 2) {
    return (
      <Step1_5Matchups
        songs={songs}
        bucketTitle={bucket === 'banger' ? 'Banger' : bucket === 'slaps' ? 'Slap' : cfg.label}
        onComplete={(sorted) => {
          // A session counts as USED when it changed the
          // order (Skip Pre-Sort and hold-only sessions hand
          // back the same sequence and don't count).
          const before = (bucketRanks[bucket] || []).map((x) => x.id).join('|');
          const after = sorted.map((x) => x.id).join('|');
          if (before !== after) markToolUsed(bucket);
          onUpdateRanks({ ...bucketRanks, [bucket]: sorted });
          setShowMatchups(false);
        }}
        triageMap={triageMap}
        onKeepSorting={onKeepSorting}
      />
    );
  }

  return (
    <div className="space-y-6 pb-36 relative">

      {/* SORTING-INCOMPLETE NOTICE — tops every refine stage when
          triage isn't finished (renders nothing at 206). The
          matchups interstitial above replaces this whole view
          while it runs; since the owner's Nov 7, 2026 ruling the
          notice renders INSIDE the takeover too (Step1_5Matchups
          receives triageMap/onKeepSorting and shows it at the top
          of its column), closing the gap the Nov 3 bracketing
          compromise left. */}
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
              {/* DRAG TIP — only on stages where this list actually
                  offers drag-reorder. canOrder is the flag
                  that renders the ☰ handle and enables dragging
                  (Banger / Lowkey Slaps, plus a lower bucket the
                  fan opted to rank); a lower stage without the
                  opt-in has no drag, so the tip must not claim
                  there is (owner, Nov 3). No substitute advice
                  where it doesn't apply — the box just isn't there. */}
              {canOrder && (
                <>
                  <br /><br />
                  <span className="text-xs text-slate-500 flex gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="shrink-0">💡</span>
                    <span>To simply reorder songs within this list, hold and drag the ☰ icon instead.</span>
                  </span>
                </>
              )}
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

      {/* EYEBROW (owner, Nov 7) — every stage carries the same
          eyebrow, "It's Time to Refine", in the style the old
          UAT P-10 stage indicator used. The "Stage X of 5" count
          is gone from the Refine flow entirely: it rendered only
          on stages 2–5, which read as a leftover artifact next
          to the eyebrow-less first stage. (P-10's "← Dashboard"
          pill beside the old indicator was already removed
          app-wide on Oct 19 — the app menu is the way to the
          dashboard.) CENTERED above the headline (owner, Nov 7,
          later): the indicator's old left alignment and its pl-1
          went with the count — the eyebrow now sits centered over
          the centered headline block below it, on all five stages
          (this header renders once per stage from the stage data).
          SPACING (owner, Nov 7, later still): the eyebrow sits
          RIGHT above the headline (~3px of visible gap), not
          floating well above it. The pair renders inside one
          plain wrapper so it takes a single space-y-6 slot from
          the root: as separate root children they stacked the
          root's 24px slot margin plus the headline block's pt-2
          (8px) between the two lines — ~43px glyph-to-glyph once
          the line boxes' half-leadings are counted. Inside the
          wrapper the eyebrow carries -mb-2 and the headline
          block drops its pt-2, which cancels the headline's top
          half-leading: 2.75px (eyebrow bottom half-leading) +
          8px (headline top half-leading) − 8px = ~3px. (A -mt-*
          on the headline block could not do this job — the
          root's space-y selector outranks a lone margin utility —
          and an -mb-* on an un-wrapped eyebrow lost to space-y's
          margin-bottom: 0 whenever the sorting-incomplete notice
          renders above it; the wrapper makes the tight gap hold
          in both states.) */}
      <div>
      <div className="text-center -mb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          It's Time to Refine
        </span>
      </div>

      {/* HEADER — the headline wraps balanced (owner, Nov 5):
          the old "Rank Your Lowkey Slaps" broke unbalanced,
          stranding a single word on the second line. Since
          Nov 7 the Slaps title is "Rank Your Slaps", which fits
          one line at this size on a 390px screen (~230px of
          glyphs vs ~326px available); the other four titles fit
          one line too. text-wrap: balance stays as the safety
          treatment. (The arbitrary-property form is deliberate:
          this project is on Tailwind 3.3, which has no
          text-balance utility.) */}
      <div className="text-center space-y-2 px-4 mb-8">
        <h1 className={`${displayFont.className} text-[32px] text-[#0C1220] [text-wrap:balance]`}>{stageTitle}</h1>
        <p className="text-sm font-bold text-[#3D4A63] max-w-sm mx-auto leading-tight">{stageDesc}</p>
      </div>
      </div>

      {/* THE MICRO-PROGRAM MODULE — between the header and
          the list card (owner, Nov 14, 2026). Collapsed, it's
          one slim strip; the song list below is the star. */}
      {showModule && (
        <RefineToolsModule
          open={moduleOpen}
          mode={moduleMode}
          isRankableBucket={isRankableBucket}
          songCount={songs.length}
          plural={SPLIT_PLURAL[bucket]}
          onOpen={() => setModuleOpen(true)}
          onClose={() => setModuleOpen(false)}
          onChooseMode={chooseRefineMode}
          onLaunchMatchups={() => { setModuleOpen(false); setShowMatchups(true); }}
          onLaunchSplit={() => { setModuleOpen(false); setShowSplit(true); }}
          toolsTouched={!!toolUse[bucket]}
          locked={rankLocked}
          lockedPrevPlural={prevLower ? SPLIT_PLURAL[prevLower] : undefined}
          onJumpToPrevious={() => goToStage(stageIdx - 1)}
        />
      )}

      {/* ACTIVE BUCKET DRAG-AND-DROP CONTAINER */}
      <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] p-3 sm:p-5 shadow-[4px_4px_0_rgba(11,30,63,0.85)]" onDragOver={canOrder ? handleDragOver : undefined} onDrop={canOrder ? () => handleDrop(bucket, songs.length) : undefined}>

        <div className={`flex items-center justify-between ${BAND_BG[bucket]} border-[2.5px] border-[#0C1220] rounded-xl px-2.5 py-2 mb-3`}>
          {/* One line each (owner, Nov 7): the label and the
              button never wrap and never shrink — with the band
              label shortened (BAND_LABEL), the widest pair,
              "SLAPS (49)" (~103px) + the button (~127px), totals
              ~230px against ~273px of band content width at a
              360px viewport. */}
          <h2 className={`text-sm sm:text-base font-black uppercase tracking-wider whitespace-nowrap shrink-0 ${cfg.color}`}>
            {cfg.emoji} {BAND_LABEL[bucket]} <span className="text-[#3D4A63]">({songs.length})</span>
          </h2>

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
                  draggable={canOrder}
                  onDragStart={canOrder ? (e) => handleDragStart(e, bucket, song) : undefined}
                  onDragOver={handleDragOver}
                  onDrop={canOrder ? (e) => { e.stopPropagation(); handleDrop(bucket, idx); } : undefined}
                  className={`rounded-2xl py-2 px-2.5 flex items-center justify-between gap-2 transition-all duration-150 ${
                    isMouseDrag 
                      ? 'opacity-40 border-2 border-dashed border-slate-300 bg-slate-100 scale-[0.98]'
                      : isTouchDrag
                      ? 'bg-slate-900 border-2 border-amber-400 text-white scale-[1.02] shadow-2xl z-30 relative ring-4 ring-amber-400/20'
                      : 'bg-white border-2 border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] text-[#0C1220]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isRankableBucket && (
                      <span className={`w-7 h-7 font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isTouchDrag ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300' : 'bg-[#0072CE] text-white'
                      }`}>
                        #{rankNumberById.get(song.id) ?? idx + 1}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      {/* Titles never truncate (owner, Nov 5) — same
                          rule F3 applied on Final Review: long titles
                          wrap to a second line instead of ellipsizing. */}
                      <h3
                        onClick={handleSongTitleClick}
                        className={`text-sm font-bold leading-tight min-w-0 cursor-pointer hover:text-[#0072CE] transition-colors ${
                          isTouchDrag ? 'text-white font-extrabold' : 'text-[#0C1220]'
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
                          <AudioPreviewButton id={song.id} title={song.title} album={song.album} />
                        </div>
                        <span className={`text-[10px] font-semibold ${isTouchDrag ? 'text-slate-300' : 'text-[#3D4A63]'}`}>
                          {song.album}
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
                            isTouchDrag ? 'bg-slate-800 border-slate-700 text-white' : `${BUCKET_CONFIG[transitions.above].badgeBg} !border-2 !border-[#0C1220]`
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
                            isTouchDrag ? 'bg-slate-800 border-slate-700 text-white' : `${BUCKET_CONFIG[transitions.below].badgeBg} !border-2 !border-[#0C1220]`
                          }`}
                          title={`Demote to ${BUCKET_CONFIG[transitions.below].label}`}
                        >
                          <span className="text-[14px] leading-none -mt-0.5">↓</span>
                          <span className="text-[12px]">{BUCKET_CONFIG[transitions.below].emoji}</span>
                        </button>
                      )}
                    </div>

                    {canOrder && (
                      <span 
                        onTouchStart={(e) => handleTouchStart(e, bucket, song, idx)}
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

      {/* STICKY BOTTOM NAVIGATION CONTROLS */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-3">
        <button
          onClick={handleBack}
          className="bg-white hover:bg-slate-50 text-[#0C1220] border-[3px] border-[#0C1220] font-black text-sm px-5 py-4 rounded-full shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)] cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        <button
          onClick={handleNext}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-8 py-4 rounded-full shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)] cursor-pointer border-[3px] border-[#0C1220] flex items-center gap-2.5 whitespace-nowrap"
        >
          {stageIdx === REFINEMENT_STAGES.length - 1 && <FlyingWIcon className="w-6 h-4 text-slate-950" />}
          <span>{currentStage.nextBtn}</span>
        </button>
      </div>

    </div>
  );
}