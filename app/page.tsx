'use client';

import React from 'react';
import { useWeezer } from './context/WeezerContext';
import AppShell from './components/AppShell';

import Step0Splash from './components/Step0Splash';
import Step05Orientation from './components/Step05Orientation';
import StepDashboard from './components/StepDashboard';
import Step1Triage from './components/Step1Triage';
import Step2Refine from './components/Step2Refine';
import Step3Master from './components/Step3Master';
import Step4Wrapped from './components/Step4Wrapped';
import FanStats from './components/FanStats';
import WeezerFriends from './components/WeezerFriends';
import StepSignupSuccess from './components/StepSignupSuccess';
import Login from './login/page';

export default function WeezerRankerPage() {
  const {
    loadingUser,
    step,
    setStep,
    triageMap,
    setTriageMap,
    bucketRanks,
    masterList,
    syncRankingsToDatabase,
    updateAndSyncBucketRanks,
    moveMasterSong,
    refineStageIdx,
    setRefineStageIdx,
    autoStartMatchups,
    setAutoStartMatchups,
    navigateTo,
  } = useWeezer();

  if (loadingUser) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 gap-4">
        <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500 animate-pulse">
          Syncing Weezer Canon Ranker...
        </p>
      </div>
    );
  }

  const handleFinishTriage = () => {
    setAutoStartMatchups(true);
    navigateTo('rank_buckets');
  };

  return (
    <AppShell>
      {step === 'splash' && <Step0Splash />}

      {step === 'login' && <Login />}

      {step === 'signup_success' && <StepSignupSuccess />}

      {step === 'orientation' && <Step05Orientation />}

      {step === 'dashboard' && <StepDashboard />}

      {step === 'triage' && (
        <Step1Triage
          triageMap={triageMap}
          handleSetBucket={(id, b) => {
            const map = { ...triageMap, [id]: b };
            setTriageMap(map);
            syncRankingsToDatabase(map, masterList);
          }}
          handleFinishTriage={handleFinishTriage}
        />
      )}

      {step === 'rank_buckets' && (
        <Step2Refine
          bucketRanks={bucketRanks}
          triageMap={triageMap}
          onUpdateRanks={updateAndSyncBucketRanks}
          handleFinishBucketRanking={() => setStep('master')}
          onBackToTriage={() => setStep('triage')}
          autoStartMatchups={autoStartMatchups}
          initialStageIdx={refineStageIdx}
        />
      )}

      {step === 'master' && (
        <Step3Master
          masterList={masterList}
          triageMap={triageMap}
          moveMasterSong={moveMasterSong}
          setStep={setStep}
          onBack={() => {
            setAutoStartMatchups(false);
            setRefineStageIdx(4);
            navigateTo('rank_buckets');
          }}
        />
      )}

      {step === 'wrapped' && (
        <Step4Wrapped
          masterList={masterList}
          triageMap={triageMap}
          setStep={(s) => {
            if (s === 'rank_buckets') {
              setAutoStartMatchups(false);
              setRefineStageIdx(4);
              navigateTo('rank_buckets');
            } else {
              setStep(s as any);
            }
          }}
        />
      )}

      {step === 'fan_stats' && <FanStats userMasterList={masterList} />}

      {step === 'friends' && <WeezerFriends />}
    </AppShell>
  );
}