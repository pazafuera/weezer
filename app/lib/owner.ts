/**
 * The site owner, and the read shape of his stats page
 * (Nov 7, 2026 — the owner's call: "build the admin page just
 * for my account").
 *
 * OWNER_USER_ID is Mark's account (username 3chordme, verified
 * Nov 7, 2026 via get_public_fan). It is used in exactly two
 * client places — the account drawer's Site stats row and the
 * SiteStats page itself — and ONLY as UI hiding / a bounce.
 * The real gate is server-side: get_event_stats()
 * (supabase/migrations/20261107_event_stats_rpc.sql) is a
 * SECURITY DEFINER function that returns data only when
 * auth.uid() is this id and null for everyone else, and
 * app_events has no client select at all. Nothing sensitive
 * rests on this constant: if it leaked or were edited, the
 * worst case is a page that loads and receives null.
 */

export const OWNER_USER_ID = '02882daa-369f-4b03-aa45-b89bbf569f7f';

/** True when the signed-in user is the site owner. */
export function isOwnerUser(userId: string | null | undefined): boolean {
  return userId === OWNER_USER_ID;
}

/**
 * The get_event_stats() payload, field names mirroring the
 * RPC's JSON exactly (same convention as communityAggregates).
 * by_event always carries all six event names — the RPC builds
 * them from a values list, zeros included — so every count here
 * is a real count, never a stand-in for "missing".
 */
export interface EventCounts {
  today: number;
  last7Days: number;
  allTime: number;
}

export interface EventStatsPayload {
  byEvent: Record<string, EventCounts>;
  sharesByCard: { card: string; count: number }[];
  generatedAt: string;
}

/**
 * The six events, in the page's display order, with the plain
 * labels the page renders. The vocabulary mirrors
 * app/lib/analytics.ts (and the app_events CHECK constraint);
 * the RPC guarantees every one of these keys in by_event.
 */
export const EVENT_STATS_ROWS: { name: string; label: string }[] = [
  { name: 'session_start', label: 'Site visits' },
  { name: 'sort_started', label: 'Sorts started' },
  { name: 'sort_completed', label: 'Sorts finished' },
  { name: 'share_initiated', label: 'Shares' },
  { name: 'game_started', label: 'Games started' },
  { name: 'game_completed', label: 'Games finished' },
];

const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

function parseCounts(v: unknown): EventCounts | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  if (!isNum(c.today) || !isNum(c.last_7_days) || !isNum(c.all_time)) {
    return null;
  }
  return { today: c.today, last7Days: c.last_7_days, allTime: c.all_time };
}

/**
 * Validate an unknown RPC result into an EventStatsPayload, or
 * null when it is not one — a null RPC answer (the server gate
 * saying no), an error shape, a half-built payload. The page
 * treats null as "no numbers to show", never as zeros: a
 * genuinely empty events table comes back as a full payload of
 * real zeros, which validates fine and renders as zeros.
 */
export function parseEventStatsPayload(
  data: unknown
): EventStatsPayload | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!d.by_event || typeof d.by_event !== 'object') return null;
  if (typeof d.generated_at !== 'string') return null;
  if (!Array.isArray(d.shares_by_card)) return null;

  const byEvent: Record<string, EventCounts> = {};
  for (const [name, raw] of Object.entries(
    d.by_event as Record<string, unknown>
  )) {
    const counts = parseCounts(raw);
    if (!counts) return null;
    byEvent[name] = counts;
  }
  // The RPC's contract is all six events, always. A payload
  // missing one is not the RPC's payload — reject it whole
  // rather than letting the page invent a zero for a gap.
  for (const row of EVENT_STATS_ROWS) {
    if (!byEvent[row.name]) return null;
  }

  const sharesByCard: { card: string; count: number }[] = [];
  for (const entry of d.shares_by_card as Record<string, unknown>[]) {
    if (!entry || typeof entry.card !== 'string' || !isNum(entry.count)) {
      return null;
    }
    sharesByCard.push({ card: entry.card, count: entry.count });
  }

  return { byEvent, sharesByCard, generatedAt: d.generated_at };
}
