'use client';

import React from 'react';
import { useWeezer } from './context/WeezerContext';
import AppShell from './components/AppShell';
import { GuardNotice } from './components/SharedUI';

import Step0Splash from './components/Step0Splash';
import Step05Orientation from './components/Step05Orientation';
import StepDashboard from './components/StepDashboard';
import Step1Triage from './components/Step1Triage';
import Step2Refine from './components/Step2Refine';
import Step3Master from './components/Step3Master';
import Step4Wrapped from './components/Step4Wrapped';
import StepShareables from './components/StepShareables';
import FanStats from './components/FanStats';
import WeezerFriends from './components/WeezerFriends';
import Login from './components/Login';

export default function WeezerRankerPage() {
  const {
    loadingUser,
    step,
    setStep,
    triageMap,
    
    bucketRanks,
    masterList,
    
    updateAndSyncBucketRanks,
    moveMasterSong,
    refineStageIdx,
    setRefineStageIdx,
    autoStartMatchups,
    setAutoStartMatchups,
    navigateTo,
    guardNotice,
    dismissGuardNotice,
    closeMaster,
    closeRefine,
    setSongBucket,
    normalizeMasterList,
    userId,
  } = useWeezer();

  if (loadingUser) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 gap-4">
        <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500 animate-pulse">
          Busy wrestling with Jimmy...
        </p>
      </div>
    );
  }

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
    <AppShell fullWidth={step === 'wrapped'}>
      {/* Guard-rewrite explanation (UAT P-1): renders only when
          the guard rewrote the landing the user just arrived on
          (rewrites land on triage or rank_buckets; context clears
          the notice on the next non-rewrite navigation). */}
      <GuardNotice notice={guardNotice} onDismiss={dismissGuardNotice} />

      {step === 'splash' && <Step0Splash />}

      {step === 'login' && <Login />}

      {step === 'orientation' && <Step05Orientation />}

      {step === 'dashboard' && <StepDashboard />}

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
          onUpdateRanks={updateAndSyncBucketRanks}
          handleFinishBucketRanking={() => {
            normalizeMasterList();
            setStep('master');
          }}
          onBackToTriage={() => closeRefine()}
          onKeepSorting={() => navigateTo('triage')}
          onExitToDashboard={() => navigateTo('dashboard')}
          autoStartMatchups={autoStartMatchups}
          initialStageIdx={refineStageIdx}
          onStageChange={setRefineStageIdx}
        />
      )}

      {step === 'master' && (
        <Step3Master
          masterList={masterList}
          triageMap={triageMap}
          moveMasterSong={moveMasterSong}
          setStep={(s) => navigateTo(s)}
          onBack={() => {
            setAutoStartMatchups(false);
            closeMaster();
          }}
          onKeepSorting={() => navigateTo('triage')}
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
    </AppShell>
  );
}
