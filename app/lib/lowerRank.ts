import type { BucketType } from '../data/constants';

/**
 * Downstream bucket ranking — the opt-in (owner, Nov 12, 2026).
 *
 * Bangers and Slaps are ranked as part of the project; Mid,
 * Skip and Trash are only sorted — where a song sits inside
 * those buckets means nothing (their stage copy says so).
 * A fan who has finished sorting can opt in, per bucket, to
 * ranking the lower buckets too: the Refine stage for that
 * bucket gains the drag ordering the top two stages have, and
 * the order they set is the order their list and tier card
 * show (the order itself already lives in the master list —
 * opting in just makes it deliberate).
 *
 * The opt-in itself is a device preference, kept in
 * localStorage like the triage view mode: it only decides
 * whether the ordering controls show. The Weezerverse stats
 * never read list order inside a bucket (bucket points only),
 * so opted-in and opted-out fans feed the aggregates exactly
 * the same shape of data.
 */
export const LOWER_RANK_BUCKETS: readonly BucketType[] = [
  'mid',
  'skip',
  'trash',
];

const LOWER_RANK_KEY = 'weezer-lower-rank-optins';

export function isLowerRankBucket(
  bucket: BucketType
): bucket is 'mid' | 'skip' | 'trash' {
  return (LOWER_RANK_BUCKETS as readonly string[]).includes(bucket);
}

/** Parse a stored value into a clean opt-in list: only real
 *  lower buckets, no duplicates, canonical stage order. Any
 *  malformed input parses to an empty list. */
export function parseLowerRankOptIns(raw: string | null): BucketType[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return LOWER_RANK_BUCKETS.filter((b) => parsed.includes(b));
}

export function serializeLowerRankOptIns(list: BucketType[]): string {
  return JSON.stringify(
    LOWER_RANK_BUCKETS.filter((b) => list.includes(b))
  );
}

/** Pure toggle used by the context setter. */
export function withLowerRankOptIn(
  list: BucketType[],
  bucket: BucketType,
  on: boolean
): BucketType[] {
  if (!isLowerRankBucket(bucket)) return [...list];
  if (on) {
    return list.includes(bucket) ? [...list] : [...list, bucket];
  }
  return list.filter((b) => b !== bucket);
}

export function loadLowerRankOptIns(): BucketType[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseLowerRankOptIns(window.localStorage.getItem(LOWER_RANK_KEY));
  } catch {
    return [];
  }
}

export function saveLowerRankOptIns(list: BucketType[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOWER_RANK_KEY,
      serializeLowerRankOptIns(list)
    );
  } catch {
    /* storage unavailable — the opt-in simply won't persist */
  }
}

/**
 * The Refine module's per-bucket decisions (owner, Nov 14,
 * 2026): 'rank' or 'review' per lower bucket, device-local
 * under 'weezer-refine-decisions'. Step2Refine's module reads
 * them to tell "chose Review" from "never asked"; the
 * triage-completion card (page.tsx, Nov 20, 2026) writes them
 * when the fan answers the rank-depth question up front, so
 * the Refine runway never re-asks bucket by bucket.
 */
export type LowerRankDecision = 'rank' | 'review';

const REFINE_DECISIONS_KEY = 'weezer-refine-decisions';

export function loadRefineDecisions(): Partial<
  Record<BucketType, LowerRankDecision>
> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(REFINE_DECISIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const out: Partial<Record<BucketType, LowerRankDecision>> = {};
    for (const b of LOWER_RANK_BUCKETS) {
      const v = parsed?.[b];
      if (v === 'rank' || v === 'review') out[b] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveRefineDecisions(
  next: Partial<Record<BucketType, LowerRankDecision>>
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REFINE_DECISIONS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — the module just asks again */
  }
}

/** Merge one bucket's decision into the stored record and
 *  return the merged record (for state kept beside it). */
export function recordRefineDecision(
  bucket: BucketType,
  decision: LowerRankDecision
): Partial<Record<BucketType, LowerRankDecision>> {
  const next = { ...loadRefineDecisions(), [bucket]: decision };
  saveRefineDecisions(next);
  return next;
}
