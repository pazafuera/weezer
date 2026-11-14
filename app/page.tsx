'use client';

import React from 'react';
import { useWeezer } from './context/WeezerContext';
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
import Step4Wrapped from './components/Step4Wrapped';
import StepShareables from './components/StepShareables';
import FanStats from './components/FanStats';
import WeezerFriends from './components/WeezerFriends';
import Login from './components/Login';
import StepLore from './components/StepLore';
import SiteStats from './components/SiteStats';

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

  const handleFinishTriage = () => {
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
        />
      )}

      {step === 'wrapped' && (
        <Step4Wrapped
          masterList={masterList}
          triageMap={triageMap}
          setStep={(s) => {
            if (s === 'rank_buckets') {
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
        </>
      )}
      </AppShell>
    </>
  );
}
