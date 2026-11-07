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
 * ACCOUNT STAMPS (Nov 7, 2026 — the post-freeze hardening,
 * finding F1 of the regression audit): the queue's payloads
 * belong to whoever enqueued them, but a payload can outlive
 * its session — retained through retry backoff or give-up,
 * it is still here when a DIFFERENT account signs in on the
 * same device, and the next attempt (or a tab-hide flush)
 * would send it under the new session. The queue therefore
 * accepts an `isCurrent` predicate: before every attempt it
 * asks whether the retained payload is still the live
 * session's to send, and a stale payload is DISCARDED —
 * never sent, never retried, and its onSuccess/onGiveUp
 * never fire (a foreign success must not certify state, and
 * a foreign failure must not alarm the wrong user); the
 * discard is reported through `onDiscard` so the decision
 * leaves a trace. `clear()` is the explicit version of the
 * same rule, for sign-out: everything retained is dropped,
 * and an attempt already in flight has its outcome ignored
 * (an epoch counter — the attempt may genuinely have landed
 * in its own account's row, which is fine; what it may not
 * do is certify anything in the session that replaced it).
 * A payload enqueued after the clear sends normally, even
 * while the pre-clear drain is still unwinding.
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
  /**
   * Account currency (F1): consulted before EVERY send
   * attempt with the payload about to be sent. Return false
   * when the payload no longer belongs to the live session
   * (its account signed out or was replaced): the queue
   * discards it — no attempt, no onSuccess/onGiveUp — and
   * reports it through onDiscard. Omit it and every payload
   * is current (the pre-hardening behavior).
   */
  isCurrent?: (payload: T) => boolean;
  /**
   * Called once when a retained payload is discarded as no
   * longer the live session's (see isCurrent). The provider
   * records a diagnostic; the payload's owner is gone, so
   * nothing user-facing fires for it.
   */
  onDiscard?: (payload: T) => void;
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
  /**
   * Drop everything retained — pending payload, failure
   * flag, timers (F1: sign-out). An attempt already in
   * flight keeps its promise but its outcome is ignored:
   * neither onSuccess nor onGiveUp fires for it. Payloads
   * enqueued afterwards are a new generation and send
   * normally.
   */
  clear: () => void;
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
  /** Queue generation (F1): bumped by clear(). An attempt
   *  that started under an older generation has its outcome
   *  ignored when it settles — the work it belonged to was
   *  dropped by the session change, and neither its success
   *  nor its failure may certify or alarm the new session. */
  let epoch = 0;

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
      // Account currency (F1): the retained payload is sent
      // only while it still belongs to the live session. A
      // payload whose account is gone is discarded here —
      // before any attempt — so it can never be written
      // under a different account, and neither onSuccess
      // nor onGiveUp fires for it.
      if (options.isCurrent && !options.isCurrent(latest)) {
        const dropped = latest;
        latest = null;
        dirty = false;
        failed = false;
        options.onDiscard?.(dropped);
        return;
      }
      const payload = latest;
      const keepalive = keepaliveNext;
      keepaliveNext = false;
      // Tentatively clean; restored below if this attempt fails, so
      // the payload is only ever dropped by a confirmed success (or
      // by being superseded by a newer payload that then succeeds).
      dirty = false;
      const attemptEpoch = epoch;
      const ok = await attemptSend(payload, keepalive);
      if (attemptEpoch !== epoch) {
        // clear() dropped this payload's generation while
        // the attempt was in flight (sign-out). The write
        // may or may not have landed in ITS account's row —
        // either is fine — but its outcome certifies nothing
        // here: no callbacks, no retry accounting. Loop on:
        // if a new generation already enqueued work, this
        // same drain sends it; otherwise the loop condition
        // exits (clear emptied the queue).
        attempts = 0;
        continue;
      }
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

  const clear = () => {
    // A new generation: any attempt still in flight from
    // before the clear has its outcome ignored when it
    // settles (see the drain's epoch check). The retained
    // payload is dropped outright — it belongs to a session
    // that just ended, and the isCurrent rule would discard
    // it at the next attempt anyway; clearing here means it
    // is gone even if no attempt ever comes.
    epoch += 1;
    latest = null;
    dirty = false;
    failed = false;
    keepaliveNext = false;
    clearTimer();
    wake(); // cut short a backoff sleep so the drain notices now
  };

  return {
    enqueue,
    flush,
    clear,
    hasPending: () => dirty,
    isFailed: () => failed,
  };
}
