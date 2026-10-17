'use client';

import React, { useEffect, useState } from 'react';
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
 * a viewport-bounded column (100dvh minus the sticky AppShell header)
 * and the deck fills it as a flex column that never scrolls: compact
 * progress line → the card (flex-1, centered) → the action buttons
 * pinned at the bottom → a small Deck | List toggle at the very
 * bottom. The checkpoint and completion states replace the card
 * inside the same column.
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

    // Class strings mirror the list rows in Step1Triage: same selected
    // state (sky-400), same border/hover treatment — with a touch more
    // vertical padding so the row is a comfortable thumb target now
    // that it anchors the bottom of the screen.
    return (
      <button
        key={bucket}
        onClick={() => act(bucket)}
        className={`py-2.5 px-1.5 sm:py-3 sm:px-3 lg:px-4 rounded-xl text-xs sm:text-sm font-black border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
          isSelected
            ? 'bg-sky-400 text-slate-950 font-black border-sky-500 shadow-md scale-[1.02] z-10'
            : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-800'
        }`}
        title={displayLabel}
      >
        <span className="text-sm sm:text-base leading-none">{cfg.emoji}</span>
        <span className="truncate text-[10px] sm:text-xs lg:text-sm tracking-tight">
          {displayLabel}
        </span>
      </button>
    );
  };

  const inSongState = !checkpointPending && !isComplete && !!currentSong;

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
            <strong className="text-[#0072CE] font-mono text-xs">
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
          <span className="text-[#0072CE] font-mono text-xs shrink-0">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full h-2 bg-[#E0F2FE] border border-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7DD3FC] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {bucketedCount >= 1 && !isComplete && (
          <div className="text-right">
            <button
              onClick={handleFinishTriage}
              className="text-[11px] font-semibold text-slate-400 hover:text-[#0072CE] underline underline-offset-2 decoration-slate-300 transition-colors cursor-pointer"
            >
              Continue with {bucketedCount} of {total} bucketed →
            </button>
          </div>
        )}
      </div>

      {/* CARD REGION — flex-1 and centered; the checkpoint and
          completion states replace the card right here, inside the
          same bounded column. */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-2">
        {checkpointPending ? (
          <div className="w-full bg-white border border-slate-300 rounded-3xl shadow-xs p-6 sm:p-8 text-center space-y-5">
            <div className="text-4xl">🎉</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
              You&apos;ve sorted the big ones
            </h2>
            <p className="text-sm font-bold text-slate-500 leading-snug max-w-sm mx-auto">
              The Blue Album, Pinkerton, and all the big singles are done —
              and you&apos;ve got enough ranked for your Wrapped whenever
              you want it. The deep cuts will still be here.
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
        ) : isComplete || !currentSong ? (
          /* COMPLETION — every song categorized (the same count the
             list's "Categorize All Songs" lock runs on). */
          <div className="w-full bg-white border border-slate-300 rounded-3xl shadow-xs p-6 sm:p-8 text-center space-y-5">
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
        ) : (
          /* THE CARD — title is the hero; art supports, a step smaller
             than before so the whole screen fits without scrolling. */
          <div className="w-full bg-white border border-slate-300 rounded-3xl shadow-xs p-5 sm:p-6">
            <div className="text-center space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={albumCoverSrc(resolveAlbumId(currentSong))}
                alt={`${currentSong.album} cover art`}
                className="w-[112px] h-[112px] [@media(max-height:560px)]:w-20 [@media(max-height:560px)]:h-20 rounded-2xl shadow-md border border-slate-200 mx-auto object-cover"
              />
              <h2 className="text-4xl sm:text-5xl [@media(max-height:560px)]:text-3xl font-black tracking-tight text-slate-950 leading-tight break-words">
                {currentSong.title}
              </h2>
              <div className="flex items-center justify-center gap-3 text-sm font-bold text-slate-400">
                <span>
                  {currentSong.album} ({currentSong.year})
                </span>
                {/* The list rows' preview button, exact same component
                    and styling — only bigger (large = 48px). */}
                <AudioPreviewButton title={currentSong.title} large />
              </div>
              {triageMap[currentSong.id] !== undefined && (
                <p className="text-[11px] font-bold text-slate-400">
                  {triageMap[currentSong.id] === 'unknown'
                    ? 'You marked this Don’t Know It — tap a tier to rate it.'
                    : `You marked this ${
                        BUCKET_CONFIG[triageMap[currentSong.id] as BucketType]
                          .label
                      } — tap another tier to change it.`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ACTIONS — pinned at the bottom of the column: the five tier
          buttons, then the quieter Don't Know It / Undo / Jump row. */}
      {inSongState && (
        <div className="shrink-0 space-y-2">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 items-center">
            {BUCKET_ORDER.map(renderBucketButton)}
          </div>
          <div className="flex items-center justify-between gap-2">
            {/* DON'T KNOW IT — quieter/secondary, same treatment as the list */}
            <button
              onClick={() => act('unknown')}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                triageMap[currentSong.id] === 'unknown'
                  ? 'bg-slate-200 text-slate-600 border-slate-300'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="I haven't heard this song — don't rate it"
            >
              Don&apos;t Know It
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="text-[11px] font-extrabold text-slate-600 bg-white border border-slate-300 rounded-lg px-3 py-2 transition-all enabled:hover:bg-slate-100 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↩ Undo
              </button>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) jumpToSection(e.target.value);
                }}
                className="text-[11px] font-extrabold text-slate-600 bg-white border border-slate-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0072CE] max-w-[42vw]"
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
            </div>
          </div>
          <p className="hidden sm:block text-center text-[10px] font-semibold text-slate-300">
            Keys 1–5 pick a tier · U undoes
          </p>
        </div>
      )}

      {/* DECK | LIST TOGGLE — below the card/actions, small and muted
          (in list mode the toggle stays up in the header instead). */}
      <div className="shrink-0 flex justify-center pt-2 pb-3">
        <div className="inline-flex bg-white border border-slate-300 rounded-full p-0.5 shadow-xs">
          <button
            className="px-3 py-1 rounded-full text-[11px] font-black bg-[#0072CE] text-white shadow-sm"
            aria-current="true"
          >
            Deck
          </button>
          <button
            onClick={onSwitchToList}
            className="px-3 py-1 rounded-full text-[11px] font-black text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            List
          </button>
        </div>
      </div>
    </div>
  );
}
