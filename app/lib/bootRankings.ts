/**
 * Boot-source predicate for rankings recovery (Nov 6, 2026).
 *
 * The lost-move post-mortem: every rankings edit writes a local
 * snapshot (localStorage `weezer_ranker_state`) synchronously and
 * enqueues a debounced database write through rankingsSync. If the
 * page is discarded inside that window — the owner flipping between
 * apps on iOS while the hide flush is still awaiting its session
 * read — the write may never be issued, and the payload dies with
 * the in-memory queue. The snapshot on disk is then the ONLY copy
 * of the newest state.
 *
 * Boot used to throw that copy away: migrateGuestRankingsToUser
 * returns the account row whenever the account has any progress
 * (the Oct 16, 2026 never-overwrite rule), without ever comparing
 * it against the local snapshot. The stale row loaded, and the
 * next edit re-stamped the snapshot with stale-derived state —
 * the move was gone for good.
 *
 * This predicate is the narrow exception that closes the hole
 * without reopening the Oct 16 one. A local snapshot supersedes
 * the account row ONLY when it is provably this account's own
 * newer work:
 *
 * - it carries a user stamp, written only by a session signed in
 *   as that user (guest snapshots carry no stamp; a previous
 *   account's leftovers carry the wrong one), AND
 * - its save time is strictly later than the row's `updated_at`
 *   (both stamps are device-generated `Date` values; the row's is
 *   written by the upsert payload itself), AND
 * - the row actually carries a parseable `updated_at` — with no
 *   trustworthy account stamp, the never-overwrite rule holds.
 *
 * Pure and dependency-free so the rankings harness can replay the
 * exit scenario against it (see harness/rankings-sync-harness.cjs,
 * scenario (d)).
 */
export function localSnapshotSupersedesAccount(args: {
  /** User stamp on the local snapshot (null/absent for guests). */
  localUserId: string | null | undefined;
  /** Save time of the local snapshot (ms since epoch). */
  localSavedAt: number | null | undefined;
  /** The account booting right now. */
  userId: string;
  /** The account row's updated_at (ISO string) if it carries one. */
  accountUpdatedAt: string | null | undefined;
}): boolean {
  if (!args.localUserId || args.localUserId !== args.userId) return false;
  if (
    typeof args.localSavedAt !== 'number' ||
    !Number.isFinite(args.localSavedAt) ||
    args.localSavedAt <= 0
  ) {
    return false;
  }
  if (!args.accountUpdatedAt) return false;
  const accountMs = Date.parse(args.accountUpdatedAt);
  if (!Number.isFinite(accountMs)) return false;
  return args.localSavedAt > accountMs;
}
