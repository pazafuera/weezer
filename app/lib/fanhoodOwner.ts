/**
 * Fanhood device-record ownership — the reconcile decision, as
 * a pure function (Nov 7, 2026).
 *
 * THE BUG THIS FIXES. The device fanhood record (localStorage
 * 'weezer-lore-best') carried no owner. The account sync
 * (app/lib/fanhoodSync.ts) merges that record into ANY account
 * that signs in on the device and upserts the merge to the
 * account's row — by design for a guest who plays and then
 * signs up, but indiscriminate on a shared device: the owner
 * signed in with a test account on his own phone and the test
 * account absorbed his primary account's 13,225-point record
 * permanently (it then showed in every browser, and the
 * leaderboard carried the score under both accounts).
 *
 * THE MODEL. The device record belongs to somebody, and the
 * sync keeps a per-account parking lot:
 *
 *   - The STAMP ('weezer-lore-owner') names the user id the
 *     ACTIVE device record belongs to. Absent = a guest or
 *     legacy record, owned by nobody yet. The stamp is device
 *     bookkeeping only: it lives in its own key and is never
 *     written into the record, its serialization, or anything
 *     sent to the database.
 *   - A PARKED record waits under 'weezer-lore-best:acct:<id>'
 *     while another account is active on the device.
 *
 * On a reconcile for account U, the planner below decides the
 * storage shuffle; fanhoodSync executes it INSIDE its promise-
 * chain task (the F5 serialization discipline), before the
 * ordinary merge reads the device record:
 *
 *   - stamp === U      → nothing to shuffle; merge as always.
 *   - stamp absent     → merge as always, then the record is
 *     U's: claim the stamp. (This is also the legacy path —
 *     the first account to reconcile after this ships claims
 *     the unstamped record, which is exactly the owner's own
 *     record on his own phone.)
 *   - stamp === V ≠ U  → park the active record under V's slot
 *     FIRST (copy, verified, before anything replaces it),
 *     then put U's own record in the active seat: U's parked
 *     slot restored if one waits, otherwise the seat starts
 *     empty and the ordinary merge fills it from U's account
 *     row. The stamp moves to U. V's games never enter U's
 *     row, U's session view, or any upsert for U.
 *
 * Sign-out moves nothing: the active record stays, stamped,
 * and the signed-out surfaces keep showing it (the owner's
 * accepted posture) — it just can't be absorbed by the next
 * account anymore.
 *
 * Everything decidable without a browser is decided here and
 * pinned in the lore harness; the storage shuffling itself
 * (reads, verified writes, the fallbacks) lives in
 * fanhoodSync.
 */

/** localStorage key naming the account the ACTIVE device
 *  fanhood record belongs to (absent = guest/legacy record). */
export const FANHOOD_OWNER_STAMP_KEY = 'weezer-lore-owner';

/** The parking slot for an account's device fanhood record
 *  while another account is active on this device. */
export function fanhoodSlotKey(userId: string): string {
  return `weezer-lore-best:acct:${userId}`;
}

export interface FanhoodOwnershipFacts {
  /** The stamp on the device: the user id the active record
   *  belongs to, or null when no stamp is stored (a guest or
   *  legacy record). An empty string reads as absent. */
  stamp: string | null;
  /** The account reconciling now; null for a guest session. */
  accountId: string | null;
  /** A parked record waits for the reconciling account. */
  hasParkedSlot: boolean;
  /** An active device record exists at all. (False when the
   *  stamp names an owner whose record has since been wiped
   *  by the store's own legacy normalization.) */
  hasActiveRecord: boolean;
}

/**
 * One step of the ownership shuffle, executed in plan order.
 * 'park-active' copies before anything replaces: the wiring
 * verifies the parked copy reads back before a later step is
 * allowed to touch the active seat, and any failed step aborts
 * the shuffle into the plain merge — a failure can never lose
 * a record.
 */
export type FanhoodOwnershipStep =
  | 'park-active'
  | 'restore-slot'
  | 'clear-active'
  | 'claim-stamp'
  | 'merge';

/**
 * The reconcile plan for one account on this device. 'merge'
 * is always the last step when present: it is the ordinary
 * fanhoodSync merge, run against whatever the shuffle left in
 * the active seat. A guest (no account) gets an empty plan —
 * guests reconcile nothing and own nothing.
 */
export function planFanhoodReconcile(facts: FanhoodOwnershipFacts): {
  steps: FanhoodOwnershipStep[];
} {
  const accountId = facts.accountId ? facts.accountId : null;
  if (!accountId) return { steps: [] };
  const stamp = facts.stamp ? facts.stamp : null;
  if (stamp === accountId) return { steps: ['merge'] };
  if (stamp === null) return { steps: ['claim-stamp', 'merge'] };
  // The active record belongs to a different account. Park it
  // under its owner's slot before the seat changes hands.
  const steps: FanhoodOwnershipStep[] = [];
  if (facts.hasActiveRecord) steps.push('park-active');
  if (facts.hasParkedSlot) {
    steps.push('restore-slot');
  } else if (facts.hasActiveRecord) {
    steps.push('clear-active');
  }
  steps.push('claim-stamp', 'merge');
  return { steps };
}
