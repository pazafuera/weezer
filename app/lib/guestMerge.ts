/**
 * Guest→account rankings merge (Nov 7, 2026 — Part 3 of the
 * database-led pass, the launch-funnel fix).
 *
 * The trap this closes: a visitor sorts as a guest — the whole
 * funnel is guest-first — then signs in to an account that
 * ALREADY has rankings. The Oct 16 never-overwrite rule (correct
 * against its own incident: stray local picks erasing a real
 * account at login) resolved that collision by returning the
 * account row and simply never loading the guest work. Every
 * guest pick vanished, silently, at the exact moment the funnel
 * asked for commitment.
 *
 * The merge rule, per song:
 *
 * - The ACCOUNT wins wherever it has a real bucket. Its bucket,
 *   its seat, its copy of the song.
 * - Guest categorization fills only the gaps — songs the account
 *   has not rated.
 * - 'unknown' ("Don't Know It") is dealt-with, not a rating: a
 *   real bucket from either side beats a don't-know mark, and a
 *   lone don't-know mark carries over as itself.
 *
 * Order: the account's master-list order, with guest-filled songs
 * seated inside their bucket blocks in their local relative
 * order. The final ordering is NOT hand-rolled here — the merged
 * list is composed from the existing helpers (sanitizeMasterList
 * drops unranked leftovers and block-sorts stably;
 * reconcileMasterList seats any categorized song neither list
 * carried), the same normalization every other load path uses.
 *
 * The caller (migrateGuestRankingsToUser) invokes this only for
 * the boot resolver's 'merged' source: unstamped local work
 * against an account with real rankings. The merged state loads
 * into the session and persists through the normal save path on
 * the next edit — the merge itself performs no write.
 */
import type { BucketType, Song } from '../data/constants';
import {
  reconcileMasterList,
  sanitizeMasterList,
} from '../../utils/rankingUtils';

/** A triage value: one of the five real buckets, or 'unknown'. */
type TriageValueLike = BucketType | 'unknown';

const REAL_BUCKETS: readonly BucketType[] = [
  'banger',
  'slaps',
  'mid',
  'skip',
  'trash',
];

function isRealBucket(
  value: TriageValueLike | undefined
): value is BucketType {
  return (
    value !== undefined &&
    REAL_BUCKETS.indexOf(value as BucketType) !== -1
  );
}

export function mergeGuestRankingsIntoAccount(args: {
  accountTriageMap: Record<string, TriageValueLike>;
  accountMasterList: readonly Song[];
  guestTriageMap: Record<string, TriageValueLike>;
  guestMasterList: readonly Song[];
}): {
  triageMap: Record<string, TriageValueLike>;
  masterList: Song[];
} {
  const {
    accountTriageMap,
    accountMasterList,
    guestTriageMap,
    guestMasterList,
  } = args;

  // Per-song triage merge. Real ratings dominate from whichever
  // side holds them (the account first); don't-know marks fill
  // what is left.
  const triageMap: Record<string, TriageValueLike> = {};
  const guestFilled = new Set<string>();
  const seenIds = new Set<string>();
  const allIds: string[] = [];
  for (const id of [
    ...Object.keys(accountTriageMap),
    ...Object.keys(guestTriageMap),
  ]) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    allIds.push(id);
  }
  for (const id of allIds) {
    const accountValue = accountTriageMap[id];
    const guestValue = guestTriageMap[id];
    if (isRealBucket(accountValue)) {
      triageMap[id] = accountValue;
    } else if (isRealBucket(guestValue)) {
      triageMap[id] = guestValue;
      guestFilled.add(id);
    } else if (accountValue !== undefined) {
      triageMap[id] = accountValue;
    } else if (guestValue !== undefined) {
      triageMap[id] = guestValue;
    }
  }

  // Master list: the account's entries in the account's order,
  // then the guest-filled songs in their local relative order —
  // the account's copy of a song always survives, the guest's
  // copy arrives only for songs it filled.
  const combined: Song[] = [...accountMasterList];
  const seated = new Set<string>(accountMasterList.map((s) => s.id));
  for (const song of guestMasterList) {
    if (guestFilled.has(song.id) && !seated.has(song.id)) {
      combined.push(song);
      seated.add(song.id);
    }
  }

  // Final ordering from the existing helpers: sanitize drops
  // anything the merged map does not rank and block-sorts stably
  // (account seats keep their order; fills land inside their
  // blocks behind them); reconcile then seats any categorized
  // song neither list carried.
  const masterList = reconcileMasterList(
    sanitizeMasterList(combined, triageMap),
    triageMap
  );

  return { triageMap, masterList };
}
