'use client';

import React, { useEffect, useState } from 'react';
import { useWeezer, getProgressState, countBucketedSongs, countCategorizedSongs } from '../context/WeezerContext';
import { BUCKET_CONFIG, FULL_SONG_POOL, BucketType, ALBUM_NAME_TO_ID } from '../data/constants';
import { isLoreUnlocked, loreGateRemainingAlbums, titleForDepth } from '../data/loreGame';
import { fanhoodDisplay, readFanhood } from '../lib/fanhood';
import type { FanhoodRecord } from '../lib/fanhood';
import { AlbumArtwork } from './SharedUI';
import WeezerOnboardingModal from './WeezerOnboardingModal';

export default function StepDashboard() {
  const {
    userId,
    userProfile,
    setUserProfile,
    triageMap,
    masterList,
    navigateTo,
    setAutoStartMatchups,
    setRefineStageIdx,
    syncRankingsToDatabase,
  } = useWeezer();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Metrics
  const totalSongs = FULL_SONG_POOL.length; // 206
  const triageSortedCount = Object.keys(triageMap).length;
  const triagePct = Math.round((triageSortedCount / totalSongs) * 100);
  const progress = getProgressState(triageMap, masterList); const isTriageComplete = progress.isTriageComplete;
  const hasStartedTriage = triageSortedCount > 0;

  // Album Grouping for Catalog Completion
  const albumsGrouped = Array.from(new Set(FULL_SONG_POOL.map((s) => s.album)));

  // Bucket breakdown counts
  const bucketCounts = (Object.keys(BUCKET_CONFIG) as BucketType[]).reduce(
    (acc, key) => {
      acc[key] = Object.values(triageMap).filter((b) => b === key).length;
      return acc;
    },
    {} as Record<BucketType, number>
  );

  const isRefinedMasterComplete = progress.isMasterUnlocked;

  // Garage session module (Overnight 5): categorized = triageMap keys
  // (the count the merged progress card headlines); bucketed = real buckets
  // only, via the context counter — the two counts are never conflated.
  const bucketedCount = countBucketedSongs(triageMap);
  const remainingCount = totalSongs - triageSortedCount;
  const showGuestSaveHero = userId === null && triageSortedCount >= 1;
  const showRefineCallout = bucketedCount >= 25 && !progress.isWrappedUnlocked;

  // Sorting complete = every catalog song categorized — a real bucket
  // OR a "Don't Know It" mark. The same signal the nav menu's Ranking
  // Project group flips on (countCategorizedSongs vs the full pool),
  // NOT the completionist isTriageComplete flag above, which demands
  // all 206 in real buckets. The dashboard's state anatomy keys off
  // this: incomplete → the one job is getting back to sorting;
  // complete → the Thread leads and What's Next is the checklist.
  const categorizedCount = countCategorizedSongs(triageMap);
  const isSortingComplete = categorizedCount >= totalSongs;

  // The Garage's existing refine action — same calls as the stage-2 hero
  // and the Refine Buckets card in the What's Next grid.
  const handleStartRefining = () => {
    setAutoStartMatchups(true);
    setRefineStageIdx(0);
    navigateTo('rank_buckets');
  };

  // Dynamic Triage CTA Text
  const getTriageCtaText = () => {
    if (isTriageComplete) return 'Review ✓';
    if (triageSortedCount > 160) return 'Finish →';
    if (hasStartedTriage) return 'Continue →';
    return 'Start →';
  };

  // HOT-LINK TO AN ALBUM ON THE TRIAGE PAGE — the tap hands the
  // album to the triage step through sessionStorage (the same
  // flag pattern as the deck tutorial's 'weezer-deck-tutorial-force'):
  // Step1Triage consumes it once on mount and lands the user on
  // that album — the deck applies its own Jump-to-album logic,
  // the list scrolls its album section into view. (The old code
  // navigated, then raced the mount with a 150ms setTimeout DOM
  // scroll: in deck mode there is no album element to find, so
  // the tapped album was silently ignored and the deck stayed
  // wherever it was.)
  const handleAlbumClick = (albumName: string) => {
    try {
      window.sessionStorage.setItem('weezer-triage-jump-album', albumName);
    } catch {
      /* sessionStorage unavailable — navigate without the jump */
    }
    navigateTo('triage');
  };

  // Step Status & Strict Locking
  const stepsState = [
    {
      id: 'triage',
      title: 'The Gut Check',
      desc: isTriageComplete
        ? 'All 206 songs sorted'
        : `${triageSortedCount}/${totalSongs} sorted`,
      isComplete: isTriageComplete,
      isCurrent: !isTriageComplete,
      isDisabled: false,
      unlockHint: null as string | null,
      ctaText: getTriageCtaText(),
      action: () => navigateTo('triage'),
    },
    {
      id: 'rank_buckets',
      title: 'Refine Buckets',
      desc: isRefinedMasterComplete ? 'Matchups completed' : 'Head-to-head matchups',
      isComplete: isRefinedMasterComplete,
      isCurrent: isTriageComplete && !isRefinedMasterComplete,
      isDisabled: !progress.isRefineUnlocked,
      unlockHint: "Unlocks once you've rated a song" as string | null,
      ctaText: isRefinedMasterComplete ? 'View →' : 'Start →',
      action: () => {
        if (!progress.isRefineUnlocked) return;
        setAutoStartMatchups(true);
        setRefineStageIdx(0);
        navigateTo('rank_buckets');
      },
    },
    {
      id: 'master',
      title: 'Master List',
      desc: 'Your Personalized Playlist',
      isComplete: isRefinedMasterComplete,
      isCurrent: false,
      isDisabled: !progress.isMasterUnlocked,
      unlockHint: 'Unlocks after Refine' as string | null,
      ctaText: 'View →',
      action: () => {
        if (!progress.isMasterUnlocked) return;
        navigateTo('master');
      },
    },
    {
      id: 'wrapped',
      title: 'Sweater Thread',
      desc: 'Your Fan DNA',
      isComplete: isRefinedMasterComplete,
      isCurrent: isRefinedMasterComplete,
      isDisabled: !progress.isWrappedUnlocked,
      unlockHint: 'Unlocks after Refine' as string | null,
      ctaText: 'View →',
      action: () => {
        if (!progress.isWrappedUnlocked) return;
        navigateTo('wrapped');
      },
    },
  ];

  // MERGED PROGRESS CARD — the ONE dashboard card that carries the
  // sorted count. (It was two cards: the "{n} of 206 sorted" session
  // module and this "YOUR PROGRESS" catalog module, each stating the
  // count.) Contents: the count headline, the progress bar + percent,
  // the sorting action — with the session module's Refine callout
  // folded into the action zone when it applies — the Catalog
  // Completion strip, and the bucket tallies. The count appears once.
  const MergedProgressCard = () => (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
      {/* TOP: COUNT HEADLINE + PROGRESS BAR */}
      <div className="space-y-2.5">
        <p className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
          {triageSortedCount} of {totalSongs} sorted — {remainingCount} to go.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
            <div
              className="h-full bg-[#0072CE] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${triagePct}%` }}
            />
          </div>
          <span className="text-xs font-black text-[#0072CE] shrink-0">
            {triagePct}%
          </span>
        </div>
      </div>

      {/* ACTION ZONE: RESUME SORTING — OR THE REFINE CALLOUT (the
          session module's, folded in: at 25+ bucketed with no Thread
          compiled yet, refining is offered alongside resuming). */}
      {showRefineCallout ? (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
            Enough sorted to refine — run the matchups and your Thread can be compiled.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleStartRefining}
              className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
            >
              Start refining
            </button>
            <button
              onClick={() => navigateTo('triage')}
              className="w-full sm:w-auto bg-white border-2 border-slate-200 hover:border-slate-300 active:scale-95 text-slate-700 font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all cursor-pointer"
            >
              Resume sorting
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => navigateTo('triage')}
            className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
          >
            {triageSortedCount === 0 ? 'Start sorting' : 'Resume sorting'}
          </button>
        </div>
      )}

      {/* MIDDLE: CATALOG COMPLETION CAROUSEL */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
            Catalog Completion
          </h3>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 no-scrollbar -mx-1 px-1">
          {albumsGrouped.map((albumName) => {
            const albumSongs = FULL_SONG_POOL.filter((s) => s.album === albumName);
            const sortedCount = albumSongs.filter((s) => triageMap[s.id]).length;
            const isAlbumDone = sortedCount === albumSongs.length;
            const albumPct = Math.round((sortedCount / albumSongs.length) * 100);
            const firstSong = albumSongs[0];
            const resolvedId = firstSong?.albumId || ALBUM_NAME_TO_ID[albumName] || 'unknown';

            return (
              // A real <button> (UAT P-9): the tile was a div with
              // an onClick — mouse-only, invisible to keyboards.
              // As a button it is focusable and Enter/Space fire
              // the same album jump; the focus ring wears the
              // app's brand blue. (The bucket tally strip below
              // stays inert on purpose — it is a readout, not a
              // control.)
              <button
                type="button"
                key={albumName}
                onClick={() => handleAlbumClick(albumName)}
                aria-label={`Jump to ${albumName} in Sort — ${sortedCount} of ${albumSongs.length} sorted`}
                className="w-[115px] sm:w-[125px] shrink-0 bg-slate-50 border border-slate-200/80 hover:border-blue-300 rounded-2xl p-2.5 shadow-2xs flex flex-col items-center text-center cursor-pointer group transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072CE] focus-visible:ring-offset-1"
              >
                <div className="relative mb-1.5">
                  <AlbumArtwork
                    albumId={resolvedId}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl shadow-2xs object-cover border border-slate-200/60 group-hover:scale-105 transition-transform"
                  />
                  {isAlbumDone ? (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white shadow-2xs">
                      ✓
                    </span>
                  ) : sortedCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-[#0072CE] text-white w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white shadow-2xs">
                      ⚡
                    </span>
                  ) : null}
                </div>

                <h4 className="text-[11px] font-black text-slate-900 truncate w-full group-hover:text-[#0072CE] transition-colors">
                  {albumName}
                </h4>

                <span className="text-[9px] font-extrabold text-slate-400 mt-0.5">
                  {sortedCount}/{albumSongs.length} ({albumPct}%)
                </span>

                <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isAlbumDone ? 'bg-emerald-500' : 'bg-[#0072CE]'
                    }`}
                    style={{ width: `${albumPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM: BUCKET BREAKDOWN */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between gap-1">
          {(Object.keys(BUCKET_CONFIG) as BucketType[]).map((key) => {
            const cfg = BUCKET_CONFIG[key];
            const count = bucketCounts[key] || 0;
            return (
              <div
                key={key}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl bg-slate-50 border border-slate-100"
                title={cfg.label}
              >
                <span className="text-sm sm:text-base">{cfg.emoji}</span>
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // SWEATER THREAD PREVIEW CARD (sorting incomplete) — the Thread
  // card in its softened, honest form, below the progress card: what
  // exists so far is a sketch built on the songs rated to date, not
  // the finished portrait. (Once sorting is complete and the Thread
  // is compiled, the dark "Unraveled" card in the return below takes
  // this card's place and leads the page.)
  //
  // The CTA always names the step it actually opens. The Thread
  // unlocks only when a refined master list exists
  // (progress.isWrappedUnlocked); below that, resolveGuardedStep
  // would silently bounce a 'wrapped' request to rank_buckets
  // (once any song is rated) or triage (nothing rated) — so a bare
  // "Peek at your Thread" would promise a page the app won't show.
  // Instead: nothing rated → the card offers sorting itself; rated
  // but unrefined → it points at Refine, the step that unlocks the
  // Thread; unlocked → the peek, as promised.
  const ThreadPreviewCard = () => {
    const threadCta: {
      label: string;
      step: Parameters<typeof navigateTo>[0];
    } =
      bucketedCount === 0
        ? { label: 'Start sorting →', step: 'triage' }
        : !progress.isWrappedUnlocked
          ? { label: 'Refine to unlock your Thread →', step: 'rank_buckets' }
          : { label: 'Peek at your Thread →', step: 'wrapped' };

    return (
      <button
        type="button"
        onClick={() => navigateTo(threadCta.step)}
        className="w-full text-left bg-white border border-slate-200/90 hover:border-blue-300 rounded-3xl p-5 shadow-xs transition-all cursor-pointer group space-y-2"
      >
        <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight group-hover:text-[#0072CE] transition-colors">
          Your Sweater Thread
        </h2>
        <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
          {bucketedCount === 0
            ? 'Nothing rated yet — your Thread starts with your first sorted song, and it sharpens as you sort more.'
            : `So far it's built on the ${bucketedCount} song${
                bucketedCount === 1 ? '' : 's'
              } you've rated — a sketch, not the portrait. It sharpens as you sort more.`}
        </p>
        <div className="pt-0.5 flex items-center text-xs font-black text-[#0072CE] group-hover:underline">
          {threadCta.label}
        </div>
      </button>
    );
  };

  // FANHOOD GAME CARD — the depth game's dashboard home, in both
  // dashboard states. Locked: the teaser names the gate albums and
  // what remains — by album, never by count (the merged progress
  // card's Catalog Completion strip, directly above, already
  // carries every album's sorted count; restating them here would
  // be the duplicate-number sin the merged card exists to prevent).
  // Unlocked: the pitch plus the fan's established fanhood, once a
  // run has set one.
  const LoreGameCard = () => {
    const unlocked = isLoreUnlocked(triageMap);
    const remaining = loreGateRemainingAlbums(triageMap);
    const [fanhood, setFanhood] = useState<FanhoodRecord | null>(null);
    useEffect(() => {
      setFanhood(readFanhood());
    }, []);

    if (!unlocked) {
      return (
        <button
          type="button"
          onClick={() => navigateTo('triage')}
          className="w-full text-left bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
              How Rare a Weezer Fan Are You?
            </h2>
            <span className="text-xs font-black text-slate-400 shrink-0">Locked 🔒</span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
            {remaining.length === 2
              ? 'The game unlocks once you\u2019ve sorted the Blue Album and Pinkerton.'
              : remaining[0] === 'Pinkerton'
                ? 'The Blue Album is sorted — Pinkerton is all that stands between you and the game.'
                : 'Pinkerton is sorted — the Blue Album is all that stands between you and the game.'}
          </p>
          <div className="pt-0.5 flex items-center text-xs font-black text-[#0072CE] group-hover:underline">
            Keep sorting →
          </div>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => navigateTo('lore')}
        className="w-full text-left bg-white border border-slate-200/90 hover:border-blue-300 rounded-3xl p-5 shadow-xs transition-all cursor-pointer group space-y-2"
      >
        <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight group-hover:text-[#0072CE] transition-colors">
          How Rare a Weezer Fan Are You?
        </h2>
        <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
          {(() => {
            const display = fanhoodDisplay(fanhood);
            if (!display) {
              return 'Five games, seven prompts each — the rarer your answers, the deeper you go.';
            }
            return `You\u2019re a ${display.title} — ${display.depth.toLocaleString()} deep across ${display.gamesPlayed} of 5 games.`;
          })()}
        </p>
        <div className="pt-0.5 flex items-center text-xs font-black text-[#0072CE] group-hover:underline">
          {fanhood ? 'Go deeper →' : 'Play the game →'}
        </div>
      </button>
    );
  };

  // DONE SORTING? (sorting incomplete) — replaces What's Next in
  // this state. Quiet on purpose: Refine and Final Review stay one
  // tap away for anyone who means to stop here, but nothing here
  // competes with finishing the sort — no checkmarks, no status
  // lines. Same destinations and lock rules as the What's Next
  // grid's tiles.
  const DoneSortingSection = () => (
    <div className="space-y-2 pt-1">
      <h2 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
        Done Sorting?
      </h2>
      <div className="space-y-2">
        <button
          type="button"
          disabled={!progress.isRefineUnlocked}
          onClick={
            !progress.isRefineUnlocked
              ? (e) => e.preventDefault()
              : handleStartRefining
          }
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
            !progress.isRefineUnlocked
              ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed pointer-events-none select-none'
              : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer group shadow-xs'
          }`}
        >
          <span
            className={`text-sm font-black ${
              !progress.isRefineUnlocked
                ? 'text-slate-400'
                : 'text-slate-900 group-hover:text-[#0072CE] transition-colors'
            }`}
          >
            Refine
          </span>
          <span className="flex flex-col items-end shrink-0">
            <span className="text-xs font-black text-slate-400">
              {!progress.isRefineUnlocked ? 'Locked 🔒' : '→'}
            </span>
            {!progress.isRefineUnlocked && (
              <span className="text-[10px] font-bold text-slate-400">
                Unlocks once you&apos;ve rated a song
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          disabled={!progress.isMasterUnlocked}
          onClick={
            !progress.isMasterUnlocked
              ? (e) => e.preventDefault()
              : () => navigateTo('master')
          }
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
            !progress.isMasterUnlocked
              ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed pointer-events-none select-none'
              : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer group shadow-xs'
          }`}
        >
          <span
            className={`text-sm font-black ${
              !progress.isMasterUnlocked
                ? 'text-slate-400'
                : 'text-slate-900 group-hover:text-[#0072CE] transition-colors'
            }`}
          >
            Final Review
          </span>
          <span className="flex flex-col items-end shrink-0">
            <span className="text-xs font-black text-slate-400">
              {!progress.isMasterUnlocked ? 'Locked 🔒' : '→'}
            </span>
            {!progress.isMasterUnlocked && (
              <span className="text-[10px] font-bold text-slate-400">
                Unlocks after Refine
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* PROFILE SETUP MODAL */}
      <WeezerOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        currentUserId={userId}
        onSuccess={(newProfile) => {
          setUserProfile(newProfile);
          syncRankingsToDatabase(triageMap, masterList);
        }}
      />

      {/* FULL-BLEED TOP HERO BANNER (FLUSH TO HEADER & SIDE EDGES) */}
      <div className="-mt-4 sm:-mt-6 lg:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 bg-slate-900 border-b border-slate-200 overflow-hidden shadow-xs">
        <img
          src="/img/garage-banner.jpg"
          alt="In The Garage"
          className="w-full h-36 sm:h-48 md:h-56 object-cover block"
        />
      </div>

      {/* DASHBOARD CONTENT CONTAINER */}
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* WELCOME HEADER */}
        <div className="pt-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              My Name Is{' '}
              {/* The joke, kept quiet: "Jonas" stays struck
                  through but takes the title's own black ink —
                  the display name beside it is the ONLY blue
                  element on the line (two blue chunks side by
                  side read as links / a glitch). */}
              <span className="line-through text-slate-950 mr-1.5">
                Jonas
              </span>
              <span className="text-[#0072CE]">
                {userProfile?.displayName || userProfile?.username || 'Guest'}
              </span>
            </h1>
          </div>
        </div>

        {/* GUEST SAVE HERO (GUESTS WITH PROGRESS ONLY) */}
        {showGuestSaveHero && (
          <div className="bg-gradient-to-br from-[#0072CE] to-blue-700 text-white rounded-3xl p-5 shadow-md border border-blue-600 space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black tracking-tight leading-tight">
                Save your progress
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">
                {triageSortedCount} songs sorted. Create a free account so they&apos;re yours on any device.
              </p>
            </div>
            <button
              onClick={() => navigateTo('login', 'signup')}
              className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition-all shadow-md cursor-pointer"
            >
              Create free account, save progress
            </button>
          </div>
        )}

        {/* PROGRESS CARD — INCOMPLETE STATE: HIGH, RIGHT UNDER THE
            TOP BANNERS. While sorting is unfinished, getting back to
            sorting is the dashboard's one job. (In the complete state
            the same card renders lower, as a summary — see below.) */}
        {!isSortingComplete && <MergedProgressCard />}

        {/* PROFILE COMPLETION BANNER (SIGNED-IN, NO USERNAME SET) */}
        {userId && !userProfile?.username && (
          <div className="bg-amber-50 border-2 border-amber-300/80 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-extrabold text-amber-950 text-sm sm:text-base">
                Claim Your Weezer Song Ranking Username
              </h3>
              <p className="text-xs font-medium text-amber-900/80 leading-relaxed">
                Set up your profile so you can save rankings and compare with friends.
              </p>
            </div>

            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs px-4 py-3 rounded-xl transition-all shadow-md cursor-pointer shrink-0 text-center"
            >
              Setup Profile
            </button>
          </div>
        )}

        {/* TOP CALLOUT / HERO BASED ON USER PROGRESS */}
        {isTriageComplete && !isRefinedMasterComplete && (
          /* STAGE 2: TRIAGE DONE, PROMPT FOR HEAD-TO-HEAD MATCHUPS */
          <div className="bg-gradient-to-br from-[#0072CE] to-blue-700 text-white rounded-3xl p-6 shadow-md border border-blue-600 space-y-4">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Gut Check 100% Done ✓
              </span>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                Ready to Build Your 1–206 Master Ranking?
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">
                You&apos;ve bucketed all 206 songs! Run quick head-to-head matchups to fine-tune your definitive Weezer canon.
              </p>
            </div>
            <button
              onClick={() => {
                setAutoStartMatchups(true);
                setRefineStageIdx(0);
                navigateTo('rank_buckets');
              }}
              className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Start Head-to-Head Matchups</span>
              <span>→</span>
            </button>
          </div>
        )}

        {isSortingComplete && isRefinedMasterComplete && (
          /* STAGE 3: SORTING COMPLETE + REFINED - SWEATER THREAD HERO
             LINK. The dark card only leads once sorting is complete;
             in the incomplete state the softened ThreadPreviewCard
             below takes its place. */
          <button
            type="button"
            onClick={() => navigateTo('wrapped')}
            className="w-full text-left bg-slate-900 hover:bg-slate-950 text-white rounded-3xl p-6 shadow-md border border-slate-800 hover:border-[#0072CE] transition-all cursor-pointer group space-y-3"
          >
            

            <div className="space-y-1">
              <h2 className="text-l sm:text-2xl font-black tracking-tight leading-tight group-hover:text-[#0072CE] transition-colors">
                Your Sweater Thread is Unraveled!
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                Explore your personalized Weezer fandom analytics.
              </p>
            </div>

            <div className="pt-1 flex items-center text-xs font-black text-amber-400 group-hover:underline">
              View Your Sweater Thread →
            </div>
          </button>
        )}

        {/* COMPLETE: THE PROGRESS CARD AS SUMMARY, ABOVE WHAT'S NEXT.
            INCOMPLETE: THE SWEATER THREAD PREVIEW, BELOW THE PROGRESS
            CARD (WHICH RENDERS HIGH IN THIS STATE — SEE ABOVE). */}
        {isSortingComplete ? <MergedProgressCard /> : <ThreadPreviewCard />}

        {/* FANHOOD GAME — one card, both states (see LoreGameCard). */}
        <LoreGameCard />

        {/* WHAT'S NEXT (SORTING COMPLETE) — IN THE INCOMPLETE STATE
            THE QUIET "DONE SORTING?" SECTION RENDERS INSTEAD. */}
        {isSortingComplete ? (
          <div className="space-y-3 pt-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            What&apos;s Next
          </h2>

          {/* 4 CORE RANKING PIPELINE STEPS */}
          <div className="grid grid-cols-2 gap-3">
            {stepsState.map((st) => (
              <button
                key={st.id}
                type="button"
                disabled={st.isDisabled}
                onClick={st.isDisabled ? (e) => e.preventDefault() : st.action}
                className={`p-5 rounded-3xl text-left transition-all flex flex-col justify-between min-h-[110px] border-2 shadow-sm ${
                  st.isDisabled
                    ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed pointer-events-none select-none'
                    : st.isCurrent
                    ? 'bg-[#0072CE] border-[#0072CE] text-white shadow-blue-500/20 cursor-pointer group'
                    : st.isComplete
                    ? 'bg-emerald-50/70 border-emerald-200/80 hover:border-emerald-300 text-slate-950 cursor-pointer group'
                    : 'bg-slate-50/90 border-slate-200/90 hover:border-slate-300 text-slate-950 cursor-pointer group'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3
                      className={`font-black text-base sm:text-lg leading-tight transition-colors ${
                        st.isDisabled
                          ? 'text-slate-400'
                          : st.isCurrent
                          ? 'text-white'
                          : 'text-slate-950 group-hover:text-[#0072CE]'
                      }`}
                    >
                      {st.title}
                    </h3>

                    {st.isComplete && !st.isDisabled && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-sm">
                        ✓
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-xs font-semibold ${
                      st.isDisabled
                        ? 'text-slate-400'
                        : st.isCurrent
                        ? 'text-blue-100'
                        : 'text-slate-400'
                    }`}
                  >
                    {st.desc}
                  </p>
                </div>

                <span
                  className={`text-xs font-black mt-3 transition-colors ${
                    st.isDisabled
                      ? 'text-slate-400'
                      : st.isCurrent
                      ? 'text-blue-100'
                      : 'text-slate-400 group-hover:text-[#0072CE]'
                  }`}
                >
                  {st.isDisabled ? (
                    <>
                      Locked 🔒
                      {/* The unlock condition, not just the lock
                          (UAT P-1b) — derived from the same guard
                          that disabled the tile. */}
                      {st.unlockHint && (
                        <span className="block text-[10px] font-bold mt-0.5">
                          {st.unlockHint}
                        </span>
                      )}
                    </>
                  ) : (
                    st.ctaText
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* COMMUNITY & SOCIAL CARDS (EMBEDDED INSIDE WHAT'S NEXT) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigateTo('fan_stats')}
              className="p-5 rounded-3xl text-left transition-all flex flex-col justify-between min-h-[110px] border-2 border-slate-200/90 bg-slate-50/90 hover:border-slate-300 text-slate-950 cursor-pointer group shadow-sm"
            >
              <div>
                <h3 className="font-black text-base sm:text-lg leading-tight text-slate-950 group-hover:text-[#0072CE] transition-colors">
                  Fan Stats
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  Global consensus
                </p>
              </div>
              <span className="text-xs font-black mt-3 text-slate-400 group-hover:text-[#0072CE] transition-colors">
                View →
              </span>
            </button>

            <button
              type="button"
              disabled={!userId}
              onClick={!userId ? (e) => e.preventDefault() : () => navigateTo('friends')}
              className={`p-5 rounded-3xl text-left transition-all flex flex-col justify-between min-h-[110px] border-2 shadow-sm ${
                !userId
                  ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed pointer-events-none select-none'
                  : 'bg-slate-50/90 border-slate-200/90 hover:border-slate-300 text-slate-950 cursor-pointer group'
              }`}
            >
              <div>
                <h3
                  className={`font-black text-base sm:text-lg leading-tight transition-colors ${
                    !userId ? 'text-slate-400' : 'text-slate-950 group-hover:text-[#0072CE]'
                  }`}
                >
                  Fan Friends
                </h3>
                <p className="text-xs font-semibold mt-1 text-slate-400">
                  {!userId ? 'Sign in to unlock' : 'Head-to-head taste'}
                </p>
              </div>
              <span
                className={`text-xs font-black mt-3 transition-colors ${
                  !userId ? 'text-slate-400' : 'text-slate-400 group-hover:text-[#0072CE]'
                }`}
              >
                {!userId ? 'Locked 🔒' : 'View →'}
              </span>
            </button>
          </div>

          {/* SHAREABLES ASSET LIBRARY CARD */}
          <button
            type="button"
            onClick={() => navigateTo('shareables')}
            className="w-full p-5 rounded-3xl text-left transition-all flex items-center justify-between gap-4 border-2 border-slate-800 bg-slate-900 hover:bg-slate-950 text-white cursor-pointer group shadow-sm"
          >
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight">Shareables</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Your asset library — view, save & share your ranking cards
              </p>
            </div>
            <span className="text-xs font-black text-amber-400 group-hover:underline shrink-0">
              Open Library →
            </span>
          </button>
          </div>
        ) : (
          <DoneSortingSection />
        )}
      </div>
    </div>
  );
}
