'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BucketType, BUCKET_CONFIG, FULL_SONG_POOL, Song } from '../data/constants';
import {
  countBucketedSongs,
  countCategorizedSongs,
  TriageValue,
} from '../context/WeezerContext';
import { albumCoverSrc, resolveAlbumId } from './shareables/ShareCardShell';
import { FlyingWIcon, AudioPreviewButton } from './SharedUI';
import type { TriageSection } from './Step1Triage';

/**
 * Deck mode — an alternate, one-song-at-a-time view of the Gut Check.
 *
 * It reads and writes the SAME triageMap through the SAME handlers as
 * the list view (handleSetBucket / handleFinishTriage), and walks the
 * SAME recognition-first display order: Step1Triage computes its
 * sections once and passes the flattened order down, so deck and list
 * can never disagree about what comes next.
 *
 * ONE-SCREEN LAYOUT (owner feedback): Step1Triage hands this component
 * a column at least one viewport tall (100dvh minus the sticky
 * AppShell header, as a MIN height) and the deck fills it as a flex
 * column: compact progress line → the fixed-height card (centered in
 * the remaining space) → the tray of tier tiles → one quiet Don't
 * Know It line → the Undo / Jump / Deck|List row. On tall phones
 * everything fits one screen; on short ones the page scrolls a
 * little — the owner accepted that in exchange for a song card tall
 * enough to hold a two-line title without pushing the preview button
 * off it. The checkpoint and completion states replace the card
 * inside the same column, at the same fixed height.
 *
 * SWIPE (owner feedback): the song card also drags horizontally —
 * commit left = Skip for an unrated song, advance-with-rating-kept
 * for a rated one; commit right = Undo. Directional stamps on the
 * card (SKIP / NEXT / BACK) plus quiet edge chevrons show the
 * affordance. See the SWIPE block in the component for the mapping;
 * it funnels into the same act()/undo() as the buttons.
 *
 * Cursor model: `cursorId` names the song on the card. Null means "no
 * explicit cursor" — the card shows the first uncategorized song in
 * display order (or the completion state when none are left). Acting
 * on a song advances the cursor to the next uncategorized song AFTER
 * the acted one, wrapping to the first uncategorized song overall when
 * the tail of the order is exhausted. Jump and Undo set the cursor
 * explicitly; a song the cursor lands on may already be categorized
 * (its state shows on the card, and picking a tier overwrites it).
 *
 * Undo: the context only exposes a setter (setSongBucket) — there is
 * no clear/remove API for a triage entry anywhere in the app, and the
 * list view cannot un-bucket a song either. So Undo moves the cursor
 * back to the last acted song WITHOUT clearing its entry; re-choosing
 * a tier (or Don't Know It) overwrites it. The in-memory history stack
 * holds acted song ids in order.
 */

// The short-path promise the site's own splash copy makes ("25 songs
// gets you your Wrapped in about 5 minutes" — Step0Splash). There is
// no separate code constant for it; the deck's framing counts bucketed
// songs toward that same 25. Actual step gating is unchanged and
// still runs through handleFinishTriage.
const WRAPPED_SHORT_PATH_GOAL = 25;

// Blue (10) + Pinkerton (10) + the singles block (26): the end of the
// recognition-first front section. Crossing this many categorized
// songs — with the short-path Wrapped goal met — earns one checkpoint.
const FRONT_SECTION_SIZE = 46;

const CHECKPOINT_DISMISSED_KEY = 'weezer-deck-checkpoint-dismissed';

const BUCKET_ORDER: BucketType[] = ['banger', 'slaps', 'mid', 'skip', 'trash'];

// Swipe (owner, Oct 16): dragging the card left past the commit
// threshold is "as good as a skip" for an unrated song (and just an
// advance for a rated one); dragging right is Undo. The stamp fades
// in from STAMP_FADE_PX and the gesture commits at
// max(COMMIT_MIN_PX, SWIPE_COMMIT_RATIO × card width).
const STAMP_FADE_PX = 40;
const COMMIT_MIN_PX = 80;
const SWIPE_COMMIT_RATIO = 0.25;

/**
 * The white card from the owner's reference mock, with a stacked-deck
 * effect: two backing cards peek out behind the real one, rotated a
 * couple of degrees — pure CSS, no images. The shell is a FIXED
 * height — it never grows or shrinks with content — so a song title
 * can never push the preview button off the card; the checkpoint and
 * completion states render inside the same shell at the same height.
 *
 * Slot budget (mobile-first, sums to the 392px height): card vertical
 * padding py-5 (40) + art slot h-32 (128) + gap-3 (12) + two-line
 * title slot h-[104px] (104 — two lines at the ladder's largest size,
 * text-5xl × leading-[1.05], is 100.8) + gap-3 (12) + meta line
 * text-sm (20) + gap-3 (12) + preview-button slot h-16 (64) = 392.
 */
function DeckCardShell({
  children,
  swipe,
}: {
  children: React.ReactNode;
  /**
   * Song state only: makes the front card draggable (see the swipe
   * block in Step1Deck). The backing layers stay put — only the
   * front card follows the pointer, complete with its directional
   * stamp and edge chevrons. Checkpoint/completion shells render
   * without it, so they can never be dragged.
   */
  swipe?: {
    dragX: number;
    isDragging: boolean;
    cardRef: React.RefObject<HTMLDivElement>;
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
    stamp: 'skip' | 'next' | 'back' | null;
    stampOpacity: number;
  };
}) {
  return (
    <div className="relative w-full h-[392px]">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[28px] bg-white border border-slate-200 shadow-md -rotate-2 translate-y-1"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[28px] bg-white border border-slate-200 shadow-md rotate-[1.5deg] translate-y-0.5"
      />
      {swipe ? (
        <div
          ref={swipe.cardRef}
          onPointerDown={swipe.onPointerDown}
          onPointerMove={swipe.onPointerMove}
          onPointerUp={swipe.onPointerEnd}
          onPointerCancel={swipe.onPointerEnd}
          style={{
            transform: `translateX(${swipe.dragX}px) rotate(${
              swipe.dragX * 0.03
            }deg)`,
            touchAction: 'pan-y',
            cursor: swipe.isDragging ? 'grabbing' : 'grab',
          }}
          className={`relative h-full rounded-[28px] bg-white border border-slate-200 shadow-xl select-none ${
            swipe.isDragging ? '' : 'transition-transform duration-200'
          }`}
        >
          {/* Persistent drag hint: quiet chevrons at the card's
              side edges, vertical center. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 z-10 text-2xl font-black leading-none text-slate-300/70"
          >
            ‹
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 z-10 text-2xl font-black leading-none text-slate-300/70"
          >
            ›
          </span>
          {/* Directional stamps: SKIP/NEXT ride the top-LEFT corner
              (opposite a leftward drag), BACK the top-right. Their
              opacity is proportional to drag distance (computed by
              the parent), and only the stamp for the current drag
              direction renders. */}
          {swipe.stamp === 'skip' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute top-4 left-4 z-20 -rotate-12 rounded-lg border-[3px] border-orange-500 px-2.5 py-1 text-lg font-black uppercase tracking-widest text-orange-500 bg-white/70"
            >
              Skip
            </span>
          )}
          {swipe.stamp === 'next' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute top-4 left-4 z-20 -rotate-12 rounded-lg border-[3px] border-slate-500 px-2.5 py-1 text-lg font-black uppercase tracking-widest text-slate-600 bg-white/70"
            >
              Next
            </span>
          )}
          {swipe.stamp === 'back' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute top-4 right-4 z-20 rotate-12 rounded-lg border-[3px] border-[#0072CE] px-2.5 py-1 text-lg font-black uppercase tracking-widest text-[#0072CE] bg-white/70"
            >
              Back
            </span>
          )}
          {children}
        </div>
      ) : (
        <div className="relative h-full rounded-[28px] bg-white border border-slate-200 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Step1Deck({
  triageMap,
  orderedSongs,
  sections,
  handleSetBucket,
  handleFinishTriage,
  onSwitchToList,
}: {
  triageMap: Record<string, TriageValue>;
  orderedSongs: Song[];
  sections: TriageSection[];
  handleSetBucket: (id: string, bucket: TriageValue) => void;
  handleFinishTriage: () => void;
  onSwitchToList: () => void;
}) {
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [checkpointPending, setCheckpointPending] = useState(false);
  const [checkpointDismissed, setCheckpointDismissed] = useState(false);

  // "Don't show again this session" survives toggling to the list and
  // back (which remounts the deck), so it lives in sessionStorage.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CHECKPOINT_DISMISSED_KEY) === '1') {
        setCheckpointDismissed(true);
      }
    } catch {
      /* sessionStorage unavailable — checkpoint just stays session-local */
    }
  }, []);

  const categorizedCount = countCategorizedSongs(triageMap);
  const bucketedCount = countBucketedSongs(triageMap);
  const total = FULL_SONG_POOL.length;
  const progressPercent = Math.round((categorizedCount / total) * 100);
  const isComplete = categorizedCount === total;
  const songsToWrapped = Math.max(0, WRAPPED_SHORT_PATH_GOAL - bucketedCount);

  const firstUncategorized = (map: Record<string, TriageValue>): Song | null =>
    orderedSongs.find((s) => map[s.id] === undefined) ?? null;

  const nextUncategorizedAfter = (
    map: Record<string, TriageValue>,
    afterId: string
  ): Song | null => {
    const idx = orderedSongs.findIndex((s) => s.id === afterId);
    for (let i = idx + 1; i < orderedSongs.length; i++) {
      if (map[orderedSongs[i].id] === undefined) return orderedSongs[i];
    }
    for (let i = 0; i <= idx; i++) {
      if (map[orderedSongs[i].id] === undefined) return orderedSongs[i];
    }
    return null;
  };

  const cursorSong = cursorId
    ? orderedSongs.find((s) => s.id === cursorId) ?? null
    : null;
  const currentSong = cursorSong ?? firstUncategorized(triageMap);

  const act = (value: TriageValue) => {
    if (!currentSong || checkpointPending) return;
    const song = currentSong;
    handleSetBucket(song.id, value);
    setHistory((h) => [...h, song.id]);

    // Advance against the prospective map — the context update hasn't
    // rendered yet, but the acted song must not be re-offered.
    const prospective: Record<string, TriageValue> = {
      ...triageMap,
      [song.id]: value,
    };
    const next = nextUncategorizedAfter(prospective, song.id);
    setCursorId(next ? next.id : null);

    // Checkpoint: this action crosses the front-section boundary
    // (Blue + Pinkerton + Singles) with the Wrapped short-path met.
    const newCategorized = countCategorizedSongs(prospective);
    const newBucketed = countBucketedSongs(prospective);
    if (
      !checkpointDismissed &&
      categorizedCount < FRONT_SECTION_SIZE &&
      newCategorized >= FRONT_SECTION_SIZE &&
      newBucketed >= WRAPPED_SHORT_PATH_GOAL
    ) {
      setCheckpointPending(true);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const lastId = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCheckpointPending(false);
    setCursorId(lastId);
  };

  // SWIPE — hand-rolled pointer drag on the song card (no library).
  // Buttons remain the primary path; a committed swipe funnels into
  // the SAME act()/undo() the buttons use, so history, checkpoint
  // logic and advance rules live in exactly one place:
  //   commit left, song unrated → act('skip')  ("as good as a skip")
  //   commit left, song rated   → advance only, rating kept — done by
  //     re-acting the song's existing value: act() re-sets the same
  //     bucket, pushes history, advances and recomputes the
  //     checkpoint exactly as a button tap on that bucket would.
  //   commit right              → undo()
  // The card element carries `touch-action: pan-y` (see
  // DeckCardShell), so vertical scrolls belong to the page and only
  // horizontal-dominant drags are captured here.
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    locked: boolean;
  } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // A song change (advance, jump, undo, mode remount) ends any drag
  // and resets the transform — the next card renders in place.
  const currentSongId = currentSong?.id ?? null;
  useEffect(() => {
    dragRef.current = null;
    setDragX(0);
    setIsDragging(false);
  }, [currentSongId, checkpointPending, isComplete]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Never steal a drag that starts on the preview button or any
    // other interactive element inside the card.
    if (
      (e.target as HTMLElement).closest(
        'button, a, input, select, textarea, [data-no-swipe]'
      )
    ) {
      return;
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      locked: false,
    };
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.locked) {
      // Direction lock: only take over horizontal-dominant drags;
      // anything else (vertical scroll, a tap) is released for
      // good, so the gesture never fights the page.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      drag.locked = true;
      setIsDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort; coordinates still track */
      }
    }
    setDragX(dx);
  };

  const handleCardPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (!drag.locked || !currentSong) {
      setDragX(0);
      return;
    }
    const width = cardRef.current?.offsetWidth ?? 0;
    const threshold = Math.max(
      COMMIT_MIN_PX,
      width * SWIPE_COMMIT_RATIO
    );
    const dx = dragX;
    setDragX(0);
    if (dx <= -threshold) {
      // Swipe left = move on. Unrated: a swipe IS a skip. Rated:
      // keep the rating and advance the same way a tap on its
      // current bucket would (act re-sets the identical value).
      const existing = triageMap[currentSong.id];
      if (existing === undefined) {
        act('skip');
      } else {
        act(existing);
      }
    } else if (dx >= threshold) {
      // Swipe right = go back (a no-op snap-back when there's no
      // history, since undo() guards on an empty stack).
      undo();
    }
    // Below threshold: dragX reset + the shell's transition class
    // animates the card back to rest.
  };

  // Stamp state, derived from the live drag distance. SKIP shows
  // only when moving on would actually record a skip; a rated song
  // gets NEXT instead. BACK mirrors the Undo affordance and only
  // appears when there's history to go back to.
  const stampKind: 'skip' | 'next' | 'back' | null =
    dragX <= -STAMP_FADE_PX
      ? currentSong && triageMap[currentSong.id] === undefined
        ? 'skip'
        : 'next'
      : dragX >= STAMP_FADE_PX && history.length > 0
      ? 'back'
      : null;
  const stampOpacity = Math.min(
    1,
    Math.abs(dragX) / (COMMIT_MIN_PX * 1.5)
  );

  const jumpToSection = (sectionKey: string) => {
    const section = sections.find((s) => s.key === sectionKey);
    if (!section || section.songs.length === 0) return;
    const target =
      section.songs.find((s) => triageMap[s.id] === undefined) ??
      section.songs[0];
    setCheckpointPending(false);
    setCursorId(target.id);
  };

  const dismissCheckpoint = () => {
    setCheckpointPending(false);
    setCheckpointDismissed(true);
    try {
      window.sessionStorage.setItem(CHECKPOINT_DISMISSED_KEY, '1');
    } catch {
      /* state flag above still covers this mount */
    }
  };

  // Keyboard: 1–5 pick the buckets in displayed order, U undoes.
  // Ignored while typing in a form field or when a modal state
  // (checkpoint / completion) owns the screen.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (checkpointPending || isComplete) return;
      if (e.key >= '1' && e.key <= '5') {
        act(BUCKET_ORDER[Number(e.key) - 1]);
      } else if (e.key === 'u' || e.key === 'U') {
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // act/undo close over current state; re-binding per render keeps
    // them fresh (the listener is cheap to re-attach).
  });

  const renderBucketButton = (bucket: BucketType) => {
    const activeBucket = currentSong ? triageMap[currentSong.id] : undefined;
    const isSelected = activeBucket === bucket;
    const cfg = BUCKET_CONFIG[bucket];
    const displayLabel = bucket === 'slaps' ? 'Slaps' : cfg.label;

    // The mock's bucket tiles: white, thin slate border, the bucket's
    // glyph large on top and its label underneath. The selected tile
    // keeps the deck's sky-400 family as a border/ring treatment.
    return (
      <button
        key={bucket}
        onClick={() => act(bucket)}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-3 [@media(max-height:740px)]:py-2 shadow-sm transition-all cursor-pointer ${
          isSelected
            ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
        title={displayLabel}
      >
        <span className="text-[26px] [@media(max-height:740px)]:text-[22px] leading-none">
          {cfg.emoji}
        </span>
        <span className="text-[13px] font-bold text-slate-800 leading-tight">
          {displayLabel}
        </span>
      </button>
    );
  };

  const inSongState = !checkpointPending && !isComplete && !!currentSong;

  // Title size steps down as titles get longer, so a long title wraps
  // to two lines at a readable size instead of eating the card.
  const titleLength = currentSong?.title.length ?? 0;
  const titleSizeClass =
    titleLength <= 12
      ? 'text-5xl sm:text-6xl'
      : titleLength <= 20
      ? 'text-[34px] sm:text-5xl'
      : titleLength <= 32
      ? 'text-[30px] sm:text-4xl'
      : 'text-2xl sm:text-[34px]';

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full max-w-[560px] mx-auto px-4">
      {/* COMPACT PROGRESS — one line + a slim bar. Same counts as the
          list header (categorizedCount / bucketedCount), so the two
          views always agree; the deck's old full counters block and
          Flying-W bar are replaced by this. */}
      <div className="shrink-0 pt-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-[11px] font-black text-slate-700">
          <span className="uppercase tracking-wider">
            Song{' '}
            <strong className="text-[#0072CE] text-xs">
              {isComplete ? total : Math.min(categorizedCount + 1, total)}
            </strong>{' '}
            of {total}
            {songsToWrapped > 0 ? (
              <span className="normal-case tracking-normal font-bold text-slate-500">
                {' '}
                · {songsToWrapped} more to your Wrapped
              </span>
            ) : (
              <span className="normal-case tracking-normal font-bold text-[#0072CE]">
                {' '}
                · Wrapped unlocked ✓
              </span>
            )}
          </span>
          <span className="text-[#0072CE] text-xs shrink-0">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0072CE] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* CARD REGION — flex-1 and centered; the checkpoint and
          completion states replace the card right here, at the same
          fixed height. */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-2">
        {checkpointPending ? (
          <DeckCardShell>
            <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-5">
              <div className="text-4xl">🎉</div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                You&apos;ve sorted the big ones
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                The Blue Album, Pinkerton, and all the big singles are done
                — and you&apos;ve got enough ranked for your Wrapped
                whenever you want it. The deep cuts will still be here.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  onClick={handleFinishTriage}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
                >
                  <FlyingWIcon className="w-6 h-4 text-slate-950" />
                  <span>See your Wrapped</span>
                </button>
                <button
                  onClick={dismissCheckpoint}
                  className="text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-6 py-3.5 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
                >
                  Keep going
                </button>
              </div>
            </div>
          </DeckCardShell>
        ) : isComplete || !currentSong ? (
          /* COMPLETION — every song categorized (the same count the
             list's "Categorize All Songs" lock runs on). */
          <DeckCardShell>
            <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-5">
              <div className="text-4xl">🏆</div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                All {total} songs sorted
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                Every song has a verdict. Time to refine the buckets and see
                where they land.
              </p>
              <button
                onClick={handleFinishTriage}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 inline-flex items-center gap-2.5 whitespace-nowrap"
              >
                <FlyingWIcon className="w-6 h-4 text-slate-950" />
                <span>Next Step: Refine Buckets</span>
              </button>
            </div>
          </DeckCardShell>
        ) : (
          /* THE CARD — the owner's reference mock: centered stack of
             art, huge title, "Album (Year)", and the big preview
             button, every element in a FIXED-height slot (see the
             budget on DeckCardShell). The layout is therefore
             identical for one-line and two-line titles, and the
             preview button — the last slot — can never be pushed
             off the card. The already-rated note rides on the card's
             top edge as a badge, so it never adds layout height. */
          <DeckCardShell
            swipe={{
              dragX,
              isDragging,
              cardRef,
              onPointerDown: handleCardPointerDown,
              onPointerMove: handleCardPointerMove,
              onPointerEnd: handleCardPointerEnd,
              stamp: stampKind,
              stampOpacity,
            }}
          >
            <div className="relative h-full flex flex-col items-center text-center px-5 py-5 gap-3">
              {triageMap[currentSong.id] !== undefined && (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                  {triageMap[currentSong.id] === 'unknown'
                    ? '✓ You marked this Don’t Know It — tap a tier to rate it'
                    : `✓ You marked this ${
                        BUCKET_CONFIG[triageMap[currentSong.id] as BucketType]
                          .label
                      } — tap a tier to change it`}
                </p>
              )}
              {/* ART — a fixed 128px slot; it no longer flexes or
                  shrinks to make room for the title. */}
              <div className="h-32 w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(resolveAlbumId(currentSong))}
                  alt={`${currentSong.album} cover art`}
                  className="h-32 w-32 object-cover rounded-xl shadow-md border border-slate-100"
                />
              </div>
              {/* TITLE — a fixed two-line slot. line-clamp-2 caps the
                  title at two lines, so it can never outgrow the
                  slot; a one-line title centers in it and leaves the
                  second line's space empty. */}
              <div className="h-[104px] w-full flex items-center justify-center">
                <h2
                  className={`${titleSizeClass} font-black tracking-tight text-slate-950 leading-[1.05] break-words line-clamp-2`}
                >
                  {currentSong.title}
                </h2>
              </div>
              <p className="text-sm font-bold text-slate-400">
                {currentSong.album} ({currentSong.year})
              </p>
              {/* The list rows' preview button, exact same component
                  and styling — only bigger (large = 64px), pinned in
                  the card's last slot. */}
              <AudioPreviewButton title={currentSong.title} large />
            </div>
          </DeckCardShell>
        )}
      </div>

      {/* ACTIONS — pinned at the bottom of the column: the mock's
          light tray holds ONLY the five tier tiles; Don't Know It
          moved out to one quiet centered line below the tray
          (owner, Oct 16); the Undo / Jump row beneath that now
          also carries the Deck | List toggle on the same line. */}
      {inSongState && (
        <div className="shrink-0">
          <div className="bg-slate-100 border border-slate-200/60 rounded-3xl shadow-sm p-3 [@media(max-height:740px)]:p-2.5">
            <div className="flex gap-1.5 sm:gap-2">
              {BUCKET_ORDER.map(renderBucketButton)}
            </div>
          </div>
          {/* DON'T KNOW IT — one quiet centered text button directly
              below the tray; still a single tap through act(), and
              still visibly active when the song is marked unknown. */}
          <div className="text-center pt-1.5">
            <button
              onClick={() => act('unknown')}
              className={`text-sm px-4 py-1 rounded-full transition-all cursor-pointer ${
                triageMap[currentSong.id] === 'unknown'
                  ? 'text-[#0072CE] font-bold'
                  : 'text-slate-500 font-medium hover:text-slate-800'
              }`}
              title="I haven't heard this song — don't rate it"
            >
              Don&apos;t Know It
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="shrink-0 text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm px-5 py-2 transition-all enabled:hover:bg-slate-50 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↩ Undo
            </button>
            <div className="relative flex-1 min-w-0">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) jumpToSection(e.target.value);
                }}
                className="w-full appearance-none text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm pl-4 pr-9 py-2 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0072CE]"
                aria-label="Jump to album"
              >
                <option value="" disabled>
                  Jump to album…
                </option>
                {sections.map((section) => {
                  const sortedInSection = section.songs.filter(
                    (s) => triageMap[s.id]
                  ).length;
                  return (
                    <option key={section.key} value={section.key}>
                      {section.title} ({sortedInSection}/{section.songs.length})
                    </option>
                  );
                })}
              </select>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {/* DECK | LIST TOGGLE — rides in the Undo/Jump row now
                (owner, Oct 16): same white pill with the blue active
                segment, shrunk to share one line. In list mode the
                toggle stays up in the header instead. */}
            <div className="inline-flex shrink-0 bg-white border border-slate-200 rounded-full p-1 shadow-sm">
              <button
                className="px-3.5 py-1.5 rounded-full text-sm font-bold bg-[#0072CE] text-white shadow-sm"
                aria-current="true"
              >
                Deck
              </button>
              <button
                onClick={onSwitchToList}
                className="px-3.5 py-1.5 rounded-full text-sm font-bold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              >
                List
              </button>
            </div>
          </div>
          <p className="hidden sm:block text-center text-[10px] font-semibold text-slate-300 pt-1.5">
            Keys 1–5 pick a tier · U undoes
          </p>
        </div>
      )}

      {/* CHECKPOINT / COMPLETION FOOTER — there's no actions block
          in those states, but the toggle still needs a home: the
          same inline pill, centered at the column bottom. */}
      {!inSongState && (
        <div className="shrink-0 flex justify-center pb-3">
          <div className="inline-flex bg-white border border-slate-200 rounded-full p-1 shadow-sm">
            <button
              className="px-3.5 py-1.5 rounded-full text-sm font-bold bg-[#0072CE] text-white shadow-sm"
              aria-current="true"
            >
              Deck
            </button>
            <button
              onClick={onSwitchToList}
              className="px-3.5 py-1.5 rounded-full text-sm font-bold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
