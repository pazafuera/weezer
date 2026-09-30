'use client';

import React, { useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { BUCKET_CONFIG, FULL_SONG_POOL, BucketType } from '../data/constants';
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
  const isTriageComplete = triageSortedCount >= totalSongs;

  // Bucket breakdown counts
  const bucketCounts = (Object.keys(BUCKET_CONFIG) as BucketType[]).reduce(
    (acc, key) => {
      acc[key] = Object.values(triageMap).filter((b) => b === key).length;
      return acc;
    },
    {} as Record<BucketType, number>
  );

  const isRefinedMasterComplete = masterList.length > 0 && isTriageComplete;

  // Step Status Determinations
  const stepsState = [
    {
      id: 'triage',
      title: 'The Gut Check',
      desc: isTriageComplete
        ? 'All 206 sorted'
        : `${triageSortedCount}/${totalSongs} sorted`,
      isComplete: isTriageComplete,
      isCurrent: !isTriageComplete,
      action: () => navigateTo('triage'),
    },
    {
      id: 'rank_buckets',
      title: 'Refine Buckets',
      desc: isRefinedMasterComplete ? 'Matchups done' : 'Head-to-head matchups',
      isComplete: isRefinedMasterComplete,
      isCurrent: isTriageComplete && !isRefinedMasterComplete,
      action: () => {
        setAutoStartMatchups(true);
        setRefineStageIdx(0);
        navigateTo('rank_buckets');
      },
    },
    {
      id: 'master',
      title: 'Master List',
      desc: '1–206 canon ranking',
      isComplete: isRefinedMasterComplete,
      isCurrent: false,
      action: () => navigateTo('master'),
    },
    {
      id: 'wrapped',
      title: 'Sweater Thread',
      desc: 'Taste DNA & Stats',
      isComplete: isRefinedMasterComplete,
      isCurrent: isRefinedMasterComplete,
      action: () => navigateTo('wrapped'),
    },
  ];

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto px-4">
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

      {/* WELCOME HEADER */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Welcome back,{' '}
            {userProfile?.displayName || userProfile?.username || 'Fan'} 👋
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Command Center
          </p>
        </div>

        {/* Hide intro link once rankings have started */}
        {triageSortedCount === 0 && (
          <button
            onClick={() => navigateTo('splash')}
            className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            View Intro →
          </button>
        )}
      </div>

      {/* PROFILE COMPLETION BANNER (IF NO USERNAME SET) */}
      {!userProfile?.username && (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="font-extrabold text-amber-950 text-sm sm:text-base">
              Claim Your Weezer Handle
            </h3>
            <p className="text-xs font-medium text-amber-900/80 leading-relaxed">
              Set up your username so you can save rankings and compare with
              friends.
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

      {/* OVERALL PROGRESS & COMPACT HORIZONTAL BUCKETS */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Gut Check Progress
          </span>
          <span className="text-xs font-black text-[#0072CE]">
            {triageSortedCount} / {totalSongs} Songs ({triagePct}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className="h-full bg-[#0072CE] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${triagePct}%` }}
          />
        </div>

        {/* COMPACT HORIZONTAL BUCKET ROW */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
          {(Object.keys(BUCKET_CONFIG) as BucketType[]).map((key) => {
            const cfg = BUCKET_CONFIG[key];
            const count = bucketCounts[key] || 0;
            return (
              <div
                key={key}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl bg-slate-50 border border-slate-100"
                title={cfg.label}
              >
                <span className="text-base sm:text-lg">{cfg.emoji}</span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* WHAT'S NEXT SECTION */}
      <div className="space-y-3 pt-2">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
          What&apos;s Next
        </h2>

        {/* COMPACT RECTANGULAR CARDS IN A 2x2 GRID */}
        <div className="grid grid-cols-2 gap-3">
          {stepsState.map((st) => (
            <button
              key={st.id}
              onClick={st.action}
              className={`p-5 rounded-3xl text-left transition-all cursor-pointer flex flex-col justify-between min-h-[110px] border-2 group shadow-sm ${
                st.isCurrent
                  ? 'bg-[#0072CE] border-[#0072CE] text-white shadow-blue-500/20'
                  : st.isComplete
                  ? 'bg-emerald-50/70 border-emerald-200/80 hover:border-emerald-300 text-slate-950'
                  : 'bg-slate-50/90 border-slate-200/90 hover:border-slate-300 text-slate-950'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3
                    className={`font-black text-base sm:text-lg leading-tight transition-colors ${
                      st.isCurrent
                        ? 'text-white'
                        : 'text-slate-950 group-hover:text-[#0072CE]'
                    }`}
                  >
                    {st.title}
                  </h3>

                  {st.isComplete && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-sm">
                      ✓
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs font-semibold ${
                    st.isCurrent ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {st.desc}
                </p>
              </div>

              <span
                className={`text-xs font-black mt-3 transition-colors ${
                  st.isCurrent
                    ? 'text-blue-100'
                    : 'text-slate-400 group-hover:text-[#0072CE]'
                }`}
              >
                {st.isCurrent ? 'Start →' : 'View →'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* COMMUNITY & SOCIAL PORTALS */}
      <div className="space-y-3 pt-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Community & Social
        </span>

        <div className="grid grid-cols-2 gap-3">
          {/* FAN STATS */}
          <button
            onClick={() => navigateTo('fan_stats')}
            className="bg-white border border-slate-200/90 hover:border-emerald-300 p-5 rounded-3xl text-left transition-all shadow-sm group cursor-pointer flex flex-col justify-between min-h-[110px]"
          >
            <div>
              <h3 className="font-black text-slate-950 text-base sm:text-lg group-hover:text-emerald-600 transition-colors leading-tight">
                Fan Stats
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Global consensus
              </p>
            </div>
            <span className="text-xs font-black text-slate-400 group-hover:text-emerald-600 transition-colors mt-2">
              View →
            </span>
          </button>

          {/* FRIENDS */}
          <button
            onClick={() => navigateTo('friends')}
            className="bg-white border border-slate-200/90 hover:border-purple-300 p-5 rounded-3xl text-left transition-all shadow-sm group cursor-pointer flex flex-col justify-between min-h-[110px]"
          >
            <div>
              <h3 className="font-black text-slate-950 text-base sm:text-lg group-hover:text-purple-600 transition-colors leading-tight">
                Friends
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Head-to-head taste
              </p>
            </div>
            <span className="text-xs font-black text-slate-400 group-hover:text-purple-600 transition-colors mt-2">
              View →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}