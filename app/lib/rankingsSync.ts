/**
 * Serialized rankings sync queue.
 *
 * Why this exists (Oct 22, 2026 — the partial-save bug): the old sync
 * fired a debounced whole-row upsert with no in-flight guard and
 * never inspected the result. Two flushes could be on the wire at
 * once carrying different snapshots of the rankings; whichever
 * landed LAST won, so an older snapshot reverting a newer one was
 * routine on slow networks — the user would move a burst of songs
 * between buckets, see them correct in-session, and find some of
 * them back in their old buckets after the next app load. Failures
 * were silent on top of that: supabase-js resolves (does not throw)
 * on HTTP errors, the returned `error` was never read, and the
 * pending payload had already been discarded.
 *
 * This queue is the whole fix at the scheduling layer:
 *
 * - SINGLE-FLIGHT + COALESCE-TO-LATEST: at most one send is ever in
 *   flight. Edits that arrive during a send collapse into one
 *   follow-up send of the newest payload. An older payload can
 *   therefore never land after a newer one.
 * - THE PAYLOAD IS NEVER DROPPED BEFORE SUCCESS: the latest payload
 *   stays queued until a send of it (or of a newer one that
 *   supersedes it) succeeds.
 * - BOUNDED RETRIES, THEN IT SAYS SO: a failed send retries with
 *   backoff; after the retries run out, `onGiveUp` fires so the UI
 *   can tell the user, and the payload is retained — the next edit
 *   or flush tries again.
 * - FLUSH: `flush()` sends immediately instead of waiting out the
 *   debounce (the tab-hide / pagehide path). With
 *   `{ keepalive: true }` the flag is passed through to the send so
 *   the transport can use a keepalive request that survives an iOS
 *   page discard.
 * - EVERY ATTEMPT IS ON A CLOCK (Nov 7, 2026 — the mid-session
 *   save freeze): a send whose promise never settles (an
 *   iOS-stalled fetch on a connection the OS silently dropped;
 *   the keepalive send stuck awaiting its session read) used to
 *   wedge this single-flight queue permanently — the drain
 *   awaited the attempt forever, later edits only updated the
 *   retained payload, and no retry, give-up, or SyncNotice ever
 *   fired. The database froze at the last good write while the
 *   owner kept editing, signed in, with no error anywhere. Each
 *   attempt now races `sendTimeoutMs` (default 15s): a hang
 *   becomes an ordinary failure — backoff, retry, and on
 *   exhaustion the give-up notice — and a timed-out attempt that
 *   settles late is ignored. The device copy, written
 *   synchronously by the caller on every edit, remains the
 *   unsent-changes buffer throughout: whatever the queue does,
 *   an unconfirmed state survives on the device and is held —
 *   visibly, never auto-written — at the next boot (the
 *   database-authority model, app/lib/bootState.ts).
 *
 * Transport-agnostic and timer-injectable so the scheduling logic
 * is exercised directly by the harness in
 * ~/workspace/weezer-prod-fix/harness/ (kept out of the app bundle).
 */

export interface RankingsSyncSendOptions {
  keepalive: boolean;
}

export interface RankingsSyncQueueOptions<T> {
  /**
   * Attempt one write. Resolve `true` on success, `false` on ANY
   * failure (HTTP error object, thrown network error, ...). The
   * caller owns the transport; this queue owns the schedule. A
   * send may also never settle at all — the queue times every
   * attempt out itself (see `sendTimeoutMs`).
   */
  send: (payload: T, opts: RankingsSyncSendOptions) => Promise<boolean>;
  /** Pause after the last change before sending. Default 1000ms. */
  debounceMs?: number;
  /**
   * How long one send attempt may run before the queue counts it
   * as failed and moves on (retry / give-up). Exists because a
   * stalled transport promise can pend forever; without a bound,
   * one hang wedges the single-flight drain for the whole
   * session. Default 15000ms — far above any healthy whole-row
   * upsert, short enough to unwedge a session promptly.
   */
  sendTimeoutMs?: number;
  /** Retries after a failed attempt before giving up. Default 3. */
  maxRetries?: number;
  /** Backoff between attempts (ms); the last value repeats. */
  retryDelaysMs?: number[];
  /**
   * Called once when the latest payload exhausts its retries. The
   * payload is retained — a later enqueue/flush retries it.
   */
  onGiveUp?: (payload: T) => void;
  /**
   * Called after any successful write, WITH the payload that
   * was just confirmed — the database-authority model (Nov 7
   * simplification) tracks the confirmed state from exactly
   * this signal: on a payload's success, that payload becomes
   * the session's confirmed state, and when the queue then has
   * nothing pending, the on-device unsent-changes buffer (which
   * holds that same state) has done its job and is cleared.
   */
  onSuccess?: (payload: T) => void;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export interface RankingsSyncQueue<T> {
  /** Record the newest state; (re)arms the debounced send. */
  enqueue: (payload: T) => void;
  /**
   * Send the pending payload now (no debounce wait). Resolves when
   * the queue is drained or has given up. Safe to call from
   * pagehide: with `keepalive` the send itself is issued on a
   * keepalive transport, so the request can outlive the page even
   * if this promise never settles.
   */
  flush: (opts?: { keepalive?: boolean }) => Promise<void>;
  /** True while the latest payload has not been confirmed written. */
  hasPending: () => boolean;
  /** True after the latest payload exhausted its retries. */
  isFailed: () => boolean;
}

export function createRankingsSyncQueue<T>(
  options: RankingsSyncQueueOptions<T>
): RankingsSyncQueue<T> {
  const debounceMs = options.debounceMs ?? 1000;
  const sendTimeoutMs = options.sendTimeoutMs ?? 15000;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelaysMs = options.retryDelaysMs ?? [600, 1800, 4500];
  const setT: (fn: () => void, ms: number) => unknown =
    options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT: (handle: unknown) => void =
    options.clearTimeoutFn ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let latest: T | null = null;
  /** The latest payload has not been confirmed written. */
  let dirty = false;
  /** The latest payload exhausted its retries (notice surfaced). */
  let failed = false;
  /** The one in-flight drain loop, if any — the single-flight guard. */
  let running: Promise<void> | null = null;
  /** Pending debounce or backoff timer handle. */
  let timer: unknown = null;
  /** Resolver for an in-progress backoff sleep, so a newer edit or
   *  a flush can cut the wait short. */
  let sleepResolve: (() => void) | null = null;
  /** The next send attempt should use the keepalive transport. */
  let keepaliveNext = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
  };

  const wake = () => {
    clearTimer();
    if (sleepResolve) {
      const resolve = sleepResolve;
      sleepResolve = null;
      resolve();
    }
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      sleepResolve = resolve;
      timer = setT(() => {
        timer = null;
        sleepResolve = null;
        resolve();
      }, ms);
    });

  /**
   * One send attempt, raced against the send timeout. The
   * transport promise may never settle (the Nov 7 freeze: an
   * iOS-stalled fetch neither resolves nor rejects); without the
   * race, that single await wedges the drain for the rest of the
   * session. A timed-out attempt resolves `false` — an ordinary
   * failure — and if the underlying send settles later its result
   * is dropped: the attempt is already accounted, and a late
   * settle must not clear state a retry has since owned, nor
   * resurrect work after the queue moved on. The timeout runs on
   * the injected timers under its OWN handle — never the shared
   * debounce/backoff `timer`, which wake() clears whenever a
   * newer edit arrives; an edit during a hung send must not
   * disarm the timeout.
   */
  const attemptSend = (
    payload: T,
    keepalive: boolean
  ): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      let timeoutHandle: unknown = null;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle !== null) clearT(timeoutHandle);
        resolve(ok);
      };
      timeoutHandle = setT(() => finish(false), sendTimeoutMs);
      let result: Promise<boolean>;
      try {
        result = options.send(payload, { keepalive });
      } catch {
        finish(false);
        return;
      }
      Promise.resolve(result).then(
        (ok) => finish(ok),
        () => finish(false)
      );
    });

  const drain = async (): Promise<void> => {
    let attempts = 0;
    while (dirty && latest !== null) {
      const payload = latest;
      const keepalive = keepaliveNext;
      keepaliveNext = false;
      // Tentatively clean; restored below if this attempt fails, so
      // the payload is only ever dropped by a confirmed success (or
      // by being superseded by a newer payload that then succeeds).
      dirty = false;
      const ok = await attemptSend(payload, keepalive);
      if (ok) {
        attempts = 0;
        failed = false;
        options.onSuccess?.(payload);
        continue; // loop re-checks: an edit during the send re-dirtied us
      }
      dirty = true;
      if (latest !== payload) {
        // Superseded mid-flight: the newest payload is what matters;
        // send it next without burning its retry budget.
        attempts = 0;
        continue;
      }
      attempts += 1;
      if (attempts > maxRetries) {
        failed = true;
        options.onGiveUp?.(payload);
        return; // payload retained (dirty, in `latest`) for the next kick
      }
      const delay =
        retryDelaysMs[Math.min(attempts - 1, retryDelaysMs.length - 1)];
      await sleep(delay);
      if (latest !== payload) attempts = 0; // new payload, fresh budget
    }
  };

  const kick = (): Promise<void> => {
    if (!running) {
      running = drain().finally(() => {
        running = null;
      });
    }
    return running;
  };

  const enqueue = (payload: T) => {
    latest = payload;
    dirty = true;
    failed = false;
    if (running) {
      // The drain loop will pick the new payload up — cut short any
      // backoff sleep so it goes promptly.
      wake();
      return;
    }
    clearTimer();
    timer = setT(() => {
      timer = null;
      void kick();
    }, debounceMs);
  };

  const flush = async (opts?: { keepalive?: boolean }): Promise<void> => {
    if (opts?.keepalive) keepaliveNext = true;
    wake(); // skip any debounce/backoff wait
    if (running) {
      await running;
      return;
    }
    if (dirty && latest !== null) {
      await kick();
    }
  };

  return {
    enqueue,
    flush,
    hasPending: () => dirty,
    isFailed: () => failed,
  };
}
