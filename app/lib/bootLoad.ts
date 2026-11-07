/**
 * Boot load decisions — the failure semantics of the rankings
 * boot (Nov 7, 2026 — the post-freeze hardening; findings F2,
 * F3, F4 of the regression audit in REPORT.md).
 *
 * The database-authority boot (app/lib/bootState.ts) says the
 * fetched row is the confirmed state, period. What it could
 * not say — because the fetch result's `error` was never read —
 * is what happens when the fetch itself fails. Three failure
 * shapes, one family (state disagreeing with itself):
 *
 * - F2: a rankings-row (or profile) fetch ERROR was read as
 *   "this account has no rankings": the boot committed an
 *   EMPTY confirmed state, and the user's next edit built on
 *   the empty state and overwrote their real row. A failed
 *   fetch is not an empty account. classifyBootFetch is the
 *   distinction, and it is total: error present → 'failed',
 *   whatever data rode along; data present → 'loaded'; neither
 *   → 'empty' (a genuinely row-less account, which still boots
 *   as a fresh empty account, unchanged).
 * - F3: the save queue races every attempt against a 15s clock
 *   because an iOS-stalled promise "neither resolves nor
 *   rejects"; the boot's awaits had no equivalent bound, so one
 *   hung fetch wedged the boot gate and the loading skeleton
 *   forever. settleWithTimeout is that clock for the boot's
 *   session/fetch phase: same 15s budget class, late settles
 *   ignored, and a timeout routes into the F2 failure state —
 *   the boot ALWAYS settles.
 * - F4: a boot that commits after a mid-boot sign-out
 *   resurrects the account's data as unstamped guest work. The
 *   provider keeps a boot generation (bumped by sign-out and
 *   by a live session's end); the boot captures it at entry
 *   and asks isBootStale immediately before its commit block —
 *   a moved generation means the load belongs to a session
 *   that no longer exists and is discarded whole.
 *
 * The edit block (F2's second half): while an account's load
 * has failed and not yet succeeded, there is no confirmed
 * state for that account, so there is nothing safe to build a
 * save on — editsBlockedForAccount is the gate commitEdit
 * consults before it may enqueue (or stamp the device buffer)
 * for the account.
 *
 * Pure and dependency-free (types aside); every decision here
 * is pinned in the rankings harness (scenarios (r)).
 */

/**
 * How long one boot fetch phase may run before it counts as
 * failed. The rankings sync queue's per-attempt precedent
 * (app/lib/rankingsSync.ts): 15s is far above any healthy
 * whole-row read, short enough to unwedge a session promptly —
 * and here the "failure" it produces is the honest boot-error
 * state with a Try again, not a silent retry loop.
 */
export const BOOT_LOAD_TIMEOUT_MS = 15000;

/** What a boot fetch actually said. */
export type BootFetchClass = 'loaded' | 'empty' | 'failed';

/**
 * Classify one Supabase-style fetch result. THE F2 RULE: an
 * error means the load FAILED — never that the account is
 * empty — even if a data field rode along. Only a clean
 * no-error, no-data result is 'empty' (the account genuinely
 * has no row).
 */
export function classifyBootFetch(args: {
  data: unknown;
  error: unknown;
}): BootFetchClass {
  if (args.error !== null && args.error !== undefined) return 'failed';
  if (args.data !== null && args.data !== undefined) return 'loaded';
  return 'empty';
}

/** The outcome of one timeout-raced await. */
export type TimedSettle<T> =
  | { status: 'value'; value: T }
  | { status: 'error'; error: unknown }
  | { status: 'timeout' };

/**
 * Race a promise against the clock, on injected timers (the
 * rankings queue's attempt pattern, app/lib/rankingsSync.ts).
 * Whichever side settles first wins; the loser is dropped — a
 * late-resolving fetch must not resurrect a boot the timeout
 * already routed to the failure state, and a late rejection is
 * swallowed here rather than surfacing as an unhandled
 * rejection in a dead boot.
 */
export function settleWithTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  timers?: {
    setTimeoutFn?: (fn: () => void, ms: number) => unknown;
    clearTimeoutFn?: (handle: unknown) => void;
  }
): Promise<TimedSettle<T>> {
  const setT: (fn: () => void, ms: number) => unknown =
    timers?.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT: (handle: unknown) => void =
    timers?.clearTimeoutFn ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  return new Promise<TimedSettle<T>>((resolve) => {
    let settled = false;
    let handle: unknown = null;
    const finish = (outcome: TimedSettle<T>) => {
      if (settled) return;
      settled = true;
      if (handle !== null) clearT(handle);
      resolve(outcome);
    };
    handle = setT(() => finish({ status: 'timeout' }), timeoutMs);
    Promise.resolve(promise).then(
      (value) => finish({ status: 'value', value }),
      (error) => finish({ status: 'error', error })
    );
  });
}

/**
 * The F4 staleness decision: a boot may commit only into the
 * generation it was captured in. The generation moves when a
 * session ends (sign-out, or a live session's death in the
 * auth listener); a boot that finds it moved discards its
 * load entirely.
 */
export function isBootStale(
  capturedGeneration: number,
  currentGeneration: number
): boolean {
  return capturedGeneration !== currentGeneration;
}

/**
 * The F2 edit gate: edits (and their saves) for an account are
 * blocked while that account's boot load stands failed — the
 * session holds no confirmed state for it, so anything built
 * would be built on nothing. A different account, a guest
 * (null), or no recorded failure is never blocked by another
 * account's failure.
 */
export function editsBlockedForAccount(
  currentUserId: string | null,
  failedLoadUserId: string | null
): boolean {
  return (
    currentUserId !== null &&
    failedLoadUserId !== null &&
    currentUserId === failedLoadUserId
  );
}
