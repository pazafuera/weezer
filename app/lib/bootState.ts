/**
 * Boot state resolution for the database-authority rankings model
 * (Nov 7, 2026 — the simplification; design in REPORT.md, "the
 * Photograph resurrection" addendum, Section 2).
 *
 * The owner's question — "why aren't we writing and reading from
 * the database instead of messing with browser sessions?" — named
 * the real flaw: a signed-in user had up to three copies of the
 * rankings (the database row, the context's state variables, the
 * stamped local snapshot), and every incident on record (Oct 22,
 * Nov 6, the Nov 7 wedge, the Photograph resurrection) was a
 * reconciliation failure between copies, or a machine built to
 * reconcile them failing at a new seam. The overhaul's machinery
 * — the boot resolver with its revision/timestamp promotion
 * predicates, the heal writes, the buffer guard — is deleted by
 * this design, not patched. What remains is small enough to state
 * whole:
 *
 * - THE ROW IS THE ONLY AUTHORITY. A signed-in boot fetches the
 *   row; that is the confirmed state, period. No promotion, no
 *   heal, no revision comparison, no clock predicate — this
 *   module makes NO write decision at all, because boot never
 *   writes.
 * - THE DEVICE COPY HAS TWO JOBS ONLY. (a) The guest store: no
 *   account, the device is the authority (unchanged, handled by
 *   the no-session load — not this module). (b) The unsent-
 *   changes buffer: written on every signed-in edit, CLEARED on
 *   the confirmed write of that state, so its presence means
 *   "unconfirmed" by construction.
 * - A buffer present at a signed-in boot is HELD, never promoted:
 *   the row loads as the confirmed state; the buffer becomes the
 *   pending state — the session's effective state is the pending
 *   state when one is held (the user's unsent work is what they
 *   see), the save indicator says the work is on this device
 *   only, and the buffer reaches the row only inside the user's
 *   next edit (built on the effective state) or not at all. It
 *   can never silently overwrite the row, because nothing writes
 *   at boot.
 * - Guest work found at a sign-in boot (an unstamped snapshot)
 *   gets the same treatment, through the one reconciliation that
 *   has never hurt anyone: the per-song guest merge
 *   (app/lib/guestMerge.ts), whose result the caller passes in as
 *   `guestCandidate`. Against an account with nothing real, the
 *   candidate is the guest state itself. Either way it is HELD
 *   as pending — the merge produces the session's first pending
 *   edit, not a boot write.
 * - A candidate that already EQUALS the row (the keepalive flush
 *   landed before the page died, but the document never lived to
 *   clear the buffer) is discarded: presence meant unconfirmed,
 *   and equality proves this one confirmed. Equality is content,
 *   not metadata: same triage entries, same master-list id
 *   sequence (embedded song metadata is catalog-refreshed at
 *   load and is not identity).
 * - ANOTHER account's stamped buffer is ignored entirely — it is
 *   that account's unsent work, not this one's, and it never
 *   becomes this session's pending state.
 *
 * The upgrade boot (devices holding overhaul-era snapshots
 * stamped on every edit, confirmed or not) is exactly the
 * general rule above: load the row, hold any own snapshot as
 * pending, never auto-write it. No special case exists because
 * none is needed — the unsafe outcomes of the old world
 * (promotion, heal) are not operations this design performs.
 *
 * Pure and dependency-free (types aside) so the rankings harness
 * pins the whole matrix (scenarios (d) and (g)).
 */
import type { BucketType, Song } from '../data/constants';

/** One triage entry: a real bucket, or 'unknown' ("Don't Know It"). */
export type TriageValueLike = BucketType | 'unknown';

/**
 * The ONE rankings state object. Signed-in session state is a
 * single value of this shape; `bucketRanks` is derived from it
 * at render (getDerivedBucketRanks in the context) and is never
 * a state variable again — the map/master disagreement that
 * defined the Photograph incident is unrepresentable when every
 * edit commits one of these, whole.
 */
export interface RankingsStateData {
  triageMap: Record<string, TriageValueLike>;
  masterList: Song[];
}

export const EMPTY_RANKINGS_STATE: RankingsStateData = {
  triageMap: {},
  masterList: [],
};

/** Any triage entries or master-list songs at all. */
export function rankingsStateHasProgress(
  state: RankingsStateData
): boolean {
  return (
    Object.keys(state.triageMap).length > 0 || state.masterList.length > 0
  );
}

/**
 * Content equality for rankings states: same triage entries,
 * same master-list id sequence. Embedded song fields (title,
 * album, year) are catalog-owned copies refreshed at load, so
 * they are deliberately not part of identity.
 */
export function rankingsStatesEqual(
  a: RankingsStateData,
  b: RankingsStateData
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a.triageMap);
  const bKeys = Object.keys(b.triageMap);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a.triageMap[key] !== b.triageMap[key]) return false;
  }
  if (a.masterList.length !== b.masterList.length) return false;
  for (let i = 0; i < a.masterList.length; i++) {
    if (a.masterList[i].id !== b.masterList[i].id) return false;
  }
  return true;
}

/** What became of the device copy at this boot. */
export type BootBufferOutcome =
  /** No local candidate (or an empty one): nothing held. */
  | 'none'
  /** This account's own stamped buffer, divergent from the row:
   *  held as the pending state. */
  | 'held'
  /** Unstamped guest work (or its per-song merge with the row):
   *  held as the pending state — the session's first pending
   *  edit, not a boot write. */
  | 'guest-held'
  /** A candidate that already equals the row: confirmed by
   *  content, discarded — nothing is pending. */
  | 'identical'
  /** Another account's stamped buffer: ignored entirely. */
  | 'foreign';

export interface BootStateResolution {
  /** The account row, sanitized — the authority, always. (The
   *  empty state when the account has no row.) */
  confirmed: RankingsStateData;
  /** The held buffer state, or null. When present it is the
   *  session's effective state and the row stays untouched
   *  until a save confirms new work. */
  pending: RankingsStateData | null;
  buffer: BootBufferOutcome;
}

/**
 * The signed-in boot decision, whole. There is deliberately no
 * write instruction in the result: boot never writes. The row
 * is confirmed; a qualifying device copy is held as pending;
 * stamps (userId aside — whose work is this?) are never
 * consulted: savedAt and the overhaul-era revision field are
 * not inputs, so no clock and no counter can strand or promote
 * anything here.
 */
export function resolveBootState(args: {
  /** The account booting right now. */
  userId: string;
  /** The fetched account row as a state, or null when the
   *  account has none. */
  row: RankingsStateData | null;
  /** The parsed device copy, or null when there is none. */
  snapshot: (RankingsStateData & { userId?: string | null }) | null;
  /**
   * For an UNSTAMPED snapshot only: the state the caller wants
   * held — the per-song merge of the guest work into the row,
   * or the guest state itself when the account has nothing real
   * to protect. Ignored for stamped snapshots.
   */
  guestCandidate?: RankingsStateData | null;
}): BootStateResolution {
  const confirmed = args.row ?? EMPTY_RANKINGS_STATE;
  const snap = args.snapshot;
  if (!snap || !rankingsStateHasProgress(snap)) {
    return { confirmed, pending: null, buffer: 'none' };
  }

  if (snap.userId) {
    if (snap.userId !== args.userId) {
      return { confirmed, pending: null, buffer: 'foreign' };
    }
    const candidate: RankingsStateData = {
      triageMap: snap.triageMap,
      masterList: snap.masterList,
    };
    if (args.row && rankingsStatesEqual(candidate, args.row)) {
      return { confirmed, pending: null, buffer: 'identical' };
    }
    return { confirmed, pending: candidate, buffer: 'held' };
  }

  // Unstamped: guest work arriving at a sign-in. The caller
  // composed the candidate (merge, or the work itself); an
  // empty candidate means the merge found nothing to hold.
  const candidate =
    args.guestCandidate ??
    { triageMap: snap.triageMap, masterList: snap.masterList };
  if (!rankingsStateHasProgress(candidate)) {
    return { confirmed, pending: null, buffer: 'none' };
  }
  if (args.row && rankingsStatesEqual(candidate, args.row)) {
    return { confirmed, pending: null, buffer: 'identical' };
  }
  return { confirmed, pending: candidate, buffer: 'guest-held' };
}

/** The state the session shows and edits build on. */
export function effectiveRankingsState(
  resolution: BootStateResolution
): RankingsStateData {
  return resolution.pending ?? resolution.confirmed;
}
