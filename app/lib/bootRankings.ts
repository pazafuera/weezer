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
 *
 * Nov 7, 2026 — the database-led boot: resolveBootRankings (below)
 * is the ONE precedence decision every signed-in boot runs. The
 * account row is the authority; the local snapshot participates
 * only in the two narrow roles this module defines — the stamped
 * unsent-edits buffer above, and (unstamped) as guest work that
 * merges per song or migrates into an empty account. The Oct 16
 * protection survives as a property of the matrix: a guest's local
 * progress never overwrites an account at boot — the merge is an
 * explicit sign-in event in the caller, not a boot side effect.
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

/** What the caller knows about the account row at boot. */
export interface BootAccountRowInfo {
  /** The row carries at least one real bucket. 'unknown'
   *  ("Don't Know It") marks alone are NOT progress to protect —
   *  the same line the migration has always drawn. */
  hasRealProgress: boolean;
  /** The row's updated_at (ISO string) if it carries one. */
  updatedAt: string | null | undefined;
}

/** What the caller knows about the local snapshot at boot. */
export interface BootLocalSnapshotInfo {
  /** The snapshot holds any triage entries or master-list songs. */
  hasProgress: boolean;
  /** User stamp on the snapshot (null/absent for guest work). */
  userId: string | null | undefined;
  /** Save time of the snapshot (ms since epoch), if stamped. */
  savedAt: number | null | undefined;
}

/** Where a signed-in boot loads its rankings from. */
export type BootRankingsSource =
  /** The account row, untouched. The database leads. */
  | 'account-row'
  /** The local snapshot: this account's own stamped buffer
   *  (recovery / row recreation), or guest work migrating into an
   *  account with nothing real to protect. */
  | 'local-snapshot'
  /** Per-song merge of unstamped local work into the account row
   *  (the row wins wherever it has spoken). The merged state
   *  persists via the normal save path, never a boot write. */
  | 'merged'
  /** Nothing to load: no row, and no local state this account may
   *  claim (e.g. only another account's buffer is on the device). */
  | 'none';

export interface BootRankingsResolution {
  source: BootRankingsSource;
  /** Upsert the loaded state to the account row as part of boot.
   *  True only for 'local-snapshot' (buffer heal / first
   *  migration); the merge deliberately persists later, through
   *  the ordinary sync queue, like any other edit. */
  healRow: boolean;
}

/**
 * The signed-in boot precedence, whole:
 *
 * - No usable local state → the row (or nothing).
 * - The snapshot is THIS account's stamped buffer → it loads (and
 *   heals the row) when the account has nothing real yet, or when
 *   the predicate proves it newer than the row; otherwise the row
 *   stands. A stamp-less, older, or equal-time buffer NEVER
 *   competes with the row.
 * - The snapshot is ANOTHER account's stamped buffer → it never
 *   touches this account: the row stands, or nothing loads.
 * - The snapshot is unstamped guest/legacy work → against an
 *   account with real rankings it merges per song ('merged');
 *   against an account with nothing real to protect it migrates
 *   in wholesale, as guest picks always have.
 */
export function resolveBootRankings(args: {
  /** The account booting right now. */
  userId: string;
  /** The fetched account row, or null when the account has none. */
  account: BootAccountRowInfo | null;
  /** The parsed local snapshot, or null when there is none. */
  local: BootLocalSnapshotInfo | null;
}): BootRankingsResolution {
  const { userId, account, local } = args;
  const accountRow: BootRankingsResolution = {
    source: 'account-row',
    healRow: false,
  };
  const none: BootRankingsResolution = { source: 'none', healRow: false };

  if (!local || !local.hasProgress) return account ? accountRow : none;

  if (local.userId) {
    if (local.userId !== userId) return account ? accountRow : none;
    // This account's own stamped buffer.
    if (!account || !account.hasRealProgress) {
      return { source: 'local-snapshot', healRow: true };
    }
    return localSnapshotSupersedesAccount({
      localUserId: local.userId,
      localSavedAt: local.savedAt,
      userId,
      accountUpdatedAt: account.updatedAt,
    })
      ? { source: 'local-snapshot', healRow: true }
      : accountRow;
  }

  // Unstamped guest/legacy work.
  if (account && account.hasRealProgress) {
    return { source: 'merged', healRow: false };
  }
  return { source: 'local-snapshot', healRow: true };
}
