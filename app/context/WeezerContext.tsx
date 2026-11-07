'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { BucketType, Song, FULL_SONG_POOL } from '../data/constants';
import { sanitizeMasterList, reconcileMasterList, getRankedSongs, sortByBucketBlock } from '@/utils/rankingUtils';
import { createRankingsSyncQueue } from '../lib/rankingsSync';
import type { RankingsSyncQueue } from '../lib/rankingsSync';
import {
  resolveBootState,
  rankingsStateHasProgress,
  EMPTY_RANKINGS_STATE,
} from '../lib/bootState';
import type {
  RankingsStateData,
  BootBufferOutcome,
} from '../lib/bootState';
import { refreshMasterListMetadata } from '../lib/catalogMetadata';
import {
  recordSaveDiagnostic,
  readSaveDiagnostics,
} from '../lib/saveDiagnostics';
import type { SaveDiagnosticEvent } from '../lib/saveDiagnostics';
import {
  configureAnalytics,
  setAnalyticsUserId,
  trackAnalytics,
} from '../lib/analytics';
import { INITIAL_SAVE_STATE, bootSaveState } from '../lib/saveStatus';
import type { SaveState } from '../lib/saveStatus';
import {
  readLastUserId,
  rememberLastUserId,
  forgetLastUserId,
  resolveSnapshotStampUserId,
  detectStrandedState,
} from '../lib/lastUser';
import { mergeGuestRankingsIntoAccount } from '../lib/guestMerge';
import {
  forgetAccountFanhoodSync,
  reconcileAccountFanhood,
} from '../lib/fanhoodSync';
import {
  createNavStack,
  initNavStack,
  resetNavStack,
  pushNavStep,
  replaceNavStep,
  applyPopNavIndex,
  parseNavMarker,
  createNavMarker,
  canGoBackInStack,
  previousStackStep,
  recordNavScroll,
  navScrollFor,
} from '../lib/navigationHistory';
import type { NavStack } from '../lib/navigationHistory';
import {
  persistPendingScrollRestore,
  readFreshPendingScrollRestore,
  clearPendingScrollRestore,
} from '../lib/pendingScrollRestore';
import type { PendingScrollRestore } from '../lib/pendingScrollRestore';


export type AppStep =
  | 'splash'
  | 'orientation'
  | 'dashboard'
  | 'garage2'
  | 'triage'
  | 'rank_buckets'
  | 'master'
  | 'wrapped'
  | 'fan_stats'
  | 'friends'
  | 'login'
  | 'shareables'
  | 'lore';
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
  'garage2',
  'triage',
  'rank_buckets',
  'master',
  'wrapped',
  'fan_stats',
  'friends',
  'login',
  'shareables',
  'lore',
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
  /** Set when the progression guard rewrote a requested
   *  destination (navigateTo or a ?step= deep link): the step the
   *  user asked for and the step they actually landed on. The
   *  landing step renders a dismissible notice naming the unlock
   *  condition (UAT P-1) — a guard bounce is never silent. Any
   *  landing that was not rewritten clears it. */
  guardNotice: { requested: AppStep; landed: AppStep } | null;
  dismissGuardNotice: () => void;
  /** True when the latest rankings write has failed every retry:
   *  page.tsx renders a dismissible notice (a save failure is never
   *  silent — Oct 22 save-race fix). Clears on the next successful
   *  write or on dismiss; the unsaved payload is retained and the
   *  next edit or flush retries it. */
  syncNotice: boolean;
  dismissSyncNotice: () => void;
  /** The honest save state (durability overhaul, Nov 7): driven
   *  ONLY by the sync queue's confirmed writes — 'saved' means
   *  the database holds the latest edit, never merely that the
   *  edit happened on screen. AppShell's header renders the
   *  indicator copy (app/lib/saveStatus.ts); the account drawer
   *  shows the same state beside the save diagnostics. */
  saveState: SaveState;
  /** The save-diagnostics ring (app/lib/saveDiagnostics.ts):
   *  the recent boot/save decision points, newest last — the
   *  record the next save incident is diagnosed from. */
  saveDiagnostics: SaveDiagnosticEvent[];
  /** True when this device remembers a signed-in user and holds
   *  their local progress, but no session is live — the session
   *  died (token evicted, refresh race) and the app is running on
   *  the local copy. AppShell renders a signed-out card instead
   *  of the guest upsell in this state; edits made in it stamp
   *  the remembered user and are recovered at the next sign-in.
   *  Clears the moment a session exists again. */
  stranded: boolean;
  initialAuthMode: AuthModeType;
  navigateTo: (
    targetStep: AppStep,
    authMode?: AuthModeType,
    opts?: {
      preserveOrigins?: boolean;
      /** Browser-history treatment for this navigation. Default:
       *  a push for a distinct step (guard rewrites and same-step
       *  navigations never push). 'replace' swaps the current
       *  entry (post-auth landings — Back must never land on the
       *  login screen); 'reset' re-anchors the stack at the
       *  target (sign-out — Back must never resurrect signed-in
       *  pages). */
      history?: 'push' | 'replace' | 'reset';
    }
  ) => void;
  /** True when the in-app history stack has an entry behind the
   *  current one — browser Back / iOS swipe-back will land on
   *  another app step rather than leaving the site. */
  canGoBack: boolean;
  /** The step browser Back would land on, when the stack knows
   *  it (after a reload it may be unknown until a pop reveals
   *  it). Null when there is nowhere in-app to go back to. */
  previousStep: AppStep | null;
  /** Browser Back, when it stays inside the app. No-op on the
   *  landing entry. */
  goBack: () => void;
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
  /** True when the latest community fetch FAILED (and no newer
   *  fetch is running) — lets Fan Stats show an honest error
   *  with a retry instead of the "genuinely nothing" empty
   *  state a failure used to be indistinguishable from. */
  communityError: boolean;
  refreshCommunityData: () => Promise<void>;

  // Actions
  syncRankingsToDatabase: (
    map: Record<string, TriageValue>,
    master: Song[]
  ) => Promise<void>;
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

/** The shared "does this parsed snapshot hold anything?" test —
 *  the same progress line the boot migration, the guest load, and
 *  the stranded check all draw. */
function snapshotHasProgress(
  parsed: { triageMap?: unknown; masterList?: unknown } | null | undefined
): boolean {
  if (!parsed) return false;
  const map = parsed.triageMap as Record<string, unknown> | undefined;
  const list = parsed.masterList as unknown[] | undefined;
  return (
    (!!map && Object.keys(map).length > 0) || (!!list && list.length > 0)
  );
}

/** The rankings-row shape the boot path reads. */
type RankingsRow = {
  triage_map?: Record<string, TriageValue> | null;
  master_list?: Song[] | null;
} | null;

/** What a signed-in boot resolved — the diagnostics and
 *  save-state wiring in the provider read from this, so the
 *  boot's outcome is recorded exactly once. */
interface SignedInBoot {
  /** The fetched row as a state — the confirmed state. (The
   *  empty state when the account has no row.) */
  confirmed: RankingsStateData;
  /** The held device buffer as the pending state, or null. */
  pending: RankingsStateData | null;
  /** What became of the device copy at this boot. */
  buffer: BootBufferOutcome;
  /** The device copy's own save time, when it carries one. */
  bufferSavedAt: number | null;
}

/**
 * The signed-in boot (Nov 7, 2026 — the database-authority
 * simplification; design in REPORT.md and app/lib/bootState.ts).
 *
 * Fetch the row. That is the confirmed state — the database is
 * the only authority, and boot performs NO writes: no promotion,
 * no heal, no revision or clock comparison (the resolver, the
 * heal upsert, the client_rev path, and the buffer guard that
 * the overhaul built around boot are all deleted; the seams
 * they guarded are gone because the operations are gone).
 *
 * The device copy (localStorage `weezer_ranker_state`) is read
 * for its two remaining jobs: unstamped guest work arriving at
 * a sign-in merges per song into the row (guestMerge — the one
 * reconciliation that runs once, at a boundary the user chose,
 * and fills gaps instead of overwriting), and ANY qualifying
 * local state — this account's own unsent-changes buffer, or
 * the guest merge's result — is HELD as the pending state when
 * it differs from the row: the session's effective state is the
 * pending state (the user's unsent work is what they see), the
 * save state announces it as device-only, and it reaches the
 * row only inside the user's next edit. A candidate identical
 * to the row is discarded (the write had in fact landed; the
 * document died before clearing its buffer). Another account's
 * stamped buffer is ignored — and its file left untouched.
 *
 * Device-copy bookkeeping (local writes only, never row
 * writes): a held buffer is (re)stamped with this account's id
 * so later boots recognize whose pending work it is; an
 * identical candidate's file is removed.
 *
 * Boot de-duplication (Nov 4, 2026) survives: the caller fires
 * its rankings fetch up front and passes the promise in, so
 * weezer_rankings is read once per boot.
 */
const resolveSignedInBoot = async (
  newUserId: string,
  rankingsRowPromise?: PromiseLike<{ data: RankingsRow }>
): Promise<SignedInBoot> => {
  const validSongIds = new Set(FULL_SONG_POOL.map((s) => s.id));

  /** One stored (map, list) pair -> one clean state: ids the
   *  catalog doesn't know are dropped, the list is sanitized
   *  against the map (unranked leftovers out, block order
   *  stable), and the catalog-owned fields (title, album, year)
   *  are refreshed from the catalog — saved entries embed
   *  copies that go stale when the catalog corrects a title
   *  ('Summer Elaine and Dr. Pepper'). Applied to every state
   *  the boot adopts, from whichever source. */
  const buildState = (
    rawMap: Record<string, TriageValue> | null | undefined,
    rawList: Song[] | null | undefined
  ): RankingsStateData => {
    const triageMap: Record<string, TriageValue> = {};
    if (rawMap) {
      Object.keys(rawMap).forEach((id) => {
        if (validSongIds.has(id)) triageMap[id] = rawMap[id];
      });
    }
    const masterList = refreshMasterListMetadata(
      sanitizeMasterList(
        (rawList || []).filter((s: Song) => validSongIds.has(s.id)),
        triageMap
      ),
      FULL_SONG_POOL
    );
    return { triageMap, masterList };
  };

  let row: RankingsRow = null;
  if (rankingsRowPromise) {
    const { data } = await rankingsRowPromise;
    row = data;
  } else {
    const { data } = await supabase
      .from('weezer_rankings')
      .select('triage_map, master_list')
      .eq('user_id', newUserId)
      .maybeSingle();
    row = data as RankingsRow;
  }
  const rowState = row ? buildState(row.triage_map, row.master_list) : null;

  // The device copy, parsed defensively — a corrupt snapshot
  // must never take the boot down with it.
  let snapshot: (RankingsStateData & { userId?: string | null }) | null =
    null;
  let snapshotSavedAt: number | null = null;
  try {
    const raw =
      typeof window !== 'undefined'
        ? localStorage.getItem('weezer_ranker_state')
        : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      snapshotSavedAt =
        typeof parsed?.savedAt === 'number' &&
        Number.isFinite(parsed.savedAt)
          ? parsed.savedAt
          : null;
      if (parsed && (parsed.triageMap || parsed.masterList)) {
        snapshot = {
          ...buildState(parsed.triageMap || {}, parsed.masterList || []),
          userId: parsed.userId ?? null,
        };
      }
    }
  } catch {
    snapshot = null;
  }

  // Unstamped local work is guest work arriving at a sign-in:
  // against an account with real rankings it merges per song
  // (the account wins wherever it has spoken); against an
  // account with nothing real to protect, the work itself is
  // the candidate. (Only REAL buckets count as existing
  // rankings here — an account holding nothing but 'unknown'
  // marks has no ratings to protect. Oct 16, 2026: temp test
  // picks replaced a real account's rankings at login; the
  // merge's account-wins rule is what keeps that hole closed.)
  let guestCandidate: RankingsStateData | null = null;
  if (snapshot && !snapshot.userId && rankingsStateHasProgress(snapshot)) {
    const accountHasRealProgress =
      !!rowState &&
      (Object.values(rowState.triageMap).some((value) =>
        isRealBucket(value)
      ) ||
        rowState.masterList.length > 0);
    if (accountHasRealProgress && rowState) {
      const merged = mergeGuestRankingsIntoAccount({
        accountTriageMap: rowState.triageMap,
        accountMasterList: rowState.masterList,
        guestTriageMap: snapshot.triageMap,
        guestMasterList: snapshot.masterList,
      });
      guestCandidate = {
        triageMap: merged.triageMap as Record<string, TriageValue>,
        masterList: refreshMasterListMetadata(
          merged.masterList,
          FULL_SONG_POOL
        ),
      };
    } else {
      guestCandidate = snapshot;
    }
  }

  const resolution = resolveBootState({
    userId: newUserId,
    row: rowState,
    snapshot,
    guestCandidate,
  });

  // Device-copy bookkeeping (see the header): a held buffer is
  // (re)stamped as this account's pending work; an identical
  // candidate is confirmed-by-content and its file removed; a
  // foreign buffer's file is left exactly as found.
  try {
    if (
      resolution.pending &&
      (resolution.buffer === 'held' || resolution.buffer === 'guest-held')
    ) {
      localStorage.setItem(
        'weezer_ranker_state',
        JSON.stringify({
          triageMap: resolution.pending.triageMap,
          masterList: resolution.pending.masterList,
          userId: newUserId,
          savedAt: snapshotSavedAt ?? Date.now(),
        })
      );
    } else if (resolution.buffer === 'identical') {
      localStorage.removeItem('weezer_ranker_state');
    }
  } catch {
    // Bookkeeping must never break the boot it describes.
  }

  return {
    confirmed: resolution.confirmed,
    pending: resolution.pending,
    buffer: resolution.buffer,
    bufferSavedAt: snapshotSavedAt,
  };
};

/**
 * Steps whose exit control means "take me back where I came from"
 * rather than a fixed destination: 'login' (its card's X),
 * 'orientation' (How It Works' "← Back"), 'fan_stats' (Fan Stats'
 * "← Back"), and 'rank_buckets' (Refine's stage-0 "← Back").
 * 'master' is tracked too — its origin is still recorded on entry —
 * but since Nov 7 its exit is the exception: Final Review's "← Back"
 * always goes to Refine (see closeMaster), never to the origin.
 * navigateTo records an origin for these on entry; the close*
 * functions consume it, each falling back to the destination its
 * control hardcoded before origin tracking
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

  // Launch analytics (app/lib/analytics.ts): configure the
  // singleton's send once, here at provider scope — the insert
  // translates Supabase's { error } result into a rejection so
  // the tracker's disable-on-first-failure rule can see it
  // (until the owner runs the app_events migration, that first
  // failure is exactly what happens, silently, by design).
  configureAnalytics(async (row) => {
    const { error } = await supabase.from('app_events').insert(row);
    if (error) throw error;
  });

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
  // still remembers where orientation itself was entered from.
  // (master's origin is the one exception — recorded like the others,
  // but closeMaster clears it unread since Nov 7: Final Review's Back
  // always goes to Refine.) A ref, not state: nothing renders from it.
  const returnStepRef = useRef<Partial<Record<AppStep, AppStep>>>({});
  const [refineStageIdx, setRefineStageIdx] = useState(0);
  const [autoStartMatchups, setAutoStartMatchups] = useState(false);
  // Post-sign-up banner flag (see the interface note). Plain state:
  // orientation renders from it, unlike the origin ref.
  const [accountCreated, setAccountCreated] = useState(false);

  // Guard-rewrite notice (see the interface note). Plain state:
  // page.tsx renders the notice from it on the landing step.
  const [guardNotice, setGuardNotice] = useState<{
    requested: AppStep;
    landed: AppStep;
  } | null>(null);

  const dismissGuardNotice = () => setGuardNotice(null);

  // Save-failure notice (see the interface note) + a ref mirror of
  // userId so the sync queue's send — created once, below — always
  // writes for the currently signed-in user.
  const [syncNotice, setSyncNotice] = useState(false);
  const dismissSyncNotice = () => setSyncNotice(false);

  // The last CONFIRMED rankings state (database-authority
  // model, Nov 7 simplification): set at boot from the fetched
  // row, then advanced ONLY by the sync queue's confirmed-write
  // signal (its onSuccess now carries the payload it confirmed).
  // The rendered state is the EFFECTIVE state — this confirmed
  // state with any unconfirmed work applied — held in the
  // triageMap/masterList state below; this ref is the record of
  // where the database provably stands.
  const confirmedStateRef = useRef<RankingsStateData>(
    EMPTY_RANKINGS_STATE
  );

  // The account whose rankings this provider has booted (or is
  // booting). The auth listener's whole discipline hangs off
  // it: a session event for THIS account (token refresh, user
  // update, a duplicate SIGNED_IN) never reloads rankings — the
  // second-init hazard (a late init overwriting mid-session
  // state) is deleted, not guarded — while a sign-in transition
  // to an account that has not booted IS a boot and runs the
  // load exactly once. Cleared when a session ends.
  const bootedRankingsUserRef = useRef<string | null>(null);

  // The save-diagnostics ring, mirrored in state so the account
  // drawer can render it; noteSaveDiagnostic is the ONLY way the
  // provider records (storage first, then the mirror refresh).
  const [saveDiagnostics, setSaveDiagnostics] = useState<
    SaveDiagnosticEvent[]
  >(() => readSaveDiagnostics());
  const noteSaveDiagnostic = (kind: string, detail: string) => {
    recordSaveDiagnostic(kind, detail);
    setSaveDiagnostics(readSaveDiagnostics());
  };

  // The visible save state (app/lib/saveStatus.ts holds the
  // phase vocabulary and the indicator copy). It moves ONLY on
  // the queue's confirmed-write signals and on boot outcomes —
  // an edit moves it to 'saving', never to 'saved'.
  const [saveState, setSaveState] = useState<SaveState>(INITIAL_SAVE_STATE);

  // Stranded state (see the interface note): set by the no-session
  // boot path and by the auth listener when a session ends without
  // an explicit sign-out behind it.
  const [stranded, setStranded] = useState(false);
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Deep-link intent parsed from ?step= on initial load. It is applied
  // (with prerequisite guards) only after user/ranking state has loaded.
  const [deepLinkIntent, setDeepLinkIntent] = useState<{
    raw: string | null;
    resolved: AppStep | null;
  } | null>(null);
  const deepLinkConsumedRef = useRef(false);

  // Rankings State — the ONE state object of the
  // database-authority model: (triageMap, masterList) is the
  // session's effective rankings state, committed whole by
  // commitEdit and by the boot load, never half at a time.
  // bucketRanks is NOT a state variable anymore (the
  // simplification's core deletion): it is derived at render
  // from the same pair, so it can never disagree with them —
  // the seam the Photograph resurrection lived in (three state
  // variables, two funnels updating them asymmetrically) no
  // longer exists.
  const [triageMap, setTriageMap] = useState<Record<string, TriageValue>>({});
  const [masterList, setMasterList] = useState<Song[]>([]);
  const bucketRanks = useMemo(
    () => getDerivedBucketRanks(triageMap, masterList),
    [triageMap, masterList]
  );

  // Sort completion (analytics): fire when the session's triage
  // CROSSES to all 206 bucketed. Only crossings observed after
  // the boot settles count — the first settled observation is
  // the baseline, so a boot that LOADS a finished sort never
  // fires it (completions are acts, not states), and the
  // tracker's once-rule keeps a dip-and-return from refiring.
  const triageCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (loadingUser) return;
    const count = Object.values(triageMap).filter(
      (v) => v !== 'unknown'
    ).length;
    const prev = triageCountRef.current;
    triageCountRef.current = count;
    if (prev !== null && prev < FULL_SONG_POOL.length && count >= FULL_SONG_POOL.length) {
      trackAnalytics('sort_completed', { oncePerSession: true });
    }
  }, [triageMap, loadingUser]);

  // Cached Community Data State (Fix B)
  const [communityMasterLists, setCommunityMasterLists] = useState<Song[][]>([]);
  const [communityTriageMaps, setCommunityTriageMaps] = useState<Record<string, TriageValue>[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState<boolean>(false);
  const [communityLoaded, setCommunityLoaded] = useState<boolean>(false);
  const [communityError, setCommunityError] = useState<boolean>(false);
  /** The in-flight community fetch, if any — concurrent
   *  refreshCommunityData calls share it instead of racing
   *  duplicate RPCs (refetch hardening, Nov 7). */
  const communityFetchRef = useRef<Promise<void> | null>(null);

  const setStep = (newStep: AppStep) => {
    setStepState(newStep);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // ---- Browser history for steps (Nov 4, 2026) ------------------
  // Steps used to live only in React state: navigateInternal
  // replaceState'd ?step= onto the ONE browser entry, so Back and
  // the iOS swipe-back gesture left the site from everywhere.
  // Now every user navigation pushes a real history entry stamped
  // with a marker (app/lib/navigationHistory.ts owns the pure
  // stack model), and a popstate listener walks the steps back
  // and forth. History is managed ONLY on the root path '/':
  // /u/[username], /terms and /privacy are real routes and keep
  // native Next history. The stack initializes when the initial
  // landing settles (see the deep-link effect) — never before, so
  // Smart Entry / guard decisions can't leak half-landed entries
  // into the stack, and a deep link's Back exits as it should.
  const navStackRef = useRef<NavStack<AppStep>>(createNavStack<AppStep>());
  /** A scroll restoration owed to a popstate landing: the step
   *  being landed on and the scrollY recorded when that entry was
   *  last left. The restore effect below applies it after the
   *  step renders (setStep's scroll-to-top is for FRESH entries;
   *  a Back/Forward landing returns to where the user was). The
   *  handler also writes it through to sessionStorage
   *  (app/lib/pendingScrollRestore.ts) so the restore survives a
   *  document reload landing mid-restore. */
  const pendingScrollRef = useRef<{ step: AppStep; y: number } | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [previousStep, setPreviousStep] = useState<AppStep | null>(null);
  // Mirrors for the mount-once popstate listener, which must read
  // the CURRENT step and guard data, not first-render closures
  // (same pattern as sendRankingsRef / userIdRef above).
  const stepRef = useRef<AppStep>(step);
  stepRef.current = step;
  const navGuardDataRef = useRef({ triageMap, masterList });
  navGuardDataRef.current = { triageMap, masterList };

  const syncNavUi = () => {
    const stack = navStackRef.current;
    setCanGoBack(canGoBackInStack(stack));
    setPreviousStep(previousStackStep(stack));
  };

  /** A deliberate navigation supersedes any restore a pop landing
   *  persisted: the user has moved on, and fresh entries start at
   *  the top — exactly as they did before the record existed. */
  const clearPersistedScrollRestore = (reason: string) => {
    void reason;
    clearPendingScrollRestore();
  };

  /** Stamp the stack's current position into the browser entry:
   *  the marker (step + navIndex + generation) plus the ?step=
   *  URL, kept in sync exactly as the old replaceState did. */
  const writeNavEntry = (mode: 'push' | 'replace') => {
    if (typeof window === 'undefined') return;
    const stack = navStackRef.current;
    const current = stack.entries[stack.index];
    if (current === undefined) return;
    const url = new URL(window.location.href);
    url.searchParams.set('step', current);
    const marker = createNavMarker(stack, current);
    if (mode === 'push') {
      window.history.pushState(marker, '', url.toString());
    } else {
      window.history.replaceState(marker, '', url.toString());
    }
  };

  /** Anchor the stack at the step the initial landing settled on
   *  (index 0, replacing the browser's initial entry). Idempotent
   *  and root-path only: sessions that reach the app through a
   *  sub-page keep native history until their first in-app
   *  navigation lazily initializes the stack (navigateInternal). */
  const initializeNavHistory = (landedStep: AppStep) => {
    if (navStackRef.current.initialized) return;
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== '/') return;
    navStackRef.current = initNavStack(navStackRef.current, landedStep);
    writeNavEntry('replace');
    syncNavUi();
  };

  /**
   * The origin bookkeeping for return-tracked steps, shared by
   * navigateInternal (fresh entries) and the popstate listener
   * (Forward landings): entering a tracked step records where the
   * user came FROM — except from the step itself, and never from
   * login (a detour, not a place a Back returns TO) — and entering
   * an ordinary step consumes every recorded origin.
   */
  const recordReturnOrigins = (targetStep: AppStep, fromStep: AppStep) => {
    if (RETURN_TRACKED_STEPS.indexOf(targetStep) !== -1) {
      if (fromStep !== targetStep && fromStep !== 'login') {
        returnStepRef.current[targetStep] = fromStep;
      }
    } else {
      returnStepRef.current = {};
    }
  };

  // FETCH & CACHE COMMUNITY DATA IN BACKGROUND
  // Pre-launch security: reads the anonymized aggregate via the
  // get_community_rankings() SECURITY DEFINER function instead of
  // selecting other users' rows directly (blocked by RLS).
  //
  // Refetch hardening (Nov 7): three soft spots closed.
  // - DUPLICATE IN-FLIGHT FETCHES: callers share one in-flight
  //   promise, and the callback identity is STABLE (useCallback)
  //   — Fan Stats' mount effect lists this function in its deps,
  //   and the old per-render identity re-fired the effect (and
  //   the RPC) on every render while the lists were empty.
  // - HONEST ERROR STATE: a failure now sets communityError and
  //   leaves any loaded data untouched, instead of settling
  //   silently into the same shape as a genuinely empty
  //   community (Fan Stats showed "No fan data yet" for what
  //   was actually a dead RPC, with no way to retry).
  // - STALE-EMPTY FLASH: loadingCommunity is true for the whole
  //   fetch, and Fan Stats' empty branch checks it FIRST — a
  //   return visit mid-refetch shows the spinner, never a flash
  //   of the empty (or error) state over data on its way.
  const refreshCommunityData = useCallback(async () => {
    if (communityFetchRef.current) return communityFetchRef.current;
    const run = (async () => {
      setLoadingCommunity(true);
      setCommunityError(false);
      try {
        const { data, error } = await supabase.rpc('get_community_rankings');

        if (error) throw error;
        if (data) {
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
        setCommunityError(true);
      } finally {
        setLoadingCommunity(false);
        setCommunityLoaded(true);
        communityFetchRef.current = null;
      }
    })();
    communityFetchRef.current = run;
    return run;
  }, []);

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
    // initUserAndLoadRankings already applies. Either way the
    // landing has now settled: anchor the history stack at the
    // step it settled on (Back from a fresh arrival exits).
    if (raw === null) {
      initializeNavHistory(stepRef.current);
      return;
    }

    // Unknown ?step= value: never leave a blank screen. Signed-in users
    // with ranking progress land on the dashboard, everyone else on splash.
    if (resolved === null) {
      const hasProgress =
        Object.keys(triageMap).length > 0 || masterList.length > 0;
      const fallback: AppStep = userId && hasProgress ? 'dashboard' : 'splash';
      setStepState(fallback);
      replaceStepInUrl(fallback);
      initializeNavHistory(fallback);
      return;
    }

    // A deep link must never bypass the visual locks: resolve it through the
    // same progression guard as navigateTo. Corrective redirects use
    // replaceState (never push) so the back button can't loop on a bad URL.
    const guarded = resolveGuardedStep(resolved, triageMap, masterList);
    if (guarded !== resolved) {
      replaceStepInUrl(guarded);
      // A guard-rewritten deep link gets the same explanation as a
      // guard-rewritten navigateTo (UAT P-1).
      setGuardNotice({ requested: resolved, landed: guarded });
    }

    setStepState(guarded);
    initializeNavHistory(guarded);
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
        // Session events update auth state only — they no
        // longer reload rankings (database-authority
        // simplification, Nov 7). The listener used to re-run
        // the full boot load on EVERY event, token refreshes
        // included: a late init landing mid-session overwrote
        // live state with stored state and reset the session's
        // counters — a hazard class the overhaul had to guard
        // rather than remove. Now: a sign-in transition to an
        // account whose rankings have not booted is a boot and
        // runs the load exactly once (the ref is set BEFORE the
        // call, so an INITIAL_SESSION racing the mount boot
        // cannot double it); every event for the account
        // already booted is ignored for rankings purposes.
        if (bootedRankingsUserRef.current !== session.user.id) {
          bootedRankingsUserRef.current = session.user.id;
          initUserAndLoadRankings();
        }
      } else {
        bootedRankingsUserRef.current = null;
        forgetAccountFanhoodSync();
        setUserId(null);
        setUserProfile(null);
        setFriendsList([]);
        setFriendCards([]);
        setPendingRequestsCount(0);
        // A session ending here is not necessarily a sign-out the
        // user asked for — an expired token lands in the same
        // event. If the device remembers a user and the local
        // copy holds their progress, this is a stranded owner:
        // flag it so the menu shows the signed-out card. An
        // explicit sign-out clears the last-user record BEFORE
        // supabase.auth.signOut() is called (handleSignOut), so
        // by the time a deliberate exit lands here the record is
        // already gone and this stays false. Rankings state
        // deliberately stays loaded — the local copy is fully
        // usable, and its edits now stamp the remembered user.
        try {
          const snap = localStorage.getItem('weezer_ranker_state');
          const parsedSnap = snap ? JSON.parse(snap) : null;
          setStranded(
            detectStrandedState({
              lastUserId: readLastUserId(),
              snapshotUserId: parsedSnap?.userId,
              hasProgress: snapshotHasProgress(parsedSnap),
            })
          );
        } catch {
          setStranded(false);
        }
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FETCH & REFRESH FRIENDS + PENDING REQUESTS
  // STABLE IDENTITY (useCallback on userId): consumers fire this
  // from effects that list it as a dependency — AppShell refreshes
  // friends when the nav menu opens. As a plain per-render closure
  // it changed identity on EVERY provider render, and because it
  // setState's fresh arrays (friendsList, friendCards) its own
  // completion re-rendered the provider, which re-fired those
  // effects, which fetched again — a self-sustaining fetch →
  // render → refetch loop that churned the whole tree several
  // times a second and starved taps on the phone, trapping the
  // menu open (no Escape key exists on touch to break out).
  // Memoized on userId, the identity changes only at sign-in/out.
  const refreshFriends = useCallback(async () => {
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
  }, [userId]);

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
        // One boot per account (see bootedRankingsUserRef): a
        // duplicate invocation for the account already booted —
        // the mount call racing the listener's INITIAL_SESSION,
        // a token refresh the listener let through before this
        // guard existed — must not reload rankings over live
        // state. The boot already done (or in flight) owns the
        // load; this invocation just releases the loading flag.
        if (bootedRankingsUserRef.current === uid) {
          setLoadingUser(false);
          return;
        }
        bootedRankingsUserRef.current = uid;
        setUserId(uid);
        setAnalyticsUserId(uid);

        // This device now remembers whose account it holds
        // (app/lib/lastUser.ts): if the session later dies, the
        // app can tell a stranded owner apart from a true guest.
        rememberLastUserId(uid);
        setStranded(false);

        // Fanhood follows the account: reconcile the device
        // record with the account's (fire-and-forget — silently
        // degrades to local-only until the fanhood table is live).
        reconcileAccountFanhood(uid);

        // Boot fetches (Nov 4, 2026): the profile read and the
        // rankings read are independent, so both fire NOW, in
        // parallel. The boot resolution folds into the rankings
        // fetch (its guest-merge check reads this very row) —
        // weezer_rankings is read once per boot.
        const profilePromise = supabase
          .from('profiles')
          .select('username, display_name, birth_year, country_code, state_code')
          .eq('id', uid)
          .maybeSingle();
        const rankingsPromise = supabase
          .from('weezer_rankings')
          .select('triage_map, master_list')
          .eq('user_id', uid)
          .maybeSingle();

        // The signed-in boot (resolveSignedInBoot): fetch the
        // row — it is the confirmed state, the only authority —
        // and hold any qualifying device copy as the pending
        // state. Boot writes NOTHING. The first thing done with
        // the outcome is recording it in the save diagnostics:
        // a boot that loses work from here on leaves a trace of
        // what it found (durability overhaul, Nov 7 — the ring
        // survives the simplification; its vocabulary slimmed
        // with the machinery it described).
        const boot = await resolveSignedInBoot(uid, rankingsPromise);
        confirmedStateRef.current = boot.confirmed;
        noteSaveDiagnostic('boot', `row loaded · buffer=${boot.buffer}`);
        if (boot.pending) {
          noteSaveDiagnostic(
            'buffer-held',
            'unsent changes are waiting on this device — they join the next edit; the row stays the authority until a save confirms them'
          );
        }
        // The boot's save state (bootSaveState in
        // app/lib/saveStatus.ts): a plain row load starts IDLE —
        // nothing was saved this session, and announcing "All
        // changes saved" at boot only confused the owner about
        // work he hadn't done (his ruling, Nov 7). A boot
        // holding a buffer starts 'local-only': the work is on
        // this device, unconfirmed, and the strip says so.
        setSaveState(
          bootSaveState({
            hasPendingBuffer: boot.pending !== null,
            bufferSavedAt: boot.bufferSavedAt,
          })
        );

        // Fetch User Profile
        const { data: profileData } = await profilePromise;

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

        // Commit the boot's effective state: the held pending
        // state when one exists (the user's unsent work is what
        // they see), otherwise the confirmed row state. Both
        // halves commit in the same act — the single state
        // object is the only shape this provider holds.
        const effective = boot.pending ?? boot.confirmed;
        setTriageMap(effective.triageMap);
        setMasterList(effective.masterList);

        // Smart Entry: Route to Dashboard if progress exists and no URL step is specified
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (
            !params.get('step') &&
            (Object.keys(effective.triageMap).length > 0 ||
              effective.masterList.length > 0)
          ) {
            setStepState('dashboard');
          }
        }
      } else {
        // No session: load the local snapshot as a guest would —
        // which, on a device that remembers a signed-in user, may
        // actually be a stranded owner whose session died (the
        // stranded computation after the load). The load itself is
        // identical either way; only the flag differs.
        setSaveState(INITIAL_SAVE_STATE);
        const localState = localStorage.getItem('weezer_ranker_state');
        let parsedSnapshot: {
          triageMap?: Record<string, TriageValue>;
          masterList?: Song[];
          userId?: string | null;
        } | null = null;
        if (localState) {
          try {
            parsedSnapshot = JSON.parse(localState);
            const parsed = parsedSnapshot!;
            const guestTriage: Record<string, TriageValue> = parsed.triageMap || {};
            // Sanitize saved master list against the triage map: drop unranked
            // leftovers from older saves; every ranked song keeps its position.
            // Same catalog-metadata refresh as the signed-in load —
            // guest lists carry the same stale embedded copies.
            const guestMaster = refreshMasterListMetadata(
              sanitizeMasterList(parsed.masterList || [], guestTriage),
              FULL_SONG_POOL
            );
            setTriageMap(guestTriage);
            setMasterList(guestMaster);

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
        setStranded(
          detectStrandedState({
            lastUserId: readLastUserId(),
            snapshotUserId: parsedSnapshot?.userId,
            hasProgress: snapshotHasProgress(parsedSnapshot),
          })
        );
      }
    } catch (err) {
      console.error('Error loading rankings:', err);
    } finally {
      setLoadingUser(false);
      // The visit's funnel anchor (analytics): fired when the
      // boot settles, once per session — the tracker's
      // once-rule absorbs the duplicate invocations the boot
      // guard turns away above.
      trackAnalytics('session_start', { oncePerSession: true });
    }
  }

  // Database sync goes through a serialized queue (app/lib/
  // rankingsSync.ts — see its header for the Oct 22 post-mortem).
  // The old code fired debounced whole-row upserts with no
  // in-flight guard and never read the result: two snapshots could
  // race on the wire and the older one landing last reverted songs
  // the user had just moved, and failures vanished silently. The
  // queue serializes writes (single-flight, coalesce-to-latest),
  // retries with backoff, keeps the payload until a write succeeds,
  // and surfaces an exhausted failure via syncNotice. localStorage
  // still writes immediately on every change (the guest store, and
  // unchanged); the queue only governs the Supabase write.
  type RankingsSyncPayload = {
    map: Record<string, TriageValue>;
    master: Song[];
  };

  // One transport attempt. Resolves true ONLY on a confirmed write:
  // supabase-js resolves with an `error` object on HTTP failures
  // (expired token, RLS), so the error must be read, not caught.
  const sendRankingsToDatabase = async (
    payload: RankingsSyncPayload,
    opts: { keepalive: boolean }
  ): Promise<boolean> => {
    const uid = userIdRef.current;
    if (!uid) return false;
    const row = {
      user_id: uid,
      triage_map: payload.map,
      master_list: payload.master,
      updated_at: new Date().toISOString(),
    };
    if (opts.keepalive) {
      // The page is going away (hide/pagehide): write through a
      // keepalive fetch so iOS doesn't kill the request when it
      // discards the page mid-flush. Same PostgREST upsert the
      // client performs, with the session's access token.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return false;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/weezer_rankings?on_conflict=user_id`,
          {
            method: 'POST',
            keepalive: true,
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(row),
          }
        );
        return res.ok;
      } catch {
        return false;
      }
    }
    try {
      const { error } = await supabase
        .from('weezer_rankings')
        .upsert(row, { onConflict: 'user_id' });
      if (error) {
        console.error('Error syncing rankings:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error syncing rankings:', err);
      return false;
    }
  };
  const sendRankingsRef = useRef(sendRankingsToDatabase);
  sendRankingsRef.current = sendRankingsToDatabase;

  const syncQueueRef = useRef<RankingsSyncQueue<RankingsSyncPayload> | null>(
    null
  );
  if (syncQueueRef.current === null) {
    syncQueueRef.current = createRankingsSyncQueue<RankingsSyncPayload>({
      send: (payload, opts) => sendRankingsRef.current(payload, opts),
      onGiveUp: () => {
        setSyncNotice(true);
        // The indicator's failed phase (durability overhaul):
        // the payload is retained on the device and the app
        // keeps trying — and now the give-up is also IN THE
        // RECORD, not just on a dismissible banner.
        setSaveState({ phase: 'failed', savedAt: null });
        noteSaveDiagnostic(
          'give-up',
          'the save queue exhausted its retries — changes are retained on this device'
        );
      },
      onSuccess: (payload) => {
        setSyncNotice(false);
        // The confirmed state advances to exactly the payload
        // this success confirms — the queue carries it now
        // (app/lib/rankingsSync.ts). A successful send confirms
        // only ITS payload: the state is 'saved' when nothing
        // newer is still waiting. This is the one place 'saved'
        // is ever set mid-session — a confirmed database write,
        // with its time.
        confirmedStateRef.current = {
          triageMap: payload.map,
          masterList: payload.master,
        };
        const queue = syncQueueRef.current;
        if (queue && !queue.hasPending()) {
          // The newest state is confirmed in the row, so the
          // on-device unsent-changes buffer has done its job:
          // presence means unconfirmed, and this state is
          // confirmed — clear it. (Guests never enqueue, so the
          // guest store is never cleared by this path.)
          try {
            localStorage.removeItem('weezer_ranker_state');
          } catch {
            // A failed clear only means a later boot holds an
            // identical buffer and discards it (bootState's
            // content-equality rule) — never a wrong state.
          }
          setSaveState({ phase: 'saved', savedAt: Date.now() });
        } else {
          setSaveState({ phase: 'saving', savedAt: null });
        }
      },
    });
  }

  // Flush on tab hide/close as well as on the debounce: a fast exit
  // sends any pending write right away, on the keepalive transport.
  useEffect(() => {
    const flush = () => {
      void syncQueueRef.current?.flush({ keepalive: true });
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

  /**
   * THE edit path (database-authority model, Nov 7
   * simplification). Every rankings edit — triage answers,
   * Refine moves and drags, matchup results, Final Review
   * reorders and normalization, magic fill — is one atomic
   * commit of the single state object: both halves replace
   * together, so the map/master disagreement class (the
   * Photograph resurrection: the Refine funnel synced a map it
   * never committed, and the next edit built on the stale half)
   * is unrepresentable — there is no second variable to leave
   * behind.
   *
   * A commit does three things, in order:
   * 1. Replaces the session's effective state (the render
   *    derives bucketRanks from it — optimistic as ever; only
   *    the word "saved" waits for confirmation).
   * 2. Writes the device copy synchronously. For a guest it IS
   *    the store (no account exists). For a signed-in user it
   *    is the unsent-changes buffer: it holds exactly the
   *    newest unconfirmed state, and the queue's confirmed
   *    write clears it — presence means unconfirmed, by
   *    construction. The stamp is the live session's user, or
   *    the device's remembered user when the session died (a
   *    stranded owner's edits ARE that account's work — the
   *    stamp is what lets the next sign-in boot hold them as
   *    that account's pending buffer instead of mistaking them
   *    for guest work). A true guest stamps null.
   * 3. For a signed-in user, enqueues the state for the
   *    database write and moves the save state to 'saving'.
   *    Only the queue's confirmed write (its onSuccess, above)
   *    may advance the confirmed state and say 'saved'.
   */
  const commitEdit = (nextState: RankingsStateData) => {
    setTriageMap(nextState.triageMap);
    setMasterList(nextState.masterList);
    if (userId) rememberLastUserId(userId);
    try {
      localStorage.setItem(
        'weezer_ranker_state',
        JSON.stringify({
          triageMap: nextState.triageMap,
          masterList: nextState.masterList,
          userId: resolveSnapshotStampUserId(userId, readLastUserId()),
          savedAt: Date.now(),
        })
      );
    } catch {
      // A device copy that cannot be written (quota, privacy
      // mode) degrades the buffer, never the edit: the queue
      // below still carries the state to the row.
    }
    if (!userId) {
      // No account to save to (guest, or stranded): the work is
      // on this device only, and the indicator says exactly that.
      setSaveState({ phase: 'local-only', savedAt: Date.now() });
      return;
    }
    setSaveState({ phase: 'saving', savedAt: null });
    syncQueueRef.current?.enqueue({
      map: nextState.triageMap,
      master: nextState.masterList,
    });
  };

  /** The long-standing public shape: push a (map, master) pair
   *  as the session's state. Now simply a commitEdit of that
   *  pair — the onboarding pushes in StepDashboard/StepGarage2
   *  call it with the context's current pair right after
   *  sign-up, which writes the session's state (including any
   *  boot-held pending work) to the new account's row through
   *  the ordinary confirmed path. */
  const syncRankingsToDatabase = async (
    map: Record<string, TriageValue>,
    master: Song[]
  ) => {
    commitEdit({ triageMap: map, masterList: master });
  };

  const updateAndSyncBucketRanks = (
    newBucketRanks: Record<BucketType, Song[]>,
    updatedMap?: Record<string, TriageValue>
  ) => {
    const activeMap = updatedMap || triageMap;
    const newMaster = [
      ...(newBucketRanks.banger || []),
      ...(newBucketRanks.slaps || []),
      ...(newBucketRanks.mid || []),
      ...(newBucketRanks.skip || []),
      ...(newBucketRanks.trash || []),
    ];
    commitEdit({ triageMap: activeMap, masterList: newMaster });
  };

  const setSongBucket = (id: string, bucket: TriageValue) => {
    const map = { ...triageMap, [id]: bucket };
    const reconciled = reconcileMasterList(masterList, map);
    commitEdit({ triageMap: map, masterList: reconciled });
  };

  // Final Review entry normalization (belt and braces): reconcile
  // heals triage writes as they happen and sanitize heals saves at
  // load, but this pass — the same sortByBucketBlock both of them
  // use — guarantees the master step only ever receives a
  // bucket-block-ordered list. No-op, and no commit, when the list
  // is already normalized. (Under the overhaul this pass was the
  // one NON-edit writer, held by the buffer guard while a buffer
  // waited; in the database-authority model there is no second
  // write channel to guard — normalization builds on the session's
  // effective state like any edit, and a boot-held buffer folds in
  // through it exactly as the design specifies for the next
  // commitEdit.)
  const normalizeMasterList = () => {
    const normalized = sortByBucketBlock(masterList, triageMap);
    const changed =
      normalized.length !== masterList.length ||
      normalized.some((song, i) => song.id !== masterList[i].id);
    if (!changed) return;
    commitEdit({ triageMap, masterList: normalized });
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
    commitEdit({ triageMap, masterList: list });
  };

  const navigateInternal = (
    targetStep: AppStep,
    authMode?: AuthModeType,
    isReturn: boolean = false,
    preserveOrigins: boolean = false,
    historyMode?: 'push' | 'replace' | 'reset'
  ) => {
    // Origin bookkeeping for the return-tracked steps. A return
    // navigation (the close* exits) skips it entirely:
    // the exit consumes its own origin in returnFromStep, and landing
    // back on another tracked step must not overwrite (or clear) that
    // step's recorded origin with the step just exited.
    if (!isReturn) {
      if (
        RETURN_TRACKED_STEPS.indexOf(targetStep) !== -1 ||
        !preserveOrigins
      ) {
        // Entering a tracked step records where the user is coming
        // FROM so the step's exit control can take them back there
        // (recordReturnOrigins holds the exact rules: never the
        // step itself, never from login — a detour, not a place a
        // Back should return TO). Entering an ordinary step
        // consumes every recorded origin — the user has moved on.
        recordReturnOrigins(targetStep, step);
      }
      // The remaining case — preserveOrigins into an ordinary
      // step — is a detour navigation (the help sheet's tutorial
      // replay): the user is being pulled away mid-visit, not
      // moving on, so the origins recorded for the tracked steps
      // they were visiting survive (UAT P-3).
    }

    if (authMode) {
      setInitialAuthMode(authMode);
    }

    const guardedStep = resolveGuardedStep(targetStep, triageMap, masterList); if (guardedStep === 'rank_buckets') {
      // (bucketRanks needs no refresh here anymore: it is
      // derived from (triageMap, masterList) at render.)
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

    // Guard-rewrite notice (UAT P-1): if the guard rewrote the
    // requested destination, record the pair so the landing step
    // can explain itself. Any landing that was NOT rewritten
    // clears it — the notice belongs to one landing only and
    // never trails the user around the app.
    if (guardedStep !== targetStep) {
      setGuardNotice({ requested: targetStep, landed: guardedStep });
    } else {
      setGuardNotice(null);
    }

    // Capture the scroll position of the step being left BEFORE
    // setStep runs: setStep force-scrolls to the top, so a
    // window.scrollY read after it records 0 for the entry being
    // left — which is exactly what the first scroll-restoration
    // build did, and why every Back landing "restored" the top
    // in Mark's Nov 4 playtest. The push branch below records
    // THIS value into the nav stack.
    const leavingScrollY =
      typeof window !== 'undefined' ? window.scrollY : 0;

    setStep(guardedStep);

    if (typeof window !== 'undefined') {
      // If navigating from a sub-page (e.g. /u/username), redirect back to root with step param.
      // Real routes keep native Next history — unmanaged by the stack.
      if (window.location.pathname !== '/') {
        router.push(`/?step=${guardedStep}`);
        return;
      }

      // Lazy init: the provider also mounts on sub-pages, where
      // the landing never initializes the stack. A session that
      // reached the app through one initializes on its first
      // in-app navigation instead — anchored at the step it is
      // leaving, so this navigation can push on top of it.
      if (
        !navStackRef.current.initialized &&
        deepLinkConsumedRef.current &&
        !loadingUser
      ) {
        initializeNavHistory(step);
      }

      if (!navStackRef.current.initialized) {
        // The initial landing hasn't settled yet: keep the URL in
        // sync exactly as before, without touching the stack.
        const url = new URL(window.location.href);
        url.searchParams.set('step', guardedStep);
        window.history.replaceState({}, '', url.toString());
        return;
      }

      if (historyMode === 'reset') {
        // Sign-out: re-anchor the stack at the target. The
        // generation bump inside reset orphans every marker
        // written before it, so Back/Forward afterwards can
        // never resurrect a signed-in page.
        navStackRef.current = resetNavStack(navStackRef.current, guardedStep);
        clearPersistedScrollRestore('fresh-navigation-reset');
        writeNavEntry('replace');
      } else if (
        historyMode === 'replace' ||
        isReturn ||
        guardedStep !== targetStep
      ) {
        // Replace, never push: explicit post-auth landings,
        // returnFromStep's fallback path, and guard rewrites —
        // a step the user didn't ask for (or can't see) must
        // not become an entry Back can land on. The entry keeps
        // its index but changes its step, so any scroll recorded
        // for the old step is cleared: this landing starts at
        // the top (setStep already scrolled there).
        navStackRef.current = recordNavScroll(
          replaceNavStep(navStackRef.current, guardedStep),
          0
        );
        clearPersistedScrollRestore('fresh-navigation-replace');
        writeNavEntry('replace');
      } else if (guardedStep !== step) {
        // Leaving this entry for a fresh one: record how far
        // the user had scrolled it (captured above, before
        // setStep scrolled the new step to the top), so Back
        // restores the spot.
        navStackRef.current = pushNavStep(
          recordNavScroll(navStackRef.current, leavingScrollY),
          guardedStep
        );
        clearPersistedScrollRestore('fresh-navigation-push');
        writeNavEntry('push');
      }
      // Same-step navigation pushes nothing (and the current
      // entry already carries the right marker).
      syncNavUi();
    }
  };

  const navigateTo = (
    targetStep: AppStep,
    authMode?: AuthModeType,
    opts?: {
      preserveOrigins?: boolean;
      history?: 'push' | 'replace' | 'reset';
    }
  ) => {
    navigateInternal(
      targetStep,
      authMode,
      false,
      opts?.preserveOrigins,
      opts?.history
    );
  };

  /** Browser Back, when it stays inside the app (see the
   *  interface note). The popstate listener below performs the
   *  actual landing. */
  const goBack = () => {
    if (typeof window === 'undefined') return;
    if (canGoBackInStack(navStackRef.current)) {
      window.history.back();
    }
  };

  // POPSTATE — browser Back/Forward and the iOS swipe-back
  // gesture. THE LOOP RULE: a pop landing applies its step
  // WITHOUT pushing (the browser has already moved; pushing here
  // would truncate the forward stack and re-enter the handler).
  // Mount-once: everything mutable is read through refs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = (event: PopStateEvent) => {
      if (window.location.pathname !== '/') return;
      const stack = navStackRef.current;
      if (!stack.initialized) {
        return;
      }
      const marker = parseNavMarker(
        event.state,
        (s): s is AppStep => resolveUrlStep(s) === s
      );
      // Not one of ours (Next router state, a sub-page entry, a
      // pre-history-build entry): leave it to the router.
      if (!marker) {
        return;
      }
      // Stale generation — an entry written before a sign-out
      // reset. Never resurrect it; the app stays where it is.
      if (marker.gen !== stack.gen) return;

      const previousIndex = stack.index;
      // Record how far the entry being left was scrolled BEFORE
      // the stack index moves — a later Forward landing restores
      // it, exactly as this landing restores its own entry's.
      const applied = applyPopNavIndex(
        recordNavScroll(stack, window.scrollY),
        marker
      );
      navStackRef.current = applied.stack;
      const requested = applied.step;

      const { triageMap: tm, masterList: ml } = navGuardDataRef.current;
      const guarded = resolveGuardedStep(requested, tm, ml);
      if (guarded !== requested) {
        // The entry names a step the guard no longer allows
        // (e.g. rankings changed since it was written): rewrite
        // THIS browser entry with the guarded step, exactly as
        // navigateTo treats a guard rewrite, and explain it.
        // The rewritten entry's saved scroll belonged to the
        // step that is no longer landing — clear it.
        navStackRef.current = recordNavScroll(
          replaceNavStep(navStackRef.current, guarded),
          0
        );
        // This landing owes no restore (it starts at the top):
        // drop any restore record a previous landing persisted.
        clearPersistedScrollRestore('popstate-guard-rewrite');
        writeNavEntry('replace');
        setGuardNotice({ requested, landed: guarded });
      } else {
        setGuardNotice(null);
      }

      // Origin bookkeeping mirrors the two ways a landing can
      // happen: a Back landing is a RETURN (origins untouched,
      // like the close* exits — the recorded origins belong to
      // the entries themselves and are consumed only by a real
      // exit), while a Forward landing records origins like a
      // fresh entry.
      if (marker.navIndex > previousIndex) {
        recordReturnOrigins(guarded, stepRef.current);
      }

      // Refine landings need no bucket-list refresh (bucketRanks
      // is render-derived now), and a pop NEVER resets the stage
      // or the matchup flag: Step2Refine writes its stage back
      // as it moves, so Back/Forward returns to the work in
      // progress.

      if (guarded !== requested) {
        // Guard-rewritten landing: a place the user didn't ask
        // for — start it at the top, as a fresh entry would.
        setStep(guarded);
      } else {
        // A true Back/Forward landing: return to the scroll
        // position this entry had when it was left (top when
        // none was recorded). setStepState, NOT setStep —
        // setStep force-scrolls to the top on every landing,
        // which is the bug this restores against. The restore
        // effect applies the position once the step renders.
        pendingScrollRef.current = {
          step: guarded,
          y: navScrollFor(navStackRef.current, marker.navIndex) ?? 0,
        };
        // Write the owed restore through to sessionStorage: the
        // stale-build watchdog can reload the document mid-landing
        // (proven by the owner's Nov 6 on-device log — the
        // restore started, then the page rebooted at scrollY=0),
        // and the in-memory ref dies with the document. The next
        // document's restore effect re-offers it on boot; the
        // watchdog also refuses to reload while it exists. See
        // app/lib/pendingScrollRestore.ts.
        persistPendingScrollRestore({
          step: guarded,
          y: pendingScrollRef.current.y,
          navIndex: marker.navIndex,
          ts: Date.now(),
        });
        setStepState(guarded);
      }
      syncNavUi();
    };
    // The app manages scroll restoration itself (per-entry
    // positions on the nav stack); the browser's automatic
    // restoration fires before React renders the landed step
    // and would be overwritten anyway — turn it off so the two
    // never fight mid-landing.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SCROLL RESTORATION for popstate landings: once the landed
  // step has rendered, put the scroll back where the entry left
  // it. Fresh navigations never set the pending ref, so they
  // keep setStep's scroll-to-top.
  //
  // The pending restore is ALSO persisted to sessionStorage by
  // the popstate handler (app/lib/pendingScrollRestore.ts): if
  // the stale-build watchdog reloads the document mid-landing,
  // the rebooted app lands on the same step (via ?step=) and
  // this effect re-offers the persisted restore to the same
  // loop below. BuildVersionCheck refuses to reload while a
  // fresh record exists, so the boot path is the backstop, not
  // the common case.
  //
  // The restore is a short retry loop, not a single scrollTo:
  // the first version applied one scrollTo on double-rAF and
  // Mark's phone test (Nov 4, 2026) still landed at the top —
  // the landed step's data-driven sections (record shelf,
  // Thread cards) are still mounting at that point, so the
  // document isn't tall enough yet and the browser CLAMPS the
  // offset to whatever height exists. The loop re-applies the
  // target every frame until the scroll position actually
  // sticks for two consecutive frames (i.e. the layout has
  // grown enough to hold it), gives up after ~2s, and cancels
  // the moment the user touches or wheels — their scroll wins.
  useEffect(() => {
    let pending = pendingScrollRef.current;
    let fromPersistedRecord = false;
    let bootRecord: PendingScrollRestore | null = null;
    if (!pending) {
      // BOOT PATH: a pop landing in a PREVIOUS document may have
      // persisted its owed restore before a watchdog reload wiped
      // the page (the Nov 6 diagnosis — restore started at +18215,
      // pagehide at +18428, reboot at the top). The reload lands
      // the app back on the same step via ?step=, so when the
      // booted step matches the record's step, re-offer the
      // restore to this same loop. The record only ever comes
      // from a pop landing in this tab session and goes stale in
      // 15s, so a genuinely fresh visit can't trip this.
      const record = readFreshPendingScrollRestore();
      if (record && record.step === step) {
        pending = { step: step, y: record.y };
        fromPersistedRecord = true;
        bootRecord = record;
      }
    }
    if (!pending || pending.step !== step) return;
    pendingScrollRef.current = null;
    // ROUND 2 (the owner's second retest log): an IN-PAGE
    // consumption must NOT clear the persisted record. Round 1
    // cleared it right here — and the watchdog's async check,
    // its /api/build-id fetch still in flight, reached its
    // reload decision ~1.1s later, found no record, and
    // reloaded anyway; after the reload there was also no
    // record left for the boot restore to find. Both defenses
    // died to the same early clear. The record now stands for
    // "the most recent Back landing's target, valid for its
    // whole 15s freshness window" and clears ONLY on a fresh
    // push/replace/reset navigation, a guard-rewritten pop
    // landing, boot-restore application, or staleness. If the
    // watchdog reloads anyway inside the window, the boot path
    // retrying this same target is exactly the intent — so the
    // restore loop's outcome (stuck / deadline / cancelled)
    // doesn't clear it either.
    // The BOOT path, by contrast, DOES clear its record — but
    // only after the restore has been applied (finish() below),
    // and only if the record still in storage is THIS one: a
    // newer landing may have replaced it meanwhile, and that
    // newer record is not this document's to clear.
    const clearBootRecordIfStillCurrent = () => {
      if (!bootRecord) return;
      const current = readFreshPendingScrollRestore();
      if (current && current.ts === bootRecord.ts) {
        clearPersistedScrollRestore('boot-restore-applied');
      }
    };
    const y = pending.y;
    if (y <= 0) {
      // Honored with nothing to apply — the landing's target IS
      // the top — so a boot record that brought us here is done.
      clearBootRecordIfStillCurrent();
      return;
    }
    let raf = 0;
    let cancelled = false;
    let stuckFrames = 0;
    let attempts = 0;
    let finished = false;
    const deadline = performance.now() + 2000;
    const finish = (outcome: string) => {
      void outcome;
      if (finished) return;
      finished = true;
      // A boot restore clears its persisted record only now —
      // AFTER the loop has applied it (or the user/deadline
      // ended it) — never at consumption. In-page restores have
      // no boot record, so for them this is a no-op and the
      // record outlives the restore (round 2, above).
      clearBootRecordIfStillCurrent();
    };
    const cancelOnUserScroll = () => {
      if (!cancelled) finish('cancelled-by-touch-or-wheel');
      cancelled = true;
    };
    window.addEventListener('touchstart', cancelOnUserScroll, {
      passive: true,
    });
    window.addEventListener('wheel', cancelOnUserScroll, {
      passive: true,
    });
    const attempt = () => {
      if (cancelled) return;
      attempts += 1;
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      if (Math.abs(window.scrollY - y) <= 1) {
        stuckFrames += 1;
        if (stuckFrames >= 2) {
          finish('stuck');
          return;
        }
      } else {
        stuckFrames = 0;
        if (performance.now() > deadline) {
          finish('deadline');
          return;
        }
      }
      raf = requestAnimationFrame(attempt);
    };
    // Double rAF before the first attempt so the step's own
    // mount effects (a couple of steps scroll themselves to
    // the top on entry) have already run.
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(attempt);
    });
    return () => {
      finish('cleanup-effect-rerun-or-unmount');
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('touchstart', cancelOnUserScroll);
      window.removeEventListener('wheel', cancelOnUserScroll);
    };
  }, [step]);

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
    // If the recorded origin is exactly the previous in-app
    // history entry, go Back for real: the browser stack stays
    // honest (Forward will return here afterwards) and the
    // popstate listener performs the landing with return
    // semantics. Any desync — no stack, a stale entry, an origin
    // that isn't the previous entry — falls back to the replace
    // navigation below, as before.
    const navStack = navStackRef.current;
    if (
      typeof window !== 'undefined' &&
      window.location.pathname === '/' &&
      navStack.initialized &&
      navStack.index > 0 &&
      navStack.entries[navStack.index] === fromStep &&
      navStack.entries[navStack.index - 1] === target
    ) {
      window.history.back();
      return;
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

  /** Final Review's "← Back": leave My Rankings for Refine — ALWAYS
      (owner, Nov 7). This exit is deliberately NOT origin-aware: the
      button walks the user back through the refinement process, so
      wherever Final Review was entered from (Refine's own finish,
      the Thread's edit-intent, the menu, the dashboard), Back lands
      in Refine. Clearing the recorded origin first is the mechanism:
      with nothing recorded, returnFromStep takes its fallback —
      rank_buckets — through the standard return machinery (the
      stage-preserving, matchup-free isReturn landing, with the
      real history.back() fast path when Refine is the previous
      stack entry). The landing stage is the context's refine-stage
      copy (refineStageIdx), which page.tsx hands Step2Refine as its
      initial stage — the stage the user left Refine from. Refine's
      own recorded origin is untouched, so its stage-0 Back behaves
      exactly as before. */
  const closeMaster = () => {
    delete returnStepRef.current['master'];
    returnFromStep('master', 'rank_buckets');
  };

  /** Refine's stage-0 "← Back": leave Refine, go back where you came from. */
  const closeRefine = () => {
    returnFromStep('rank_buckets', 'triage');
  };

  const handleSignOut = async () => {
    // The last-user record goes FIRST: the auth listener treats a
    // session ending with the record still present (and local
    // progress on disk) as a stranded owner, and an explicit
    // sign-out must land as a clean true guest. It is the ONLY
    // place the record is cleared — a session merely dying never
    // clears it. (Delete-account, when its backend ships, ends in
    // this same sign-out.)
    forgetLastUserId();
    setStranded(false);
    await supabase.auth.signOut();
    setUserId(null);
    setAnalyticsUserId(null);
    setUserProfile(null);
    setTriageMap({});
    setMasterList([]);
    setFriendsList([]);
    setFriendCards([]);
    setPendingRequestsCount(0);
    localStorage.removeItem('weezer_ranker_state');
    // The boot bookkeeping belongs to the signed-in session
    // that just ended; the next account (or guest) boots its
    // own confirmed state from its own row.
    bootedRankingsUserRef.current = null;
    confirmedStateRef.current = EMPTY_RANKINGS_STATE;
    setSaveState(INITIAL_SAVE_STATE);
    // History reset (see navigateInternal): Back after sign-out
    // must never resurrect a signed-in page.
    navigateTo('splash', undefined, { history: 'reset' });
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
        guardNotice,
        dismissGuardNotice,
        syncNotice,
        dismissSyncNotice,
        saveState,
        saveDiagnostics,
        stranded,
        initialAuthMode,
        navigateTo,
        canGoBack,
        previousStep,
        goBack,
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
        communityError,
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

