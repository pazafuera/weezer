/**
 * A serial promise chain — one shared queue for
 * read-modify-write cycles that must never interleave
 * (Nov 7, 2026 — the post-freeze hardening; finding F5 of the
 * regression audit in REPORT.md).
 *
 * The fanhood account sync (app/lib/fanhoodSync.ts) reconciles
 * a whole record: fetch the account copy, merge it with the
 * device copy, write the merged record back to both stores.
 * Two triggers run it — the session-establish reconcile and
 * the post-run push — and unsynchronized, the slower one's
 * stale read could land after the faster one's write and
 * erase a finished game from BOTH stores (the merge is a
 * union, but only over what each reconcile READ; a reconcile
 * that read before the game landed merges a world without
 * it, and its whole-record write then removes the game).
 *
 * The chain is the rankings sync queue's single-flight
 * discipline at the smallest possible size: tasks run one at
 * a time, strictly in enqueue order; a task that rejects
 * settles its own caller and never breaks the chain for the
 * next task. Each task reads its inputs when it RUNS, not
 * when it was enqueued — that is what makes the serialization
 * worth anything here.
 *
 * Pure scheduling (no I/O of its own), pinned in the rankings
 * harness (scenario (s)): order preserved, no overlap, a
 * rejection is contained.
 */
export interface PromiseChain {
  /**
   * Run `task` after every previously enqueued task settles.
   * The returned promise settles with the task's own outcome.
   */
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
}

export function createPromiseChain(): PromiseChain {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue: <T>(task: () => Promise<T>): Promise<T> => {
      const run = tail.then(() => task());
      // The chain itself must survive any task's rejection:
      // the tail swallows outcomes (each caller keeps its own
      // promise above), so one failed task can never wedge or
      // poison the tasks behind it.
      tail = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
  };
}
