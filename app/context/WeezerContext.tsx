'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { BucketType, Song, FULL_SONG_POOL } from '../data/constants';

export type AppStep =
  | 'splash'
  | 'orientation'
  | 'dashboard'
  | 'triage'
  | 'rank_buckets'
  | 'master'
  | 'wrapped'
  | 'fan_stats'
  | 'friends';

interface UserProfile {
  username?: string;
  displayName?: string;
  birthYear?: number;
  location?: string;
}

interface WeezerContextType {
  // Navigation & Flow State
  step: AppStep;
  setStep: (step: AppStep) => void;
  refineStageIdx: number;
  setRefineStageIdx: (idx: number) => void;
  autoStartMatchups: boolean;
  setAutoStartMatchups: (val: boolean) => void;
  navigateTo: (targetStep: AppStep) => void;

  // Auth & User State
  loadingUser: boolean;
  userId: string | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  handleSignOut: () => Promise<void>;

  // Friend Requests State
  pendingRequestsCount: number;
  refreshPendingRequests: () => Promise<void>;

  // Ranking State
  triageMap: Record<string, BucketType>;
  setTriageMap: (map: Record<string, BucketType>) => void;
  bucketRanks: Record<BucketType, Song[]>;
  masterList: Song[];

  // Actions
  syncRankingsToDatabase: (map: Record<string, BucketType>, master: Song[]) => Promise<void>;
  updateAndSyncBucketRanks: (
    newBucketRanks: Record<BucketType, Song[]>,
    updatedMap?: Record<string, BucketType>
  ) => void;
  moveMasterSong: (index: number, direction: 'up' | 'down') => void;
  handleMagicFill: () => void;
}

const WeezerContext = createContext<WeezerContextType | undefined>(undefined);

const getDerivedBucketRanks = (
  map: Record<string, BucketType>,
  master: Song[]
) => {
  const poolToUse = master.length > 0 ? master : FULL_SONG_POOL;
  const masterIds = new Set(poolToUse.map((s) => s.id));
  const missingSongs = FULL_SONG_POOL.filter((s) => !masterIds.has(s.id));
  const combinedPool = [...poolToUse, ...missingSongs];

  return {
    banger: combinedPool.filter((s) => map[s.id] === 'banger'),
    slaps: combinedPool.filter((s) => map[s.id] === 'slaps'),
    mid: combinedPool.filter((s) => map[s.id] === 'mid'),
    skip: combinedPool.filter((s) => map[s.id] === 'skip'),
    trash: combinedPool.filter((s) => map[s.id] === 'trash' || !map[s.id]),
  };
};

export const WeezerProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  // Auth State
  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Social & Friend Requests
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Navigation State
  const [step, setStepState] = useState<AppStep>('splash');
  const [refineStageIdx, setRefineStageIdx] = useState(0);
  const [autoStartMatchups, setAutoStartMatchups] = useState(false);

  // Rankings State
  const [triageMap, setTriageMap] = useState<Record<string, BucketType>>({});
  const [bucketRanks, setBucketRanks] = useState<Record<BucketType, Song[]>>({
    banger: [], slaps: [], mid: [], skip: [], trash: [],
  });
  const [masterList, setMasterList] = useState<Song[]>([]);

  const setStep = (newStep: AppStep) => {
    setStepState(newStep);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // Sync step from URL parameter on initial load or refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlStep = params.get('step') as AppStep;
      if (urlStep) {
        setStepState(urlStep);
      }
    }
  }, []);

  useEffect(() => {
    initUserAndLoadRankings();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initUserAndLoadRankings();
      } else {
        setUserId(null);
        setUserProfile(null);
        setPendingRequestsCount(0);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPendingRequests = async () => {
    if (!userId) return;
    try {
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'pending');

      setPendingRequestsCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending friend requests:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      refreshPendingRequests();
    }
  }, [userId]);

  async function initUserAndLoadRankings() {
    setLoadingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const uid = session.user.id;
        setUserId(uid);

        // Fetch User Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, display_name, birth_year, country_code, state_code')
          .eq('id', uid)
          .maybeSingle();

        if (profileData) {
          const locationStr =
            profileData.country_code === 'US' && profileData.state_code
              ? `${profileData.state_code}, USA`
              : profileData.country_code || undefined;

          setUserProfile({
            username: profileData.username,
            displayName: profileData.display_name || profileData.username || session.user.email?.split('@')[0],
            birthYear: profileData.birth_year || undefined,
            location: locationStr,
          });
        } else {
          setUserProfile({
            displayName: session.user.email?.split('@')[0] || 'Fan',
          });
        }

        // Fetch Rankings for logged in user
        const validSongIds = new Set(FULL_SONG_POOL.map((s) => s.id));
        const { data: rankData } = await supabase
          .from('weezer_rankings')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (rankData) {
          let loadedTriage: Record<string, BucketType> = {};
          let loadedMaster: Song[] = [];

          if (rankData.triage_map) {
            Object.keys(rankData.triage_map).forEach((id) => {
              if (validSongIds.has(id)) loadedTriage[id] = rankData.triage_map[id];
            });
            setTriageMap(loadedTriage);
          }
          if (rankData.master_list && Array.isArray(rankData.master_list)) {
            loadedMaster = rankData.master_list.filter((s: Song) =>
              validSongIds.has(s.id)
            );
            setMasterList(loadedMaster);
          }

          setBucketRanks(getDerivedBucketRanks(loadedTriage, loadedMaster));

          // Smart Entry: If user has progress and no URL step is specified, route to Dashboard
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (!params.get('step') && (Object.keys(loadedTriage).length > 0 || loadedMaster.length > 0)) {
              setStepState('dashboard');
            }
          }
        }
      } else {
        // Guest mode fallback from localStorage
        const localState = localStorage.getItem('weezer_ranker_state');
        if (localState) {
          try {
            const parsed = JSON.parse(localState);
            if (parsed.triageMap) setTriageMap(parsed.triageMap);
            if (parsed.masterList) setMasterList(parsed.masterList);
            setBucketRanks(getDerivedBucketRanks(parsed.triageMap || {}, parsed.masterList || []));
            
            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              if (!params.get('step') && Object.keys(parsed.triageMap || {}).length > 0) {
                setStepState('dashboard');
              }
            }
          } catch (e) {
            console.error('Error parsing local state:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error loading rankings:', err);
    } finally {
      setLoadingUser(false);
    }
  }

  const syncRankingsToDatabase = async (
    map: Record<string, BucketType>,
    master: Song[]
  ) => {
    localStorage.setItem(
      'weezer_ranker_state',
      JSON.stringify({ triageMap: map, masterList: master })
    );
    if (!userId) return;
    try {
      await supabase.from('weezer_rankings').upsert(
        {
          user_id: userId,
          triage_map: map,
          master_list: master,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('Error syncing rankings:', err);
    }
  };

  const updateAndSyncBucketRanks = (
    newBucketRanks: Record<BucketType, Song[]>,
    updatedMap?: Record<string, BucketType>
  ) => {
    setBucketRanks(newBucketRanks);
    const activeMap = updatedMap || triageMap;
    const newMaster = [
      ...(newBucketRanks.banger || []),
      ...(newBucketRanks.slaps || []),
      ...(newBucketRanks.mid || []),
      ...(newBucketRanks.skip || []),
      ...(newBucketRanks.trash || []),
    ];
    setMasterList(newMaster);
    syncRankingsToDatabase(activeMap, newMaster);
  };

  const handleMagicFill = () => {
    const newMap: Record<string, BucketType> = {};
    FULL_SONG_POOL.forEach((song) => {
      const rand = Math.random();
      if (rand < 0.15) newMap[song.id] = 'banger';
      else if (rand < 0.4) newMap[song.id] = 'slaps';
      else if (rand < 0.7) newMap[song.id] = 'mid';
      else if (rand < 0.9) newMap[song.id] = 'skip';
      else newMap[song.id] = 'trash';
    });
    setTriageMap(newMap);
    const derived = getDerivedBucketRanks(newMap, masterList);
    setBucketRanks(derived);
    syncRankingsToDatabase(newMap, masterList);
    alert('Magic Fill Complete! 206 songs bucketed.');
  };

  const moveMasterSong = (index: number, direction: 'up' | 'down') => {
    const list = [...masterList];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setMasterList(list);
    syncRankingsToDatabase(triageMap, list);
  };

  const navigateTo = (targetStep: AppStep) => {
    if (targetStep === 'rank_buckets') {
      setBucketRanks(getDerivedBucketRanks(triageMap, masterList));
      setRefineStageIdx(0);
    }
    setStep(targetStep);

    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/') {
        router.push(`/?step=${targetStep}`);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('step', targetStep);
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setUserProfile(null);
    setTriageMap({});
    setMasterList([]);
    setPendingRequestsCount(0);
    setBucketRanks({ banger: [], slaps: [], mid: [], skip: [], trash: [] });
    localStorage.removeItem('weezer_ranker_state');
    navigateTo('splash');
  };

  return (
    <WeezerContext.Provider
      value={{
        step, setStep, refineStageIdx, setRefineStageIdx, autoStartMatchups, setAutoStartMatchups, navigateTo,
        loadingUser, userId, userProfile, setUserProfile, handleSignOut,
        pendingRequestsCount, refreshPendingRequests,
        triageMap, setTriageMap, bucketRanks, masterList,
        syncRankingsToDatabase, updateAndSyncBucketRanks, moveMasterSong, handleMagicFill,
      }}
    >
      {children}
    </WeezerContext.Provider>
  );
};

export const useWeezer = () => {
  const context = useContext(WeezerContext);
  if (context === undefined) {
    throw new Error('useWeezer must be used within a WeezerProvider');
  }
  return context;
};