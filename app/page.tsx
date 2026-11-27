'use client';

import React, { useState } from 'react';
import { useWeezer, countCategorizedSongs } from './context/WeezerContext';
import { BUCKET_CONFIG, FULL_SONG_POOL } from './data/constants';
import {
  loadSortPath,
  saveSortPath,
  sortPathSongIds,
} from './lib/sortPath';
import {
  LOWER_RANK_BUCKETS,
  loadRefineDecisions,
  saveRefineDecisions,
} from './lib/lowerRank';
import { displayFont } from './components/shareables/fonts';
import AppShell from './components/AppShell';
import WelcomeInterstitial from './components/WelcomeInterstitial';
import { GuardNotice, SyncNotice } from './components/SharedUI';

import Step0Splash from './components/Step0Splash';
import Step05Orientation from './components/Step05Orientation';
import StepGarage2 from './components/StepGarage2';
import Step1Triage from './components/Step1Triage';
import Step2Refine from './components/Step2Refine';
import Step3Master from './components/Step3Master';
import StepFinalRankings from './components/StepFinalRankings';
import { SpotifyReturnGate } from './components/SpotifyExport';
import Step4Wrapped from './components/Step4Wrapped';
import StepShareables from './components/StepShareables';
import FanStats from './components/FanStats';
import WeezerFriends from './components/WeezerFriends';
import Login from './components/Login';
import StepLore from './components/StepLore';
import SiteStats from './components/SiteStats';

const LOWER_PLURALS: Record<string, string> = {
  mid: 'Mids',
  skip: 'Skips',
  trash: 'Trash',
};

export default function WeezerRankerPage() {
  const {
    loadingUser,
    bootError,
    retryBoot,
    step,
    triageMap,
    
    bucketRanks,
    masterList,
    
    updateAndSyncBucketRanks,
    moveMasterSong,
    refineStageIdx,
    setRefineStageIdx,
    lowerRankOptIns,
    setLowerRankOptIn,
    autoStartMatchups,
    setAutoStartMatchups,
    refineOpenTools,
    setRefineOpenTools,
    navigateTo,
    guardNotice,
    dismissGuardNotice,
    syncNotice,
    dismissSyncNotice,
    closeMaster,
    closeRefine,
    setSongBucket,
    normalizeMasterList,
    userId,
  } = useWeezer();

  // THE RANK-DEPTH QUESTION (owner, Nov 20, 2026): asked
  // ONCE, at the moment sorting finishes — how far down do
  // you want to rank? Bangers and Slaps always rank; the
  // lower buckets form a ladder (the site's own sequential
  // rule: Skips rank only behind Mids, Trash behind Skips).
  // The answer writes the opt-in flags AND the Refine
  // module's decision record, so the runway that follows
  // never re-asks bucket by bucket, and Final Review's
  // divider stops being the only door. A fan whose lower
  // buckets are all already decided — or who has none —
  // never sees the card: the finish goes straight to Refine.
  const lowerCounts: Record<string, number> = { mid: 0, skip: 0, trash: 0 };
  for (const v of Object.values(triageMap)) {
    if (v === 'mid' || v === 'skip' || v === 'trash') lowerCounts[v] += 1;
  }
  const presentLowers = LOWER_RANK_BUCKETS.filter((b) => lowerCounts[b] > 0);
  const [rankDepthPrompt, setRankDepthPrompt] = useState(false);
  const [rankDepth, setRankDepth] = useState(0);

  const handleFinishTriage = () => {
    const decisions = loadRefineDecisions();
    const undecided = presentLowers.some(
      (b) => !decisions[b] && !lowerRankOptIns.includes(b)
    );
    if (presentLowers.length > 0 && undecided) {
      // Start the ladder where the flags already stand.
      let depth = 0;
      while (
        depth < presentLowers.length &&
        lowerRankOptIns.includes(presentLowers[depth])
      ) {
        depth += 1;
      }
      setRankDepth(depth);
      setRankDepthPrompt(true);
      return;
    }
    setAutoStartMatchups(true);
    navigateTo('rank_buckets');
  };

  const confirmRankDepth = () => {
    const decisions = { ...loadRefineDecisions() };
    presentLowers.forEach((b, i) => {
      const on = i < rankDepth;
      setLowerRankOptIn(b, on);
      decisions[b] = on ? 'rank' : 'review';
    });
    saveRefineDecisions(decisions);
    setRankDepthPrompt(false);
    setAutoStartMatchups(true);
    navigateTo('rank_buckets');
  };

  // Guest = no signed-in session (the one auth signal every component
  // branches on). Computed here and drilled into the deck so its
  // milestone / end / completion cards can offer account creation and
  // the Garage off-ramp (milestone-flows design memo, §1.3).
  const isGuest = userId === null;

  return (
    <>
      {/* Welcome / boot overlay (Nov 4, 2026): session-gated —
          covers the boot on a new session or a return after 8h+,
          or when the boot runs long; never on step changes. It
          reads loadingUser only and touches no step state, so
          history init (which keys off the landing settling in
          the context) is unaffected. */}
      <WelcomeInterstitial loading={loadingUser} />

      <AppShell fullWidth={step === 'wrapped'} fullBleed={step === 'lore'}>
      {/* Guard-rewrite explanation (UAT P-1): renders only when
          the guard rewrote the landing the user just arrived on
          (rewrites land on triage or rank_buckets; context clears
          the notice on the next non-rewrite navigation). */}
      <GuardNotice notice={guardNotice} onDismiss={dismissGuardNotice} />

      {/* Save-failure notice (Oct 22 save-race fix): renders only
          when a rankings write exhausted its retries. */}
      <SyncNotice show={syncNotice} onDismiss={dismissSyncNotice} />

      {loadingUser ? (
        /* Boot placeholder: the shell's normal chrome over a
           quiet skeleton while the initial load settles. The
           actual step renders only after settling — no
           wrong-screen flash, no guard changes — but the boot
           no longer feels like a full-screen interstitial. */
        <div
          aria-busy="true"
          aria-label="Loading"
          className="animate-pulse space-y-4 pt-2 sm:space-y-6"
        >
          <div className="h-44 rounded-[2rem] bg-slate-200/70 sm:h-52" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-28 rounded-[2rem] bg-slate-200/60" />
            <div className="h-28 rounded-[2rem] bg-slate-200/60" />
          </div>
          <div className="h-28 rounded-[2rem] bg-slate-200/50" />
        </div>
      ) : bootError ? (
        /* Boot load failure (Nov 7 hardening, audit F2/F3):
           a rankings/profile fetch errored or timed out, so
           nothing was loaded and nothing was adopted. The
           honest landing is this card — never an empty sort
           presented as the account's truth, and never the
           skeleton forever. The saved rankings are untouched
           in the account; Try again runs the boot for real
           (the failed boot set no marker to no-op against). */
        <div className="mx-auto max-w-md pt-6">
          <div className="space-y-4 rounded-[2rem] border-[3px] border-[#0C1220] bg-white p-6 text-center shadow-[4px_4px_0_#0C1220]">
            <div className="space-y-2">
              <h2 className="text-lg font-black text-[#0C1220]">
                Couldn&rsquo;t load your rankings
              </h2>
              <p className="text-sm font-medium leading-relaxed text-[#3D4A63]">
                {userId
                  ? 'Your saved rankings are safe in your account — they just didn’t load this time. Check your connection, then try again.'
                  : 'Something interrupted the load before it could finish. Check your connection, then try again.'}
              </p>
            </div>
            <button
              type="button"
              onClick={retryBoot}
              className="w-full cursor-pointer rounded-xl bg-[#0072CE] py-3 text-sm font-black text-white transition-all hover:bg-blue-600"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <>
      {step === 'splash' && <Step0Splash />}

      {step === 'login' && <Login />}

      {step === 'orientation' && <Step05Orientation />}

      {/* The dashboard IS the headquarters page (Mark's call,
          Nov 4, 2026): StepGarage2 renders for 'dashboard' and
          keeps its 'garage2' alias below. The old StepDashboard
          component stays in the tree, unreferenced, for rollback —
          repoint this line at it to revert. */}
      {step === 'dashboard' && <StepGarage2 />}

      {step === 'garage2' && <StepGarage2 />}

      {step === 'triage' && (
        <Step1Triage
          triageMap={triageMap}
          handleSetBucket={(id, b) => setSongBucket(id, b)}
          handleFinishTriage={handleFinishTriage}
          isGuest={isGuest}
          onCreateAccount={() => navigateTo('login', 'signup')}
          onOpenGarage={() => navigateTo('dashboard')}
        />
      )}

      {step === 'rank_buckets' && (
        <Step2Refine
          bucketRanks={bucketRanks}
          triageMap={triageMap}
          masterList={masterList}
          onUpdateRanks={updateAndSyncBucketRanks}
          handleFinishBucketRanking={() => {
            normalizeMasterList();
            // Through navigateTo, not the raw setStep: this is a
            // real user navigation, so it gets a history entry,
            // the guard, and a recorded origin for Final Review's
            // Back — the raw setter did none of that, and Back
            // from Final Review used to leave the site.
            navigateTo('master');
          }}
          onBackToTriage={() => closeRefine()}
          onKeepSorting={() => navigateTo('triage')}
          autoStartMatchups={autoStartMatchups}
          initialStageIdx={refineStageIdx}
          onStageChange={setRefineStageIdx}
          lowerRankOptIns={lowerRankOptIns}
          onToggleLowerRank={setLowerRankOptIn}
          openTools={refineOpenTools}
          onConsumeOpenTools={() => setRefineOpenTools(false)}
        />
      )}

      {step === 'final' && (
        <StepFinalRankings
          masterList={masterList}
          triageMap={triageMap}
          setStep={(s) => navigateTo(s)}
        />
      )}

      {step === 'master' && (
        <Step3Master
          masterList={masterList}
          triageMap={triageMap}
          moveMasterSong={moveMasterSong}
          setSongBucket={setSongBucket}
          setStep={(s) => navigateTo(s)}
          onBack={() => {
            setAutoStartMatchups(false);
            closeMaster();
          }}
          onKeepSorting={() => navigateTo('triage')}
          lowerRankOptIns={lowerRankOptIns}
          onRankBucket={(b) => {
            // Same after-navigateTo ordering as the My
            // Rankings prompt (owner bug, Nov 12, 2026):
            // navigate first, THEN set the stage, or the
            // landing resets to Bangers.
            const stageIdx = ({ mid: 2, skip: 3, trash: 4 } as Record<string, number>)[b];
            if (stageIdx === undefined) return;
            navigateTo('rank_buckets');
            setRefineStageIdx(stageIdx);
            setAutoStartMatchups(false);
            setLowerRankOptIn(b, true);
            setRefineOpenTools(true);
          }}
        />
      )}

      {step === 'wrapped' && (
        <Step4Wrapped
          masterList={masterList}
          triageMap={triageMap}
          setStep={(s) => {
            if (s === 'triage') {
              // KEEP SORTING FROM THE THREAD (owner, Nov 21,
              // 2026): a fan whose path is finished but whose
              // catalog isn't is answering the Thread's
              // "sort more" invite — widen their path to the
              // full catalog and land them on the songs they
              // haven't sorted (triage reads the intent and
              // turns Hide Sorted on), not on the completed
              // list they just left. Any other trip to triage
              // leaves the path alone.
              const path = loadSortPath();
              if (
                path &&
                path.kind !== 'all' &&
                countCategorizedSongs(triageMap) < FULL_SONG_POOL.length &&
                sortPathSongIds(path).every(
                  (id) => triageMap[id] !== undefined
                )
              ) {
                saveSortPath({ kind: 'all' });
                try {
                  window.sessionStorage.setItem('weezer-keep-sorting', '1');
                } catch {
                  /* the widening alone still lands them right */
                }
              }
              navigateTo('triage');
            } else if (s === 'rank_buckets') {
              setRefineStageIdx(4);
              navigateTo('rank_buckets');
              // AFTER navigateTo on purpose: navigateInternal sets the
              // matchup flag explicitly on every Refine landing, so
              // this edit-intent exception must run last to survive.
              setAutoStartMatchups(false);
            } else {
              // Through navigateTo, not the raw setStep: the URL
              // stays in sync, guards run, and a return origin is
              // recorded for the tracked steps — a raw setStep did
              // none of that, so refresh/share resurrected the
              // Thread and Final Review's Back lost the Thread as
              // its origin. (Targets from Wrapped are safe here:
              // fan_stats/triage are unguarded, and master's unlock
              // condition is identical to wrapped's.)
              navigateTo(s as any);
            }
          }}
        />
      )}

      {step === 'shareables' && <StepShareables />}

      {step === 'fan_stats' && <FanStats userMasterList={masterList} />}

      {step === 'friends' && <WeezerFriends />}

      {step === 'lore' && <StepLore />}

      {/* The owner's stats page (Nov 7): renders only for his
          account — SiteStats bounces anyone else to the
          dashboard — and its data comes from an RPC that
          answers only to him server-side. Deliberately no menu
          entry; the account drawer holds the only door. */}
      {step === 'owner_stats' && <SiteStats />}

      {/* Spotify return gate (Nov 14, 2026): after the
          Spotify sign-in round-trip, the playlist modal
          reopens wherever the fan landed. Renders nothing
          unless a return is pending. */}
      <SpotifyReturnGate />

      {/* The rank-depth question (owner, Nov 20, 2026): the
          one up-front ask at the end of sorting, rendered
          over the triage screen the fan just finished. */}
      {rankDepthPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0C1220]/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="How far down do you want to rank?"
        >
          <div className="w-full max-w-md space-y-4 rounded-[28px] bg-white p-5 shadow-[0_14px_30px_rgba(12,18,32,0.08)]">
            <h3
              className="text-[24px] font-black leading-tight text-[#0C1220]"
            >
              You&rsquo;ve ranked {countCategorizedSongs(triageMap)} songs
            </h3>
            <p className="text-sm font-medium leading-relaxed text-[#3D4A63]">
              Next, you&rsquo;ll rank order them to refine your list.
              Which groupings do you want to rank?
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Rank depth">
              {Array.from({ length: presentLowers.length + 1 }, (_, d) => {
                const selected = rankDepth === d;
                const deepest = d > 0 ? presentLowers[d - 1] : null;
                const label =
                  d === 0
                    ? 'Just my Bangers & Slaps'
                    : d === presentLowers.length
                      ? 'Rank all'
                      : `Rank my ${presentLowers
                          .slice(0, d)
                          .map((b) => `${LOWER_PLURALS[b]} (${lowerCounts[b]})`)
                          .join(' + ')} too`;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRankDepth(d)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-black transition-all ${
                      selected
                        ? 'bg-[#0072CE] text-white shadow-[0_14px_30px_rgba(12,18,32,0.08)]'
                        : 'bg-[#F1F5F9] text-[#0C1220] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[2.5px] ${
                        selected ? 'border-white' : 'border-[#94A3B8]'
                      }`}
                    >
                      {selected && (
                        <span className="h-2.5 w-2.5 rounded-full bg-white" />
                      )}
                    </span>
                    {deepest && d < presentLowers.length && (
                      <span aria-hidden="true">
                        {BUCKET_CONFIG[deepest].emoji}
                      </span>
                    )}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={confirmRankDepth}
              className="w-full cursor-pointer rounded-full bg-[#FFC72C] px-6 py-3 text-base font-black text-[#0C1220] shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Start ranking →
            </button>
            <p className="text-center text-xs font-bold text-[#3D4A63]">
              Then: review your list, and get your Sweater Thread.
            </p>
          </div>
        </div>
      )}
        </>
      )}
      </AppShell>
    </>
  );
}
