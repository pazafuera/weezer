'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BucketType, BUCKET_CONFIG, FULL_SONG_POOL, SINGLE_SONG_IDS, Song } from '../data/constants';
import {
  countBucketedSongs,
  countCategorizedSongs,
  TriageValue,
} from '../context/WeezerContext';
import { FlyingWIcon, AudioPreviewButton, HelpButton } from './SharedUI';
import Step1Deck from './Step1Deck';

export interface TriageSection {
  /** DOM id of the section (album sections keep the album-<slug> form
   *  the dashboard's hot-links target). */
  key: string;
  title: string;
  /** Banner eyebrow for non-album sections (the singles block). */
  eyebrow: string | null;
  /** Banner background override; null → first song's album color. */
  bannerClass: string | null;
  songs: Song[];
  /** Mixed-album sections label every row with its album. */
  showAlbumPerRow: boolean;
}

export default function Step1Triage({
  triageMap,
  handleSetBucket,
  handleFinishTriage,
  isGuest,
  onCreateAccount,
  onOpenGarage,
}: {
  triageMap: Record<string, TriageValue>;
  handleSetBucket: (id: string, bucket: TriageValue) => void;
  handleFinishTriage: () => void;
  /** Auth/navigation plumbing for the deck's milestone cards
   *  (computed in page.tsx; forwarded untouched to Step1Deck). */
  isGuest: boolean;
  onCreateAccount: () => void;
  onOpenGarage: () => void;
}) {
  const [hideSorted, setHideSorted] = useState(false);

  // Deck | List view mode. Deck is the default; the choice persists
  // in localStorage so it survives step navigation and remounts. Read
  // after mount (not in the initializer) to keep first paint identical
  // to the server render. Both views read/write the same triageMap
  // through the same handlers, so the mode never loses state. The
  // toggle UI that used to switch modes in place is gone (owner,
  // Oct 18) — the persisted preference and the deck default remain;
  // users simply stay in their current view.
  const [viewMode, setViewMode] = useState<'deck' | 'list'>('deck');
  // True once the persisted mode above has been read. Consumers
  // that must act on the RESOLVED mode (the album jump below)
  // wait for this — the first paint is always the deck, and a
  // list user's deck unmounts a beat later.
  const [viewModeResolved, setViewModeResolved] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('weezer-triage-view-mode');
      if (saved === 'list' || saved === 'deck') setViewMode(saved);
    } catch {
      /* localStorage unavailable — deck default stands */
    }
    setViewModeResolved(true);
  }, []);

  // TUTORIAL-REPLAY DECK OVERRIDE (UAT P-8) — the deck tour lives
  // in the deck, so "Replay the deck tutorial" was a dead button
  // for list-mode users: the replay event fired with no deck
  // mounted to hear it. Now a replay presents the deck for the
  // tour's duration only: this session-only flag swaps the
  // rendered mode, and Step1Deck's 'weezer:tutorial-ended'
  // signal (dispatched when a tour closes) swaps it back. The
  // persisted preference above is never read differently and
  // never written — when the tour ends, the user is exactly
  // where they were: list mode, same triageMap, same state.
  const [tutorialDeckOverride, setTutorialDeckOverride] =
    useState(false);
  const effectiveMode: 'deck' | 'list' = tutorialDeckOverride
    ? 'deck'
    : viewMode;

  // The already-on-triage route: AppShell dispatches the replay
  // event when Replay is tapped on this step. A deck user needs
  // nothing here (the deck hears the event itself); a list user
  // engages the override, and the deck that mounts consumes the
  // sessionStorage force flag AppShell set.
  useEffect(() => {
    if (viewMode !== 'list') return;
    const onReplay = () => setTutorialDeckOverride(true);
    window.addEventListener('weezer:replay-tutorial', onReplay);
    return () =>
      window.removeEventListener('weezer:replay-tutorial', onReplay);
  }, [viewMode]);

  // The arriving-from-elsewhere route: the replay was tapped on
  // another step, so this component mounted fresh — the force
  // flag is the only trace. Read it WITHOUT consuming it (the
  // deck consumes it on mount); it is set only by a replay, so
  // its presence here means a list user's replay is pending.
  useEffect(() => {
    if (!viewModeResolved || viewMode !== 'list') return;
    try {
      if (
        window.sessionStorage.getItem('weezer-deck-tutorial-force') ===
        '1'
      ) {
        setTutorialDeckOverride(true);
      }
    } catch {
      /* sessionStorage unavailable — the event route above
         still covers replays tapped while on this step */
    }
  }, [viewModeResolved, viewMode]);

  // The hand-back: the tour closed (finished or skipped) — drop
  // the override and the list returns.
  useEffect(() => {
    if (!tutorialDeckOverride) return;
    const onEnded = () => setTutorialDeckOverride(false);
    window.addEventListener('weezer:tutorial-ended', onEnded);
    return () =>
      window.removeEventListener('weezer:tutorial-ended', onEnded);
  }, [tutorialDeckOverride]);

  // ALBUM JUMP HANDOFF — a tap on the dashboard's Catalog
  // Completion strip stores the album name in sessionStorage
  // ('weezer-triage-jump-album', set by StepDashboard's
  // handleAlbumClick — the same flag pattern as the deck
  // tutorial's force flag) before navigating here. Consume it
  // ONCE on mount: the flag is removed as it's read, so a later
  // ordinary visit to triage never re-jumps. The album name maps
  // to a section key by the same slug formula the section ids
  // below are built with. Application waits for the resolved
  // view mode: the list scrolls its section into view (see the
  // effect further down, next to scrollToSection); the deck
  // receives the key as a prop and applies its own jumpToSection.
  const [pendingJumpKey, setPendingJumpKey] = useState<string | null>(null);
  useEffect(() => {
    try {
      const album = window.sessionStorage.getItem('weezer-triage-jump-album');
      if (album) {
        window.sessionStorage.removeItem('weezer-triage-jump-album');
        setPendingJumpKey(
          `album-${album.replace(/\s+/g, '-').toLowerCase()}`
        );
      }
    } catch {
      /* sessionStorage unavailable — no jump to apply */
    }
  }, []);

  const albumsGrouped = Array.from(new Set(FULL_SONG_POOL.map((s) => s.album)));
  // Categorized = bucketed + "Don't Know It" marks. The progress bar and
  // the "Categorize All Songs" lock run on this: a song the user can't
  // judge still counts as dealt with. Progression gating (Continue,
  // unlocks) keeps using bucketedCount — real ratings only.
  const categorizedCount = countCategorizedSongs(triageMap);
  const progressPercent = Math.round((categorizedCount / FULL_SONG_POOL.length) * 100);
  const isGutCheckComplete = categorizedCount === FULL_SONG_POOL.length;
  // Secondary partial-triage path: moving forward is allowed as soon as at
  // least one song has an explicit, valid triage bucket.
  const bucketedCount = countBucketedSongs(triageMap);
  const hasPartialTriage = bucketedCount >= 1;

  // Recognition-first display order (display only — the pool order, and
  // every saved ranking derived from it, is untouched):
  //   1. The Blue Album, track order   2. Pinkerton, track order
  //   3. The singles from every other album, chronological by album
  //   4. The remaining album tracks, album by album in catalog order
  // A casual fan's first screenful is now the songs they actually know.
  const blueSongs = FULL_SONG_POOL.filter((s) => s.album === 'The Blue Album');
  const pinkertonSongs = FULL_SONG_POOL.filter((s) => s.album === 'Pinkerton');
  const frontIds = new Set<string>(
    [...blueSongs, ...pinkertonSongs].map((s) => s.id)
  );
  const singlesSongs = FULL_SONG_POOL.filter(
    (s) => !frontIds.has(s.id) && SINGLE_SONG_IDS.has(s.id)
  );
  const shownIds = new Set<string>();
  frontIds.forEach((id) => shownIds.add(id));
  singlesSongs.forEach((s) => shownIds.add(s.id));

  const sections: TriageSection[] = [
    {
      key: 'album-the-blue-album',
      title: 'The Blue Album',
      eyebrow: null,
      bannerClass: null,
      songs: blueSongs,
      showAlbumPerRow: false,
    },
    {
      key: 'album-pinkerton',
      title: 'Pinkerton',
      eyebrow: null,
      bannerClass: null,
      songs: pinkertonSongs,
      showAlbumPerRow: false,
    },
    ...(singlesSongs.length > 0
      ? [
          {
            key: 'album-the-singles',
            title: 'The Singles',
            eyebrow: 'The hits from every other album',
            bannerClass: 'bg-slate-900',
            songs: singlesSongs,
            showAlbumPerRow: true,
          } as TriageSection,
        ]
      : []),
    ...albumsGrouped
      .filter((a) => a !== 'The Blue Album' && a !== 'Pinkerton')
      .map(
        (albumName): TriageSection => ({
          key: `album-${albumName.replace(/\s+/g, '-').toLowerCase()}`,
          title: albumName,
          eyebrow: null,
          bannerClass: null,
          songs: FULL_SONG_POOL.filter(
            (s) => s.album === albumName && !shownIds.has(s.id)
          ),
          showAlbumPerRow: false,
        })
      )
      .filter((sec) => sec.songs.length > 0),
  ];

  // The flat recognition-first display order, derived from the very
  // sections the list renders below. Deck mode walks this exact list,
  // so the two views can never disagree about song order.
  const orderedSongs: Song[] = sections.flatMap((section) => section.songs);

  // Keep the user's place across a bucket tap. A tap re-renders the
  // whole list, and with "Hide Sorted" on the tapped row (and any album
  // section it empties) unmounts, shrinking the document and shifting /
  // clamping the scroll position — the user lost their place after
  // every tap. So: remember the tapped row's viewport offset before the
  // update, then re-anchor after render. If the row is gone (hidden as
  // sorted), fall back to the pre-tap scroll offset.
  const scrollAnchorRef = useRef<{ id: string; top: number; y: number } | null>(null);

  const handleRowTap = (
    e: React.MouseEvent,
    id: string,
    value: TriageValue
  ) => {
    const row = (e.currentTarget as HTMLElement).closest('[data-triage-row]');
    if (row) {
      scrollAnchorRef.current = {
        id,
        top: row.getBoundingClientRect().top,
        y: window.scrollY,
      };
    }
    handleSetBucket(id, value);
  };

  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    scrollAnchorRef.current = null;
    const el = document.querySelector(`[data-triage-row="${anchor.id}"]`);
    if (el) {
      const delta = el.getBoundingClientRect().top - anchor.top;
      if (delta !== 0) window.scrollBy(0, delta);
    } else if (window.scrollY !== anchor.y) {
      window.scrollTo(0, anchor.y);
    }
  });

  const scrollToSection = (sectionKey: string) => {
    const el = document.getElementById(sectionKey);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Apply a pending dashboard album jump in LIST mode, through
  // the same scrollToSection the quick-jump pills use. Runs
  // after the render commit, so the section element exists;
  // gated on the resolved mode so a list user's brief deck
  // first paint can't consume it. Cleared as it applies —
  // one-shot, exactly like the flag it came from. (Deck mode
  // applies its own below, via Step1Deck's jumpToSection.)
  useEffect(() => {
    if (!viewModeResolved || effectiveMode !== 'list' || !pendingJumpKey) return;
    scrollToSection(pendingJumpKey);
    setPendingJumpKey(null);
    // scrollToSection is a stable render-scope helper; the
    // jump is keyed on the three values above alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModeResolved, effectiveMode, pendingJumpKey]);

  return (
    <div
      className={
        effectiveMode === 'list'
          ? 'space-y-6 pb-44'
          : // Deck mode: the step itself becomes a column AT LEAST
            // one screen tall under the sticky AppShell header
            // (h-14 = 56px, lg:h-16 = 64px in AppShell.tsx), bleeding
            // over <main>'s padding (p-4 / sm:p-6 / lg:p-8) the same
            // way the list's sticky bar below does. Minimum height,
            // not fixed: on tall phones everything fits one screen,
            // but the deck's fixed-height song card can push the
            // tray just below the fold on short screens — the
            // owner accepted a little scroll there over a card too
            // short for two-line titles.
            'flex flex-col -m-4 sm:-m-6 lg:-m-8 min-h-[calc(100dvh-56px)] lg:min-h-[calc(100dvh-64px)]'
      }
    >
      {effectiveMode === 'list' && (
      <>
      {/* STICKY PROGRESS & ALBUM QUICK-JUMP BAR (EXPANDED FOR DESKTOP) */}
      <div className="sticky top-[56px] lg:top-[64px] z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 py-3 px-4 shadow-xs -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 mb-6 space-y-3">
        <div className="max-w-5xl lg:max-w-6xl mx-auto space-y-2">
          {/* PROGRESS METRICS & HIDE SORTED TOGGLE — the percent
              rides with the count on the LEFT (owner); the right
              side keeps Hide Sorted and the help button. */}
          <div className="flex justify-between items-center text-xs font-black text-slate-700">
            <div className="flex items-center gap-3">
              {/* No dashboard exit in this bar — the owner
                  ruled the menu is the way there (a first-run
                  sorter has never seen a dashboard to go
                  "back" to). */}
              <span className="uppercase tracking-wider">
                Progress: <strong className="text-[#0072CE] font-mono text-sm">{categorizedCount}</strong> / {FULL_SONG_POOL.length}
              </span>
              <span className="text-[#0072CE] font-mono text-sm font-black">{progressPercent}%</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-extrabold text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={hideSorted}
                  onChange={(e) => setHideSorted(e.target.checked)}
                  className="rounded border-slate-300 text-[#0072CE] focus:ring-[#0072CE] w-3.5 h-3.5 cursor-pointer"
                />
                <span>Hide Sorted ({categorizedCount})</span>
              </label>
              <HelpButton />
            </div>
          </div>

          {/* PROGRESS BAR */}
          <div className="relative w-full h-3.5 my-2 z-0">
            <div className="absolute inset-0 bg-[#E0F2FE] rounded-full border border-blue-200 z-10" />
            <div
              className="absolute top-0 left-0 h-full bg-[#7DD3FC] rounded-full transition-all duration-300 z-20"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-30 text-[#0072CE] w-8 h-5 ml-[-16px]"
              style={{ left: `${Math.min(98, Math.max(2, progressPercent))}%` }}
            >
              <FlyingWIcon className="w-full h-full drop-shadow-sm" />
            </div>
          </div>

          {/* SECTION QUICK-JUMP PILLS */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5 text-[10px] font-black text-slate-600">
            {sections.map((section) => {
              const sortedInSection = section.songs.filter((s) => triageMap[s.id]).length;
              const isSectionDone = sortedInSection === section.songs.length;
              // Under Hide Sorted a finished section unmounts
              // entirely — its pill used to stay live and scroll
              // to an element that doesn't exist (a silent no-op
              // that reads as a dead control). Disable it and say
              // why in the tooltip.
              const isSectionHidden =
                hideSorted && section.songs.every((s) => triageMap[s.id]);

              return (
                <button
                  key={section.key}
                  onClick={() => scrollToSection(section.key)}
                  disabled={isSectionHidden}
                  title={isSectionHidden ? 'Hidden by Hide Sorted' : undefined}
                  className={`px-2.5 py-1 rounded-lg border shrink-0 transition-all ${
                    isSectionHidden
                      ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      : `cursor-pointer ${
                          isSectionDone
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : sortedInSection > 0
                            ? 'bg-blue-50 border-blue-200 text-[#0072CE]'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`
                  }`}
                >
                  {section.title} ({sortedInSection}/{section.songs.length})
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}

      {/* HEADER — deck mode gets a compact variant (smaller headline,
          one-line subhead) so headline + card + actions fit a single
          screen. List mode keeps the full header. (Neither header
          carries a Deck | List toggle anymore — owner, Oct 18.) */}
      {effectiveMode === 'deck' ? (
        <div className="text-center px-4 pt-3 pb-1 shrink-0">
          <h1 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">
            The <span className="text-[#0072CE]">Gut Check</span>
          </h1>
          <p className="text-xs font-bold text-slate-500 leading-snug mt-1">
            Sort every song into a tier. Trust your first instinct.
          </p>
        </div>
      ) : (
        <div className="text-center space-y-2 px-4 mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tighter">
            The <span className="text-[#0072CE]">Gut Check</span>
          </h1>
          <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-snug">
            Sort every song into a tier. Trust your first instinct, don&apos;t overthink it.
          </p>
        </div>
      )}

      {effectiveMode === 'deck' ? (
        <Step1Deck
          triageMap={triageMap}
          orderedSongs={orderedSongs}
          sections={sections}
          handleSetBucket={handleSetBucket}
          handleFinishTriage={handleFinishTriage}
          isGuest={isGuest}
          onCreateAccount={onCreateAccount}
          onOpenGarage={onOpenGarage}
          pendingJumpSectionKey={
            viewModeResolved && effectiveMode === 'deck' ? pendingJumpKey : null
          }
          onJumpApplied={() => setPendingJumpKey(null)}
        />
      ) : (
      <>
      {/* SONG SECTIONS (Blue → Pinkerton → Singles → remaining albums) */}
      <div className="space-y-8">
        {/* Every section filtered out by Hide Sorted used to leave
            a completely blank page body — no text, no controls.
            Say what's true and name the way back. */}
        {hideSorted &&
          sections.every((sec) =>
            sec.songs.every((s) => triageMap[s.id])
          ) && (
            <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-10 text-center">
              <p className="text-sm font-bold text-slate-500 leading-snug">
                Every song is sorted, and Hide Sorted is on — so
                there&apos;s nothing left to show here. Turn off Hide
                Sorted to review or change a song.
              </p>
            </div>
          )}
        {sections.map((section) => {
          const visibleSongs = hideSorted
            ? section.songs.filter((s) => !triageMap[s.id])
            : section.songs;
          const firstSong = section.songs[0];

          if (visibleSongs.length === 0 && hideSorted) return null;

          return (
            <div
              key={section.key}
              id={section.key}
              className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-xs scroll-mt-36"
            >
              {/* SECTION BANNER */}
              <div className={`${section.bannerClass ?? firstSong.albumColor} p-4 text-white text-center border-b border-slate-300`}>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">
                  {section.eyebrow ??
                    (firstSong.isBSide ? 'Special Collection' : `Album (${firstSong.year})`)}
                </span>
                <h2 className="text-xl font-black tracking-tight">{section.title}</h2>
              </div>

              {/* SONG ROWS WITH HORIZONTAL BUCKET ROW ON DESKTOP */}
              <div className="divide-y divide-slate-300">
                {visibleSongs.map((song, index) => {
                  const activeBucket = triageMap[song.id];
                  const isUnknown = activeBucket === 'unknown';
                  const isEven = index % 2 === 0;

                  return (
                    <div
                      key={song.id}
                      data-triage-row={song.id}
                      className={`p-3 sm:p-4 lg:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-6 transition-colors ${
                        isEven ? 'bg-slate-50/70' : 'bg-white'
                      } hover:bg-blue-50/50`}
                    >
                      {/* LEFT SIDE: PREVIEW BUTTON & TITLE */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 py-0.5">
                        <AudioPreviewButton title={song.title} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-lg sm:text-xl lg:text-2xl font-black tracking-tight leading-tight break-words ${
                              isUnknown ? 'text-slate-400' : 'text-slate-950'
                            }`}>
                              {song.title}
                            </h3>
                            {isUnknown && (
                              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5">
                                Don&apos;t know it
                              </span>
                            )}
                          </div>
                          {section.showAlbumPerRow && (
                            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                              {song.album} ({song.year})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* RIGHT SIDE: BUCKET BUTTONS IN A HORIZONTAL ROW ON DESKTOP */}
                      <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                      <div className="grid grid-cols-5 sm:flex sm:flex-row gap-1.5 sm:gap-2 w-full sm:w-auto items-center">
                        {(['banger', 'slaps', 'mid', 'skip', 'trash'] as BucketType[]).map((bucket) => {
                          const isSelected = activeBucket === bucket;
                          const cfg = BUCKET_CONFIG[bucket];
                          const displayLabel = bucket === 'slaps' ? 'Slaps' : cfg.label;

                          return (
                            <button
                              key={bucket}
                              onClick={(e) => handleRowTap(e, song.id, bucket)}
                              className={`py-2 px-1.5 sm:py-2.5 sm:px-3 lg:px-4 rounded-xl text-xs sm:text-sm font-black border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
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
                        })}
                      </div>
                      {/* DON'T KNOW IT — compact, muted; not a rating */}
                      <button
                        onClick={(e) => handleRowTap(e, song.id, 'unknown')}
                        className={`self-end sm:self-auto text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          isUnknown
                            ? 'bg-slate-200 text-slate-600 border-slate-300'
                            : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title="I haven't heard this song — don't rate it"
                      >
                        Don&apos;t Know It
                      </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2">
        {isGutCheckComplete && bucketedCount === 0 ? (
          /* All 206 categorized but every one is Don't Know It:
             Refine is still locked (≥1 real bucket required), so
             the amber button guard-bounced straight back here —
             an infinite, unexplained loop. State the unlock
             condition instead. */
          <div className="bg-slate-800/95 text-slate-200 font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-full border border-slate-700 shadow-xl backdrop-blur-md text-center max-w-md">
            Refine Buckets unlocks with 1 song in a real bucket —
            Don&apos;t Know It doesn&apos;t count
          </div>
        ) : isGutCheckComplete ? (
          <button
            onClick={handleFinishTriage}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
          >
            <FlyingWIcon className="w-6 h-4 text-slate-950" />
            <span>Next Step: Refine Buckets</span>
          </button>
        ) : (
          <button
            disabled
            className="bg-slate-800/95 text-slate-400 font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-full border border-slate-700 cursor-not-allowed shadow-xl backdrop-blur-md whitespace-nowrap"
          >
            🔒 Categorize All Songs ({categorizedCount}/{FULL_SONG_POOL.length})
          </button>
        )}
        {/* The partial-sort forward path (UAT P-7): a real
            secondary button, not the 11px underlined link it was —
            the enabled way forward was the least visible element
            on the screen, under a big disabled lock pill. Same
            action (handleFinishTriage's partial path), ≥44px
            target, visually secondary to the amber primary that
            replaces the lock pill at full completion. */}
        {hasPartialTriage && !isGutCheckComplete && (
          <button
            onClick={handleFinishTriage}
            className="min-h-[44px] flex items-center bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 shadow-lg font-black text-xs px-5 rounded-full transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            Continue with {bucketedCount} of {FULL_SONG_POOL.length} bucketed →
          </button>
        )}
        {/* The neutral early-Refine line (UAT P-6, owner's
            wording): wherever a partial sorter is offered the
            jump to Refine, both doors are named and neither is
            sold — no Thread-unlock pitch. Same line on the
            deck's early-Refine offers (Step1Deck). */}
        {hasPartialTriage && !isGutCheckComplete && (
          <p className="text-[11px] font-semibold text-slate-200 bg-slate-950/60 backdrop-blur-sm rounded-2xl px-3 py-1.5 max-w-[300px] text-center leading-snug">
            You can refine the songs you&apos;ve sorted so far, or
            keep sorting and refine the full set later.
          </p>
        )}
        {/* Songs categorized but none bucketed yet (all Don't Know
            It so far): no Continue link exists and nothing said
            why. One line names the unlock. */}
        {!isGutCheckComplete && categorizedCount > 0 && bucketedCount === 0 && (
          <span className="text-[11px] font-semibold text-slate-300/90 bg-slate-950/60 rounded-full px-3 py-1 backdrop-blur-sm whitespace-nowrap">
            One song in a real bucket unlocks Refine — Don&apos;t Know It doesn&apos;t count
          </span>
        )}
      </div>
      </>
      )}
    </div>
  );
}
