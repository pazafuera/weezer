/**
 * Client types for the server-side community aggregates
 * (supabase/migrations/20261016_community_aggregates_PREP.sql).
 *
 * PREP ONLY: the migration has not been run and nothing reads this yet.
 * When it lands, FanStats switches from get_community_rankings (raw
 * per-fan rows) to get_community_stats() and these types become the
 * contract. Field names mirror the RPC's JSON exactly.
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
