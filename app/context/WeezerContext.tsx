'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { BucketType, Song, FULL_SONG_POOL } from '../data/constants';
import { sanitizeMasterList, reconcileMasterList, getRankedSongs } from '@/utils/rankingUtils';


export type AppStep =
  | 'splash'
  | 'orientation'
  | 'dashboard'
  | 'triage'
  | 'rank_buckets'
  | 'master'
  | 'wrapped'
  | 'fan_stats'
  | 'friends'
  | 'login'
  | 'signup_success'
  | 'shareables';
export type AuthModeType = 'signup' | 'login' | 'magic';

/**
 * One triage entry: one of the five real buckets, or 'unknown' when the
 * user tapped "Don't Know It" for a song they can't judge. 'unknown'
 * lives in the same map so the song renders as dealt-with in triage,
 * but it is NOT a rating: it is excluded from the master list, matchup
 * pools, bucket scores, rating counts, and community submissions (see
 * isRealBucket / countBucketedSongs). The ONE place unknowns carry
 * weight is era coverage (Era DNA): not knowing an era's songs is real
 * evidence your fandom isn't there.
 */
export type TriageValue = BucketType | 'unknown';

/**
 * Every step name that page.tsx knows how to render.
 */
const KNOWN_APP_STEPS: readonly AppStep[] = [
  'splash',
  'orientation',
  'dashboard',
  'triage',
  'rank_buckets',
  'master',
  'wrapped',
  'fan_stats',
  'friends',
  'login',
  'signup_success',
  'shareables',
];

/**
 * Backward-compatible aliases for retired step names.
 * 'refine' was the previous name of the rank_buckets step.
 */
const STEP_ALIASES: Record<string, AppStep> = {
  refine: 'rank_buckets',
};

/**
 * Resolves a raw `?step=` URL value to a known AppStep.
 * Returns the canonical step for known values and aliases, and null
 * for anything else. Unknown values must never become app state —
 * page.tsx renders nothing for them (blank screen).
 */
export function resolveUrlStep(raw: string | null): AppStep | null {
  if (raw === null) return null;
  const aliased: AppStep | undefined = STEP_ALIASES[raw];
  if (aliased) return aliased;
  const known: AppStep | undefined = KNOWN_APP_STEPS.find(
    (step) => step === raw
  );
  return known ?? null;
}
/**
 * Unified progression-gating state. This is the ONE shared rule used by the
 * dashboard, the nav menu (AppShell), navigateTo, and the ?step= URL guard —
 * no duplicated, slightly-different booleans elsewhere.
 *
 * Truth table (steps unlocked):
 * - zero progress: triage only
 * - partial triage (>=1 song bucketed), no refined list: + rank_buckets (Refine Buckets)
 * - partial triage + real refined master list: + master (Master List), + wrapped (Sweater Thread)
 * - triage complete (all 206 bucketed): isTriageComplete = true (display/completionist flag)
 */
export interface ProgressState {
  /** Gut Check fully sorted (see isTriageComplete). */
  isTriageComplete: boolean;
  /** Number of songs with an explicit, valid triage bucket. */
  triageBucketedCount: number;
  /** Partial triage: at least one song explicitly bucketed. */
  hasPartialTriage: boolean;
  /** Refine Buckets unlocked: as soon as partial triage exists (>=1 bucketed song). */
  isRefineUnlocked: boolean;
  /** Master List unlocked: partial triage AND a real refined master list exists. */
  isMasterUnlocked: boolean;
  /** Sweater Thread unlocked: same rule as Master List. */
  isWrappedUnlocked: boolean;
}

/**
 * Returns the unified progress state for the given ranking data. A real
 * refined master list exists only when the master list is non-empty and
 * every entry has a triage bucket — unranked leftovers never count as
 * progress.
 */
export function getProgressState(
  triageMap: Record<string, TriageValue>,
  masterList: Song[]
): ProgressState {
  const triageComplete = isTriageComplete(triageMap);
  const bucketedCount = countBucketedSongs(triageMap);
  const hasPartialTriage = bucketedCount >= 1;
  const hasRefinedMaster =
    hasPartialTriage &&
    masterList.length > 0 &&
    getRankedSongs(masterList, triageMap).length === masterList.length;
  return {
    isTriageComplete: triageComplete,
    triageBucketedCount: bucketedCount,
    hasPartialTriage,
    isRefineUnlocked: hasPartialTriage,
    isMasterUnlocked: hasRefinedMaster,
    isWrappedUnlocked: hasRefinedMaster,
  };
}

/**
 * Enforces the progression rule on a requested step. A request for a locked
 * step resolves to the earliest unfinished step (triage when no song is
 * bucketed yet, else rank_buckets when no refined list exists). Requests for
 * unlocked steps pass through unchanged.
 */
export function resolveGuardedStep(
  requested: AppStep,
  triageMap: Record<string, TriageValue>,
  masterList: Song[]
): AppStep {
  const progress = getProgressState(triageMap, masterList);
  switch (requested) {
    case 'rank_buckets':
      return progress.isRefineUnlocked ? requested : 'triage';
    case 'master':
    case 'wrapped':
      if (progress.isMasterUnlocked) return requested;
      return progress.isRefineUnlocked ? 'rank_buckets' : 'triage';
    default:
      return requested;
  }
}

const VALID_TRIAGE_BUCKETS: readonly BucketType[] = [
  'banger',
  'slaps',
  'mid',
  'skip',
  'trash',
];

/** True when a triage value is one of the five real buckets (not a
 *  missing entry, not 'unknown'). */
export function isRealBucket(
  value: TriageValue | undefined
): value is BucketType {
  return (
    value !== undefined &&
    VALID_TRIAGE_BUCKETS.indexOf(value as BucketType) !== -1
  );
}

/**
 * Number of songs in FULL_SONG_POOL with an explicit, valid triage bucket.
 * Partial triage (>=1) is sufficient to unlock Refine Buckets; a full 206
 * is only tracked by isTriageComplete for display/completionist purposes.
 * 'unknown' entries never count here — they are not ratings.
 */
export function countBucketedSongs(
  triageMap: Record<string, TriageValue>
): number {
  return FULL_SONG_POOL.reduce((count: number, song: Song) => {
    return isRealBucket(triageMap[song.id]) ? count + 1 : count;
  }, 0);
}

/**
 * Number of songs in FULL_SONG_POOL the user has dealt with in triage:
 * a real bucket OR a "Don't Know It" mark. This is the counter behind
 * the triage screen's "Categorize All Songs (n/206)" lock — a song the
 * user honestly can't judge still counts as categorized.
 */
export function countCategorizedSongs(
  triageMap: Record<string, TriageValue>
): number {
  return FULL_SONG_POOL.reduce((count: number, song: Song) => {
    const value: TriageValue | undefined = triageMap[song.id];
    return value !== undefined && (value === 'unknown' || isRealBucket(value))
      ? count + 1
      : count;
  }, 0);
}

/**
 * Gut Check (triage) is complete when every song in FULL_SONG_POOL
 * has an explicit, valid triage bucket. ('unknown' marks do not make
 * triage "complete" — this stays the completionist flag for a full
 * 206-song bucketing; the triage screen's own lock uses
 * countCategorizedSongs.)
 */
export function isTriageComplete(
  triageMap: Record<string, TriageValue>
): boolean {
  return FULL_SONG_POOL.every((song) => isRealBucket(triageMap[song.id]));
}

/**
 * Rewrites the `step` query param in place via history.replaceState,
 * so corrective redirects never pollute the back/forward stack.
 */
function replaceStepInUrl(step: AppStep): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('step', step);
  window.history.replaceState({}, '', url.toString());
}

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
  initialAuthMode: AuthModeType;
  navigateTo: (targetStep: AppStep, authMode?: AuthModeType) => void;

  // Auth & User State
  loadingUser: boolean;
  userId: string | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  handleSignOut: () => Promise<void>;

  // Friend Requests & Social State
  friendsList: any[];
  pendingRequestsCount: number;
  refreshPendingRequests: () => Promise<void>;
  refreshFriends: () => Promise<void>;

  // Ranking State
  triageMap: Record<string, TriageValue>;
  setTriageMap: (map: Record<string, TriageValue>) => void;
  bucketRanks: Record<BucketType, Song[]>;
  masterList: Song[];

  // Cached Community Data State (Fix B)
  communityMasterLists: Song[][];
  communityTriageMaps: Record<string, TriageValue>[];
  loadingCommunity: boolean;
  refreshCommunityData: () => Promise<void>;

  // Actions
  syncRankingsToDatabase: (map: Record<string, TriageValue>, master: Song[]) => Promise<void>;
  updateAndSyncBucketRanks: (
    newBucketRanks: Record<BucketType, Song[]>,
    updatedMap?: Record<string, TriageValue>
  ) => void;
  setSongBucket: (id: string, bucket: TriageValue) => void;
  moveMasterSong: (index: number, direction: 'up' | 'down') => void;
  handleMagicFill: () => void;
}

const WeezerContext = createContext<WeezerContextType | undefined>(undefined);

const getDerivedBucketRanks = (
  map: Record<string, TriageValue>,
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
    // A song is only Trash when explicitly marked so; a missing triage
    // entry means "unranked", never Trash.
    trash: combinedPool.filter((s) => map[s.id] === 'trash'),
  };
};

/**
 * Copies guest rankings stored in localStorage to Supabase for the authenticated user.
 */
export const migrateGuestRankingsToUser = async (newUserId: string) => {
  if (typeof window === 'undefined') return;
  const localState = localStorage.getItem('weezer_ranker_state');
  if (!localState) return;

  try {
    const { triageMap, masterList } = JSON.parse(localState);

    const hasProgress =
      (triageMap && Object.keys(triageMap).length > 0) ||
      (masterList && masterList.length > 0);

    if (hasProgress) {
      // NEVER overwrite rankings the account already has. Guest picks
      // only migrate into an account that has none yet — otherwise,
      // logging in from a browser holding leftover guest picks would
      // erase the account's real saved rankings. (Bit us Oct 16, 2026:
      // temp test picks replaced a real account's rankings at login.)
      const { data: existing } = await supabase
        .from('weezer_rankings')
        .select('triage_map, master_list')
        .eq('user_id', newUserId)
        .maybeSingle();

      // Only REAL buckets count as existing rankings here: an account
      // whose triage_map holds nothing but 'unknown' ("Don't Know It")
      // marks has no ratings to protect, so guest picks may still
      // migrate in.
      const accountTriageMap = existing?.triage_map as
        | Record<string, unknown>
        | undefined;
      const accountHasProgress =
        (accountTriageMap &&
          Object.values(accountTriageMap).some((value) =>
            isRealBucket(value as TriageValue | undefined)
          )) ||
        (existing?.master_list && existing.master_list.length > 0);

      if (accountHasProgress) return;

      await supabase.from('weezer_rankings').upsert(
        {
          user_id: newUserId,
          triage_map: triageMap || {},
          master_list: masterList || [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }
  } catch (err) {
    console.error('Failed to migrate guest rankings:', err);
  }
};

export const WeezerProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  // Auth State
  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Social & Friends State
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Navigation & Auth Mode State
  const [step, setStepState] = useState<AppStep>('splash');
  const [initialAuthMode, setInitialAuthMode] = useState<AuthModeType>('signup');
  const [refineStageIdx, setRefineStageIdx] = useState(0);
  const [autoStartMatchups, setAutoStartMatchups] = useState(false);

  // Deep-link intent parsed from ?step= on initial load. It is applied
  // (with prerequisite guards) only after user/ranking state has loaded.
  const [deepLinkIntent, setDeepLinkIntent] = useState<{
    raw: string | null;
    resolved: AppStep | null;
  } | null>(null);
  const deepLinkConsumedRef = useRef(false);

  // Rankings State
  const [triageMap, setTriageMap] = useState<Record<string, TriageValue>>({});
  const [bucketRanks, setBucketRanks] = useState<Record<BucketType, Song[]>>({
    banger: [],
    slaps: [],
    mid: [],
    skip: [],
    trash: [],
  });
  const [masterList, setMasterList] = useState<Song[]>([]);

  // Cached Community Data State (Fix B)
  const [communityMasterLists, setCommunityMasterLists] = useState<Song[][]>([]);
  const [communityTriageMaps, setCommunityTriageMaps] = useState<Record<string, TriageValue>[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState<boolean>(false);

  const setStep = (newStep: AppStep) => {
    setStepState(newStep);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // FETCH & CACHE COMMUNITY DATA IN BACKGROUND
  // Pre-launch security: reads the anonymized aggregate via the
  // get_community_rankings() SECURITY DEFINER function instead of
  // selecting other users' rows directly (blocked by RLS).
  const refreshCommunityData = async () => {
    setLoadingCommunity(true);
    try {
      const { data, error } = await supabase.rpc('get_community_rankings');

      if (!error && data) {
        const cleanRankings: Song[][] = [];
        const cleanTriageMaps: Record<string, TriageValue>[] = [];

        data.forEach((row: { master_list: unknown; triage_map: unknown }) => {
          if (Array.isArray(row.master_list) && row.master_list.length > 0) {
            cleanRankings.push(row.master_list);
          }
          if (row.triage_map && Object.keys(row.triage_map).length > 0) {
            cleanTriageMaps.push(row.triage_map as Record<string, TriageValue>);
          }
        });

        setCommunityMasterLists(cleanRankings);
        setCommunityTriageMaps(cleanTriageMaps);
      }
    } catch (err) {
      console.error('Error fetching background community data:', err);
    } finally {
      setLoadingCommunity(false);
    }
  };

  // Parse the ?step= deep link on initial load or refresh. Aliases are
  // canonicalized in the URL immediately (replaceState); the resolved step
  // is applied after user/ranking state has loaded so guards see real data.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('step');
    if (raw !== null) {
      const resolved = resolveUrlStep(raw);
      if (resolved !== null && resolved !== raw) {
        replaceStepInUrl(resolved);
      }
      setDeepLinkIntent({ raw, resolved });
    } else {
      setDeepLinkIntent({ raw: null, resolved: null });
    }
  }, []);

  // Apply the ?step= deep link AFTER user/ranking state has loaded, so
  // prerequisite guards see real data. Corrective redirects use
  // replaceState (never push) so the back button can't loop on a bad URL.
  useEffect(() => {
    if (loadingUser || deepLinkConsumedRef.current || deepLinkIntent === null) {
      return;
    }
    deepLinkConsumedRef.current = true;

    const { raw, resolved } = deepLinkIntent;

    // No ?step= param: the existing Smart Entry behavior inside
    // initUserAndLoadRankings already applies.
    if (raw === null) return;

    // Unknown ?step= value: never leave a blank screen. Signed-in users
    // with ranking progress land on the dashboard, everyone else on splash.
    if (resolved === null) {
      const hasProgress =
        Object.keys(triageMap).length > 0 || masterList.length > 0;
      const fallback: AppStep = userId && hasProgress ? 'dashboard' : 'splash';
      setStepState(fallback);
      replaceStepInUrl(fallback);
      return;
    }

    // A deep link must never bypass the visual locks: resolve it through the
    // same progression guard as navigateTo. Corrective redirects use
    // replaceState (never push) so the back button can't loop on a bad URL.
    const guarded = resolveGuardedStep(resolved, triageMap, masterList);
    if (guarded !== resolved) {
      replaceStepInUrl(guarded);
    }

    setStepState(guarded);
  }, [loadingUser, deepLinkIntent, triageMap, masterList, userId]);

  // Fetch community data once on initial startup
  useEffect(() => {
    refreshCommunityData();
  }, []);

  useEffect(() => {
    initUserAndLoadRankings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initUserAndLoadRankings();
      } else {
        setUserId(null);
        setUserProfile(null);
        setFriendsList([]);
        setPendingRequestsCount(0);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FETCH & REFRESH FRIENDS + PENDING REQUESTS
  const refreshFriends = async () => {
    if (!userId) return;
    try {
      // 1. Fetch Pending Requests Count
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'pending');

      setPendingRequestsCount(count || 0);

      // 2. Fetch Accepted Friends List
      const { data: friendshipsData } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (friendshipsData) {
        setFriendsList(friendshipsData);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  };

  const refreshPendingRequests = refreshFriends;

  // REAL-TIME SUBSCRIPTION FOR FRIENDSHIPS
  useEffect(() => {
    if (!userId) {
      setFriendsList([]);
      setPendingRequestsCount(0);
      return;
    }

    refreshFriends();

    const channel = supabase
      .channel('realtime_friendships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          refreshFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function initUserAndLoadRankings() {
    setLoadingUser(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const uid = session.user.id;
        setUserId(uid);

        // Migrate guest rankings from localStorage to Supabase
        await migrateGuestRankingsToUser(uid);

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
            displayName:
              profileData.display_name ||
              profileData.username ||
              session.user.email?.split('@')[0],
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
          let loadedTriage: Record<string, TriageValue> = {};
          let loadedMaster: Song[] = [];

          if (rankData.triage_map) {
            Object.keys(rankData.triage_map).forEach((id) => {
              if (validSongIds.has(id)) loadedTriage[id] = rankData.triage_map[id];
            });
            setTriageMap(loadedTriage);
          }
          if (rankData.master_list && Array.isArray(rankData.master_list)) {
            // Sanitize saved master list against the triage map: drop unranked
            // leftovers from older saves; every ranked song keeps its position.
            loadedMaster = sanitizeMasterList(rankData.master_list.filter((s: Song) => validSongIds.has(s.id)), loadedTriage);
            setMasterList(loadedMaster);
          }

          setBucketRanks(getDerivedBucketRanks(loadedTriage, loadedMaster));

          // Smart Entry: Route to Dashboard if progress exists and no URL step is specified
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (
              !params.get('step') &&
              (Object.keys(loadedTriage).length > 0 || loadedMaster.length > 0)
            ) {
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
            const guestTriage: Record<string, TriageValue> = parsed.triageMap || {};
            // Sanitize saved master list against the triage map: drop unranked
            // leftovers from older saves; every ranked song keeps its position.
            const guestMaster = sanitizeMasterList(parsed.masterList || [], guestTriage);
            setTriageMap(guestTriage);
            setMasterList(guestMaster);
            setBucketRanks(getDerivedBucketRanks(guestTriage, guestMaster));

            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              if (
                !params.get('step') &&
                Object.keys(parsed.triageMap || {}).length > 0
              ) {
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

  // Debounced database sync (performance): triage and ranking clicks
  // can fire many saves per second. localStorage still writes
  // immediately on every change; the Supabase upsert waits ~1s for a
  // pause and always sends the LATEST state. A flush on tab hide/close
  // sends any pending write right away, so a fast exit doesn't lose
  // the last change.
  const pendingSyncRef = useRef<{
    map: Record<string, TriageValue>;
    master: Song[];
  } | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSyncToDatabase = async () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const pending = pendingSyncRef.current;
    pendingSyncRef.current = null;
    if (!pending || !userId) return;
    try {
      await supabase.from('weezer_rankings').upsert(
        {
          user_id: userId,
          triage_map: pending.map,
          master_list: pending.master,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('Error syncing rankings:', err);
    }
  };
  const flushSyncRef = useRef(flushSyncToDatabase);
  flushSyncRef.current = flushSyncToDatabase;

  useEffect(() => {
    const flush = () => {
      void flushSyncRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const syncRankingsToDatabase = async (
    map: Record<string, TriageValue>,
    master: Song[]
  ) => {
    localStorage.setItem(
      'weezer_ranker_state',
      JSON.stringify({ triageMap: map, masterList: master })
    );
    if (!userId) return;
    pendingSyncRef.current = { map, master };
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void flushSyncRef.current();
    }, 1000);
  };

  const updateAndSyncBucketRanks = (
    newBucketRanks: Record<BucketType, Song[]>,
    updatedMap?: Record<string, TriageValue>
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

  const setSongBucket = (id: string, bucket: TriageValue) => {
    const map = { ...triageMap, [id]: bucket };
    const reconciled = reconcileMasterList(masterList, map);
    setTriageMap(map);
    setMasterList(reconciled);
    syncRankingsToDatabase(map, reconciled);
  };

  const handleMagicFill = () => {
    const newMap: Record<string, TriageValue> = {};
    FULL_SONG_POOL.forEach((song) => {
      const rand = Math.random();
      if (rand < 0.15) newMap[song.id] = 'banger';
      else if (rand < 0.4) newMap[song.id] = 'slaps';
      else if (rand < 0.7) newMap[song.id] = 'mid';
      else if (rand < 0.9) newMap[song.id] = 'skip';
      else newMap[song.id] = 'trash';
    });
    
    const derived = getDerivedBucketRanks(newMap, masterList);
    updateAndSyncBucketRanks(derived, newMap);
    
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

  const navigateTo = (targetStep: AppStep, authMode?: AuthModeType) => {
    if (authMode) {
      setInitialAuthMode(authMode);
    }

    const guardedStep = resolveGuardedStep(targetStep, triageMap, masterList); if (guardedStep === 'rank_buckets') {
      setBucketRanks(getDerivedBucketRanks(triageMap, masterList));
      setRefineStageIdx(0);
    }

    setStep(guardedStep);

    if (typeof window !== 'undefined') {
      // If navigating from a sub-page (e.g. /u/username), redirect back to root with step param
      if (window.location.pathname !== '/') {
        router.push(`/?step=${guardedStep}`);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('step', guardedStep);
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
    setFriendsList([]);
    setPendingRequestsCount(0);
    setBucketRanks({ banger: [], slaps: [], mid: [], skip: [], trash: [] });
    localStorage.removeItem('weezer_ranker_state');
    navigateTo('splash');
  };

  return (
    <WeezerContext.Provider
      value={{
        step,
        setStep,
        refineStageIdx,
        setRefineStageIdx,
        autoStartMatchups,
        setAutoStartMatchups,
        initialAuthMode,
        navigateTo,
        loadingUser,
        userId,
        userProfile,
        setUserProfile,
        handleSignOut,
        friendsList,
        pendingRequestsCount,
        refreshPendingRequests,
        refreshFriends,
        triageMap,
        setTriageMap,
        bucketRanks,
        masterList,
        communityMasterLists,
        communityTriageMaps,
        loadingCommunity,
        refreshCommunityData,
        syncRankingsToDatabase,
        updateAndSyncBucketRanks,
        setSongBucket,
        moveMasterSong,
        handleMagicFill,
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

