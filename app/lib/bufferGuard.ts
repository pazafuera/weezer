/**
 * Buffer protection (Nov 7, 2026 — durability overhaul, item 3).
 *
 * The stamped local snapshot (localStorage `weezer_ranker_state`)
 * is the recovery buffer of record: when a signed-in boot cannot
 * promote it (the account row wins this time), the buffer is the
 * ONLY copy of the work it holds, and it must stay promotable on
 * a later boot — until a genuine user edit supersedes it.
 *
 * The hazard this guard closes: `syncRankingsToDatabase` is the
 * snapshot's only writer, and not every call to it carries a
 * user edit. The audited non-edit writer is the Final Review
 * entry normalization (context `normalizeMasterList`): it syncs
 * state derived from whatever the boot loaded. After a boot that
 * loaded the account row over an unpromoted buffer, such a write
 * re-stamps the snapshot with row-derived state — the buffer's
 * newer work is demoted below the row forever, quietly, by the
 * act of LOOKING at a screen. (The Nov 7 recovery failure is
 * consistent with this class: two recovery boots did not promote
 * a buffer the session had provably written. The exact field
 * path was not provable from outside the device — which is why
 * the invariant is now enforced structurally and recorded in the
 * save diagnostics, not left to audit alone.)
 *
 * The rule, enforced in the context's single snapshot writer:
 *
 * - Protection ARMS when a signed-in boot loads the account row
 *   while this account's own stamped buffer exists locally with
 *   progress (shouldArmBufferProtection).
 * - While armed, a write that is NOT a genuine edit is SKIPPED
 *   as a snapshot write and as a queue enqueue (decideSnapshot
 *   Write): no re-stamp, no revision bump, no row write from
 *   loaded state. Display-only state updates are unaffected.
 * - A genuine edit writes through: the buffer is superseded by
 *   definition, protection clears, and the edit's revision is
 *   taken past the buffer's own so the device counter stays
 *   monotonic.
 *
 * Pure and dependency-free; the rankings harness pins the
 * decision matrix (scenario (l) part 4).
 */

import type { BootRankingsSource } from './bootRankings';

/**
 * Arm protection when this boot loaded the account row while the
 * device holds THIS account's own stamped buffer with progress —
 * work the boot did not promote and must not let a non-edit
 * write trample. (A promoted buffer needs no protection: the
 * session state IS the buffer. A foreign or guest snapshot is
 * not this account's buffer at all.)
 */
export function shouldArmBufferProtection(args: {
  /** The boot resolution's source. */
  source: BootRankingsSource;
  /** The local snapshot's user stamp (null for guest work). */
  localUserId: string | null | undefined;
  /** The account that booted. */
  userId: string;
  /** The local snapshot holds any rankings progress. */
  localHasProgress: boolean;
}): boolean {
  return (
    args.source === 'account-row' &&
    !!args.localUserId &&
    args.localUserId === args.userId &&
    args.localHasProgress
  );
}

/**
 * May this call to the snapshot writer proceed? While protection
 * is armed, only a genuine user edit may write; every system
 * write (normalization, state pushes of loaded state) skips.
 * Unarmed, everything writes as it always has.
 */
export function decideSnapshotWrite(args: {
  protectionArmed: boolean;
  /** The write carries a genuine user edit from this session. */
  genuineEdit: boolean;
}): 'write' | 'skip' {
  if (args.protectionArmed && !args.genuineEdit) return 'skip';
  return 'write';
}
