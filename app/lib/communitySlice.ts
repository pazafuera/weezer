/**
 * Weezerverse filters + world map — Phase 1 client
 * (spec: files/weezerverse-filters-map-spec-2026-11-05.md).
 *
 * Two RPCs, both SECURITY DEFINER (migration
 * supabase/migrations/20261105_weezerverse_slices.sql):
 *   get_fan_presence()          — place codes with >= 1 ranked fan
 *   get_community_slice_stats() — one filtered cohort's aggregates
 *
 * GRACEFUL DEGRADATION is the contract here: until the owner runs
 * the migration, both RPCs 404. Every fetch in this module resolves
 * to a result object — { status: 'unavailable' } on ANY error,
 * malformed payload, or missing function — and never throws. The
 * page treats 'unavailable' as "the feature does not exist" and
 * renders exactly as it did before Phase 1.
 *
 * Privacy shape (spec §4): a suppressed payload carries no numbers
 * at all. parseSlicePayload refuses to construct a visible payload
 * unless cohortSize is a number >= the floor — a payload that
 * claims visible-but-tiny is treated as suppressed, never rendered.
 */

import { supabase } from '@/utils/supabase';
import { FULL_SONG_POOL, ALBUMS_BY_ID, ALBUM_NAME_TO_ID } from '../data/constants';
import type { Song } from '../data/constants';
import {
  ALBUM_SHRINKAGE_K,
  CONTROVERSY_POLARIZATION_WEIGHT,
  LONE_BANGER_MIN_FAN_SHARE,
  MIN_DISPLAY_SAMPLE,
  MIN_DIVISIVE_RATINGS,
  MIN_DIVISIVE_REACH,
  POLARIZATION_FACTOR,
  SONG_TYPE,
  classifyFanTribe,
  debateWeight,
} from './fanStatsMethodology';
import type {
  CommunitySongStat,
  CommunityStatsPayload,
} from './communityAggregates';

/** The suppression floor, mirrored from the migration. The server
 *  enforces it; the client repeats it as a belt-and-braces check so
 *  a malformed or hand-rolled payload can never print sub-floor
 *  numbers. */
export const SLICE_FLOOR = 5;

/** Fixed generational birth-year bands — the keys the disabled
 *  GenerationalTasteGrid already used, labels per the spec table.
 *  The server derives the band from birth_year; raw birth years
 *  never reach the client. */
export type AgeBandKey = 'boomer' | 'genx' | 'millennial' | 'genz' | 'genalpha';

export const AGE_BANDS: { key: AgeBandKey; label: string }[] = [
  { key: 'boomer', label: 'Boomers' },
  { key: 'genx', label: 'Gen X' },
  { key: 'millennial', label: 'Millennials' },
  { key: 'genz', label: 'Gen Z' },
  { key: 'genalpha', label: 'Gen Alpha' },
];

const AGE_BAND_KEYS = new Set<string>(AGE_BANDS.map((b) => b.key));

export function ageBandLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return AGE_BANDS.find((b) => b.key === key)?.label ?? null;
}

export type SliceSelection = {
  country: string | null;
  state: string | null;
  band: AgeBandKey | null;
};

export const EMPTY_SELECTION: SliceSelection = {
  country: null,
  state: null,
  band: null,
};

export function isFilterActive(sel: SliceSelection): boolean {
  return sel.country !== null || sel.state !== null || sel.band !== null;
}

export type FanPresence = {
  countries: string[];
  states: string[];
};

export type PresenceResult =
  | { status: 'ok'; presence: FanPresence }
  | { status: 'unavailable' };

/** Per-fan album/era point summaries from the slice RPC: 8 numbers,
 *  no identity, no songs. They let computeSliceStats run the
 *  methodology module's own debate-weight and tribe-classification
 *  rules instead of duplicating editorial constants client-side. */
export type SliceFanSummary = {
  blueSum: number;
  blueCount: number;
  pinkSum: number;
  pinkCount: number;
  modernSum: number;
  modernCount: number;
  totalSum: number;
  totalCount: number;
};

export type SlicePayload = CommunityStatsPayload & {
  suppressed: boolean;
  reason?: 'below_floor' | 'none_qualified';
  slice: {
    country: string | null;
    state: string | null;
    band: string | null;
  };
  /** Present only when the slice is visible (server-enforced). */
  cohortSize?: number;
  fanSummaries: SliceFanSummary[];
};

export type SliceResult =
  | { status: 'ok'; payload: SlicePayload }
  | { status: 'unavailable' };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Pure parse of a get_fan_presence response. Any error, null data,
 * or unexpected shape → unavailable. (Harness-tested.)
 */
export function parsePresencePayload(
  data: unknown,
  error: unknown,
): PresenceResult {
  if (error || !data || typeof data !== 'object') {
    return { status: 'unavailable' };
  }
  const d = data as Record<string, unknown>;
  if (!isStringArray(d.countries) || !isStringArray(d.states)) {
    return { status: 'unavailable' };
  }
  return {
    status: 'ok',
    presence: { countries: d.countries, states: d.states },
  };
}

/**
 * Pure parse of a get_community_slice_stats response. Any error,
 * null data, or unexpected shape → unavailable. A payload that is
 * not explicitly suppressed must still prove it passes the floor
 * (numeric cohortSize >= SLICE_FLOOR) before the client treats it
 * as visible. (Harness-tested.)
 */
export function parseSlicePayload(
  data: unknown,
  error: unknown,
): SliceResult {
  if (error || !data || typeof data !== 'object') {
    return { status: 'unavailable' };
  }
  const d = data as Record<string, unknown>;
  if (typeof d.suppressed !== 'boolean') {
    return { status: 'unavailable' };
  }
  if (!Array.isArray(d.songs) || !Array.isArray(d.pairs)) {
    return { status: 'unavailable' };
  }
  const sliceRaw =
    d.slice && typeof d.slice === 'object'
      ? (d.slice as Record<string, unknown>)
      : {};
  const slice = {
    country: typeof sliceRaw.country === 'string' ? sliceRaw.country : null,
    state: typeof sliceRaw.state === 'string' ? sliceRaw.state : null,
    band:
      typeof sliceRaw.band === 'string' && AGE_BAND_KEYS.has(sliceRaw.band)
        ? sliceRaw.band
        : null,
  };
  const fanSummaries = Array.isArray(d.fanSummaries)
    ? (d.fanSummaries as SliceFanSummary[])
    : [];

  if (d.suppressed) {
    // Suppressed is a complete, renderable answer — with no numbers.
    const reason =
      d.reason === 'none_qualified' ? 'none_qualified' : 'below_floor';
    return {
      status: 'ok',
      payload: {
        qualifiedSubmissions: 0,
        methodologyVersion:
          typeof d.methodologyVersion === 'string'
            ? d.methodologyVersion
            : '1.0',
        refreshedAt: null,
        songs: [],
        pairs: [],
        suppressed: true,
        reason,
        slice,
        fanSummaries: [],
      },
    };
  }

  const cohortSize =
    typeof d.cohortSize === 'number' ? d.cohortSize : undefined;
  if (cohortSize === undefined || cohortSize < SLICE_FLOOR) {
    // Claims visible but cannot prove it passes the floor: treat
    // as suppressed, never as numbers.
    return {
      status: 'ok',
      payload: {
        qualifiedSubmissions: 0,
        methodologyVersion:
          typeof d.methodologyVersion === 'string'
            ? d.methodologyVersion
            : '1.0',
        refreshedAt: null,
        songs: [],
        pairs: [],
        suppressed: true,
        reason: 'below_floor',
        slice,
        fanSummaries: [],
      },
    };
  }

  return {
    status: 'ok',
    payload: {
      qualifiedSubmissions:
        typeof d.qualifiedSubmissions === 'number'
          ? d.qualifiedSubmissions
          : cohortSize,
      methodologyVersion:
        typeof d.methodologyVersion === 'string' ? d.methodologyVersion : '1.0',
      refreshedAt: null,
      songs: d.songs as CommunitySongStat[],
      pairs: d.pairs as SlicePayload['pairs'],
      suppressed: false,
      slice,
      cohortSize,
      fanSummaries,
    },
  };
}

export async function fetchFanPresence(): Promise<PresenceResult> {
  try {
    const { data, error } = await supabase.rpc('get_fan_presence');
    return parsePresencePayload(data, error);
  } catch {
    return { status: 'unavailable' };
  }
}

export async function fetchCommunitySlice(
  sel: SliceSelection,
): Promise<SliceResult> {
  try {
    const { data, error } = await supabase.rpc('get_community_slice_stats', {
      p_country: sel.country,
      p_state: sel.country === 'US' ? sel.state : null,
      p_band: sel.band,
    });
    return parseSlicePayload(data, error);
  } catch {
    return { status: 'unavailable' };
  }
}

// ---------------------------------------------------------------------------
// Slice statistics: the FanStats derivations, fed by aggregates.
// ---------------------------------------------------------------------------

type BucketKey = 'banger' | 'slaps' | 'mid' | 'skip' | 'trash';

export type SliceSongMetric = {
  id: string;
  song: Song;
  count: number;
  mean: number;
  sd: number;
  controversy: number;
  pBanger: number;
  pSlaps: number;
  pMid: number;
  pSkip: number;
  pTrash: number;
  reach: number;
  type: string;
  typeLabel: string;
  typeColor: string;
};

/**
 * The shape FanStats renders for its re-cut sections. Field parity
 * with the page's own communityStats object is deliberate — the
 * component reads one or the other through a single seam.
 */
export type SliceStats = {
  totalFans: number;
  submissionsReceived: number;
  enoughForPercentages: boolean;
  hasDebateData: boolean;
  bluePct: number;
  pinkPct: number;
  tribes: {
    name: string;
    pct: number;
    count: number;
    sacred: string;
    heresy: string;
    stroke: string;
    desc: string;
  }[];
  mostLoved?: SliceSongMetric;
  mostDivisive?: SliceSongMetric;
  divisiveTop: SliceSongMetric[];
  hiddenGem?: SliceSongMetric;
  mostRejected?: SliceSongMetric;
  anatomyCategories: {
    id: string;
    title: string;
    desc: string;
    accent: string;
    songs: SliceSongMetric[];
  }[];
  topConsensus: SliceSongMetric[];
  albumLeaderboard: {
    id: string;
    album: string;
    score: number;
    rawMean: number;
    count: number;
  }[];
  loneBangers: {
    id: string;
    album: string;
    song: Song | undefined;
    lift: number;
    songMean: number;
    albumMean: number;
  }[];
  globalTierListRankings: {
    id: string;
    title: string;
    album: string;
    rank: number;
  }[];
  tasteTwin: null;
  genClassicistSong: null;
  genModernistSong: null;
};

const BUCKET_POINTS: Record<BucketKey, number> = {
  banger: 5,
  slaps: 4,
  mid: 3,
  skip: 2,
  trash: 1,
};

/**
 * Compute the slice view of every re-cut FanStats section from a
 * visible (non-suppressed) slice payload. Mirrors the page's own
 * math wherever aggregates allow exact parity:
 *   - Song mean / sd / controversy come from bucket counts — the
 *     same multiset the global path averages, so sd is exact.
 *   - Album leaderboard, debate weights, and tribe classification
 *     run the methodology module's own functions on the payload's
 *     sums and per-fan summaries — identical rules, identical
 *     constants.
 * Two adaptations, both forced by aggregates (no per-fan master
 * lists ship in a slice, by design):
 *   - Community Top 10 ranks by mean score among well-reached
 *     songs instead of master-list percentiles.
 *   - Hidden Gem keeps the global low-reach gate but ranks by
 *     mean score instead of master-list position.
 */
export function computeSliceStats(payload: SlicePayload): SliceStats {
  const totalFans = payload.cohortSize ?? payload.qualifiedSubmissions;
  const statById = new Map<string, CommunitySongStat>();
  for (const s of payload.songs) statById.set(s.songId, s);

  const metrics: SliceSongMetric[] = [];
  const albumL1: Record<
    string,
    { name: string; total: number; count: number }
  > = {};

  for (const song of FULL_SONG_POOL) {
    const st = statById.get(song.id);
    const count = st ? st.ratings : 0;
    const resolvedId =
      song.albumId || ALBUM_NAME_TO_ID[song.album] || 'unknown';
    if (!albumL1[resolvedId]) {
      albumL1[resolvedId] = {
        name: ALBUMS_BY_ID[resolvedId]?.name || song.album,
        total: 0,
        count: 0,
      };
    }
    if (!st || count === 0) continue;
    albumL1[resolvedId].total += st.sum;
    albumL1[resolvedId].count += count;

    const buckets = st.buckets;
    const mean = st.sum / count;
    const sumSq = (Object.keys(BUCKET_POINTS) as BucketKey[]).reduce(
      (acc, k) => acc + buckets[k] * BUCKET_POINTS[k] * BUCKET_POINTS[k],
      0,
    );
    const variance = Math.max(0, sumSq / count - mean * mean);
    const sd = Math.sqrt(variance);

    const pBanger = buckets.banger / count;
    const pSlaps = buckets.slaps / count;
    const pMid = buckets.mid / count;
    const pSkip = buckets.skip / count;
    const pTrash = buckets.trash / count;

    const polarization = POLARIZATION_FACTOR * pBanger * pTrash;
    const controversy = sd * (1 + CONTROVERSY_POLARIZATION_WEIGHT * polarization);

    let type = 'Universally Disliked';
    let typeLabel = 'UNIVERSALLY DISLIKED';
    let typeColor = 'text-slate-500 bg-slate-100';
    if (
      pBanger + pSlaps > SONG_TYPE.lovedPositiveShare &&
      pTrash < SONG_TYPE.lovedMaxTrashShare
    ) {
      type = 'Universally Loved';
      typeLabel = 'UNIVERSALLY LOVED';
      typeColor = 'text-amber-900 bg-amber-400';
    } else if (
      pBanger > SONG_TYPE.dividedMinBangerShare &&
      pTrash > SONG_TYPE.dividedMinTrashShare &&
      pMid < SONG_TYPE.dividedMaxMidShare
    ) {
      type = 'Deeply Divided';
      typeLabel = 'DEEPLY DIVIDED';
      typeColor = 'text-white bg-rose-500';
    } else if (
      pBanger < SONG_TYPE.safeMaxBangerShare &&
      pSlaps + pMid > SONG_TYPE.safePositiveShare &&
      pTrash < SONG_TYPE.safeMaxTrashShare
    ) {
      type = 'Safe Bets';
      typeLabel = 'SAFE BETS';
      typeColor = 'text-blue-900 bg-blue-300';
    } else if (
      pBanger > SONG_TYPE.gemMinBangerShare &&
      pBanger < SONG_TYPE.gemMaxBangerShare &&
      pSkip + pTrash > SONG_TYPE.gemMinNegativeShare
    ) {
      type = 'Hidden Gems';
      typeLabel = 'HIDDEN GEMS';
      typeColor = 'text-indigo-900 bg-indigo-300';
    }

    metrics.push({
      id: song.id,
      song,
      count,
      mean,
      sd,
      controversy,
      pBanger,
      pSlaps,
      pMid,
      pSkip,
      pTrash,
      reach: totalFans > 0 ? count / totalFans : 0,
      type,
      typeLabel,
      typeColor,
    });
  }

  // Album leaderboard — same shrinkage rule as the global path.
  const totalSum = metrics.reduce((a, m) => a + m.mean * m.count, 0);
  const totalCount = metrics.reduce((a, m) => a + m.count, 0);
  const globalPriorMean = totalCount > 0 ? totalSum / totalCount : 0;
  const albumLeaderboard = Object.entries(albumL1)
    .filter(([, d]) => d.count > 0)
    .map(([id, data]) => {
      const rawMean = data.total / data.count;
      const score =
        (data.count / (data.count + ALBUM_SHRINKAGE_K)) * rawMean +
        (ALBUM_SHRINKAGE_K / (data.count + ALBUM_SHRINKAGE_K)) *
          globalPriorMean;
      return { id, album: data.name, score, rawMean, count: data.count };
    })
    .sort((a, b) => b.score - a.score);

  // Eligible pool for the awards / consensus lists — the global
  // path's reach rule (rated by more than 10% of fans).
  const eligible = metrics.filter((m) => m.count > totalFans * 0.1);
  const byMean = [...eligible].sort((a, b) => b.mean - a.mean);

  const mostLoved = byMean[0];
  const divisiveTop = eligible
    .filter(
      (m) =>
        m.id !== mostLoved?.id &&
        m.count >= MIN_DIVISIVE_RATINGS &&
        m.count > totalFans * MIN_DIVISIVE_REACH &&
        m.sd > 0 &&
        m.controversy > 0,
    )
    .sort((a, b) => b.controversy - a.controversy)
    .slice(0, 5);
  const mostDivisive = divisiveTop[0];
  const hiddenGem =
    eligible
      .filter(
        (m) =>
          m.reach <= 0.6 &&
          m.id !== mostLoved?.id &&
          m.id !== mostDivisive?.id,
      )
      .sort((a, b) => b.mean - a.mean)[0] ||
    eligible
      .filter((m) => m.id !== mostLoved?.id && m.id !== mostDivisive?.id)
      .sort((a, b) => a.reach - b.reach)[0];
  const mostRejected = eligible
    .filter(
      (m) =>
        m.id !== mostLoved?.id &&
        m.id !== mostDivisive?.id &&
        m.id !== hiddenGem?.id,
    )
    .sort((a, b) => b.pTrash - a.pTrash)[0];

  // Community Top 10 (slice adaptation — see the header note).
  const topConsensus = byMean.slice(0, 10);

  const globalTierListRankings = [...metrics]
    .filter((m) => m.count > totalFans * 0.1)
    .sort((a, b) => b.mean - a.mean)
    .map((m, idx) => ({
      id: m.song.id,
      title: m.song.title,
      album: m.song.album,
      rank: idx + 1,
    }));

  // Blue vs. Pinkerton + Fan Tribes from the per-fan summaries,
  // running the methodology module's own rules.
  let blueTotalWeight = 0;
  let pinkTotalWeight = 0;
  const tribeCounts = {
    purists: 0,
    cult: 0,
    modernists: 0,
    haters: 0,
    chaos: 0,
  };
  for (const f of payload.fanSummaries) {
    const blueMean = f.blueCount > 0 ? f.blueSum / f.blueCount : 0;
    const pinkMean = f.pinkCount > 0 ? f.pinkSum / f.pinkCount : 0;
    const delta = blueMean - pinkMean;
    const weight = debateWeight(delta);
    if (delta > 0) blueTotalWeight += weight;
    else if (delta < 0) pinkTotalWeight += weight;

    const userMean = f.totalCount > 0 ? f.totalSum / f.totalCount : 3;
    const modernMean = f.modernCount > 0 ? f.modernSum / f.modernCount : 0;
    tribeCounts[
      classifyFanTribe({ userMean, modernMean, bluePinkertonDelta: delta })
    ]++;
  }
  const totalWarWeight = blueTotalWeight + pinkTotalWeight;
  const bluePct =
    totalWarWeight > 0
      ? Math.round((blueTotalWeight / totalWarWeight) * 100)
      : 0;
  const pinkPct = 100 - bluePct;

  const tTotal = Object.values(tribeCounts).reduce((a, b) => a + b, 0) || 1;
  const tribes = [
    { name: 'Blue Album Purists', pct: Math.round((tribeCounts.purists / tTotal) * 100), count: tribeCounts.purists, sacred: 'Buddy Holly', heresy: 'Beverly Hills', stroke: '#0072CE', desc: 'Favor the clean, power-pop perfection of the 1994 debut above all else.' },
    { name: 'Pinkerton Cult', pct: Math.round((tribeCounts.cult / tTotal) * 100), count: tribeCounts.cult, sacred: 'El Scorcho', heresy: 'Island in the Sun', stroke: '#334155', desc: 'Deep devotion to the raw, abrasive, and emotional 1996 sophomore record.' },
    { name: 'Modern Defenders', pct: Math.round((tribeCounts.modernists / tTotal) * 100), count: tribeCounts.modernists, sacred: 'California Kids', heresy: 'Hash Pipe', stroke: '#10b981', desc: 'Champions of post-2010 releases like White, OK Human, and SZNZ.' },
    { name: 'Harsh Critics', pct: Math.round((tribeCounts.haters / tTotal) * 100), count: tribeCounts.haters, sacred: "Say It Ain't So", heresy: 'Most of the catalog', stroke: '#f43f5e', desc: "Extremely difficult to please, handing out 'Trash' and 'Skip' ratings liberally." },
    { name: 'Chaos Agents', pct: Math.round((tribeCounts.chaos / tTotal) * 100), count: tribeCounts.chaos, sacred: 'Pork and Beans', heresy: 'Consensus', stroke: '#8b5cf6', desc: 'Wildly unpredictable tastes that actively defy the overall fan consensus.' },
  ].sort((a, b) => b.pct - a.pct);

  // Lone bangers ("Better Than The Album") follow the slice like
  // Top Albums — their inputs are the same song/album aggregates.
  const bottom4Albums = albumLeaderboard.slice(-4);
  const loneBangers = bottom4Albums
    .map((a) => {
      const albumSongs = metrics.filter((m) => {
        const resolvedId =
          m.song.albumId || ALBUM_NAME_TO_ID[m.song.album] || 'unknown';
        return resolvedId === a.id;
      });
      let best: SliceSongMetric | undefined;
      let maxLift = -999;
      albumSongs.forEach((sm) => {
        if (sm.count > totalFans * LONE_BANGER_MIN_FAN_SHARE) {
          const lift = sm.mean - a.rawMean;
          if (lift > maxLift) {
            maxLift = lift;
            best = sm;
          }
        }
      });
      return {
        id: a.id,
        album: a.album,
        song: best?.song,
        lift: maxLift,
        songMean: best?.mean || 0,
        albumMean: a.rawMean,
      };
    })
    .filter((i) => i.song)
    .sort((a, b) => b.lift - a.lift);

  // Anatomy of a Jam — same classifications and orderings.
  const lovedSongs = metrics.filter((m) => m.type === 'Universally Loved').sort((a, b) => b.mean - a.mean).slice(0, 10);
  const dividedSongs = metrics.filter((m) => m.type === 'Deeply Divided').sort((a, b) => b.controversy - a.controversy).slice(0, 10);
  const safeSongs = metrics.filter((m) => m.type === 'Safe Bets').sort((a, b) => b.pMid - a.pMid).slice(0, 10);
  const cultSongs = metrics.filter((m) => m.type === 'Hidden Gems').sort((a, b) => b.pBanger - a.pBanger).slice(0, 10);
  const dislikedSongs = metrics.filter((m) => m.type === 'Universally Disliked').sort((a, b) => b.pTrash - a.pTrash).slice(0, 10);
  const anatomyCategories = [
    { id: 'loved', title: 'Universally Loved', desc: 'High Banger/Slaps, virtually zero Trash. The undisputed favorites.', accent: '#f59e0b', songs: lovedSongs },
    { id: 'divisive', title: 'Deeply Divided', desc: 'High Banger AND high Trash. Love it or hate it.', accent: '#f43f5e', songs: dividedSongs },
    { id: 'cult', title: 'Hidden Gems', desc: 'Intense praise from a small faction.', accent: '#6366f1', songs: cultSongs },
    { id: 'sleeper', title: 'Safe Bets', desc: 'Heavy concentration in Mid and Slaps. Consistently decent.', accent: '#3b82f6', songs: safeSongs },
    { id: 'hated', title: 'Universally Disliked', desc: 'Overwhelmingly skipped or trashed.', accent: '#64748b', songs: dislikedSongs },
  ].filter((cat) => cat.songs.length > 0);

  return {
    totalFans,
    submissionsReceived: totalFans,
    enoughForPercentages: totalFans >= MIN_DISPLAY_SAMPLE,
    hasDebateData: totalWarWeight > 0,
    bluePct,
    pinkPct,
    tribes,
    mostLoved,
    mostDivisive,
    divisiveTop,
    hiddenGem,
    mostRejected,
    anatomyCategories,
    topConsensus,
    albumLeaderboard,
    loneBangers,
    globalTierListRankings,
    tasteTwin: null,
    genClassicistSong: null,
    genModernistSong: null,
  };
}
