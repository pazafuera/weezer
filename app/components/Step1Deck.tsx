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
 * off it. The milestone, completion and end-of-deck states replace
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
 * deck is browsable, every card shows its own state (a large
 * ink stamp over the album art and the selected tile for a
 * sorted song; a slate "Not Sorted" stamp for a passed one —
 * see below).
 *
 * HIDE SORTED (owner, Oct 16): the progress area carries the
 * list view's Hide Sorted checkbox. OFF (default), navigation
 * is exactly the plain browsing above. ON, navigation only
 * ever lands on UNSORTED cards: forward swipes, the
 * sorting advance, and jumps resolve to the nearest unsorted
 * card in that direction (a jump to a fully sorted section
 * does nothing), back swipes / the U key resolve to the
 * nearest unsorted card behind, and toggling it ON while
 * sitting on a sorted card hops ahead to the next unsorted
 * one (or to the end card when none are ahead). Sorting and
 * passing are unaffected — Hide Sorted is purely a lens on
 * navigation. (resolveForwardTarget / resolveBackTarget are
 * the single definition; the round's report lists every rule.)
 *
 * SWIPE = PURE NAVIGATION (owner correction, Oct 16): a swipe NEVER
 * writes a rating. Sorting a song as Skip is a judgment; swiping
 * past a song is not sorting it at all — the same Tier 1 principle
 * behind Don't Know It (an unjudged song must never be recorded as
 * a rating). Leaving an UNSORTED song via a committed forward
 * swipe marks it in the session-only `passedIds` set, which drives
 * its "Not Sorted" stamp on revisit and the end card's unsorted
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
 *
 * MILESTONES (owner design, Oct 16): one mid-deck checkpoint
 * doesn't pace 206 songs, so crossing a sorted-count threshold
 * (46 / 75 / 103 / 135 / 165 — see MILESTONES below) with a SORT
 * earns a milestone card that replaces the next song card. The
 * first card is the one that reveals the payoff by name — the
 * Sweater Thread. The deck's sorting flow drops the results
 * step's old nickname entirely: new users don't know it yet.
 * Each threshold fires at most once per session
 * (the fired set persists in sessionStorage across list
 * toggles), only a sort can fire one — never navigation — and
 * nothing fires retroactively when the deck is entered already
 * past a threshold.
 */

// The short-path promise the site's own splash copy makes ("25
// songs in about 5 minutes" — Step0Splash). There is no separate
// code constant for it; the deck counts bucketed songs toward that
// same 25, which is also the Sweater Thread's real unlock
// condition — it gates the end card's "Start ranking" button.
// It also gates the milestone card's "Refine →" offer (see
// renderMilestoneActions): 25 is a PROMOTION threshold — when
// the deck starts pushing Refine — not the step's real unlock,
// which stays at 1 bucket downstream (design memo §3.4). An
// earlier milestone finish button was removed as misleading
// (it was offered ungated and read as a trip to the Thread);
// the Refine offer that replaced it is honestly labeled — it
// goes to ranking, the step that produces the master list the
// Thread is compiled from. Actual step gating is unchanged
// and still runs through handleFinishTriage.
const THREAD_SHORT_PATH_GOAL = 25;

// MILESTONES — sorted-count thresholds (categorizedCount:
// bucketed + Don't Know It, the counter the progress line shows)
// that earn a milestone card mid-deck. The first threshold, 46,
// is also the end of the recognition-first front section (Blue
// 10 + Pinkerton 10 + the singles block 26) — the moment every
// song a casual fan knows is done — so its card is the one that
// reveals the Sweater Thread by name. The rest pace the deep-cut
// back half. Remaining-count figures in the copy are computed
// from the threshold, never hand-kept.
const TOTAL_SONGS = FULL_SONG_POOL.length;

interface DeckMilestone {
  threshold: number;
  headline: string;
  body: string;
  compel: string;
}

const MILESTONES: DeckMilestone[] = [
  {
    threshold: 46,
    headline: "You've made it through Blue, Pinkerton, and the singles.",
    body: "You've unlocked the Sweater Thread — your results: your Top 10, your fan tribe, your Era DNA.",
    // Compel trimmed for the 392px fit once the milestone action
    // stack landed (Overnight 3): the "your Thread gets sharper"
    // beat was dropped here — it survives verbatim as the 103
    // milestone's compel. Before/after quoted in REPORT.md.
    compel: `The deep cuts are where it gets interesting — ${
      TOTAL_SONGS - 46
    } songs still out there.`,
  },
  {
    threshold: 75,
    headline: '75 sorted.',
    body: 'More than a third of the catalog. Your Thread is taking shape.',
    compel: 'Next stop: halfway.',
  },
  {
    threshold: 103,
    headline: 'Halfway there.',
    body: `103 of ${TOTAL_SONGS}. The back half is deep cuts and late-era swings.`,
    compel: 'Your Thread gets sharper with every song.',
  },
  {
    threshold: 135,
    headline: '135 sorted.',
    body: 'Two-thirds of the catalog, done.',
    compel: `${TOTAL_SONGS - 135} songs left.`,
  },
  {
    threshold: 165,
    headline: '165 sorted.',
    body: 'The finish line is real now.',
    compel: `${
      TOTAL_SONGS - 165
    } songs left. The last stretch is all bragging rights.`,
  },
];

// The milestone thresholds fired this session, persisted across
// deck remounts (toggling to the list and back) in sessionStorage.
const MILESTONES_FIRED_KEY = 'weezer-deck-milestones-fired';

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
const FLIP_OUT_MS = 240;
const FLIP_IN_MS = 240;
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
 * couple of degrees — pure CSS, no images. The face wears a
 * brand-blue tint (#d9eafa — a color instead of white per the
 * owner, deepened one shade in his polish pass); the two
 * backing layers stay white for contrast. The shell is a FIXED
 * height — it never grows or shrinks with content — so a song title
 * can never push the preview button off the card; the milestone,
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
   * art). (The old persistent edge chevrons are gone — owner:
   * they looked tappable but did nothing. A one-time nudge
   * animation on the session's first song card teaches the slide
   * instead — see `nudgeX`/`nudging` and the NUDGE block in
   * Step1Deck.) Milestone/completion shells render
   * without it, so they can never be dragged. `phase`/`exitX`
   * drive the exit and flip animations (see the ANIMATION block
   * in Step1Deck).
   */
  swipe?: {
    dragX: number;
    nudgeX: number;
    nudging: boolean;
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
        : `translateX(${swipe.dragX + swipe.nudgeX}px) rotate(${
            (swipe.dragX + swipe.nudgeX) * 0.03
          }deg)`
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
      : swipe.nudging
      ? 'transform 300ms ease-in-out'
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
          className="relative h-full rounded-[28px] bg-[#d9eafa] border border-slate-200 shadow-xl select-none"
        >
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
        <div className="relative h-full rounded-[28px] bg-[#d9eafa] border border-slate-200 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The milestone card's award seal — an inline-SVG prize rosette:
 * a scalloped amber medallion ringed in brand blue, two ribbon
 * tails below it, and the Flying W centered in the medallion.
 * No external assets. The W's path data is copied from
 * FlyingWIcon in SharedUI.tsx (viewBox 0 0 1000 550) and scaled
 * into place — FlyingWIcon itself renders a standalone <svg>,
 * which can't be embedded inside this one. The seal renders
 * in-flow at the top of the milestone card's content stack
 * (it originally straddled the card's top edge; the owner moved
 * it inside so it can't hover over the progress line above).
 */
function MilestoneRibbon() {
  // Twelve scallop bumps around the medallion's rim.
  const scallops = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI) / 6;
    return {
      cx: 60 + 31 * Math.cos(angle),
      cy: 46 + 31 * Math.sin(angle),
    };
  });
  return (
    <svg
      viewBox="0 0 120 128"
      className="h-[88px] w-[88px] drop-shadow-md"
      aria-hidden="true"
    >
      {/* Ribbon tails — behind the medallion, notched ends. */}
      <polygon points="42,66 60,74 52,122 43,110 34,120" fill="#0072CE" />
      <polygon points="78,66 60,74 68,122 77,110 86,120" fill="#005fae" />
      {/* Scalloped rim. */}
      {scallops.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r="8.5" fill="#f59e0b" />
      ))}
      {/* Medallion face with the brand-blue ring. */}
      <circle cx="60" cy="46" r="32" fill="#fbbf24" />
      <circle
        cx="60"
        cy="46"
        r="32"
        fill="none"
        stroke="#0072CE"
        strokeWidth="3.5"
      />
      <circle
        cx="60"
        cy="46"
        r="25.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.65"
        strokeWidth="1.5"
      />
      {/* Flying W (path data copied from FlyingWIcon, SharedUI). */}
      <path
        d="M 0,0 L 240,0 L 330,260 L 500,150 L 670,260 L 760,0 L 1000,0 L 1000,65 L 870,65 L 870,125 L 960,125 L 960,190 L 760,190 L 630,540 L 500,310 L 370,540 L 240,190 L 40,190 L 40,125 L 130,125 L 130,65 L 0,65 Z"
        fill="#0072CE"
        transform="translate(41 36.5) scale(0.038)"
      />
    </svg>
  );
}

/**
 * The milestone action stack's Save button — the guest
 * conversion action (milestone-flows memo, §2 scenarios 1–2):
 * create a free account to SAVE the progress made so far. The
 * copy promises saving, never merging (memo §3.9): if the
 * account already has rankings, the migration guard lets the
 * account's win and these picks are not added (memo §1.6).
 * Deliberately the strongest button on the milestone card —
 * same amber treatment as "Keep sorting" in its primary form.
 * A standalone component so the end/completion cards (next
 * build) reuse the exact button instead of drifting.
 */
function SaveProgressButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-4 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200"
    >
      Create a free account to save your progress
    </button>
  );
}

/**
 * The milestone action stack's quiet off-ramp to the Garage
 * (memo §2): a text-weight link, deliberately weaker than every
 * button above it — it's the break, not a destination. Shared
 * with SaveProgressButton for the end/completion cards.
 */
function GarageBreakLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer py-1"
    >
      Take a break — the Garage
    </button>
  );
}

export default function Step1Deck({
  triageMap,
  orderedSongs,
  sections,
  handleSetBucket,
  handleFinishTriage,
  onSwitchToList,
  isGuest,
  onCreateAccount,
  onOpenGarage,
}: {
  triageMap: Record<string, TriageValue>;
  orderedSongs: Song[];
  sections: TriageSection[];
  handleSetBucket: (id: string, bucket: TriageValue) => void;
  handleFinishTriage: () => void;
  onSwitchToList: () => void;
  /** Auth/navigation plumbing (page.tsx → Step1Triage → here),
   *  consumed by the milestone action stack below (guest Save
   *  prompt + Garage off-ramp — milestone-flows design memo,
   *  §2 scenarios 1–4; the end/completion cards reuse the same
   *  props in the next build). Required (not optional) because
   *  the single render path above always supplies them. */
  isGuest: boolean;
  onCreateAccount: () => void;
  onOpenGarage: () => void;
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
  // The milestone card currently on screen (set by the sort that
  // crossed its threshold), and the thresholds already fired this
  // session — each fires at most once.
  const [milestonePending, setMilestonePending] =
    useState<DeckMilestone | null>(null);
  const [milestonesFired, setMilestonesFired] = useState<
    ReadonlySet<number>
  >(() => new Set());
  // HIDE SORTED — the list view's control, deck semantics
  // (session state, default OFF). OFF: navigation is exactly the
  // plain position±1 browsing above. ON: navigation only ever
  // lands on UNSORTED cards (no triageMap entry — a bucket OR a
  // Don't Know It mark both count as sorted). Every navigation
  // path resolves its target through resolveForwardTarget /
  // resolveBackTarget below; the full rule set is documented in
  // the report for this round.
  const [hideSorted, setHideSorted] = useState(false);

  // NUDGE — the swipe teacher that replaced the edge chevrons.
  // Once per session, shortly after the deck first shows a song
  // card, the card slides a few px left, a touch right, and
  // settles — a physical "this slides" hint with no added copy.
  // Any earlier interaction cancels it for the session (the user
  // has clearly found the controls), and it never runs during a
  // drag, flip or exit.
  const [nudgeX, setNudgeX] = useState(0);
  const [nudging, setNudging] = useState(false);
  const nudgeDoneRef = useRef(false);
  const nudgeArmedRef = useRef(false);
  const nudgeTimersRef = useRef<number[]>([]);
  const userInteractedRef = useRef(false);
  const phaseRef = useRef<CardAnimPhase>('idle');

  const markNudgeDone = () => {
    if (nudgeDoneRef.current) return;
    nudgeDoneRef.current = true;
    try {
      window.sessionStorage.setItem('weezer-deck-nudged', '1');
    } catch {
      /* sessionStorage unavailable — the ref still covers this mount */
    }
  };
  const cancelNudge = () => {
    nudgeTimersRef.current.forEach((id) => window.clearTimeout(id));
    nudgeTimersRef.current = [];
    setNudging(false);
    setNudgeX(0);
  };
  // Any deliberate interaction retires the nudge for the session:
  // the user found the controls without the hint. Called at the
  // top of the pointer, sort, jump and keyboard handlers; the
  // arming effect (further down, where the song state is known)
  // does the actual scheduling.
  const noteUserInteraction = () => {
    userInteractedRef.current = true;
    if (nudging) cancelNudge();
    markNudgeDone();
  };

  // The nudge fires at most once per session.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('weezer-deck-nudged')) {
        nudgeDoneRef.current = true;
      }
    } catch {
      /* sessionStorage unavailable — in-memory refs still apply */
    }
  }, []);

  // The fired set survives toggling to the list and back (which
  // remounts the deck), so it lives in sessionStorage.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(MILESTONES_FIRED_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMilestonesFired(
            new Set(
              parsed.filter(
                (n): n is number => typeof n === 'number'
              )
            )
          );
        }
      }
      // Retire the old single-checkpoint guard's key.
      window.sessionStorage.removeItem('weezer-deck-checkpoint-dismissed');
    } catch {
      /* sessionStorage unavailable — milestones stay session-local */
    }
  }, []);

  const categorizedCount = countCategorizedSongs(triageMap);
  const bucketedCount = countBucketedSongs(triageMap);
  const total = FULL_SONG_POOL.length;
  const deckLength = orderedSongs.length;
  const progressPercent = Math.round((categorizedCount / total) * 100);
  const isComplete = categorizedCount === total;

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

  // NAVIGATION TARGETS — every movement resolves through these
  // two, so Hide Sorted has exactly one definition of "forward"
  // and "back":
  //   forward from idx: OFF → idx+1. ON → the first unsorted card
  //     after idx, or the end card (deckLength) when none remain
  //     ahead. `map` lets act() resolve against the prospective
  //     map (the song being sorted counts as sorted).
  //   back from `from`: OFF → from−1 (from the end card, the last
  //     song). ON → the nearest unsorted card before `from` (from
  //     the end card, the last unsorted). −1 = nowhere to go
  //     (snap back / no-op).
  const resolveForwardTarget = (
    idx: number,
    map: Record<string, TriageValue> = triageMap
  ): number => {
    if (!hideSorted) return idx + 1;
    for (let i = idx + 1; i < deckLength; i++) {
      if (map[orderedSongs[i].id] === undefined) return i;
    }
    return deckLength;
  };
  const resolveBackTarget = (from: number): number => {
    if (!hideSorted) return from > 0 ? from - 1 : -1;
    for (let i = Math.min(from, deckLength) - 1; i >= 0; i--) {
      if (triageMap[orderedSongs[i].id] === undefined) return i;
    }
    return -1;
  };
  const backTarget = resolveBackTarget(effectivePosition);
  const hasBack = backTarget !== -1;

  // Toggling Hide Sorted ON while the current card is sorted
  // moves immediately to the next unsorted card ahead; if none
  // are ahead, the end card takes over (it offers review of
  // what's behind; if nothing is unsorted at all, the completion
  // card renders regardless of position). Toggling ON at the end
  // card stays there. Toggling OFF stays on the current card —
  // except at the end card, which steps back to the last song.
  const toggleHideSorted = (on: boolean) => {
    setHideSorted(on);
    if (on) {
      if (atEnd) return;
      const idx = effectivePosition;
      if (idx < deckLength && triageMap[orderedSongs[idx].id] === undefined) {
        return; // already on an unsorted card
      }
      // (resolveForwardTarget still sees the pre-toggle
      // hideSorted value inside this handler, so scan directly.)
      let next = deckLength;
      for (let i = idx + 1; i < deckLength; i++) {
        if (triageMap[orderedSongs[i].id] === undefined) {
          next = i;
          break;
        }
      }
      setPosition(next);
    } else if (atEnd && deckLength > 0) {
      setPosition(deckLength - 1);
    }
  };

  const act = (value: TriageValue) => {
    if (!currentSong || milestonePending) return;
    const song = currentSong;
    const idx = effectivePosition;
    handleSetBucket(song.id, value);

    // The prospective map — the context update hasn't rendered
    // yet, but sorting/navigation math needs the post-sort world.
    const prospective: Record<string, TriageValue> = {
      ...triageMap,
      [song.id]: value,
    };

    // Sorting a passed song clears its passed mark — it has a
    // verdict now.
    setPassedIds((prev) => {
      if (!prev.has(song.id)) return prev;
      const next = new Set(prev);
      next.delete(song.id);
      return next;
    });

    // Advance: OFF, the plain next card (position+1, sorted or
    // not); ON (Hide Sorted), the next UNSORTED card — resolving
    // against the prospective map so the just-sorted song counts
    // as sorted. Running off the end lands on the end-of-deck
    // card (or the completion card, if that was the final
    // unsorted song).
    setPosition(resolveForwardTarget(idx, prospective));

    // Milestone: this sort crosses a threshold (against the same
    // prospective map). A sort moves the count by at most one, so
    // at most one threshold can cross; each fires at most once
    // per session. (Landing on `total` shows the completion card
    // instead — milestones never fire there.)
    const newCategorized = countCategorizedSongs(prospective);
    if (newCategorized < total) {
      const crossed = MILESTONES.find(
        (m) =>
          categorizedCount < m.threshold &&
          newCategorized >= m.threshold &&
          !milestonesFired.has(m.threshold)
      );
      if (crossed) {
        setMilestonesFired((prev) => {
          const next = new Set(prev);
          next.add(crossed.threshold);
          try {
            window.sessionStorage.setItem(
              MILESTONES_FIRED_KEY,
              JSON.stringify(Array.from(next))
            );
          } catch {
            /* the state update above still covers this mount */
          }
          return next;
        });
        setMilestonePending(crossed);
      }
    }
  };

  // Step back one card. From the end card this returns to the
  // last song (OFF) or the last unsorted card (Hide Sorted ON);
  // with nowhere to go it's a no-op.
  const goBack = () => {
    if (backTarget !== -1) {
      setPosition(backTarget);
    }
  };

  // SWIPE — hand-rolled pointer drag on the song card (no library).
  // Buttons remain the primary SORTING path; a swipe only ever
  // NAVIGATES (see the model at the top of the file):
  //   commit left  → position+1. If the song being left is
  //     unsorted, it's marked passed (stamp + end-card count) —
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
  // The control (bucket tile or Don't Know It) whose sort is
  // mid-flip: it wears a committed dark fill while the flip runs
  // so the tap unmistakably registers, and resets the instant
  // the flip completes (cleared in the same timer that returns
  // the phase to 'idle').
  const [flipTarget, setFlipTarget] = useState<TriageValue | null>(null);
  // Mirrored for the nudge's fire-time check (its timer closes
  // over stale state otherwise).
  phaseRef.current = phase;
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
  // The activated control is marked (flipTarget) for the whole
  // flip so it shows its committed state, then resets.
  const flipAct = (value: TriageValue) => {
    if (phase !== 'idle' || !currentSong || milestonePending) return;
    noteUserInteraction();
    setFlipTarget(value);
    setPhase('flip-out');
    schedule(() => {
      act(value);
      setPhase('flip-in');
      schedule(() => {
        setPhase('idle');
        setFlipTarget(null);
      }, FLIP_IN_MS);
    }, FLIP_OUT_MS);
  };

  // A position/state change (advance, jump, step back, mode
  // remount) ends any drag and resets the transform — the next
  // card renders in place.
  useEffect(() => {
    dragRef.current = null;
    setDragX(0);
    setIsDragging(false);
  }, [effectivePosition, milestonePending, isComplete]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    noteUserInteraction();
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
      // past it); a committed right swipe flies back to the
      // resolved back target (the last song, or under Hide
      // Sorted the last unsorted card). Anything else springs
      // back.
      if (dx >= threshold && backTarget !== -1) {
        exitTo(1, () => setPosition(backTarget));
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
      // as it lands. Pure navigation: no setter is called. The
      // target resolves through Hide Sorted (OFF: the plain next
      // card; ON: the next unsorted card, or the end card). If
      // the song being left has no verdict, mark it passed (the
      // NOT SORTED stamp rode the card out) so it wears the stamp
      // on revisit and counts on the end card.
      const song = currentSong;
      const idx = effectivePosition;
      const wasUnsorted = triageMap[song.id] === undefined;
      const target = resolveForwardTarget(idx);
      exitTo(-1, () => {
        if (wasUnsorted) {
          setPassedIds((prev) => {
            if (prev.has(song.id)) return prev;
            const next = new Set(prev);
            next.add(song.id);
            return next;
          });
        }
        setPosition(target);
      });
    } else if (dx >= threshold) {
      // Swipe right = one card back, with the same fly-off. With
      // nowhere to go (position 0, or under Hide Sorted no
      // unsorted card behind): plain snap-back.
      if (backTarget !== -1) {
        exitTo(1, () => setPosition(backTarget));
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
  // shows NEXT; back shows BACK whenever the resolved back
  // target exists (see resolveBackTarget).
  const stampKind: 'notsorted' | 'next' | 'back' | null =
    dragX <= -STAMP_FADE_PX
      ? !atEnd && currentSong && triageMap[currentSong.id] === undefined
        ? 'notsorted'
        : !atEnd
        ? 'next'
        : null
      : dragX >= STAMP_FADE_PX && hasBack
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
    noteUserInteraction();
    const section = sections.find((s) => s.key === sectionKey);
    if (!section || section.songs.length === 0) return;
    const startIdx = orderedSongs.findIndex(
      (s) => s.id === section.songs[0].id
    );
    if (startIdx === -1) return;
    let idx = startIdx;
    if (hideSorted) {
      // Under Hide Sorted the jump lands on the section's first
      // UNSORTED song; a fully sorted section is a no-op.
      const sectionIds = new Set(section.songs.map((s) => s.id));
      idx = -1;
      for (
        let i = startIdx;
        i < deckLength && sectionIds.has(orderedSongs[i].id);
        i++
      ) {
        if (triageMap[orderedSongs[i].id] === undefined) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return;
    }
    // Plain first song of the section otherwise — the deck is a
    // browser, so a jump lands on the section's start whether or
    // not its songs are sorted yet.
    setMilestonePending(null);
    setPosition(idx);
  };

  // "Keep sorting" — the position already advanced to the pending
  // next card when the triggering sort landed (see act()), so
  // dismissing just hands the screen back to it. (If that position
  // is one past the last card, the end card shows instead.)
  const dismissMilestone = () => {
    setMilestonePending(null);
  };

  // MILESTONE ACTION STACK (milestone-flows memo, §2 scenarios
  // 1–4, decisions §3.1–3.2). What renders under the milestone
  // copy depends on who is sorting and whether they've RATED
  // enough to refine:
  //   guest:      guest line · Save (primary) · Keep sorting ·
  //               [Refine] · Garage link
  //   signed-in:  Keep sorting (primary) · [Refine] · Garage link
  // Eligibility runs on bucketedCount (real buckets only) against
  // THREAD_SHORT_PATH_GOAL — the milestone itself fired on
  // categorizedCount; the two counters never mix (memo §1.5,
  // scenario 19: a milestone earned mostly on Don't Know It
  // marks gets the celebration and the Save offer, but no
  // Refine). Refine calls handleFinishTriage — it goes to
  // ranking, the step that produces the master list the Thread
  // is compiled from, and its explainer says exactly that
  // (shortened form; see REPORT.md Overnight 3 for the fit math
  // that required it).
  const refineEligible = bucketedCount >= THREAD_SHORT_PATH_GOAL;
  const renderMilestoneActions = () => (
    <div className="w-full max-w-sm flex flex-col items-center gap-1.5">
      {isGuest && (
        <p className="text-sm font-bold text-slate-500 leading-snug">
          You&apos;re sorting as a guest — this progress lives only in
          this browser.
        </p>
      )}
      {isGuest && <SaveProgressButton onClick={onCreateAccount} />}
      <button
        onClick={dismissMilestone}
        className={
          isGuest
            ? 'w-full text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-6 py-3.5 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap'
            : 'w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 whitespace-nowrap'
        }
      >
        Keep sorting
      </button>
      {refineEligible && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-bold text-slate-400 leading-snug">
            You&apos;ve rated 25+ songs — enough to refine.
          </p>
          <button
            onClick={handleFinishTriage}
            className="bg-[#0072CE] hover:bg-[#005fae] text-white font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer whitespace-nowrap"
          >
            Refine →
          </button>
        </div>
      )}
      <GarageBreakLink onClick={onOpenGarage} />
    </div>
  );

  // Keyboard: 1–5 pick the buckets in displayed order (sort the
  // current card, with the flip), U steps back one card. Ignored
  // while typing in a form field or when a modal state
  // (milestone / completion) owns the screen.
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
      if (milestonePending || isComplete) return;
      if (phase !== 'idle') return;
      noteUserInteraction();
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
    const isCommitted = flipTarget === bucket;
    const cfg = BUCKET_CONFIG[bucket];
    const displayLabel = bucket === 'slaps' ? 'Slaps' : cfg.label;

    // The mock's bucket tiles: white, thin slate border, the bucket's
    // glyph large on top and its label underneath. The selected tile
    // keeps the deck's sky-400 family as a border/ring treatment —
    // and because the deck is browsable, it always reflects the
    // CURRENT card's verdict. While THIS tile's sort is mid-flip it
    // wears a committed fill instead (slate-900 + white text — the
    // bucket config's own fills are light tints only, so the dark
    // committed state is uniform across buckets), resetting the
    // moment the flip completes.
    return (
      <button
        key={bucket}
        onClick={() => flipAct(bucket)}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-3 [@media(max-height:740px)]:py-2 shadow-sm transition-all cursor-pointer ${
          isCommitted
            ? 'bg-slate-900 border-slate-900 shadow-md'
            : isSelected
            ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
        title={displayLabel}
      >
        <span className="text-[26px] [@media(max-height:740px)]:text-[22px] leading-none">
          {cfg.emoji}
        </span>
        <span
          className={`text-[13px] font-bold leading-tight ${
            isCommitted ? 'text-white' : 'text-slate-800'
          }`}
        >
          {displayLabel}
        </span>
      </button>
    );
  };

  const inSongState = !milestonePending && !isComplete && !!currentSong;

  // NUDGE — arm once, the first time a song card is on screen
  // (if the session opens on a milestone/end/completion card,
  // this waits for the first actual song card). ~600ms later the
  // card eases −18px, +8px, then settles to 0 over ~900ms total,
  // driven through the shell's transform (nudgeX) with its
  // ease-in-out transition. Fire-time guards: any earlier user
  // interaction retires it (noteUserInteraction), and it never
  // runs mid-drag or mid-animation.
  useEffect(() => {
    if (!inSongState || nudgeDoneRef.current || nudgeArmedRef.current) {
      return;
    }
    nudgeArmedRef.current = true;
    const startId = window.setTimeout(() => {
      if (
        userInteractedRef.current ||
        phaseRef.current !== 'idle' ||
        dragRef.current !== null
      ) {
        markNudgeDone();
        return;
      }
      setNudging(true);
      setNudgeX(-18);
      nudgeTimersRef.current.push(
        window.setTimeout(() => setNudgeX(8), 320)
      );
      nudgeTimersRef.current.push(
        window.setTimeout(() => setNudgeX(0), 620)
      );
      nudgeTimersRef.current.push(
        window.setTimeout(() => {
          setNudging(false);
          markNudgeDone();
        }, 940)
      );
    }, 600);
    nudgeTimersRef.current.push(startId);
  }, [inSongState]);

  useEffect(() => {
    const timers = nudgeTimersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

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

  // STATIC STAMP — the current card's state as a large ink stamp
  // over the album art, replacing the old top-edge pill badges
  // (owner polish: the pills read wrong and crowded the card's
  // top edge). A sorted song is stamped with its verdict in the
  // bucket's own ink (BUCKET_CONFIG.color); Don't Know It gets a
  // brand-blue stamp; a passed-but-unsorted song is stamped
  // NOT SORTED in slate; a never-visited unsorted song wears
  // nothing. While a drag is active the drag stamp owns that
  // spot (the render below hides this one when stampKind is
  // set) — one stamp at a time.
  const currentValue = currentSong ? triageMap[currentSong.id] : undefined;
  const staticStamp: { text: string; ink: string; size: string } | null =
    !currentSong
      ? null
      : currentValue === 'unknown'
      ? {
          text: 'Don’t Know It',
          ink: 'border-[#0072CE] text-[#0072CE]',
          size: 'text-xl',
        }
      : currentValue !== undefined
      ? {
          text:
            currentValue === 'slaps'
              ? 'Slaps'
              : BUCKET_CONFIG[currentValue as BucketType].label,
          ink: BUCKET_CONFIG[currentValue as BucketType].color,
          size: 'text-2xl',
        }
      : passedIds.has(currentSong.id)
      ? {
          text: 'Not Sorted',
          ink: 'border-slate-500 text-slate-600',
          size: 'text-2xl',
        }
      : null;

  // Shared swipe wiring for the two draggable shells (song card
  // and end card).
  const swipeProps = {
    dragX,
    nudgeX,
    nudging,
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
          views always agree. Right of the count sits the list
          view's Hide Sorted checkbox (owner: it replaces the old
          milestone-distance suffix — the milestone cards pace the
          deck now, the line just reports progress). */}
      <div className="shrink-0 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-700">
          <span className="uppercase tracking-wider">
            <strong className="text-[#0072CE] text-xs">
              {categorizedCount}
            </strong>{' '}
            of {total} sorted
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-extrabold text-slate-600 select-none normal-case tracking-normal">
              <input
                type="checkbox"
                checked={hideSorted}
                onChange={(e) => toggleHideSorted(e.target.checked)}
                className="rounded border-slate-300 text-[#0072CE] focus:ring-[#0072CE] w-3.5 h-3.5 cursor-pointer"
              />
              <span>Hide sorted</span>
            </label>
            <span className="text-[#0072CE] text-xs">
              {progressPercent}%
            </span>
          </div>
        </div>
        {/* The Flying W rides the fill's edge — the same treatment
            as the list view's bar (Step1Triage), colors included:
            a light track (bg-[#E0F2FE], blue-200 border) and a sky
            fill (bg-[#7DD3FC]) so the #0072CE W reads against both
            (owner: on the old solid-#0072CE fill the W drowned in
            its own color). A w-8 h-5 marker centered on the fill
            edge, its left % clamped to 2–98 so it never hangs off
            either end. */}
        <div className="relative w-full h-3.5 my-2 z-0">
          <div className="absolute inset-0 bg-[#E0F2FE] rounded-full border border-blue-200 z-10" />
          <div
            className="absolute top-0 left-0 h-full bg-[#7DD3FC] rounded-full transition-all duration-300 z-20"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-30 text-[#0072CE] w-8 h-5 ml-[-16px] pointer-events-none"
            style={{
              left: `${Math.min(98, Math.max(2, progressPercent))}%`,
            }}
          >
            <FlyingWIcon className="w-full h-full drop-shadow-sm" />
          </div>
        </div>
      </div>

      {/* CARD REGION — flex-1 and centered; the milestone,
          completion and end-of-deck states replace the card right
          here, at the same fixed height. */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center py-2">
        {milestonePending ? (
          /* MILESTONE — a sort just crossed a threshold (see
             MILESTONES). It replaces the next song card: the sort
             and the position advance already landed in act(), so
             "Keep sorting" simply hands the screen back. Not
             swipeable (no swipe prop, like the completion card);
             the tray hides while it shows (inSongState is false)
             and the footer toggle pill below keeps Deck/List
             reachable. The award seal (MilestoneRibbon) sits
             IN-FLOW at the top of the stack in place of the old
             "Milestone" eyebrow text (owner: the old build
             straddled it over the card's top edge, where it
             hovered over the progress line above — now it lives
             inside the card). Below the copy sits the ACTION
             STACK (renderMilestoneActions, memo §2 scenarios
             1–4): a guest gets the save-your-progress line and
             the primary Save button, everyone gets Keep sorting
             and the quiet Garage off-ramp, and anyone at 25+
             real buckets also gets the Refine offer. The stack
             is why this container's spacing tightened again
             (py-3/sm:py-4, space-y-1.5/sm:space-y-2) — the
             392px fit math, including the one state that still
             doesn't fit, is in REPORT.md (Overnight 3). */
          <DeckCardShell>
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-3 sm:px-8 sm:py-4 space-y-1.5 sm:space-y-2">
              <MilestoneRibbon />
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                {milestonePending.headline}
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                {milestonePending.body}
              </p>
              <p className="text-sm font-bold text-slate-400 leading-snug max-w-sm mx-auto">
                {milestonePending.compel}
              </p>
              {renderMilestoneActions()}
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
                {bucketedCount >= THREAD_SHORT_PATH_GOAL && (
                  <button
                    onClick={handleFinishTriage}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
                  >
                    <FlyingWIcon className="w-6 h-4 text-slate-950" />
                    <span>Start ranking</span>
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
             off the card. The card's state is a large ink stamp
             over the album art (see staticStamp above) — it adds
             no layout height and never competes with the progress
             line above the card. */
          <DeckCardShell swipe={swipeProps}>
            <div className="relative h-full flex flex-col items-center text-center px-5 py-5 gap-3">
              {/* STATIC STAMP — same anchor as the drag stamps
                  (the art slot's center: py-5 + half of h-32 =
                  top-[84px]), rendered only while no drag stamp
                  is up. It sits over the art; the preview button
                  lives in the card's bottom slot, far below the
                  stamp's band, so they can never overlap. */}
              {staticStamp && stampKind === null && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-1/2 top-[84px] z-10 -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] rounded-lg border-[3px] px-3 py-1 font-black uppercase tracking-widest opacity-90 bg-white/60 ${staticStamp.size} ${staticStamp.ink}`}
                >
                  {staticStamp.text}
                </span>
              )}
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
                flipTarget === 'unknown'
                  ? 'bg-slate-900 text-white font-bold shadow-md'
                  : triageMap[currentSong.id] === 'unknown'
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

      {/* MILESTONE / COMPLETION / END FOOTER — there's no actions
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
