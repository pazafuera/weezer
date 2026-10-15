import { BucketType, FULL_SONG_POOL, Song } from '@/app/data/constants';

/**
 * Ranking helpers.
 *
 * A song is only ever Trash when the user explicitly placed it in the Trash
 * bucket. A missing triage_map entry means the song was never ranked —
 * never infer Trash (or any other bucket) from it.
 */

/** True only when the user explicitly triaged this song as Trash. */
export const isExplicitTrash = (
  triageMap: Record<string, BucketType>,
  songId: string
): boolean => triageMap[songId] === 'trash';

/** True when the user has placed this song in any triage bucket. */
export const isRanked = (
  triageMap: Record<string, BucketType>,
  songId: string
): boolean => triageMap[songId] !== undefined;

/**
 * Songs from a master list that the user explicitly ranked, in master-list
 * order. Unranked leftovers (e.g. from older saves) are excluded.
 */
export const getRankedSongs = (
  masterList: Song[],
  triageMap: Record<string, BucketType>
): Song[] => masterList.filter((song) => isRanked(triageMap, song.id));

/**
 * Songs from a master list that have no triage entry — the user never
 * ranked them. If a screen must show these, use a neutral "Unranked"
 * state, never a Trash badge.
 */
export const getUnrankedSongs = (
  masterList: Song[],
  triageMap: Record<string, BucketType>
): Song[] => masterList.filter((song) => !isRanked(triageMap, song.id));

/**
 * Sanitize a previously saved master list against the triage map.
 * Drops unranked leftovers from older saves (which used to be mislabeled as
 * Trash), de-duplicates by song id, and preserves the order of every
 * explicitly ranked song — including a completed 206-song ranking.
 */
export const sanitizeMasterList = (
  masterList: Song[],
  triageMap: Record<string, BucketType>
): Song[] => {
  const seen = new Set<string>();
  return masterList.filter((song) => {
    if (!isRanked(triageMap, song.id) || seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
};

/** Bucket order used when appending triaged songs to the master list. */
const BUCKET_ORDER: BucketType[] = ['banger', 'slaps', 'mid', 'skip', 'trash'];

/**
 * Reconcile a master list with the triage map after a triage assignment.
 * Keeps every song already in the master list that still has a triage entry,
 * in its existing order and de-duplicated; then appends every bucketed song
 * missing from the master list, grouped by bucket (banger, slaps, mid, skip,
 * trash — trash last), in FULL_SONG_POOL order within each bucket.
 */
export const reconcileMasterList = (
  masterList: Song[],
  triageMap: Record<string, BucketType>
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

  return reconciled;
};
