/**
 * Client types + payload validation for the server-side
 * community aggregates
 * (supabase/migrations/20261016_community_aggregates_PREP.sql).
 *
 * The switch (Nov 7, Build 5): the context's community fetch
 * tries get_community_stats() FIRST and Fan Stats renders from
 * this payload when it answers; the raw-rows path
 * (get_community_rankings) remains as the live fallback for
 * when the RPC is missing or errors — which is every session
 * until the owner runs the migration. Field names mirror the
 * RPC's JSON exactly.
 */

export type CommunitySongStat = {
  songId: string;
  ratings: number;
  sum: number;
  buckets: {
    banger: number;
    slaps: number;
    mid: number;
    skip: number;
    trash: number;
  };
};

export type CommunityPairStat = {
  a: string;
  b: string;
  coLoved: number;
};

export type CommunityStatsPayload = {
  /** Submissions that passed the >= 10 valid-ratings rule. */
  qualifiedSubmissions: number;
  methodologyVersion: string;
  refreshedAt: string | null;
  songs: CommunitySongStat[];
  pairs: CommunityPairStat[];
};

const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * Validate an unknown RPC result into a CommunityStatsPayload,
 * or null when it is not one (missing function error shapes,
 * null data, a half-built payload). The switch treats null as
 * "the aggregates door is not open" and falls back to rows —
 * a malformed payload must never reach the stats computation.
 * Song entries validate fully (every count the computation
 * reads); a single bad entry rejects the whole payload rather
 * than silently skewing one song's numbers.
 */
export function parseCommunityStatsPayload(
  data: unknown
): CommunityStatsPayload | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isNum(d.qualifiedSubmissions)) return null;
  if (!Array.isArray(d.songs) || !Array.isArray(d.pairs)) return null;
  for (const s of d.songs as Record<string, unknown>[]) {
    if (!s || typeof s.songId !== 'string') return null;
    if (!isNum(s.ratings) || !isNum(s.sum)) return null;
    const b = s.buckets as Record<string, unknown> | null;
    if (
      !b ||
      !isNum(b.banger) ||
      !isNum(b.slaps) ||
      !isNum(b.mid) ||
      !isNum(b.skip) ||
      !isNum(b.trash)
    ) {
      return null;
    }
  }
  for (const p of d.pairs as Record<string, unknown>[]) {
    if (!p || typeof p.a !== 'string' || typeof p.b !== 'string') return null;
    if (!isNum(p.coLoved)) return null;
  }
  return {
    qualifiedSubmissions: d.qualifiedSubmissions,
    methodologyVersion:
      typeof d.methodologyVersion === 'string' ? d.methodologyVersion : '1.0',
    refreshedAt: typeof d.refreshedAt === 'string' ? d.refreshedAt : null,
    songs: d.songs as CommunitySongStat[],
    pairs: d.pairs as CommunityPairStat[],
  };
}
