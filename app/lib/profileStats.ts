/**
 * Pure derivations for the public profile page (/u/[username]),
 * computed from the fan's own get_public_fan payload — their
 * master_list (in rank order) and triage_map. No fetches, no React:
 * the page renders from these, and the same functions are what the
 * profile verification script runs against a real payload.
 *
 * Sources of truth, kept in step by hand:
 * - Top tier = the songs bucketed 'banger' or 'slaps', in master
 *   order — the page's own Top-10 derivation, and Step4Wrapped's
 *   explicitlyRankedSongs.
 * - Era shares = the Sweater Thread's "Weezer Era" computation
 *   (Step4Wrapped): top-tier songs weighted 1/√rank, canonical ERAS
 *   year ranges from EraDnaCard. The Era DNA card used to run its
 *   own coverage blend instead — for a complete rater that
 *   degenerated to the catalog's own shape and stopped describing
 *   the fan, and the card could crown a different era than the
 *   Thread for the same fan. Since Nov 6 the card consumes
 *   eraShares too (owner ruling), so all three surfaces agree.
 * - Era bar colors = EraDnaCard's POSTER_ERA_COLORS, the poster
 *   system's brighter fills.
 * - Top album = the Tribe card's dominant-album method
 *   (TribeBadgeCard's dominantAlbumId): the album with the most
 *   top-tier songs, first in rank order winning ties.
 */
import type { BucketType, Song } from '@/app/data/constants';
import {
  ALBUMS_BY_ID,
  ALBUM_NAME_TO_ID,
  BUCKET_CONFIG,
  FULL_SONG_POOL,
} from '@/app/data/constants';

export const PROFILE_BUCKET_ORDER: BucketType[] = [
  'banger',
  'slaps',
  'mid',
  'skip',
  'trash',
];

/** Segment/legend colors for the bucket breakdown bar (the mock's
 *  Tailwind-400 fills, one per bucket in BUCKET_CONFIG order). */
export const PROFILE_BUCKET_COLORS: Record<BucketType, string> = {
  banger: '#34d399',
  slaps: '#60a5fa',
  mid: '#fbbf24',
  skip: '#fb923c',
  trash: '#fb7185',
};

const REAL_BUCKETS: ReadonlySet<string> = new Set(PROFILE_BUCKET_ORDER);

/** A song counts as ranked when it carries one of the five real
 *  buckets — 'unknown' ("Don't Know It") and missing entries are
 *  not rankings. */
export function isRankedBucket(
  bucket: string | undefined,
): bucket is BucketType {
  return bucket !== undefined && REAL_BUCKETS.has(bucket);
}

/** The catalog size every coverage figure is measured against. */
export function catalogTotal(): number {
  return FULL_SONG_POOL.length;
}

/** Top-tier songs (Banger + Lowkey Slaps) in master/rank order. */
export function topTierSongs(
  master: Song[],
  triage: Record<string, BucketType>,
): Song[] {
  return master.filter(
    (s) => triage[s.id] === 'banger' || triage[s.id] === 'slaps',
  );
}

/** How many of the fan's master-list songs carry a real bucket. */
export function rankedCount(
  master: Song[],
  triage: Record<string, BucketType>,
): number {
  return master.filter((s) => isRankedBucket(triage[s.id])).length;
}

export function bucketCounts(
  master: Song[],
  triage: Record<string, BucketType>,
): Record<BucketType, number> {
  const counts: Record<BucketType, number> = {
    banger: 0,
    slaps: 0,
    mid: 0,
    skip: 0,
    trash: 0,
  };
  for (const s of master) {
    const b = triage[s.id];
    if (isRankedBucket(b)) counts[b] += 1;
  }
  return counts;
}

export interface ProfileEraShare {
  key: string;
  /** Canonical era name, e.g. 'The Purist Era' (ERAS in EraDnaCard). */
  name: string;
  /** Canonical year label, e.g. '1994–1996'. */
  label: string;
  /** Poster bar fill (EraDnaCard's POSTER_ERA_COLORS). */
  color: string;
  pct: number;
}

const PROFILE_ERAS: {
  key: string;
  name: string;
  label: string;
  color: string;
  min: number;
  max: number;
}[] = [
  { key: 'blue', name: 'The Purist Era', label: '1994–1996', color: '#0B6DAD', min: 1994, max: 1996 },
  { key: 'y2k', name: 'Y2K Weezer', label: '2001–2005', color: '#C6D92D', min: 2001, max: 2005 },
  { key: 'red', name: 'The Red Era', label: '2008–2010', color: '#F23A2E', min: 2008, max: 2010 },
  { key: 'comeback', name: 'The Comeback', label: '2014–2019', color: '#F6CD5F', min: 2014, max: 2019 },
  { key: 'new', name: 'New Horizons', label: '2021+', color: '#8A44F2', min: 2021, max: 9999 },
];

/**
 * The Thread's rank-weighted era shares: each top-tier song adds
 * 1/√(its rank within the top tier) to its era; shares are the
 * rounded percentages, sorted heaviest first (ties keep canonical
 * era order, as the Thread's sort does). Gap-year songs (1997–2000,
 * 2006–07, 2011–13, 2020) belong to no era, exactly as in ERAS.
 *
 * The parameter is the minimal structural shape (only `year` is
 * read) so the Era DNA card can pass its ShareSong top tier
 * straight in — one implementation for the Thread, the profile
 * page, and the card (Nov 6). The computation is unchanged.
 */
export function eraShares(topTier: readonly { year: number }[]): ProfileEraShare[] {
  const weights = new Map<string, number>(PROFILE_ERAS.map((e) => [e.key, 0]));
  let total = 0;
  topTier.forEach((s, idx) => {
    const w = 1 / Math.sqrt(idx + 1);
    total += w;
    const era = PROFILE_ERAS.find((e) => s.year >= e.min && s.year <= e.max);
    if (era) weights.set(era.key, (weights.get(era.key) ?? 0) + w);
  });
  return PROFILE_ERAS.map((e) => ({
    key: e.key,
    name: e.name,
    label: e.label,
    color: e.color,
    pct: total > 0 ? Math.round(((weights.get(e.key) ?? 0) / total) * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);
}

export interface TopAlbumFact {
  albumId: string;
  name: string;
  /** Top-tier songs from this album. */
  count: number;
  /** The fan's whole top tier, the count's denominator. */
  topCount: number;
}

/** The Tribe card's dominant-album method over the top tier. */
export function dominantTopAlbum(topTier: Song[]): TopAlbumFact | null {
  if (topTier.length === 0) return null;
  const counts = new Map<string, { name: string; count: number }>();
  for (const s of topTier) {
    const id = s.albumId || ALBUM_NAME_TO_ID[s.album] || 'unknown';
    const entry = counts.get(id) ?? {
      name: ALBUMS_BY_ID[id]?.name || s.album,
      count: 0,
    };
    entry.count += 1;
    counts.set(id, entry);
  }
  let bestId: string | null = null;
  let bestCount = 0;
  counts.forEach((entry, id) => {
    if (entry.count > bestCount) {
      bestId = id;
      bestCount = entry.count;
    }
  });
  if (!bestId) return null;
  return {
    albumId: bestId,
    name: counts.get(bestId)!.name,
    count: bestCount,
    topCount: topTier.length,
  };
}

export interface ProfileListGroup {
  key: string;
  /** Group heading, e.g. 'BANGER' or 'DON'T KNOW IT'. */
  label: string;
  songs: { song: Song; rank: number }[];
}

/**
 * The full list, grouped for the profile's expandable sections:
 * the five bucket blocks in order (the master list is bucket-block
 * ordered, so each block's ranks are contiguous), then any
 * 'unknown' ("Don't Know It") songs, then any songs with no bucket
 * at all. Ranks are the songs' true positions in the master list.
 * Empty groups are omitted.
 */
export function listGroups(
  master: Song[],
  triage: Record<string, BucketType>,
): ProfileListGroup[] {
  const byBucket = new Map<string, { song: Song; rank: number }[]>();
  master.forEach((song, i) => {
    const b = triage[song.id] as string | undefined;
    const key = isRankedBucket(b) ? b : b === 'unknown' ? 'unknown' : 'unranked';
    const arr = byBucket.get(key) ?? [];
    arr.push({ song, rank: i + 1 });
    byBucket.set(key, arr);
  });
  const groups: ProfileListGroup[] = [];
  for (const b of PROFILE_BUCKET_ORDER) {
    const songs = byBucket.get(b);
    if (songs && songs.length > 0) {
      groups.push({
        key: b,
        label: BUCKET_CONFIG[b].label.toUpperCase(),
        songs,
      });
    }
  }
  const unknown = byBucket.get('unknown');
  if (unknown && unknown.length > 0) {
    groups.push({ key: 'unknown', label: "DON'T KNOW IT", songs: unknown });
  }
  const unranked = byBucket.get('unranked');
  if (unranked && unranked.length > 0) {
    groups.push({ key: 'unranked', label: 'NOT YET RANKED', songs: unranked });
  }
  return groups;
}

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
];

/**
 * The era section's footnote fact: how many of the fan's Top 10
 * songs fall in their heaviest era. Returns null when fewer than
 * two do — a one-song overlap isn't a pattern worth printing.
 * The era name reads as an adjective ('The Purist Era' → 'Purist Era').
 */
export function topEraTop10Note(
  top10: Song[],
  shares: ProfileEraShare[],
): { count: number; countWord: string; eraAdjective: string } | null {
  if (top10.length === 0 || shares.length === 0) return null;
  const top = shares[0];
  const era = PROFILE_ERAS.find((e) => e.key === top.key);
  if (!era) return null;
  const count = top10.filter(
    (s) => s.year >= era.min && s.year <= era.max,
  ).length;
  if (count < 2) return null;
  return {
    count,
    countWord: NUMBER_WORDS[count] ?? String(count),
    eraAdjective: top.name.replace(/^The /, ''),
  };
}
