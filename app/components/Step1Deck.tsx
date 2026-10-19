'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BucketType, BUCKET_CONFIG, FULL_SONG_POOL, Song } from '../data/constants';
import {
  countBucketedSongs,
  countCategorizedSongs,
  TriageValue,
} from '../context/WeezerContext';
import { albumCoverSrc, resolveAlbumId } from './shareables/ShareCardShell';
import { FlyingWIcon, AudioPreviewButton, HelpButton, DashboardBackButton } from './SharedUI';
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
 * Know It line → the Jump row. On tall phones
 * everything fits one screen; on short ones the page scrolls a
 * little — the owner accepted that in exchange for a song card tall
 * enough to hold a two-line title without pushing the preview button
 * off it. The milestone, completion and end-of-deck states replace
 * the card inside the same column at the same 362px floor — their
 * shell is adaptive and grows past it when a state's content needs
 * the room (see DeckCardShell); the song card's height never moves.
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
 * MILESTONES (owner direction, Oct 17): milestones pace the
 * deck by SECTION, not by sorted count. Completing a section
 * of the recognition-first order with a SORT — Blue, then
 * Pinkerton, then the singles block, then each remaining
 * album — earns that section's milestone card, which replaces
 * the next song card (see the SECTION MILESTONES block below).
 * The Blue card teases Pinkerton; the Pinkerton card snarks on
 * how the two '90s albums fared and carries the deck's first
 * guest Save prompt; the singles card and every album card
 * after it pay out a fresh Sweater Thread nugget — a draft
 * read on the fan so far, framed as "so far" because it
 * sharpens with every song. Each section fires at most once
 * per session (the fired set persists in sessionStorage
 * across list toggles), only a sort can fire one — never
 * navigation — and a section completed elsewhere (the list, a
 * previous visit) never fires retroactively.
 *
 * END + COMPLETION STACKS (Overnight 4, memo §2 scenarios
 * 9–11, decision §3.5): the completion card is the
 * highest-intent moment in the app — a guest's whole 206-song
 * effort sits in this browser's localStorage — so a guest
 * gets the guest line and the Save button as the card's
 * PRIMARY action there, ahead of "Next Step: Refine Buckets",
 * with the Garage link under it; signed-in users just gain
 * the Garage link. The end-of-deck card stays lighter: one
 * quiet guest line above its button row, its "create a free
 * account" a text-weight link inside the sentence — Review
 * the unsorted and Start ranking keep the visual lead there.
 *
 * TUTORIAL (owner direction, Oct 17): a first-run coach-mark
 * tour over the REAL deck — no separate page, no practice
 * cards. Five steps in the owner's order: the deck itself,
 * the song preview, the sort buttons, swiping (passing a
 * song is NOT a Skip, and swiping back reviews or changes a
 * sort), and Don't Know It. It shows at most once, ever, for
 * a FRESH sorter (nothing categorized yet), over a normal
 * song card only — the seen flag is localStorage, so it
 * survives sessions; finishing OR skipping sets it. While it
 * is open it owns the deck root (an overlay intercepts every
 * pointer event; Esc counts as a skip), and it retires the
 * swipe nudge for the session — the tour teaches swiping
 * itself. See the TUTORIAL block below for steps and copy,
 * and the decision effect for the show rules.
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

// SECTION MILESTONES (owner direction, Oct 17) — a milestone
// card is earned by COMPLETING a section of the recognition-
// first order, not by crossing a sorted-count threshold: the
// old 46 / 75 / 103 / 135 / 165 count table is gone. A section
// is complete when every song in it is categorized (a real
// bucket OR a Don't Know It mark — "sorted", the same word the
// progress line uses). The front three sections get bespoke
// cards; every later section is an album section and shares
// one template. Copy is the owner's direction, in his voice;
// remaining-count figures are computed from the map at fire
// time, never hand-kept. (Milestone diet, owner Oct 17: the
// cards carry as little text as possible — the prose Thread
// nuggets are gone, replaced on the singles and album cards
// by a single dashboard factoid; see buildSectionMilestone.)
const BLUE_SECTION_KEY = 'album-the-blue-album';
const PINKERTON_SECTION_KEY = 'album-pinkerton';
const SINGLES_SECTION_KEY = 'album-the-singles';

type SectionMilestoneKind = 'blue' | 'pinkerton' | 'singles' | 'album';

interface SectionMilestone {
  sectionKey: string;
  kind: SectionMilestoneKind;
  headline: string;
  body: string | null;
  compel: string | null;
  /** The dashboard factoid (singles + album cards only): one
   *  big figure over a one-line label, computed from the
   *  sorter's real buckets at fire time. Null on the Blue and
   *  Pinkerton cards — their snark is the content. */
  factoid: { figure: string; label: string } | null;
  /** The section album's cover art (album sections, Blue and
   *  Pinkerton): leads the card in place of the award ribbon.
   *  Null on the singles card, which keeps the ribbon. */
  cover: { src: string; album: string } | null;
}

// The section ids fired this session, persisted across deck
// remounts (toggling to the list and back) in sessionStorage.
const SECTION_MILESTONES_FIRED_KEY =
  'weezer-deck-section-milestones-fired';

const sectionIsComplete = (
  section: TriageSection,
  map: Record<string, TriageValue>
) => section.songs.every((s) => map[s.id] !== undefined);

// An album's love stats over its RATED songs only (real
// buckets — Don't Know It is not a rating): how many songs
// were rated, and what share of them landed in the top two
// buckets (Banger / Slaps — the "top buckets" everywhere
// below). Drives the Pinkerton card's snark and the factoid.
const loveStats = (
  songs: Song[],
  map: Record<string, TriageValue>
): { rated: number; share: number } => {
  let rated = 0;
  let loved = 0;
  for (const s of songs) {
    const v = map[s.id];
    if (v !== undefined && v !== 'unknown') {
      rated += 1;
      if (v === 'banger' || v === 'slaps') loved += 1;
    }
  }
  return { rated, share: rated > 0 ? loved / rated : 0 };
};

// The milestone factoid over a set of songs: the headline
// figure is the top-bucket share of the RATED songs (the
// loveStats share, as a whole percent). A set with zero rated
// songs — every song marked Don't Know It — has no share to
// show, so the figure is the Don't Know It count itself. The
// caller supplies both labels (they name the scope: one album,
// or everything rated so far).
const factoidFor = (
  songs: Song[],
  map: Record<string, TriageValue>,
  percentLabel: string,
  unknownLabel: string
): { figure: string; label: string } => {
  const { rated, share } = loveStats(songs, map);
  if (rated > 0) {
    return { figure: `${Math.round(share * 100)}%`, label: percentLabel };
  }
  const unknown = songs.filter((s) => map[s.id] === 'unknown').length;
  return { figure: `${unknown}`, label: unknownLabel };
};

/**
 * The milestone card for a just-completed section, copy and
 * all, computed against the prospective (post-sort) map — the
 * card describes the world the triggering sort created. Every
 * section gets a card: the three front sections are bespoke,
 * the rest take the album template. Album sections (and Blue
 * and Pinkerton) lead with the album's cover art, resolved
 * the same way the song cards resolve theirs; the singles
 * card keeps the award ribbon. The singles and album cards
 * carry the factoid in place of the old prose Thread nugget —
 * one stat off the sorter's real buckets, nothing else.
 */
function buildSectionMilestone(
  section: TriageSection,
  map: Record<string, TriageValue>,
  sections: TriageSection[]
): SectionMilestone {
  const firstSong = section.songs[0];
  const cover =
    section.key !== SINGLES_SECTION_KEY && firstSong
      ? {
          src: albumCoverSrc(resolveAlbumId(firstSong)),
          album: section.title,
        }
      : null;
  const base = { sectionKey: section.key, cover, factoid: null };

  // BLUE — pure tease. No factoid yet and no Save prompt (the
  // owner's flow puts the first save ask on the Pinkerton
  // card); the card's whole job is pointing at Pinkerton.
  if (section.key === BLUE_SECTION_KEY) {
    return {
      ...base,
      kind: 'blue',
      headline: 'Sure, everyone loves the Blue Album.',
      body: 'but Pinkerton is much more controversial.',
      compel: null,
    };
  }

  // PINKERTON — snark keyed to how the two '90s albums
  // actually fared in the sorter's real ratings (loveStats
  // above). Every variant points at the singles next, in its
  // headline or its compel line.
  if (section.key === PINKERTON_SECTION_KEY) {
    const blueSection = sections.find((s) => s.key === BLUE_SECTION_KEY);
    const blue = loveStats(blueSection?.songs ?? [], map);
    const pink = loveStats(section.songs, map);
    let headline: string;
    let compel: string | null = null;
    if (
      blue.rated >= 5 &&
      pink.rated >= 5 &&
      blue.share >= 0.6 &&
      pink.share >= 0.6
    ) {
      headline =
        "Blue and Pinkerton both got the love. Your '90s Weezer era is looking strong. Let's see about the singles.";
    } else if (blue.share - pink.share >= 0.25) {
      headline = 'Blue wins this round. Pinkerton, not so much.';
      compel = 'Next: 26 singles. Time for the hits to make their case.';
    } else if (pink.share - blue.share >= 0.25) {
      headline = 'Pinkerton takes the crown. Blue can take it up with Rivers.';
      compel = "Next: 26 singles. Let's see what the hits have to say.";
    } else {
      // Everything else — including a wall of Don't Know It
      // (zero rated songs makes both shares 0 and both diffs 0).
      headline =
        'The verdict is still out. Luckily, Weezer has more where that came from.';
      compel =
        'Next up: 26 singles. Some familiar faces, some questionable feelings.';
    }
    return { ...base, kind: 'pinkerton', headline, body: null, compel };
  }

  // SINGLES — the recognition block is done. The factoid
  // covers everything rated so far (Blue + Pinkerton + the
  // singles themselves); the only other copy is the pointer
  // at the album run ahead.
  if (section.key === SINGLES_SECTION_KEY) {
    const ratedSoFar = sections
      .filter(
        (s) =>
          s.key === BLUE_SECTION_KEY ||
          s.key === PINKERTON_SECTION_KEY ||
          s.key === SINGLES_SECTION_KEY
      )
      .flatMap((s) => s.songs);
    return {
      ...base,
      kind: 'singles',
      headline: "Blue. Pinkerton. The hits. You're just getting started.",
      body: null,
      factoid: factoidFor(
        ratedSoFar,
        map,
        "of your rated songs landed in your top buckets",
        "songs marked Don't Know It — they won't count against you"
      ),
      compel: 'Now for the deep cuts. One album at a time.',
    };
  }

  // ALBUM sections — one template: name the album, show its
  // factoid (over THIS section's songs — the ones whose
  // sorting just finished), and count the albums still
  // standing.
  const albumsRemaining = sections.filter(
    (s) =>
      s.key !== BLUE_SECTION_KEY &&
      s.key !== PINKERTON_SECTION_KEY &&
      s.key !== SINGLES_SECTION_KEY &&
      !sectionIsComplete(s, map)
  ).length;
  return {
    ...base,
    kind: 'album',
    headline: `${section.title} — judged.`,
    body: null,
    factoid: factoidFor(
      section.songs,
      map,
      `of the ${section.title} songs you rated made your top buckets`,
      `${section.title} songs marked Don't Know It — they don't count against you`
    ),
    compel:
      albumsRemaining > 0
        ? `${albumsRemaining} ${
            albumsRemaining === 1 ? 'album' : 'albums'
          } to go.`
        : null,
  };
}

// TUTORIAL — the eight coach-mark steps (owner's beats and
// order, revised Oct 17): the deck, the preview, one step per
// bucket tile (each with the bucket's purpose — the buckets
// are taught here now, not on the orientation page), and
// swiping. Don't Know It is NOT taught: if you don't know a
// song, the tour's answer is the swipe. Copy is the owner's
// voice — short, plain, no cheese, and the Thread is only
// ever called the Sweater Thread. Each step names its
// highlight target by the data-tutorial attribute the render
// puts on that element (the card shell, the preview button's
// wrapper in the card, the five bucket tiles in the tray),
// the corner radius its ring wears, and where its callout
// sheet sits. Steps 1 and 8 ride the bottom sheet. Steps 2–7
// place ADJACENT to their target (see measureTutorial): the
// top/bottom anchoring put the sheet inches away from the
// element it pointed at (owner report, Oct 17), so the sheet
// now hovers just above the target — below it only when
// above doesn't fit. The bucket steps also carry their
// bucket: the ringed tile is tappable during its step and
// runs a no-write rehearsal of a real sort (see DEMO).
// The seen flag is localStorage — NOT sessionStorage —
// because once means once, across sessions.
const TUTORIAL_SEEN_KEY = 'weezer-deck-tutorial-seen-v1';

// TUTORIAL REPLAY — the header "?" button (AppShell) can ask
// for the tour again: it sets this sessionStorage flag before
// navigating to the triage step, and dispatches a window event
// of this name when the deck is already mounted. A forced
// open ignores the seen flag and the fresh-sorter rule (see
// the replay block inside the component).
const TUTORIAL_FORCE_KEY = 'weezer-deck-tutorial-force';
const TUTORIAL_REPLAY_EVENT = 'weezer:replay-tutorial';

type TutorialTargetKey =
  | 'card'
  | 'preview'
  | 'bucket-banger'
  | 'bucket-slaps'
  | 'bucket-mid'
  | 'bucket-skip'
  | 'bucket-trash';

interface TutorialStepDef {
  target: TutorialTargetKey;
  radius: number;
  placement: 'adjacent' | 'bottom';
  /** Bucket steps only: the tile this step rings is live —
   *  tapping it plays the demo sort for this bucket. */
  bucket?: BucketType;
  headline: string;
  line: string;
}

const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    target: 'card',
    radius: 30,
    placement: 'bottom',
    headline: 'Rank One Song at a Time',
    line: "You'll flip through the Weezer catalog and sort each song. Pro-tip: don't overthink it! The sorting is just a gut check.",
  },
  {
    target: 'preview',
    radius: 36,
    placement: 'adjacent',
    headline: 'Need a refresher?',
    line: 'Tap the play button to hear a snippet of the song.',
  },
  {
    target: 'bucket-banger',
    radius: 20,
    placement: 'adjacent',
    bucket: 'banger',
    headline: 'Tap to Sort as Banger',
    line: 'Select Banger for your all-time favorites. The best of the best.',
  },
  {
    target: 'bucket-slaps',
    radius: 20,
    placement: 'adjacent',
    bucket: 'slaps',
    headline: 'Tap to Sort as Lowkey Slaps',
    line: 'Select Slaps for great songs — just not elite.',
  },
  {
    target: 'bucket-mid',
    radius: 20,
    placement: 'adjacent',
    bucket: 'mid',
    headline: 'Tap to Sort as Mid',
    line: 'Select Mid for fine, forgettable songs.',
  },
  {
    target: 'bucket-skip',
    radius: 20,
    placement: 'adjacent',
    bucket: 'skip',
    headline: 'Tap to Sort as Skip',
    line: 'Select Skip for songs you rarely reach for.',
  },
  {
    target: 'bucket-trash',
    radius: 20,
    placement: 'adjacent',
    bucket: 'trash',
    headline: 'Tap to Sort as Trash',
    line: 'Select Trash for songs you never want to hear again.',
  },
  {
    target: 'card',
    radius: 30,
    placement: 'bottom',
    headline: "Don't Recognize a Song?",
    line: 'Swipe left to move on and leave it unsorted. Swipe right to go back and review or change past songs.',
  },
];

// The measured highlight box (target rect relative to the
// deck root, padded 4px a side — see measureTutorial). The
// ring is positioned inside the overlay root, so root-
// relative is right for it — the callout sheet is NOT (see
// TutorialSheetPos).
interface TutorialRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// The ADJACENT sheet's position, in VIEWPORT coordinates for
// a position:fixed element — measured from the target's own
// getBoundingClientRect(), never by subtracting the deck
// root's rect (that root-relative math was the v1 bug that
// parked the sheet off-screen). Null until the first measure
// lands; the sheet renders as the bottom sheet until then,
// so it is always reachable.
interface TutorialSheetPos {
  top: number;
  left: number;
  width: number;
}

// env(safe-area-inset-*) has no direct JS read; a throwaway
// probe element with the insets as padding is the reliable
// way to learn them in pixels. Returns 0s anywhere the
// probe can't run.
const readSafeAreaInsets = (): { top: number; bottom: number } => {
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);
    const cs = window.getComputedStyle(probe);
    const top = parseFloat(cs.paddingTop) || 0;
    const bottom = parseFloat(cs.paddingBottom) || 0;
    probe.remove();
    return { top, bottom };
  } catch {
    return { top: 0, bottom: 0 };
  }
};

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
// over EXIT_MS before its navigation runs; a button sort first
// stamps the tapped verdict on the still-face-up card for
// STAMP_BEAT_MS, then flips the card edge-on (FLIP_OUT_MS),
// swaps the song at the midpoint, and flips back (FLIP_IN_MS).
// SNAP_MS is the transition-less beat that lets a flown-off
// card's replacement appear in place instead of sliding in from
// off-screen.
const EXIT_MS = 260;
const FLIP_OUT_MS = 240;
const FLIP_IN_MS = 240;
const SNAP_MS = 40;
// The stamp beat: how long a sort's stamp sits on the card
// before the flip starts. One shared rhythm — a real button
// sort (flipAct) and the tutorial's no-write rehearsal
// (playDemo) both speak stamp → beat → flip (stamp + flip
// ≈ 840ms).
const STAMP_BEAT_MS = 360;

/**
 * Card animation phases. 'idle' covers both resting and actively
 * dragging (the drag transform is driven by dragX, not the phase).
 * 'exit' flies the card off-screen; 'snap' is the one-beat
 * transition-less reset that follows an exit; 'stamp' is the
 * sort stamp's visible beat (card still face-up, input locked
 * like every non-idle phase); 'flip-out' / 'flip-in' are the
 * two halves of the button-sort flip.
 */
type CardAnimPhase =
  | 'idle'
  | 'exit'
  | 'snap'
  | 'stamp'
  | 'flip-out'
  | 'flip-in';

/**
 * The card from the owner's reference mock, with a stacked-deck
 * effect: two backing cards peek out behind the real one, rotated a
 * couple of degrees — pure CSS, no images. The face wears a
 * brand-blue tint (#d9eafa — a color instead of white per the
 * owner, deepened one shade in his polish pass); the two
 * backing layers stay white for contrast. The SONG shell is a FIXED
 * height — it never grows or shrinks with content — so a song title
 * can never push the preview button off the card. The milestone,
 * completion and end-of-deck states render in the same shell with
 * `adaptive` set instead: a 362px MINIMUM height that grows to fit
 * content (Overnight 3.5 — the milestone action stack's tallest
 * guest state runs ~569px of content at phone width, which no
 * spacing trim could fit into 362; a non-song state short enough
 * to fit renders identically to the fixed shell). The backing
 * layers are inset-0, so they scale with a taller shell and the
 * stacked-deck peek survives at any height.
 *
 * Slot budget (mobile-first, sums to the 362px height — the card
 * was 392 until the owner asked for it a little shorter so the
 * bucket tray pulls up): card vertical padding py-4 (32) + art
 * slot h-28 (112) + gap-2.5 (10) + two-line title slot h-[104px]
 * (104 — two lines at the ladder's largest size, text-5xl ×
 * leading-[1.05], is 100.8) + gap-2.5 (10) + meta line text-sm
 * (20) + gap-2.5 (10) + preview-button slot h-16 (64) = 362.
 */
function DeckCardShell({
  children,
  swipe,
  adaptive,
  swaying,
}: {
  children: React.ReactNode;
  /**
   * Non-song states only (milestone / completion / end-of-deck):
   * the shell's fixed 362px height becomes a 362px MINIMUM and
   * the shell grows to fit its content (see the shell comment
   * above). Song cards never set it — their rendering path is
   * byte-for-byte the fixed shell. The inner content containers
   * of adaptive states pair this with min-h-[362px] in place of
   * h-full, so a state that fits still centers its content in
   * exactly 362px, identically to before.
   */
  adaptive?: boolean;
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
  /**
   * The tutorial's final step only ("Don't know it? Swipe."):
   * the shell root wears the `deck-tutorial-sway` keyframe
   * animation (globals.css) and the whole stack gently slides
   * side to side, demonstrating that the deck swipes both
   * ways. The root carries no transform of its own — the
   * drag / nudge / flip transforms all live on the front card
   * inside it — so the sway composes with that machinery
   * instead of fighting it. The parent passes this only while
   * the tour sits on its last step, so the animation is
   * state-toggled and can never leak into normal deck use.
   */
  swaying?: boolean;
}) {
  // The front card's transform/transition are phase-driven: it
  // follows the pointer while dragging, springs back over 200ms on
  // a below-threshold release, flies off-screen on a committed
  // swipe ('exit'), resets without a transition ('snap'), and
  // flips edge-on and back for a button sort ('flip-out'/'flip-in'
  // — the shell root carries the perspective that sells the flip).
  const cardTransform =
    swipe === undefined || swipe.phase === 'idle' || swipe.phase === 'stamp'
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
    <div
      data-tutorial="card"
      className={`relative w-full ${
        adaptive ? 'min-h-[362px]' : 'h-[362px]'
      } [perspective:1200px]${swaying ? ' deck-tutorial-sway' : ''}`}
    >
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
          className={`relative ${
            adaptive ? 'min-h-[362px]' : 'h-full'
          } rounded-[28px] bg-[#d9eafa] border border-slate-200 shadow-xl select-none`}
        >
          {/* Directional stamps: all three are CENTERED OVER THE
              ALBUM ART (owner: the old corner stamps rotated
              off-screen first and were hard to see). top-[72px] is
              the art slot's vertical center — the content's py-4
              (16px) plus half the h-28 art slot (56px). Opacity is
              proportional to drag distance (computed by the
              parent), and only the stamp for the current drag
              direction renders. NOT SORTED is the stamp motif in
              neutral slate — swiping past an unsorted song sorts
              nothing, and the stamp says exactly that. */}
          {swipe.stamp === 'notsorted' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute left-1/2 top-[72px] z-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-[3px] border-slate-500 px-2.5 py-1 text-base font-black uppercase tracking-widest text-slate-600 bg-white/70"
            >
              Not Sorted
            </span>
          )}
          {swipe.stamp === 'next' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute left-1/2 top-[72px] z-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-[3px] border-slate-500 px-2.5 py-1 text-lg font-black uppercase tracking-widest text-slate-600 bg-white/70"
            >
              Next
            </span>
          )}
          {swipe.stamp === 'back' && (
            <span
              aria-hidden="true"
              style={{ opacity: swipe.stampOpacity }}
              className="pointer-events-none absolute left-1/2 top-[72px] z-20 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-lg border-[3px] border-[#0072CE] px-2.5 py-1 text-lg font-black uppercase tracking-widest text-[#0072CE] bg-white/70"
            >
              Back
            </span>
          )}
          {children}
        </div>
      ) : (
        <div
          className={`relative ${
            adaptive ? 'min-h-[362px]' : 'h-full'
          } rounded-[28px] bg-[#d9eafa] border border-slate-200 shadow-xl`}
        >
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
 * A standalone component, reused verbatim by the completion
 * card (Overnight 4) so the guest primary never drifts. The
 * label is the tightened "Create free account, save progress"
 * (Overnight 3.5): the original wording wrapped to two lines
 * at phone width, and this is the longest variant measured to
 * fit one line at 375px — see REPORT.md for the measurement.
 */
function SaveProgressButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-4 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200"
    >
      Create free account, save progress
    </button>
  );
}

export default function Step1Deck({
  triageMap,
  orderedSongs,
  sections,
  handleSetBucket,
  handleFinishTriage,
  isGuest,
  onCreateAccount,
  onOpenGarage,
  pendingJumpSectionKey,
  onJumpApplied,
}: {
  triageMap: Record<string, TriageValue>;
  orderedSongs: Song[];
  sections: TriageSection[];
  handleSetBucket: (id: string, bucket: TriageValue) => void;
  handleFinishTriage: () => void;
  /** A dashboard album tap's target section (Step1Triage holds
   *  the consumed sessionStorage handoff; non-null only until
   *  the jump applies). Applied through this deck's own
   *  jumpToSection — see the effect beside it — then reported
   *  consumed via onJumpApplied so it can never re-fire. */
  pendingJumpSectionKey: string | null;
  onJumpApplied: () => void;
  /** Auth/navigation plumbing (page.tsx → Step1Triage → here).
   *  isGuest and onCreateAccount are consumed by the milestone
   *  action stack and the end / completion card stacks below
   *  (guest Save prompts — milestone-flows design memo, §2
   *  scenarios 1–4 and 9–11). onOpenGarage is still supplied by
   *  the single render path above but no longer consumed here:
   *  the milestone diet (owner, Oct 17) removed the cards'
   *  Garage off-ramp. Required (not optional) because the
   *  render path always supplies them. */
  isGuest: boolean;
  onCreateAccount: () => void;
  onOpenGarage: () => void;
}) {
  // NAVIGATION — a plain position index into orderedSongs, not a
  // funnel. Null = "not yet navigated": the deck then shows the
  // first uncategorized song (see effectivePosition below). One
  // past the last index is the end-of-deck card.
  const [position, setPosition] = useState<number | null>(null);
  // COMPLETION DISMISSAL — once every song is categorized, the
  // completion card takes over the card region and (before this)
  // nothing could bring a song card back in deck mode: no path
  // existed to re-check or change a verdict except leaving for
  // the list or the dashboard. "Review or change a song" on the
  // card sets this and lands on the last song; the deck then
  // browses normally (the completion state yields to position
  // again). Session-only by design — a fresh visit to a finished
  // deck opens on the completion card, as it should.
  const [completionDismissed, setCompletionDismissed] = useState(false);
  // Session-only marks for songs the user swiped past while they
  // were unsorted. React state only — never persisted, never
  // written to the triage map.
  const [passedIds, setPassedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  // The milestone card currently on screen (set by the sort
  // that completed its section), and the section ids already
  // fired this session — each section fires at most once.
  const [milestonePending, setMilestonePending] =
    useState<SectionMilestone | null>(null);
  const [sectionMilestonesFired, setSectionMilestonesFired] = useState<
    ReadonlySet<string>
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

  // TUTORIAL — the open step's index, or null when the tour
  // isn't showing; the measured highlight geometry (a ref
  // mirrors the state so the measure pass can skip no-op
  // updates); and the root ref the geometry reads. Adjacent
  // steps also carry a measured sheet position (viewport
  // coordinates; a ref mirrors it for the same no-op skip),
  // and the sheet element gets a ref so the measure pass can
  // read its real height. DEMO state: the bucket whose
  // rehearsal sort is on the card (its stamp shows), and
  // whether a rehearsal is mid-flight (locks the tap zone
  // and the sheet's buttons until it lands) — a ref mirrors
  // the lock for the timer/guard closures.
  // The show decision itself lives further down, next to the
  // nudge it has to retire (see the TUTORIAL decision effect).
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [tutorialRect, setTutorialRect] = useState<TutorialRect | null>(
    null
  );
  const [tutorialSheetPos, setTutorialSheetPos] =
    useState<TutorialSheetPos | null>(null);
  const deckRootRef = useRef<HTMLDivElement>(null);
  const tutorialRectRef = useRef<TutorialRect | null>(null);
  const tutorialSheetPosRef = useRef<TutorialSheetPos | null>(null);
  const tutorialSheetRef = useRef<HTMLDivElement>(null);
  const [demoBucket, setDemoBucket] = useState<BucketType | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoPlayingRef = useRef(false);
  // While a demo plays, the tutorial ring's hole sits on this
  // rect — the card's — instead of the step's target (see
  // playDemo and the ring render). Measured at the tap,
  // cleared when the demo lands.
  const [demoCardRect, setDemoCardRect] = useState<TutorialRect | null>(
    null
  );
  // Mirrored for the demo's timers, which must judge the step
  // that's open when they FIRE (an Esc mid-demo closes the
  // tour; the landing timer must not reopen it).
  const tutorialStepRef = useRef<number | null>(null);
  tutorialStepRef.current = tutorialStep;
  const tutorialDecidedRef = useRef(false);
  const tutorialArmedRef = useRef(false);
  // Replay bookkeeping: whether the tour currently open was
  // force-opened (its close must not write the seen flag), and
  // whether a forced request is waiting for a song card.
  const tutorialForcedRef = useRef(false);
  const tutorialForcePendingRef = useRef(false);

  const markTutorialSeen = () => {
    try {
      window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      /* localStorage unavailable — the tour may re-offer next visit */
    }
  };
  // Finishing and skipping are the same exit: the flag is set
  // either way (once means once) and the geometry resets so a
  // (never expected) reopen measures fresh. A FORCED (replay)
  // viewing is the one exception: it leaves the seen flag
  // exactly as it was — a replay neither earns nor spends the
  // first-run offer.
  const closeTutorial = () => {
    if (!tutorialForcedRef.current) {
      markTutorialSeen();
    }
    tutorialForcedRef.current = false;
    setTutorialStep(null);
    setTutorialRect(null);
    tutorialRectRef.current = null;
    setTutorialSheetPos(null);
    tutorialSheetPosRef.current = null;
  };

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
      const raw = window.sessionStorage.getItem(
        SECTION_MILESTONES_FIRED_KEY
      );
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSectionMilestonesFired(
            new Set(
              parsed.filter(
                (k): k is string => typeof k === 'string'
              )
            )
          );
        }
      }
      // Retire the old single-checkpoint guard's key and the
      // count-based milestones' fired key (section milestones
      // replaced both systems).
      window.sessionStorage.removeItem('weezer-deck-checkpoint-dismissed');
      window.sessionStorage.removeItem('weezer-deck-milestones-fired');
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
    // While a milestone card owns the screen, the toggle sits
    // behind it — flipping it would silently reposition the deck
    // underneath a card the user hasn't answered yet.
    if (milestonePending) return;
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
    // The write is landing — the unmount flush stands down.
    pendingSortRef.current = null;
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

    // Section milestone: this sort may have COMPLETED the
    // section the song belongs to — incomplete in the pre-sort
    // map, complete in the prospective one. A sort changes
    // exactly one song, so at most one section can complete;
    // each section fires at most once per session; and a
    // section already complete before this sort (finished in
    // the list, or on an earlier visit) can never cross here —
    // nothing fires retroactively. (Completing the LAST open
    // section lands on `total`, which shows the completion
    // card instead — milestones never fire there.)
    const newCategorized = countCategorizedSongs(prospective);
    if (newCategorized < total) {
      const section = sections.find((s) =>
        s.songs.some((x) => x.id === song.id)
      );
      if (
        section &&
        !sectionMilestonesFired.has(section.key) &&
        !sectionIsComplete(section, triageMap) &&
        sectionIsComplete(section, prospective)
      ) {
        setSectionMilestonesFired((prev) => {
          const next = new Set(prev);
          next.add(section.key);
          try {
            window.sessionStorage.setItem(
              SECTION_MILESTONES_FIRED_KEY,
              JSON.stringify(Array.from(next))
            );
          } catch {
            /* the state update above still covers this mount */
          }
          return next;
        });
        setMilestonePending(
          buildSectionMilestone(section, prospective, sections)
        );
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
  //   stamp + flip: a button sort first holds the tapped
  //     verdict's stamp on the face-up card for STAMP_BEAT_MS
  //     (phase 'stamp'), then flips the card edge-on over
  //     FLIP_OUT_MS; act() runs at the midpoint (the content
  //     swaps while the card is edge-on and invisible), then it
  //     flips back over FLIP_IN_MS.
  // While phase !== 'idle', pointer drags, button taps, jumps and
  // keys are all ignored — the 'stamp' beat included, so a
  // second tile tap mid-sequence can't stack another one.
  // Timers are tracked and cleared on unmount (e.g. toggling to
  // the list mid-animation cancels the pending action rather
  // than firing it into a hidden view).
  const [phase, setPhase] = useState<CardAnimPhase>('idle');
  const [exitX, setExitX] = useState(0);
  // The control (bucket tile or Don't Know It) whose sort is
  // mid-sequence: it wears a committed dark fill from the tap
  // through the stamp beat and the flip so the tap unmistakably
  // registers, and resets the instant the flip completes
  // (cleared in the same timer that returns the phase to
  // 'idle').
  const [flipTarget, setFlipTarget] = useState<TriageValue | null>(null);
  // The verdict whose stamp a button sort is holding on the
  // card during its stamp beat: a render-only override (see
  // sortStampVisual below), set at the tap and cleared in the
  // same timer that runs act() at the flip's midpoint. It has
  // to exist because the stamp derivation reads the DISPLAYED
  // song's triage value — and act() writes the value and
  // advances the position in one batch, so without an override
  // there is never a render where the tapped song shows its
  // own new stamp (owner report, Oct 17: the stamp was only
  // ever seen later, swiping back to the sorted song).
  const [sortStamp, setSortStamp] = useState<TriageValue | null>(null);
  // Mirrored for the nudge's fire-time check (its timer closes
  // over stale state otherwise).
  phaseRef.current = phase;
  const timersRef = useRef<number[]>([]);
  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  // PENDING SORT FLUSH — a control-sort's write lands at the
  // flip's midpoint (~600ms after the tap: stamp beat + flip).
  // Until then the deck's exits (the Dashboard pill, the menu)
  // stay live, and unmounting cleared the timers — the verdict
  // was silently LOST (the user saw the stamp land; nothing was
  // ever written). Track the in-flight sort and flush its write
  // on unmount. The flush is a bare write: no position advance,
  // no milestone ceremony (the moment has passed; the list
  // records the verdict identically).
  const pendingSortRef = useRef<{ songId: string; value: TriageValue } | null>(
    null
  );
  const handleSetBucketRef = useRef(handleSetBucket);
  handleSetBucketRef.current = handleSetBucket;

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      const pending = pendingSortRef.current;
      if (pending) {
        pendingSortRef.current = null;
        handleSetBucketRef.current(pending.songId, pending.value);
      }
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

  // Sort via a control, as one visual sentence: the tapped
  // verdict's stamp lands on the still-face-up card and holds
  // for STAMP_BEAT_MS (phase 'stamp' — input locked, like every
  // non-idle phase, so tiles/drag/keys can't pile a second
  // sequence on), then the card flips edge-on, act(value) runs
  // at the midpoint, and it flips back. Used by the bucket
  // tiles, Don't Know It, and keys 1–5 — every "sort via a
  // control" path gets the same sequence. act() itself is
  // untouched: the write and any section milestone still land
  // at the flip's midpoint, exactly as they did when the flip
  // started at the tap. The activated control is marked
  // (flipTarget) from the tap until the flip completes, so it
  // shows its committed state for the whole sequence.
  const flipAct = (value: TriageValue) => {
    if (phase !== 'idle' || !currentSong || milestonePending) return;
    noteUserInteraction();
    pendingSortRef.current = { songId: currentSong.id, value };
    setFlipTarget(value);
    setSortStamp(value);
    setPhase('stamp');
    schedule(() => {
      setPhase('flip-out');
      schedule(() => {
        act(value);
        setSortStamp(null);
        setPhase('flip-in');
        schedule(() => {
          setPhase('idle');
          setFlipTarget(null);
        }, FLIP_IN_MS);
      }, FLIP_OUT_MS);
    }, STAMP_BEAT_MS);
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
      // UNSORTED song. A fully sorted section used to be a silent
      // no-op — the tap looked broken. The user asked for this
      // album by name, so land on its first song anyway (the
      // toggle reasserts itself on the next navigation).
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
      if (idx === -1) idx = startIdx;
    }
    // Plain first song of the section otherwise — the deck is a
    // browser, so a jump lands on the section's start whether or
    // not its songs are sorted yet. A jump also dismisses the
    // completion card: at 206 categorized the card outranks
    // position, so without this the jump landed nowhere visible.
    setMilestonePending(null);
    setCompletionDismissed(true);
    setPosition(idx);
  };

  // EXTERNAL ALBUM JUMP — a dashboard Catalog Completion tap
  // hands its section over via Step1Triage (the consumed
  // sessionStorage handoff). Applied through the very same
  // jumpToSection the Jump-to-album dropdown uses, so the
  // landing is identical by construction: first song of the
  // section (the deck mounts with Hide Sorted off, the state
  // the dropdown's jump normally meets), any pending milestone
  // cleared the same way. Reported consumed immediately, so
  // the handoff fires exactly once.
  useEffect(() => {
    if (!pendingJumpSectionKey) return;
    jumpToSection(pendingJumpSectionKey);
    onJumpApplied();
    // Keyed on the handoff value alone; jumpToSection and
    // onJumpApplied are render-scope closures over live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJumpSectionKey]);

  // "Keep sorting" — the position already advanced to the pending
  // next card when the triggering sort landed (see act()), so
  // dismissing just hands the screen back to it. (If that position
  // is one past the last card, the end card shows instead.)
  const dismissMilestone = () => {
    setMilestonePending(null);
  };

  // MILESTONE ACTION STACKS (milestone-flows memo §2, re-
  // pointed at the section cards, Oct 17; slimmed by the
  // milestone diet, owner Oct 17). What renders under a
  // milestone card's copy depends on the CARD and on who is
  // sorting:
  //   Blue card:      "Continue Sorting" (primary) — no Save
  //                   prompt yet, even for guests; the owner's
  //                   flow puts the first one on the Pinkerton
  //                   card. The label is the owner's wording
  //                   for this card only (Oct 18), passed in as
  //                   keepLabel by the caller.
  //   Pinkerton card: Save (primary) · Keep sorting for
  //                   guests; Keep (primary) for signed-in.
  //   Singles + album cards: the Pinkerton stack, plus the
  //                   Refine text link when the sorter is
  //                   eligible.
  // The diet removed the guest explainer line, the Garage
  // off-ramp, and the Refine button + its explainer: a guest's
  // Keep button now carries the guest state in its label
  // ("Keep sorting as a guest"), and Refine survives only as
  // a quiet text link at the very bottom of the stack. "Keep
  // sorting" wears the primary (amber) treatment whenever no
  // Save button is on the card to outrank it. Eligibility runs
  // on bucketedCount (real buckets only) against
  // THREAD_SHORT_PATH_GOAL — a milestone earned mostly on
  // Don't Know It marks gets the celebration and (from
  // Pinkerton on) the Save offer, but no Refine. Refine calls
  // handleFinishTriage — it goes to ranking, the step that
  // produces the master list the Thread is compiled from.
  const refineEligible = bucketedCount >= THREAD_SHORT_PATH_GOAL;
  const renderMilestoneActions = ({
    showSave,
    showRefine,
    keepLabel,
  }: {
    showSave: boolean;
    showRefine: boolean;
    keepLabel?: string;
  }) => (
    <div className="w-full max-w-sm flex flex-col items-center gap-1.5">
      {showSave && isGuest && (
        <SaveProgressButton onClick={onCreateAccount} />
      )}
      <button
        onClick={dismissMilestone}
        className={
          showSave && isGuest
            ? 'w-full text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-6 py-3.5 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap'
            : 'w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-6 py-3.5 rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 whitespace-nowrap'
        }
      >
        {keepLabel ?? (isGuest ? 'Keep sorting as a guest' : 'Keep sorting')}
      </button>
      {showRefine && refineEligible && (
        <button
          onClick={handleFinishTriage}
          className="text-sm font-bold text-slate-400 hover:text-[#0072CE] underline underline-offset-4 transition cursor-pointer py-1"
        >
          Refine →
        </button>
      )}
    </div>
  );

  // Keyboard: 1–5 pick the buckets in displayed order (sort the
  // current card, with the flip), U steps back one card. Ignored
  // while typing in a form field or when a modal state
  // (milestone / completion / the tutorial) owns the screen.
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
      if (milestonePending || isComplete || tutorialStep !== null) return;
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
        data-tutorial={`bucket-${bucket}`}
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

  // The pending milestone's visual payload, pulled out flat
  // for the render below (cover art on the album-family cards,
  // factoid on the singles and album cards — see
  // buildSectionMilestone).
  const milestoneCover = milestonePending?.cover ?? null;
  const milestoneFactoid = milestonePending?.factoid ?? null;

  // TUTORIAL — the show decision. Like the nudge below, it
  // settles on a short timer and judges the world at FIRE
  // time (read through a ref mirror): the triage map can
  // hydrate a beat after mount, and the fresh-sorter check
  // must see the loaded map, not the empty first render.
  // Rules, in order:
  //   seen flag already set → never show.
  //   categorizedCount > 0  → not a fresh sorter: set the seen
  //     flag (a permanent skip, so this check stays cheap
  //     forever) and never show.
  //   a non-song card is up (milestone / end / completion) →
  //     never this session; the flag is left alone.
  //   the user already interacted → they beat the tour to it:
  //     never this session, flag left alone (swipes alone
  //     don't categorize anything — they may still be fresh
  //     on a later visit).
  //   otherwise → open at step 1, and retire the nudge for the
  //     session (the tour teaches swiping itself): cancel any
  //     armed nudge timers and mark it done.
  const tutorialStateRef = useRef({ inSong: false, categorized: 0 });
  tutorialStateRef.current = {
    inSong: inSongState,
    categorized: categorizedCount,
  };

  // TUTORIAL REPLAY — forced opens, for the header "?" button's
  // Replay entry (AppShell). The request arrives two ways (see
  // TUTORIAL_FORCE_KEY above): the sessionStorage flag, consumed
  // on mount below, and the window event, for a deck already on
  // screen. A forced open ignores the seen flag, the
  // fresh-sorter rule, and the already-interacted rule — the
  // user explicitly asked — but it still waits for a normal
  // song card: if a milestone / end / completion card is up
  // when the request lands, the request stays pending and the
  // tour opens on the next song card instead (the watcher
  // effect below). Opening retires the nudge for the session,
  // exactly like the first-run open, and consumes the flag so
  // a later remount doesn't replay the replay.
  const openForcedTutorial = () => {
    try {
      window.sessionStorage.removeItem(TUTORIAL_FORCE_KEY);
    } catch {
      /* sessionStorage unavailable */
    }
    tutorialForcePendingRef.current = false;
    tutorialForcedRef.current = true;
    markNudgeDone();
    cancelNudge();
    setTutorialStep(0);
  };
  const requestForcedTutorial = () => {
    if (tutorialStep !== null) return; // the tour is already up
    if (tutorialStateRef.current.inSong) {
      openForcedTutorial();
    } else {
      tutorialForcePendingRef.current = true;
    }
  };

  // Consume the sessionStorage flag on mount. Declared BEFORE
  // the first-run decision effect so a consumed request marks
  // that decision made and the effect stands down — a replay
  // must not also run the fresh-sorter bookkeeping.
  useEffect(() => {
    let forced = false;
    try {
      forced =
        window.sessionStorage.getItem(TUTORIAL_FORCE_KEY) === '1';
    } catch {
      /* sessionStorage unavailable — the event route still works */
    }
    if (!forced) return;
    tutorialDecidedRef.current = true;
    tutorialArmedRef.current = true;
    requestForcedTutorial();
    // Mount-only: requestForcedTutorial judges the world
    // through the state mirror — the same pattern the
    // first-run decision effect below uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The already-mounted route: AppShell dispatches this when
  // Replay is tapped while the triage step is on screen.
  useEffect(() => {
    const onReplay = () => requestForcedTutorial();
    window.addEventListener(TUTORIAL_REPLAY_EVENT, onReplay);
    return () =>
      window.removeEventListener(TUTORIAL_REPLAY_EVENT, onReplay);
    // Re-bound when the card state changes so the closure's
    // requestForcedTutorial sees the current card and step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSongState, tutorialStep]);

  // A pending forced request opens the moment a normal song
  // card is on screen (e.g. the milestone that was up when the
  // request landed gets dismissed).
  useEffect(() => {
    if (
      tutorialForcePendingRef.current &&
      inSongState &&
      tutorialStep === null
    ) {
      openForcedTutorial();
    }
    // openForcedTutorial only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSongState, tutorialStep]);

  useEffect(() => {
    if (tutorialDecidedRef.current || tutorialArmedRef.current) {
      return;
    }
    tutorialArmedRef.current = true;
    const id = window.setTimeout(() => {
      tutorialDecidedRef.current = true;
      let seen = false;
      try {
        seen = window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
      } catch {
        /* localStorage unavailable — treat as unseen */
      }
      if (seen) return;
      const s = tutorialStateRef.current;
      if (s.categorized > 0) {
        markTutorialSeen();
        return;
      }
      if (!s.inSong) return;
      if (userInteractedRef.current) return;
      markNudgeDone();
      cancelNudge();
      setTutorialStep(0);
    }, 350);
    return () => window.clearTimeout(id);
    // Mount-only arming: the fire-time checks read refs, so the
    // closure never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TUTORIAL — geometry. Two measurements per pass. The RING:
  // the step's target (found by its data-tutorial attribute)
  // measured against the deck root, padded 4px a side — the
  // ring lives inside the overlay root, so root-relative is
  // correct for it. The SHEET, on adjacent steps only: the
  // target's own viewport rect (getBoundingClientRect is
  // viewport-relative already — no root subtraction; doing
  // this root-relative was the v1 bug) plus the sheet's real
  // height, resolved to a hover just above the target (below
  // it if above would crowd the top safe area, clamped
  // inside the visual viewport if neither fits whole). The
  // five bucket tiles share the tray row, so their sheets all
  // land just above the tray and stay roughly put while the
  // ring walks tile to tile. State updates are skipped when
  // nothing moved, so the scroll/resize listeners can't loop.
  const measureTutorial = () => {
    if (tutorialStep === null) return;
    const root = deckRootRef.current;
    if (!root) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    const el = root.querySelector<HTMLElement>(
      `[data-tutorial="${step.target}"]`
    );
    if (!el) return;
    const rootRect = root.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const rect: TutorialRect = {
      top: t.top - rootRect.top - 4,
      left: t.left - rootRect.left - 4,
      width: t.width + 8,
      height: t.height + 8,
    };
    const prevRect = tutorialRectRef.current;
    if (
      !prevRect ||
      Math.abs(prevRect.top - rect.top) > 0.5 ||
      Math.abs(prevRect.left - rect.left) > 0.5 ||
      Math.abs(prevRect.width - rect.width) > 0.5 ||
      Math.abs(prevRect.height - rect.height) > 0.5
    ) {
      tutorialRectRef.current = rect;
      setTutorialRect(rect);
    }
    if (step.placement !== 'adjacent') return;
    const sheetH = tutorialSheetRef.current?.offsetHeight ?? 190;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const safe = readSafeAreaInsets();
    const width = Math.min(vw - 24, 400);
    const centerX = t.left + t.width / 2;
    const left = Math.max(
      12,
      Math.min(centerX - width / 2, vw - 12 - width)
    );
    const minTop = 12 + safe.top;
    const maxTop = Math.max(minTop, vh - 12 - safe.bottom - sheetH);
    const aboveTop = t.top - 12 - sheetH;
    const belowTop = t.bottom + 12;
    let top: number;
    if (aboveTop >= minTop) {
      top = aboveTop;
    } else if (belowTop <= maxTop) {
      top = belowTop;
    } else {
      top = Math.max(minTop, Math.min(aboveTop, maxTop));
    }
    const pos: TutorialSheetPos = { top, left, width };
    const prevPos = tutorialSheetPosRef.current;
    if (
      !prevPos ||
      Math.abs(prevPos.top - pos.top) > 0.5 ||
      Math.abs(prevPos.left - pos.left) > 0.5 ||
      Math.abs(prevPos.width - pos.width) > 0.5
    ) {
      tutorialSheetPosRef.current = pos;
      setTutorialSheetPos(pos);
    }
  };

  // While the tour is open: measure on open and on every step
  // change, follow resize/scroll, and take two settling passes
  // (late layout shifts — fonts, album art — can move the
  // target just after a step change).
  useEffect(() => {
    if (tutorialStep === null) return;
    measureTutorial();
    const onChange = () => measureTutorial();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    const t1 = window.setTimeout(measureTutorial, 60);
    const t2 = window.setTimeout(measureTutorial, 340);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // measureTutorial closes over the step that just changed;
    // re-binding per step is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep]);

  // Esc closes the tour — a skip, so closeTutorial sets the
  // seen flag exactly as the Skip link and the final button do.
  useEffect(() => {
    if (tutorialStep === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTutorial();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // closeTutorial only touches setters and localStorage;
    // re-binding on step change is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialStep]);

  const advanceTutorial = () => {
    if (tutorialStep === null) return;
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
    } else {
      setTutorialStep(tutorialStep + 1);
    }
  };

  // TUTORIAL DEMO — on a bucket step, tapping the ringed tile
  // rehearses a real sort: the bucket's stamp lands on the
  // card, the tile wears its committed fill, and the card
  // flips — the same visual sentence a real button sort
  // speaks (stamp beat, then flipAct's flip), driven here by
  // timers alone. It calls NO sort path: handleSetBucket,
  // act() and flipAct() are never invoked, nothing is
  // written (no triageMap, no localStorage, no passed mark),
  // the deck does not advance and progress does not move —
  // setPhase/setFlipTarget/setDemoBucket are pure render
  // state. The stamp gets a beat to read (STAMP_BEAT_MS)
  // before the flip starts; when the flip lands (~900ms
  // total) the rehearsal state clears — the card is back to
  // its normal unsorted front — and the tour steps forward.
  // The landing timer judges the step through the ref: if
  // the tour was closed mid-demo (Esc), it just cleans up.
  // THE SPOTLIGHT FOLLOWS THE PERFORMANCE: the stamp and the
  // flip happen on the CARD, but on a bucket step the ring's
  // hole sits on the TILE — so the whole show played under
  // the dim (the ring's 9999px shadow washes everything
  // outside its hole at 62% slate), in the corner of the eye
  // while the user's attention was on the bright tile. For
  // the demo's duration the ring's hole moves to the card
  // (demoCardRect, measured here with measureTutorial's
  // root-relative math) and the tile takes the dim instead.
  const playDemo = (bucket: BucketType) => {
    if (tutorialStep === null || demoPlayingRef.current) return;
    const stepAtTap = tutorialStep;
    demoPlayingRef.current = true;
    setDemoPlaying(true);
    setDemoBucket(bucket);
    setFlipTarget(bucket);
    const root = deckRootRef.current;
    const cardEl = root?.querySelector<HTMLElement>(
      '[data-tutorial="card"]'
    );
    if (root && cardEl) {
      const rootRect = root.getBoundingClientRect();
      const t = cardEl.getBoundingClientRect();
      setDemoCardRect({
        top: t.top - rootRect.top - 4,
        left: t.left - rootRect.left - 4,
        width: t.width + 8,
        height: t.height + 8,
      });
    }
    schedule(() => {
      setPhase('flip-out');
      schedule(() => {
        setPhase('flip-in');
        schedule(() => {
          setPhase('idle');
          setFlipTarget(null);
          setDemoBucket(null);
          setDemoCardRect(null);
          demoPlayingRef.current = false;
          setDemoPlaying(false);
          if (tutorialStepRef.current === stepAtTap) {
            advanceTutorial();
          }
        }, FLIP_IN_MS + 60);
      }, FLIP_OUT_MS);
    }, STAMP_BEAT_MS);
  };

  // NUDGE — arm once, the first time a song card is on screen
  // (if the session opens on a milestone/end/completion card,
  // this waits for the first actual song card). ~600ms later the
  // card eases −18px, +8px, then settles to 0 over ~900ms total,
  // driven through the shell's transform (nudgeX) with its
  // ease-in-out transition. Fire-time guards: any earlier user
  // interaction retires it (noteUserInteraction), and it never
  // runs mid-drag or mid-animation.
  useEffect(() => {
    if (
      !inSongState ||
      tutorialStep !== null ||
      nudgeDoneRef.current ||
      nudgeArmedRef.current
    ) {
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
  }, [inSongState, tutorialStep]);

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
  // A verdict value as a stamp: Don't Know It in brand blue; a
  // bucket in its own ink (BUCKET_CONFIG.color) under its
  // label, with the deck's 'Slaps' shortening. One derivation
  // shared by the static stamp (a song's standing verdict),
  // the sort stamp (a button sort's beat) and the tutorial
  // demo stamp — the three differ only in who drives them.
  const stampForValue = (
    value: TriageValue
  ): { text: string; ink: string; size: string } =>
    value === 'unknown'
      ? {
          text: 'Don’t Know It',
          ink: 'border-[#0072CE] text-[#0072CE]',
          size: 'text-xl',
        }
      : {
          text:
            value === 'slaps'
              ? 'Slaps'
              : BUCKET_CONFIG[value as BucketType].label,
          ink: BUCKET_CONFIG[value as BucketType].color,
          size: 'text-2xl',
        };

  const currentValue = currentSong ? triageMap[currentSong.id] : undefined;
  const staticStamp: { text: string; ink: string; size: string } | null =
    !currentSong
      ? null
      : currentValue !== undefined
      ? stampForValue(currentValue)
      : passedIds.has(currentSong.id)
      ? {
          text: 'Not Sorted',
          ink: 'border-slate-500 text-slate-600',
          size: 'text-2xl',
        }
      : null;

  // SORT STAMP — while a button sort's stamp beat runs (see
  // flipAct), the tapped verdict's stamp takes the static
  // stamp's place on the still-displayed song. Because it
  // outranks the static stamp, a re-sort shows the NEW bucket
  // for the beat, not the song's standing verdict.
  const sortStampVisual: { text: string; ink: string; size: string } | null =
    sortStamp === null ? null : stampForValue(sortStamp);

  // TUTORIAL DEMO STAMP — while a bucket step's rehearsal is
  // playing, the demo bucket's stamp takes the static stamp's
  // place (the shared derivation above, 'Slaps' shortening
  // included). Purely visual: the triage map is never touched,
  // so when the demo clears, the card's real state shows
  // through again.
  const demoStamp: { text: string; ink: string; size: string } | null =
    demoBucket === null ? null : stampForValue(demoBucket);
  const shownStamp = demoStamp ?? sortStampVisual ?? staticStamp;

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

  // TUTORIAL render inputs: the open step's def; its measured
  // adjacent sheet position (null while the step is a bottom
  // step, and until the first measure lands on an adjacent
  // step — the sheet renders as the bottom sheet meanwhile);
  // the bucket the step's tap zone demos (bucket steps only,
  // null everywhere else); and whether the tour sits on its
  // final step, which turns on the card's sway (see
  // DeckCardShell's `swaying` prop).
  const tutorialDef =
    tutorialStep !== null ? TUTORIAL_STEPS[tutorialStep] : null;
  const tutorialAdjacentPos =
    tutorialDef?.placement === 'adjacent' ? tutorialSheetPos : null;
  const tutorialDemoBucket = tutorialDef?.bucket ?? null;
  // The ring's hole: the step target's measured rect —
  // EXCEPT while a demo plays, when the hole moves to the
  // card (demoCardRect, at the card steps' 30px radius) so
  // the stamp + flip perform in the clear instead of under
  // the dim (see playDemo).
  const tutorialRingRect = demoCardRect ?? tutorialRect;
  const tutorialRingRadius =
    demoCardRect !== null
      ? 30
      : tutorialStep !== null
      ? TUTORIAL_STEPS[tutorialStep].radius
      : 0;
  const tutorialSwaying =
    tutorialStep !== null &&
    tutorialStep === TUTORIAL_STEPS.length - 1;

  return (
    <div
      ref={deckRootRef}
      className="relative flex-1 min-h-0 flex flex-col w-full max-w-[560px] mx-auto px-4"
    >
      {/* COMPACT PROGRESS — one line + a slim bar. Same counts as the
          list header (categorizedCount / bucketedCount), so the two
          views always agree. The percent rides with the count on the
          LEFT (owner); the right side keeps the list view's Hide
          Sorted checkbox (owner: it replaces the old milestone-
          distance suffix — the milestone cards pace the deck now,
          the line just reports progress) and the help button. */}
      <div className="shrink-0 pt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-700">
          <div className="flex items-center gap-2">
            {/* PAGE EXIT — back to the dashboard (onOpenGarage
                is page.tsx's navigateTo('dashboard'), the
                normal navigation path). Page chrome in the
                progress row: it rides above the card region,
                so it never lands inside a milestone / end /
                completion card, and the tutorial overlay
                covers the whole deck root — this included —
                while the tour is up. */}
            <DashboardBackButton onClick={onOpenGarage} />
            <span className="uppercase tracking-wider">
              <strong className="text-[#0072CE] text-xs">
                {categorizedCount}
              </strong>{' '}
              of {total} sorted
            </span>
            <span className="text-[#0072CE] text-xs">
              {progressPercent}%
            </span>
          </div>
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
            <HelpButton />
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
          here, in the adaptive shell (362px floor, grows to fit —
          see DeckCardShell). */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center py-2">
        {milestonePending ? (
          /* MILESTONE — a sort just completed a section (see the
             SECTION MILESTONES block up top). It replaces the
             next song card: the sort and the position advance
             already landed in act(), so "Keep sorting" simply
             hands the screen back. Not swipeable (no swipe prop,
             like the completion card); the tray hides while it
             shows (inSongState is false). The card leads
             IN-FLOW with the section album's cover art (the
             singles card keeps the award seal, MilestoneRibbon),
             then the section's copy as built at fire time:
             headline always; body / compel only when the card
             has them (the Blue card is two lines, the Pinkerton
             card's snark IS its headline); the factoid — one big
             figure and a one-line label — on the singles and
             album cards. Below the copy sits the card's ACTION
             STACK (renderMilestoneActions): the Save button from
             the Pinkerton card on (guests only), the Keep button
             under it, and the Refine text link (25+ real
             buckets) at the very bottom of the singles and
             album cards. The shell here is ADAPTIVE (Overnight
             3.5): the tallest stacks can't fit 362px at phone
             width, so the card grows to fit them in flow instead
             of the stack painting outside the card's bounds;
             stacks that fit render in exactly 362px, as before. */
          <DeckCardShell adaptive>
            <div className="min-h-[362px] flex flex-col items-center justify-center text-center px-6 py-3 sm:px-8 sm:py-4 space-y-1.5 sm:space-y-2">
              {milestoneCover ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={milestoneCover.src}
                    alt={`${milestoneCover.album} cover art`}
                    className="h-28 w-28 object-cover rounded-2xl shadow-md"
                  />
                </>
              ) : (
                <MilestoneRibbon />
              )}
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                {milestonePending.headline}
              </h2>
              {milestonePending.body && (
                <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                  {milestonePending.body}
                </p>
              )}
              {milestoneFactoid && (
                <div className="flex flex-col items-center gap-1 pt-1">
                  <span className="text-[44px] leading-none font-black tracking-tight text-[#0072CE]">
                    {milestoneFactoid.figure}
                  </span>
                  <span className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                    {milestoneFactoid.label}
                  </span>
                </div>
              )}
              {milestonePending.compel && (
                <p className="text-sm font-bold text-slate-400 leading-snug max-w-sm mx-auto">
                  {milestonePending.compel}
                </p>
              )}
              {renderMilestoneActions({
                showSave: milestonePending.kind !== 'blue',
                showRefine:
                  milestonePending.kind === 'singles' ||
                  milestonePending.kind === 'album',
                keepLabel:
                  milestonePending.kind === 'blue'
                    ? 'Continue Sorting'
                    : undefined,
              })}
            </div>
          </DeckCardShell>
        ) : isComplete && !completionDismissed ? (
          /* COMPLETION — every song categorized (the same count the
             list's "Categorize All Songs" lock runs on). Takes
             precedence over the end card: a fully sorted deck has
             nothing left to review. The action stack (memo §2
             scenarios 9–10, decision §3.5): this is the
             highest-intent moment in the app, so a GUEST gets the
             Save button as the card's PRIMARY action — ahead of
             "Next Step: Refine Buckets", which stays exactly as
             it was — because a guest who refines without saving
             can still lose everything. (The milestone diet,
             owner Oct 17, removed the guest explainer line that
             used to sit above the Save button and the Garage
             link that used to close this stack.) Signed-in users
             see no Save, just the Refine button. */
          <DeckCardShell adaptive>
            <div className="min-h-[362px] flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-5">
              <div className="text-4xl">🏆</div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                All {total} songs sorted
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                206 songs. One very personal theory of Weezer. Time to
                fine-tune your rankings.
              </p>
              {isGuest && <SaveProgressButton onClick={onCreateAccount} />}
              {bucketedCount >= 1 ? (
                <button
                  onClick={handleFinishTriage}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 inline-flex items-center gap-2.5 whitespace-nowrap"
                >
                  <FlyingWIcon className="w-6 h-4 text-slate-950" />
                  <span>Next Step: Refine Buckets</span>
                </button>
              ) : (
                /* Every song marked Don't Know It: Refine is still
                   locked (it needs ≥1 real bucket), so the button
                   would guard-bounce straight back to this card
                   forever. Say what's needed instead of looping. */
                <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 leading-snug max-w-sm mx-auto">
                  Refine Buckets unlocks when at least one song is in
                  a real bucket — Don&apos;t Know It marks don&apos;t
                  count. Re-bucket one song below to keep going.
                </p>
              )}
              {/* The way back IN: before this, a finished deck had
                  no path back to a song card — this card outranked
                  position, so there was no way to re-check or
                  change a single verdict in deck mode. */}
              <button
                onClick={() => {
                  setCompletionDismissed(true);
                  setPosition(deckLength - 1);
                }}
                className="text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-6 py-3.5 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
              >
                Review or change a song
              </button>
            </div>
          </DeckCardShell>
        ) : atEnd ? (
          /* END OF DECK — one past the last card. The shell stays
             draggable so a right swipe flies back to the last song;
             it can't be swiped forward. Passed-but-unsorted songs
             get their count and a review jump; a fully sorted deck
             never lands here (the completion card above wins).
             A GUEST also gets one quiet save line above the button
             row (memo §2 scenario 11) — text-weight, not a button,
             so Review the unsorted / Start ranking keep the visual
             lead; its "Create a free account" is the tappable link
             inside the sentence. Signed-in users see no line. */
          <DeckCardShell swipe={swipeProps} adaptive>
            <div className="min-h-[362px] flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-5">
              <div className="text-4xl">🎴</div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                That&apos;s the whole deck
              </h2>
              {passedUnsortedCount > 0 ? (
                <>
                  <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                    {passedUnsortedCount}{' '}
                    {passedUnsortedCount === 1 ? 'song' : 'songs'} escaped
                    your verdict. Want another look?
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
                  No loose ends. Swipe back if you want to change a verdict.
                </p>
              )}
              {isGuest && (
                <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
                  Don&apos;t lose your place.{' '}
                  <button
                    onClick={onCreateAccount}
                    className="font-extrabold text-[#0072CE] hover:text-[#005fae] underline underline-offset-2 transition cursor-pointer"
                  >
                    Create a free account
                  </button>{' '}
                  to save your progress.
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  onClick={() => {
                    if (hideSorted && backTarget === -1) {
                      // Nowhere unsorted behind (e.g. a finished
                      // deck browsed after dismissing the
                      // completion card): toggling Hide Sorted off
                      // steps back to the last song — the button
                      // used to just do nothing here.
                      toggleHideSorted(false);
                    } else {
                      goBack();
                    }
                  }}
                  className="text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-6 py-3.5 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
                >
                  {/* Under Hide Sorted, Back lands on the last
                      UNSORTED card — the label used to promise
                      "the last card" and land somewhere else. */}
                  {hideSorted && backTarget !== -1
                    ? '← Back to the last unsorted card'
                    : '← Back to the last card'}
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
          <DeckCardShell swipe={swipeProps} swaying={tutorialSwaying}>
            <div className="relative h-full flex flex-col items-center text-center px-5 py-4 gap-2.5">
              {/* STATIC STAMP — same anchor as the drag stamps
                  (the art slot's center: py-4 + half of h-28 =
                  top-[72px]), rendered only while no drag stamp
                  is up. It sits over the art; the preview button
                  lives in the card's bottom slot, far below the
                  stamp's band, so they can never overlap.
                  shownStamp is the song's standing verdict —
                  except during a button sort's stamp beat (the
                  tapped verdict, see sortStampVisual) or a
                  tutorial demo (the demo bucket's stamp). */}
              {shownStamp && stampKind === null && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-1/2 top-[72px] z-10 -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] rounded-lg border-[3px] px-3 py-1 font-black uppercase tracking-widest opacity-90 bg-white/60 ${shownStamp.size} ${shownStamp.ink}`}
                >
                  {shownStamp.text}
                </span>
              )}
              {/* ART — a fixed 112px slot; it no longer flexes or
                  shrinks to make room for the title. */}
              <div className="h-28 w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(resolveAlbumId(currentSong))}
                  alt={`${currentSong.album} cover art`}
                  className="h-28 w-28 object-cover rounded-xl shadow-lg border-[3px] border-white ring-1 ring-slate-900/10"
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
                  the card's last slot. The wrapper carries the
                  tutorial's target attribute — the tour measures
                  it to ring the button (see the TUTORIAL block). */}
              <div data-tutorial="preview">
                <AudioPreviewButton title={currentSong.title} large />
              </div>
            </div>
          </DeckCardShell>
        )}
      </div>

      {/* ACTIONS — pinned at the bottom of the column: the mock's
          light tray holds ONLY the five tier tiles; Don't Know It
          sits on one quiet centered line below the tray (owner,
          Oct 16); the Jump row sits beneath that. (The Deck | List
          toggle that used to ride in the Jump row — and as a footer
          pill in the non-song states — is gone, owner Oct 18: users
          stay in their persisted view; the view-mode preference
          itself still lives in Step1Triage.) There's no Undo
          button (owner, Oct 16) — swipe right or the U key steps
          back one card. */}
      {inSongState && (
        <div className="shrink-0">
          <div
            data-tutorial="tray"
            className="bg-slate-100 border border-slate-200/60 rounded-3xl shadow-sm p-3 [@media(max-height:740px)]:p-2.5"
          >
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
          </div>
          <p className="hidden sm:block text-center text-[10px] font-semibold text-slate-300 pt-1.5">
            Keys 1–5 pick a tier · U goes back
          </p>
        </div>
      )}

      {/* TUTORIAL — the coach-mark overlay (see the TUTORIAL
          blocks up top). It lives INSIDE the deck root and
          covers it entirely, so every pointer event lands on
          it and the deck beneath is inert; its own buttons are
          the only live controls, and [touch-action:none] keeps
          a backdrop drag from scrolling the page under it. The
          highlight ring punches its hole in the dim with a
          giant box-shadow and is pointer-events-none itself;
          before the first measure lands, a flat dim covers the
          root instead. The callout is the exception to the
          root-relative layout: it is a sheet FIXED to the
          viewport (no ancestor of it creates a containing
          block — verified: deck root, Step1Triage root, main
          and AppShell root carry no transform / filter /
          backdrop-filter / will-change / perspective, and the
          card's flip transform lives on a sibling subtree), so
          its buttons are always inside the visible area, above
          Safari's toolbar — the old root-measured placement
          could park it below the fold on phones, visible but
          unreachable. Steps 1 and 8 keep that bottom sheet.
          Steps 2–7 place the sheet ADJACENT to their target:
          measured in viewport coordinates (see
          measureTutorial), hovering just above it — below it
          only when above doesn't fit — because anchoring to
          the screen's top put the sheet inches from the
          element it pointed at (owner report, Oct 17); until
          the first measure lands, an adjacent step's sheet
          renders as the bottom sheet, always reachable. On
          bucket steps an invisible tap zone covers the ringed
          tile and plays the demo sort (see playDemo) — the
          one live surface besides the sheet's own buttons.
          The sheet uses the deck's vocabulary: white card,
          brand-blue step eyebrow, amber primary. No element
          here shifts the deck's layout. */}
      {tutorialStep !== null && (
        <div
          className="absolute inset-0 z-50 [touch-action:none]"
          role="dialog"
          aria-modal="true"
          aria-label="How the deck works"
        >
          {tutorialRingRect ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border-[3px] border-amber-400 transition-all duration-300"
              style={{
                top: tutorialRingRect.top,
                left: tutorialRingRect.left,
                width: tutorialRingRect.width,
                height: tutorialRingRect.height,
                borderRadius: tutorialRingRadius,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-slate-900/60"
            />
          )}
          {/* DEMO TAP ZONE — bucket steps only: an invisible
              button over the ring's rect (same root-relative
              box as the ring). It is the only tappable thing
              out here; the ring above/below it is visual only,
              and the deck beneath stays inert under the
              overlay. Tapping plays the demo (playDemo) —
              while one is playing, the handler ignores taps. */}
          {tutorialDemoBucket !== null && tutorialRect && (
            <button
              type="button"
              aria-label={`Try it: tap to sort as ${
                tutorialDemoBucket === 'slaps'
                  ? 'Slaps'
                  : BUCKET_CONFIG[tutorialDemoBucket].label
              }`}
              onClick={() => playDemo(tutorialDemoBucket)}
              className="absolute cursor-pointer"
              style={{
                top: tutorialRect.top,
                left: tutorialRect.left,
                width: tutorialRect.width,
                height: tutorialRect.height,
                borderRadius: TUTORIAL_STEPS[tutorialStep].radius,
              }}
            />
          )}
          <div
            ref={tutorialSheetRef}
            className={
              tutorialAdjacentPos
                ? 'fixed bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 transition-[top,left] duration-300 ease-out'
                : 'fixed left-3 right-3 mx-auto w-auto max-w-[400px] bg-white rounded-3xl border border-slate-200 shadow-2xl p-5'
            }
            style={
              tutorialAdjacentPos
                ? {
                    top: tutorialAdjacentPos.top,
                    left: tutorialAdjacentPos.left,
                    width: tutorialAdjacentPos.width,
                  }
                : {
                    bottom:
                      'calc(12px + env(safe-area-inset-bottom, 0px))',
                  }
            }
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-[#0072CE]">
              Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
            </p>
            <h3 className="text-lg font-black tracking-tight text-slate-950 mt-1">
              {TUTORIAL_STEPS[tutorialStep].headline}
            </h3>
            <p className="text-sm font-semibold text-slate-500 leading-snug mt-1">
              {TUTORIAL_STEPS[tutorialStep].line}
            </p>
            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                onClick={closeTutorial}
                disabled={demoPlaying}
                className="text-sm font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer py-1 disabled:opacity-40 disabled:cursor-default"
              >
                Skip tutorial
              </button>
              <div className="flex items-center gap-2">
                {tutorialStep > 0 && (
                  <button
                    onClick={() => setTutorialStep(tutorialStep - 1)}
                    disabled={demoPlaying}
                    className="text-sm font-extrabold text-slate-600 bg-white border border-slate-300 rounded-full px-5 py-2.5 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={advanceTutorial}
                  disabled={demoPlaying}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-5 py-2.5 min-h-[48px] inline-flex items-center justify-center rounded-full shadow-md transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 whitespace-nowrap disabled:opacity-60 disabled:cursor-default"
                >
                  {tutorialStep >= TUTORIAL_STEPS.length - 1
                    ? 'Start sorting'
                    : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
