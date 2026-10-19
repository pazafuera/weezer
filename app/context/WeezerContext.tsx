'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { BucketType, Song, FULL_SONG_POOL } from '../data/constants';
import { sanitizeMasterList, reconcileMasterList, getRankedSongs, sortByBucketBlock } from '@/utils/rankingUtils';


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
  /** Set by the login page when an in-app sign-up completes: the
   *  user lands on orientation under an "account created" banner
   *  instead of the old signup_success step. Orientation clears it
   *  on unmount (any exit) and on "Start Sorting". */
  accountCreated: boolean;
  setAccountCreated: (val: boolean) => void;
  initialAuthMode: AuthModeType;
  navigateTo: (
    targetStep: AppStep,
    authMode?: AuthModeType,
    opts?: { preserveOrigins?: boolean }
  ) => void;
  closeLogin: () => void;
  closeOrientation: () => void;
  closeFanStats: () => void;
  closeMaster: () => void;
  closeRefine: () => void;

  // Auth & User State
  loadingUser: boolean;
  userId: string | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  handleSignOut: () => Promise<void>;

  // Friend Requests & Social State
  friendsList: any[];
  /** Accepted friends WITH their profile + master list, from
   *  get_my_friend_cards() — the shape the Taste Match card
   *  actually reads. (friendsList above is raw friendships rows:
   *  ids and status only, no usernames or rankings.) */
  friendCards: any[];
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
  /** True once the first community fetch has SETTLED (data or
   *  error) — lets consumers tell "still loading" apart from
   *  "loaded, and there is genuinely nothing yet". */
  communityLoaded: boolean;
  refreshCommunityData: () => Promise<void>;

  // Actions
  syncRankingsToDatabase: (map: Record<string, TriageValue>, master: Song[]) => Promise<void>;
  updateAndSyncBucketRanks: (
    newBucketRanks: Record<BucketType, Song[]>,
    updatedMap?: Record<string, TriageValue>
  ) => void;
  setSongBucket: (id: string, bucket: TriageValue) => void;
  normalizeMasterList: () => void;
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

/**
 * Steps whose exit control means "take me back where I came from"
 * rather than a fixed destination: 'login' (its card's X),
 * 'orientation' (How It Works' "← Back"), 'fan_stats' (Fan Stats'
 * "← Back"), 'master' (Final Review's "← Back"), and 'rank_buckets'
 * (Refine's stage-0 "← Back"). navigateTo records an origin for
 * these on entry; the close* functions consume it, each falling back
 * to the destination its control hardcoded before origin tracking
 * (splash / splash / wrapped / rank_buckets / triage). See
 * returnStepRef in the provider.
 */
const RETURN_TRACKED_STEPS: readonly AppStep[] = [
  'login',
  'orientation',
  'fan_stats',
  'master',
  'rank_buckets',
];

export const WeezerProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  // Auth State
  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Social & Friends State
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [friendCards, setFriendCards] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Navigation & Auth Mode State
  const [step, setStepState] = useState<AppStep>('splash');
  const [initialAuthMode, setInitialAuthMode] = useState<AuthModeType>('signup');
  // Recorded origins for the return-tracked steps (RETURN_TRACKED_STEPS):
  // the step the user was on when they entered each one, so that step's
  // exit control — the login card's X (closeLogin), the orientation
  // page's "← Back" (closeOrientation), Fan Stats' "← Back"
  // (closeFanStats), Final Review's "← Back" (closeMaster), Refine's
  // stage-0 "← Back" (closeRefine) — can return them there instead
  // of a hardcoded destination. navigateTo records the origin on the
  // way INTO a tracked step and clears every recorded origin on any
  // navigation to an ordinary (non-tracked) step (a completed sign-in
  // routes to dashboard and consumes its origin that way; a completed
  // sign-up routes to orientation — itself tracked — so that hop is a
  // detour under the rule below). Hopping between tracked steps — orientation's "Create an
  // Account First" into login — leaves the other step's origin intact,
  // so when the login X lands back on orientation, orientation's Back
  // still remembers where orientation itself was entered from. A ref,
  // not state: nothing renders from it.
  const returnStepRef = useRef<Partial<Record<AppStep, AppStep>>>({});
  const [refineStageIdx, setRefineStageIdx] = useState(0);
  const [autoStartMatchups, setAutoStartMatchups] = useState(false);
  // Post-sign-up banner flag (see the interface note). Plain state:
  // orientation renders from it, unlike the origin ref.
  const [accountCreated, setAccountCreated] = useState(false);

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
  const [communityLoaded, setCommunityLoaded] = useState<boolean>(false);

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
      setCommunityLoaded(true);
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
        setFriendCards([]);
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

      // 3. Friend CARDS for Taste Match: raw friendships rows carry
      // no usernames and no rankings, so the compatibility card
      // read every friend as "Friend" with no songs and reported
      // "hasn't ranked enough yet" for everyone, forever. The
      // get_my_friend_cards() RPC (the same one Fan Friends uses)
      // returns the other side's profile + master list per
      // friendship; keep the accepted ones in the card's shape.
      const { data: cards } = await supabase.rpc('get_my_friend_cards');
      if (Array.isArray(cards)) {
        setFriendCards(
          cards
            .filter((c: any) => c.status === 'accepted')
            .map((c: any) => ({
              id: c.id,
              username: c.username,
              display_name: c.display_name || c.username,
              master_list: Array.isArray(c.master_list) ? c.master_list : [],
            }))
        );
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
      setFriendCards([]);
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

  // Final Review entry normalization (belt and braces): reconcile
  // heals triage writes as they happen and sanitize heals saves at
  // load, but this pass — the same sortByBucketBlock both of them
  // use — guarantees the master step only ever receives a
  // bucket-block-ordered list. No-op, and no sync, when the list is
  // already normalized.
  const normalizeMasterList = () => {
    const normalized = sortByBucketBlock(masterList, triageMap);
    const changed =
      normalized.length !== masterList.length ||
      normalized.some((song, i) => song.id !== masterList[i].id);
    if (!changed) return;
    setMasterList(normalized);
    syncRankingsToDatabase(triageMap, normalized);
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

  const navigateInternal = (
    targetStep: AppStep,
    authMode?: AuthModeType,
    isReturn: boolean = false,
    preserveOrigins: boolean = false
  ) => {
    // Origin bookkeeping for the return-tracked steps. A return
    // navigation (the close* exits) skips it entirely:
    // the exit consumes its own origin in returnFromStep, and landing
    // back on another tracked step must not overwrite (or clear) that
    // step's recorded origin with the step just exited.
    if (!isReturn) {
      if (RETURN_TRACKED_STEPS.indexOf(targetStep) !== -1) {
        // Remember where the user is coming FROM so the step's exit
        // control can take them back there. Re-entering a tracked
        // step while already on it (the nav menu stays reachable from
        // these steps) must not overwrite the recorded step with the
        // step itself. The OTHER tracked step's origin is left alone:
        // a tracked-to-tracked hop is a detour, not a fresh start.
        // Login is never recorded as another step's origin: it is a
        // detour, not a place a Back should return TO — the sign-up
        // flow (login → orientation) otherwise overwrites
        // orientation's real origin with 'login', and the login card
        // auto-bounces a signed-in user to the dashboard, so the new
        // user's first Back flashed the login card and dumped them
        // on the dashboard instead of returning to the start.
        if (step !== targetStep && step !== 'login') {
          returnStepRef.current[targetStep] = step;
        }
      } else if (preserveOrigins) {
        // A detour navigation (the help sheet's tutorial replay):
        // the user is being pulled away mid-visit, not moving on,
        // so the origins recorded for the tracked steps they were
        // visiting survive — their Backs afterward still return
        // where they should (UAT P-3).
      } else {
        // Any navigation to an ordinary step consumes every recorded
        // origin — the user has moved on, and a later visit to a
        // tracked step records a fresh origin on entry anyway.
        returnStepRef.current = {};
      }
    }

    if (authMode) {
      setInitialAuthMode(authMode);
    }

    const guardedStep = resolveGuardedStep(targetStep, triageMap, masterList); if (guardedStep === 'rank_buckets') {
      setBucketRanks(getDerivedBucketRanks(triageMap, masterList));
      // Fresh entries start at stage 0; RETURN landings (Final
      // Review's Back) keep the stage the user left — Step2Refine
      // writes its stage back here as it moves, so a return lands
      // where the work was, not four Next-taps away from it.
      if (!isReturn) {
        setRefineStageIdx(0);
      }
      // Matchup default (owner-approved, Oct 18): the flag is SET on
      // every Refine landing, never left over from an earlier entry —
      // a fresh, intentional entry arms the matchup pre-sort, but only
      // for a user who has not already refined ("If someone has
      // already gone through refine then the matchup picker shouldn't
      // fire") and never on a return navigation (Final Review's Back
      // lands on the stage list by design).
      setAutoStartMatchups(
        !isReturn && !getProgressState(triageMap, masterList).isMasterUnlocked
      );
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

  const navigateTo = (
    targetStep: AppStep,
    authMode?: AuthModeType,
    opts?: { preserveOrigins?: boolean }
  ) => {
    navigateInternal(targetStep, authMode, false, opts?.preserveOrigins);
  };

  /**
   * Shared exit for the return-tracked steps: leaves the step WITHOUT
   * completing its flow and returns to the step the user entered it
   * from. Falls back to `fallback` — the destination the exit
   * hardcoded before origin tracking (splash for login/orientation,
   * wrapped for Fan Stats, rank_buckets for Final Review, triage for
   * Refine) — when no origin was recorded (e.g. a cold ?step= deep
   * link, or a step entered through a raw setStep like Refine's
   * finish into Final Review) or the recorded origin is the step
   * itself. The origin is consumed here, and the return navigation
   * runs with isReturn so it never records a new origin: when the
   * login X lands back on orientation, orientation's own recorded
   * origin survives for its Back — and when Final Review's Back
   * falls back to Refine, Refine's recorded origin survives for its
   * stage-0 Back.
   */
  const returnFromStep = (fromStep: AppStep, fallback: AppStep = 'splash') => {
    const recorded = returnStepRef.current[fromStep];
    delete returnStepRef.current[fromStep];
    let target: AppStep =
      recorded && recorded !== fromStep ? recorded : fallback;
    // If that destination is itself locked from here — the classic
    // case is Fan Stats cold-opened by deep link, whose 'wrapped'
    // fallback a zero-progress user hasn't unlocked — the guard
    // would silently rewrite it to triage/rank_buckets: a "Back"
    // landing on a step the user has never seen, with no
    // explanation. Land on the dashboard instead — always
    // reachable, and the honest destination for a Back with
    // nowhere recorded (or nowhere reachable) to go.
    if (resolveGuardedStep(target, triageMap, masterList) !== target) {
      target = 'dashboard';
    }
    navigateInternal(target, undefined, true);
  };

  /** The login card's X: abandon sign-in, go back where you came from. */
  const closeLogin = () => {
    returnFromStep('login');
  };

  /** Orientation's "← Back": leave How It Works, go back where you came from. */
  const closeOrientation = () => {
    returnFromStep('orientation');
  };

  /** Fan Stats' "← Back": leave Global Fan Stats, go back where you came from. */
  const closeFanStats = () => {
    returnFromStep('fan_stats', 'wrapped');
  };

  /** Final Review's "← Back": leave My Rankings, go back where you came from. */
  const closeMaster = () => {
    returnFromStep('master', 'rank_buckets');
  };

  /** Refine's stage-0 "← Back": leave Refine, go back where you came from. */
  const closeRefine = () => {
    returnFromStep('rank_buckets', 'triage');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setUserProfile(null);
    setTriageMap({});
    setMasterList([]);
    setFriendsList([]);
    setFriendCards([]);
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
        accountCreated,
        setAccountCreated,
        initialAuthMode,
        navigateTo,
        closeLogin,
        closeOrientation,
        closeFanStats,
        closeMaster,
        closeRefine,
        loadingUser,
        userId,
        userProfile,
        setUserProfile,
        handleSignOut,
        friendsList,
        friendCards,
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
        communityLoaded,
        refreshCommunityData,
        syncRankingsToDatabase,
        updateAndSyncBucketRanks,
        setSongBucket,
        normalizeMasterList,
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

