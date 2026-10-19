import { BucketType, FULL_SONG_POOL, Song } from '@/app/data/constants';

/**
 * Ranking helpers.
 *
 * A song is only ever Trash when the user explicitly placed it in the Trash
 * bucket. A missing triage_map entry means the song was never ranked —
 * never infer Trash (or any other bucket) from it.
 *
 * A triage_map value of 'unknown' ("Don't Know It") is also NOT a ranking:
 * the user said they can't judge the song, so it is excluded from the
 * master list, bucket derivations, and every score — exactly like a
 * missing entry, but remembered so the UI can show it as dealt with.
 */

/** The five real buckets a triage value can hold (anything else — a
 *  missing entry or 'unknown' — is not a ranking). */
const REAL_BUCKETS: readonly BucketType[] = [
  'banger',
  'slaps',
  'mid',
  'skip',
  'trash',
];

/** True only when the user explicitly triaged this song as Trash. */
export const isExplicitTrash = (
  triageMap: Record<string, BucketType | 'unknown'>,
  songId: string
): boolean => triageMap[songId] === 'trash';

/** True when the user has placed this song in one of the five real
 *  triage buckets. 'unknown' ("Don't Know It") does not count. */
export const isRanked = (
  triageMap: Record<string, BucketType | 'unknown'>,
  songId: string
): boolean => {
  const value = triageMap[songId];
  return value !== undefined && REAL_BUCKETS.indexOf(value as BucketType) !== -1;
};

/**
 * Songs from a master list that the user explicitly ranked, in master-list
 * order. Unranked leftovers (e.g. from older saves) are excluded.
 */
export const getRankedSongs = (
  masterList: Song[],
  triageMap: Record<string, BucketType | 'unknown'>
): Song[] => masterList.filter((song) => isRanked(triageMap, song.id));

/**
 * Songs from a master list that have no triage entry — the user never
 * ranked them. If a screen must show these, use a neutral "Unranked"
 * state, never a Trash badge.
 */
export const getUnrankedSongs = (
  masterList: Song[],
  triageMap: Record<string, BucketType | 'unknown'>
): Song[] => masterList.filter((song) => !isRanked(triageMap, song.id));

/**
 * Sanitize a previously saved master list against the triage map.
 * Drops unranked leftovers from older saves (which used to be mislabeled as
 * Trash), de-duplicates by song id, and preserves the relative order of
 * songs within each bucket — including a completed 206-song ranking.
 *
 * The survivors then pass through sortByBucketBlock (below): a saved
 * list can seat a song outside its bucket's block — its bucket changed
 * in triage while its seat in the stored sequence never moved — and
 * re-seating it here heals the save on load, no user action needed. On
 * an already block-ordered list the sort is an exact no-op.
 */
export const sanitizeMasterList = (
  masterList: Song[],
  triageMap: Record<string, BucketType | 'unknown'>
): Song[] => {
  const seen = new Set<string>();
  const filtered = masterList.filter((song) => {
    if (!isRanked(triageMap, song.id) || seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
  return sortByBucketBlock(filtered, triageMap);
};

/** Bucket order used when appending triaged songs to the master list. */
const BUCKET_ORDER: BucketType[] = ['banger', 'slaps', 'mid', 'skip', 'trash'];

/**
 * Stable bucket-block sort — THE normalization for master-list order.
 * Groups songs into bucket blocks in canonical BUCKET_ORDER by their
 * triageMap bucket, preserving the existing relative order of songs
 * inside each block (the index tiebreak makes the stability explicit
 * instead of relying on the engine's sort being stable). Pure reorder:
 * exactly the songs that go in come out — nothing added, nothing
 * dropped — and an already block-ordered list comes out identical.
 *
 * Every list this runs on is ranked-only by construction (sanitize and
 * reconcile filter first; the context's master list is maintained
 * ranked-only), so each song's triage value is a real bucket here.
 *
 * Applied at all three points where master-list order is established:
 * reconcileMasterList (a triage bucket change re-seats the song in its
 * new block), sanitizeMasterList (older saves heal on load), and the
 * context's normalizeMasterList (Final Review entry). The result is
 * the same list updateAndSyncBucketRanks builds from
 * getDerivedBucketRanks over the same input — grouping is all either
 * one does.
 */
export const sortByBucketBlock = (
  songs: Song[],
  triageMap: Record<string, BucketType | 'unknown'>
): Song[] => {
  const decorated = songs.map((song, index) => ({ song, index }));
  decorated.sort((a, b) => {
    const bucketDiff =
      BUCKET_ORDER.indexOf(triageMap[a.song.id] as BucketType) -
      BUCKET_ORDER.indexOf(triageMap[b.song.id] as BucketType);
    return bucketDiff !== 0 ? bucketDiff : a.index - b.index;
  });
  return decorated.map(({ song }) => song);
};

/**
 * Reconcile a master list with the triage map after a triage assignment.
 * Keeps every song already in the master list that still has a triage entry,
 * in its existing order and de-duplicated; then appends every bucketed song
 * missing from the master list, grouped by bucket (banger, slaps, mid, skip,
 * trash — trash last), in FULL_SONG_POOL order within each bucket.
 *
 * The result then passes through sortByBucketBlock: a song whose bucket
 * just changed is re-seated into its new bucket's block instead of
 * keeping its old seat under a new bucket pill (the Final Review
 * mis-slot). A song moved to an EARLIER bucket lands at the end of that
 * block — its old seat sat behind the whole block — matching the
 * append-to-target semantics of Refine's confirmMoveSong.
 */
export const reconcileMasterList = (
  masterList: Song[],
  triageMap: Record<string, BucketType | 'unknown'>
): Song[] => {
  const seen = new Set<string>();
  const reconciled: Song[] = [];

  for (const song of masterList) {
    if (!isRanked(triageMap, song.id) || seen.has(song.id)) continue;
    seen.add(song.id);
    reconciled.push(song);
  }

  for (const bucket of BUCKET_ORDER) {
    for (const song of FULL_SONG_POOL) {
      if (triageMap[song.id] !== bucket || seen.has(song.id)) continue;
      seen.add(song.id);
      reconciled.push(song);
    }
  }

  return sortByBucketBlock(reconciled, triageMap);
};
