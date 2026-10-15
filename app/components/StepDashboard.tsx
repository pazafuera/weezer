'use client';

import React, { useState } from 'react';
import { useWeezer, getProgressState } from '../context/WeezerContext';
import { BUCKET_CONFIG, FULL_SONG_POOL, BucketType, ALBUM_NAME_TO_ID } from '../data/constants';
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

  // Dynamic Triage CTA Text
  const getTriageCtaText = () => {
    if (isTriageComplete) return 'Review ✓';
    if (triageSortedCount > 160) return 'Finish →';
    if (hasStartedTriage) return 'Continue →';
    return 'Start →';
  };

  // HOT-LINK DIRECTLY TO ALBUM SECTION ON TRIAGE PAGE
  const handleAlbumClick = (albumName: string) => {
    const slug = albumName.replace(/\s+/g, '-').toLowerCase();
    navigateTo('triage');
    setTimeout(() => {
      const el = document.getElementById(`album-${slug}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
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
      ctaText: 'View →',
      action: () => {
        if (!progress.isWrappedUnlocked) return;
        navigateTo('wrapped');
      },
    },
  ];

  // REUSABLE UNIFIED CATALOG & PROGRESS CARD MODULE
  const UnifiedCatalogProgressModule = () => (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
      {/* TOP: OVERALL PROGRESS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-400">
            Your Progress
          </span>
          <span className="text-xs font-black text-[#0072CE]">
            {triageSortedCount} / {totalSongs} Songs ({triagePct}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className="h-full bg-[#0072CE] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${triagePct}%` }}
          />
        </div>
      </div>

      {/* MIDDLE: CATALOG COMPLETION CAROUSEL */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
            Catalog Completion
          </h3>
          <button
            onClick={() => navigateTo('triage')}
            className="text-xs font-black text-[#0072CE] hover:underline cursor-pointer"
          >
            Sort Songs →
          </button>
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
              <div
                key={albumName}
                onClick={() => handleAlbumClick(albumName)}
                className="w-[115px] sm:w-[125px] shrink-0 bg-slate-50 border border-slate-200/80 hover:border-blue-300 rounded-2xl p-2.5 shadow-2xs flex flex-col items-center text-center cursor-pointer group transition-all"
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
              </div>
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
              <span className="line-through text-[#0072CE] mr-1.5">
                Jonas
              </span>
              <span className="text-[#0072CE]">
                {userProfile?.displayName || userProfile?.username || 'Guest'}
              </span>
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Welcome! You&apos;re <b>In The Garage.</b>
            </p>
          </div>

          {triageSortedCount === 0 && (
            <button
              onClick={() => navigateTo('splash')}
              className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              View Intro →
            </button>
          )}
        </div>

        {/* PROFILE COMPLETION BANNER (FOR GUESTS / NO USERNAME SET) */}
        {!userProfile?.username && (
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

        {isRefinedMasterComplete && (
          /* STAGE 3: ALL STEPS DONE - SWEATER THREAD HERO LINK */
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

        {/* STAGE 1 (INCOMPLETE TRIAGE): RENDER UNIFIED MODULE HIGH UP */}
        {!isTriageComplete && <UnifiedCatalogProgressModule />}

        {/* WHAT'S NEXT SECTION (INCLUDES COMMUNITY & SOCIAL CARDS) */}
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
                  {st.isDisabled ? 'Locked 🔒' : st.ctaText}
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
        </div>

        {/* STAGES 2 & 3 (TRIAGE DONE): UNIFIED MODULE PUSHED LOWER ON PAGE */}
        {isTriageComplete && <UnifiedCatalogProgressModule />}
      </div>
    </div>
  );
}
