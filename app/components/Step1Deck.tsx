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
 * can never disagree about the sequence.
 *
 * ONE-SCREEN LAYOUT (owner feedback): Step1Triage hands this component
 * a column at least one viewport tall (100dvh minus the sticky
 * AppShell header, as a MIN height) and the deck fills it as a flex
 * column: compact progress line → the fixed-height card (centered in
 * the remaining space) → the tray of tier tiles → one quiet Don't
 * Know It line → the Jump / Deck|List row. On tall phones
 * everything fits one screen; on short ones the page scrolls a
 * little — the owner accepted that in exchange for a song card tall
 * enough to hold a two-line title without pushing the preview button
 * off it. The checkpoint, completion and end-of-deck states replace
 * the card inside the same column, at the same fixed height.
 *
 * NAVIGATION MODEL (owner correction, Oct 16): the deck is a
 * BROWSER, not a funnel. `position` is a plain index into
 * orderedSongs (0..205), plus one past the end (206) for the
 * end-of-deck card. Until the user first navigates, position is
 * unset and the deck shows the first uncategorized song (so it
 * resumes where the work is, and self-corrects if the triage map
 * loads in late). Sorting a card records the verdict and advances
 * to position+1 — the NEXT card, sorted or not. Jump goes to a
 * section's FIRST song. Swipe right / the U key step back one.
 * There is no history stack and no undo-as-navigation: because the
 * deck is browsable, every card shows its own state (the
 * already-rated badge and the selected tile for a sorted song; a
 * muted "Not Sorted" badge for a passed one — see below).
 *
 * SWIPE = PURE NAVIGATION (owner correction, Oct 16): a swipe NEVER
 * writes a rating. Sorting a song as Skip is a judgment; swiping
 * past a song is not sorting it at all — the same Tier 1 principle
 * behind Don't Know It (an unjudged song must never be recorded as
 * a rating). Leaving an UNSORTED song via a committed forward
 * swipe marks it in the session-only `passedIds` set, which drives
 * its "Not Sorted" badge on revisit and the end card's unsorted
 * count; sorting it later clears the mark. Don't Know It counts as
 * SORTED (a deliberate disposition, value 'unknown') — passing is
 * only for songs with NO triageMap entry. Dragging shows a stamp
 * over the album art: NOT SORTED (unsorted song, forward), NEXT
 * (sorted song, forward), BACK (either way back). The Skip stamp
 * is gone from swiping entirely — Skip is reachable only via its
 * tile.
 *
 * ANIMATION: a committed swipe flies the card off-screen BEFORE
 * the position changes — the state never advances early — and a
 * button sort flips the card edge-on, swaps the song at the
 * midpoint, and flips back. The stamps sit centered over the album
 * art (the old corner stamps rotated off-screen first and were
 * hard to see). The Undo BUTTON is gone (owner) — swipe right and
 * the U key are the ways back.
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

// Swipe: dragging the card horizontally browses the deck — left
// advances one card, right goes back one (see the navigation model
// above; a swipe never writes). The stamp fades in from
// STAMP_FADE_PX and the gesture commits at max(COMMIT_MIN_PX,
// SWIPE_COMMIT_RATIO × card width).
const STAMP_FADE_PX = 40;
const COMMIT_MIN_PX = 80;
const SWIPE_COMMIT_RATIO = 0.25;

// Animation timing: a committed swipe flies the card off-screen
// over EXIT_MS before its navigation runs; a button sort flips
// the card edge-on (FLIP_OUT_MS), swaps the song at the midpoint,
// and flips back (FLIP_IN_MS). SNAP_MS is the transition-less beat
// that lets a flown-off card's replacement appear in place instead
// of sliding in from off-screen.
const EXIT_MS = 260;
const FLIP_OUT_MS = 150;
const FLIP_IN_MS = 150;
const SNAP_MS = 40;

/**
 * Card animation phases. 'idle' covers both resting and actively
 * dragging (the drag transform is driven by dragX, not the phase).
 * 'exit' flies the card off-screen; 'snap' is the one-beat
 * transition-less reset that follows an exit; 'flip-out' /
 * 'flip-in' are the two halves of the button-sort flip.
 */
type CardAnimPhase = 'idle' | 'exit' | 'snap' | 'flip-out' | 'flip-in';

/**
 * The card from the owner's reference mock, with a stacked-deck
 * effect: two backing cards peek out behind the real one, rotated a
 * couple of degrees — pure CSS, no images. The face wears a soft
 * brand-blue tint (owner: try a color instead of white); the two
 * backing layers stay white for contrast. The shell is a FIXED
 * height — it never grows or shrinks with content — so a song title
 * can never push the preview button off the card; the checkpoint,
 * completion and end-of-deck states render inside the same shell
 * at the same height.
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
   * Song state (and the end-of-deck card): makes the front card
   * draggable (see the swipe block in Step1Deck). The backing
   * layers stay put — only the front card follows the pointer,
   * complete with its directional stamp (centered over the album
   * art) and edge chevrons. Checkpoint/completion shells render
   * without it, so they can never be dragged. `phase`/`exitX`
   * drive the exit and flip animations (see the ANIMATION block
   * in Step1Deck).
   */
  swipe?: {
    dragX: number;
    isDragging: boolean;
    cardRef: React.RefObject<HTMLDivElement>;
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
    stamp: 'notsorted' | 'next' | 'back' | null;
    stampOpacity: number;
    phase: CardAnimPhase;
    exitX: number;
  };
}) {
  // The front card's transform/transition are phase-driven: it
  // follows the pointer while dragging, springs back over 200ms on
  // a below-threshold release, flies off-screen on a committed
  // swipe ('exit'), resets without a transition ('snap'), and
  // flips edge-on and back for a button sort ('flip-out'/'flip-in'
  // — the shell root carries the perspective that sells the flip).
  const cardTransform =
    swipe === undefined || swipe.phase === 'idle'
      ? swipe === undefined
        ? undefined
        : `translateX(${swipe.dragX}px) rotate(${swipe.dragX * 0.03}deg)`
      : swipe.phase === 'exit'
      ? `translateX(${swipe.exitX}px) rotate(${swipe.dragX * 0.03}deg)`
      : swipe.phase === 'flip-out'
      ? 'rotateY(90deg)'
      : 'rotateY(0deg)';
  const cardTransition =
    swipe === undefined || swipe.phase === 'snap' || swipe.isDragging
      ? 'none'
      : swipe.phase === 'exit'
      ? `transform ${EXIT_MS}ms ease-in`
      : swipe.phase === 'flip-out'
      ? `transform ${FLIP_OUT_MS}ms ease-in`
      : swipe.phase === 'flip-in'
      ? `transform ${FLIP_IN_MS}ms ease-out`
      : 'transform 200ms ease';
  return (
    <div className="relative w-full h-[392px] [perspective:1200px]">
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
            transform: cardTransform,
            transition: cardTransition,
            touchAction: 'pan-y',
            cursor: swipe.isDragging ? 'grabbing' : 'grab',
          }}
          className="relative h-full rounded-[28px] bg-[#e8f2fc] border border-slate-200 shadow-xl select-none"
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
          {/* Directional stamps: all three are CENTERED OVER THE
              ALBUM ART (owner: the old corner stamps rotated
              off-screen first and were hard to see). top-[84px] is
              the art slot's vertical center — the content's py-5
              (20px) plus half the h-32 art slot (64px). Opacity is
              proportional to drag distance (computed by the
              parent), and only the stamp for the current drag
              direction renders. NOT SORTED is the stamp motif in
              neutral slate — swiping past an unsorted song sorts
              nothing, and the stamp says exactly that. */}
          {swipe.stamp === 'notsorted' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute left-1/2 top-[84px] z-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-[3px] border-slate-500 px-2.5 py-1 text-base font-black uppercase tracking-widest text-slate-600 bg-white/70"
            >
              Not Sorted
            </span>
          )}
          {swipe.stamp === 'next' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute left-1/2 top-[84px] z-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-[3px] border-slate-500 px-2.5 py-1 text-lg font-black uppercase tracking-widest text-slate-600 bg-white/70"
            >
              Next
            </span>
          )}
          {swipe.stamp === 'back' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute left-1/2 top-[84px] z-20 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-lg border-[3px] border-[#0072CE] px-2.5 py-1 text-lg font-black uppercase tracking-widest text-[#0072CE] bg-white/70"
            >
              Back
            </span>
          )}
          {children}
        </div>
      ) : (
        <div className="relative h-full rounded-[28px] bg-[#e8f2fc] border border-slate-200 shadow-xl">
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
  // NAVIGATION — a plain position index into orderedSongs, not a
  // funnel. Null = "not yet navigated": the deck then shows the
  // first uncategorized song (see effectivePosition below). One
  // past the last index is the end-of-deck card.
  const [position, setPosition] = useState<number | null>(null);
  // Session-only marks for songs the user swiped past while they
  // were unsorted. React state only — never persisted, never
  // written to the triage map.
  const [passedIds, setPassedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
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
  const deckLength = orderedSongs.length;
  const progressPercent = Math.round((categorizedCount / total) * 100);
  const isComplete = categorizedCount === total;
  const songsToWrapped = Math.max(0, WRAPPED_SHORT_PATH_GOAL - bucketedCount);

  const firstUncatIdx = orderedSongs.findIndex(
    (s) => triageMap[s.id] === undefined
  );
  const effectivePosition =
    position ?? (firstUncatIdx === -1 ? deckLength : firstUncatIdx);
  const atEnd = effectivePosition >= deckLength;
  const currentSong = atEnd ? null : orderedSongs[effectivePosition] ?? null;

  // Passed songs that are STILL unsorted (sorting one clears its
  // mark in act(), but the map is the source of truth here).
  const firstPassedUnsortedIdx = orderedSongs.findIndex(
    (s) => passedIds.has(s.id) && triageMap[s.id] === undefined
  );
  const passedUnsortedCount = orderedSongs.reduce(
    (n, s) => (passedIds.has(s.id) && triageMap[s.id] === undefined ? n + 1 : n),
    0
  );

  const act = (value: TriageValue) => {
    if (!currentSong || checkpointPending) return;
    const song = currentSong;
    const idx = effectivePosition;
    handleSetBucket(song.id, value);

    // Sorting a passed song clears its passed mark — it has a
    // verdict now.
    setPassedIds((prev) => {
      if (!prev.has(song.id)) return prev;
      const next = new Set(prev);
      next.delete(song.id);
      return next;
    });

    // Advance to the NEXT card — plain position+1, sorted or not.
    // (At the last card this lands on the end-of-deck card, or the
    // completion card if that was the final unsorted song.)
    setPosition(idx + 1);

    // Checkpoint: this action crosses the front-section boundary
    // (Blue + Pinkerton + Singles) with the Wrapped short-path met.
    // Computed against the prospective map — the context update
    // hasn't rendered yet.
    const prospective: Record<string, TriageValue> = {
      ...triageMap,
      [song.id]: value,
    };
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

  // Step back one card. From the end card this returns to the last
  // song; at position 0 it's a no-op.
  const goBack = () => {
    if (effectivePosition > 0) {
      setPosition(effectivePosition - 1);
    }
  };

  // SWIPE — hand-rolled pointer drag on the song card (no library).
  // Buttons remain the primary SORTING path; a swipe only ever
  // NAVIGATES (see the model at the top of the file):
  //   commit left  → position+1. If the song being left is
  //     unsorted, it's marked passed (badge + end-card count) —
  //     nothing is written to the triage map.
  //   commit right → position−1 (same as the U key).
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

  // ANIMATION — phases sequence around act()/navigation so the
  // state NEVER advances before its animation says so:
  //   exit: the card flies off-screen over EXIT_MS; only then does
  //     the pending navigation/sort run, followed by one 'snap'
  //     beat with transitions off so the next card appears in
  //     place.
  //   flip: a button sort flips the card edge-on over FLIP_OUT_MS;
  //     act() runs at the midpoint (the content swaps while the
  //     card is edge-on and invisible), then it flips back over
  //     FLIP_IN_MS.
  // While phase !== 'idle', pointer drags, button taps, jumps and
  // keys are all ignored. Timers are tracked and cleared on
  // unmount (e.g. toggling to the list mid-animation cancels the
  // pending action rather than firing it into a hidden view).
  const [phase, setPhase] = useState<CardAnimPhase>('idle');
  const [exitX, setExitX] = useState(0);
  const timersRef = useRef<number[]>([]);
  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Fly the card off-screen in `dir`, THEN run `action` (a sort or
  // a navigation step) and snap-reset for the next card.
  const exitTo = (dir: -1 | 1, action: () => void) => {
    if (phase !== 'idle') return;
    const width = cardRef.current?.offsetWidth ?? 320;
    setExitX(dir * (width + 80));
    setPhase('exit');
    schedule(() => {
      action();
      setDragX(0);
      setPhase('snap');
      schedule(() => setPhase('idle'), SNAP_MS);
    }, EXIT_MS);
  };

  // Flip the card edge-on, run act(value) at the midpoint, flip
  // back. Used by the bucket tiles, Don't Know It, and keys 1–5 —
  // every "sort via a control" path gets the same transition.
  const flipAct = (value: TriageValue) => {
    if (phase !== 'idle' || !currentSong || checkpointPending) return;
    setPhase('flip-out');
    schedule(() => {
      act(value);
      setPhase('flip-in');
      schedule(() => setPhase('idle'), FLIP_IN_MS);
    }, FLIP_OUT_MS);
  };

  // A position/state change (advance, jump, step back, mode
  // remount) ends any drag and resets the transform — the next
  // card renders in place.
  useEffect(() => {
    dragRef.current = null;
    setDragX(0);
    setIsDragging(false);
  }, [effectivePosition, checkpointPending, isComplete]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle') return;
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
    if (!drag.locked) {
      setDragX(0);
      return;
    }
    const width = cardRef.current?.offsetWidth ?? 0;
    const threshold = Math.max(
      COMMIT_MIN_PX,
      width * SWIPE_COMMIT_RATIO
    );
    const dx = dragX;
    if (atEnd) {
      // END CARD — it can't be swiped forward (there's nothing
      // past it); a committed right swipe flies back to the last
      // song. Anything else springs back.
      if (dx >= threshold) {
        exitTo(1, () => setPosition(deckLength - 1));
      } else {
        setDragX(0);
      }
      return;
    }
    if (!currentSong) {
      setDragX(0);
      return;
    }
    if (dx <= -threshold) {
      // Swipe left = next card — but NOT yet: the card first
      // flies off-screen (exitTo), and the position changes only
      // as it lands. Pure navigation: no setter is called. If
      // the song being left has no verdict, mark it passed (the
      // NOT SORTED stamp rode the card out) so it wears the badge
      // on revisit and counts on the end card.
      const song = currentSong;
      const idx = effectivePosition;
      const wasUnsorted = triageMap[song.id] === undefined;
      exitTo(-1, () => {
        if (wasUnsorted) {
          setPassedIds((prev) => {
            if (prev.has(song.id)) return prev;
            const next = new Set(prev);
            next.add(song.id);
            return next;
          });
        }
        setPosition(idx + 1);
      });
    } else if (dx >= threshold) {
      // Swipe right = one card back, with the same fly-off. At
      // position 0 there's nowhere to fly to: plain snap-back.
      if (effectivePosition > 0) {
        exitTo(1, () => setPosition(effectivePosition - 1));
      } else {
        setDragX(0);
      }
    } else {
      // Below threshold: dragX reset + the shell's spring-back
      // transition animates the card back to rest.
      setDragX(0);
    }
  };

  // Stamp state, derived from the live drag distance. Forward on
  // an unsorted song shows NOT SORTED (nothing is being recorded —
  // the song is only being passed); forward on a sorted song
  // shows NEXT; back shows BACK whenever there's a card to go
  // back to (from the end card, always).
  const stampKind: 'notsorted' | 'next' | 'back' | null =
    dragX <= -STAMP_FADE_PX
      ? !atEnd && currentSong && triageMap[currentSong.id] === undefined
        ? 'notsorted'
        : !atEnd
        ? 'next'
        : null
      : dragX >= STAMP_FADE_PX && effectivePosition > 0
      ? 'back'
      : null;
  const stampOpacity = Math.min(
    1,
    Math.abs(dragX) / (COMMIT_MIN_PX * 1.5)
  );

  const jumpToSection = (sectionKey: string) => {
    // A jump mid-animation would fight the pending navigation for
    // the position — the window is a few hundred ms; ignore it.
    if (phase !== 'idle') return;
    const section = sections.find((s) => s.key === sectionKey);
    if (!section || section.songs.length === 0) return;
    // Plain first song of the section — the deck is a browser, so
    // a jump lands on the section's start whether or not its
    // songs are sorted yet.
    const idx = orderedSongs.findIndex((s) => s.id === section.songs[0].id);
    if (idx === -1) return;
    setCheckpointPending(false);
    setPosition(idx);
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

  // Keyboard: 1–5 pick the buckets in displayed order (sort the
  // current card, with the flip), U steps back one card. Ignored
  // while typing in a form field or when a modal state
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
      if (phase !== 'idle') return;
      if (e.key >= '1' && e.key <= '5') {
        flipAct(BUCKET_ORDER[Number(e.key) - 1]);
      } else if (e.key === 'u' || e.key === 'U') {
        goBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // act/goBack close over current state; re-binding per render
    // keeps them fresh (the listener is cheap to re-attach).
  });

  const renderBucketButton = (bucket: BucketType) => {
    const activeBucket = currentSong ? triageMap[currentSong.id] : undefined;
    const isSelected = activeBucket === bucket;
    const cfg = BUCKET_CONFIG[bucket];
    const displayLabel = bucket === 'slaps' ? 'Slaps' : cfg.label;

    // The mock's bucket tiles: white, thin slate border, the bucket's
    // glyph large on top and its label underneath. The selected tile
    // keeps the deck's sky-400 family as a border/ring treatment —
    // and because the deck is browsable, it always reflects the
    // CURRENT card's verdict.
    return (
      <button
        key={bucket}
        onClick={() => flipAct(bucket)}
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

  // Shared swipe wiring for the two draggable shells (song card
  // and end card).
  const swipeProps = {
    dragX,
    isDragging,
    cardRef,
    onPointerDown: handleCardPointerDown,
    onPointerMove: handleCardPointerMove,
    onPointerEnd: handleCardPointerEnd,
    stamp: stampKind,
    stampOpacity,
    phase,
    exitX,
  };

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

      {/* CARD REGION — flex-1 and centered; the checkpoint,
          completion and end-of-deck states replace the card right
          here, at the same fixed height. */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center py-2">
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
        ) : isComplete ? (
          /* COMPLETION — every song categorized (the same count the
             list's "Categorize All Songs" lock runs on). Takes
             precedence over the end card: a fully sorted deck has
             nothing left to review. */
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
        ) : atEnd ? (
          /* END OF DECK — one past the last card. The shell stays
             draggable so a right swipe flies back to the last song;
             it can't be swiped forward. Passed-but-unsorted songs
             get their count and a review jump; a fully sorted deck
             never lands here (the completion card above wins). */
          <DeckCardShell swipe={swipeProps}>
            <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-5">
              <div className="text-4xl">🎴</div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                That&apos;s the whole deck
              </h2>
              {passedUnsortedCount > 0 ? (
                <>
                  <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                    {passedUnsortedCount}{' '}
                    {passedUnsortedCount === 1 ? 'song is' : 'songs are'}{' '}
                    still not sorted — you swiped past{' '}
                    {passedUnsortedCount === 1 ? 'it' : 'them'} without a
                    verdict.
                  </p>
                  <button
                    onClick={() => {
                      if (firstPassedUnsortedIdx !== -1) {
                        setPosition(firstPassedUnsortedIdx);
                      }
                    }}
                    className="bg-[#0072CE] hover:bg-[#005fae] text-white font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer whitespace-nowrap"
                  >
                    Review the unsorted
                  </button>
                </>
              ) : (
                <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                  You&apos;ve seen every card. Swipe back through any of
                  them to change a verdict.
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  onClick={goBack}
                  className="text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-6 py-3.5 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
                >
                  ← Back to the last card
                </button>
                {bucketedCount >= WRAPPED_SHORT_PATH_GOAL && (
                  <button
                    onClick={handleFinishTriage}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
                  >
                    <FlyingWIcon className="w-6 h-4 text-slate-950" />
                    <span>See your Wrapped</span>
                  </button>
                )}
              </div>
            </div>
          </DeckCardShell>
        ) : !currentSong ? null : (
          /* THE CARD — the owner's reference mock: centered stack of
             art, huge title, "Album (Year)", and the big preview
             button, every element in a FIXED-height slot (see the
             budget on DeckCardShell). The layout is therefore
             identical for one-line and two-line titles, and the
             preview button — the last slot — can never be pushed
             off the card. The state badge rides on the card's top
             edge, so it never adds layout height: a sorted song
             shows its verdict; a passed-but-unsorted song shows a
             muted "Not Sorted"; a never-visited song shows none. */
          <DeckCardShell swipe={swipeProps}>
            <div className="relative h-full flex flex-col items-center text-center px-5 py-5 gap-3">
              {triageMap[currentSong.id] !== undefined ? (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                  {triageMap[currentSong.id] === 'unknown'
                    ? '✓ You marked this Don’t Know It — tap a tier to rate it'
                    : `✓ You marked this ${
                        BUCKET_CONFIG[triageMap[currentSong.id] as BucketType]
                          .label
                      } — tap a tier to change it`}
                </p>
              ) : passedIds.has(currentSong.id) ? (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-slate-200 text-slate-500 text-[11px] font-bold px-3 py-1 rounded-full shadow-sm border border-slate-300">
                  Not Sorted — you swiped past this one
                </p>
              ) : null}
              {/* ART — a fixed 128px slot; it no longer flexes or
                  shrinks to make room for the title. */}
              <div className="h-32 w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(resolveAlbumId(currentSong))}
                  alt={`${currentSong.album} cover art`}
                  className="h-32 w-32 object-cover rounded-xl shadow-lg border-[3px] border-white ring-1 ring-slate-900/10"
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
              <p className="text-sm font-bold text-slate-500">
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
          sits on one quiet centered line below the tray (owner,
          Oct 16); the Jump row beneath that also carries the
          Deck | List toggle on the same line. There's no Undo
          button (owner, Oct 16) — swipe right or the U key steps
          back one card. */}
      {inSongState && (
        <div className="shrink-0">
          <div className="bg-slate-100 border border-slate-200/60 rounded-3xl shadow-sm p-3 [@media(max-height:740px)]:p-2.5">
            <div className="flex gap-1.5 sm:gap-2">
              {BUCKET_ORDER.map(renderBucketButton)}
            </div>
          </div>
          {/* DON'T KNOW IT — one quiet centered text button directly
              below the tray; still a single tap (through flipAct →
              act()), and still visibly active when the song is
              marked unknown. It counts as SORTED — a deliberate
              disposition, not a pass. */}
          <div className="text-center pt-1.5">
            <button
              onClick={() => flipAct('unknown')}
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
            {/* DECK | LIST TOGGLE — rides in the Jump row (owner,
                Oct 16): same white pill with the blue active
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
            Keys 1–5 pick a tier · U goes back
          </p>
        </div>
      )}

      {/* CHECKPOINT / COMPLETION / END FOOTER — there's no actions
          block in those states, but the toggle still needs a home:
          the same inline pill, centered at the column bottom. */}
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
