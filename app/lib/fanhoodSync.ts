'use client';

/**
 * Account sync for the established fanhood (public.fanhood).
 *
 * The record's home surface is still device localStorage — every
 * reader (Thread stop, Shareables card, dashboard, game header
 * chip) reads it through app/lib/fanhood.ts and stays untouched.
 * This module keeps the account copy and the device copy
 * reconciled for signed-in players:
 *
 *   - When a session is established, the account record is
 *     fetched and merged with the local one (mergeFanhoodRecords:
 *     per-game union, recorded results immutable). The account row
 *     is read for its games column ONLY — the retired legacy
 *     columns (best_depth / deepest) never merge upward, so an
 *     old-game total can never re-enter a record from either side.
 *     The merged record is written back to
 *     localStorage, so every surface on this device/browser shows
 *     it, and pushed up to the account when the local side won.
 *   - After a finished run settles in the game, the settled
 *     record is pushed the same way — never lowering the
 *     account's best.
 *
 * GRACEFUL DEGRADATION IS THE CONTRACT: until the fanhood
 * migration is applied (table missing), offline, or on any other
 * failure, every function here resolves quietly and the game
 * behaves exactly as the local-only version. One attempt per
 * trigger — no retries, no loops, nothing user-visible.
 *
 * SERIALIZATION (Nov 7, 2026 — the post-freeze hardening,
 * finding F5 of the regression audit): reconcileRecords is a
 * whole-record read-modify-write, and its two callers used to
 * run it unsynchronized — a session reconcile whose account
 * fetch was still in flight when a run settled could complete
 * afterwards with its stale reads and overwrite BOTH stores
 * with a merged record missing the just-finished game. All
 * reconciles now run on one shared promise chain
 * (app/lib/promiseChain.ts), and each reads the device record
 * when it RUNS, not when it was triggered — the second
 * reconcile through the chain always merges a world that
 * includes the first one's writes.
 *
 * OWNERSHIP (Nov 7, 2026 — the owner-stamp fix): the merge
 * above is per-account, but the device record it merges used
 * to be anybody's: an account signing in on a device absorbed
 * whatever record the device held into its own row. The
 * device record now carries an owner (app/lib/fanhoodOwner.ts
 * — a stamp key plus per-account parking slots), and every
 * reconcile first runs the ownership shuffle INSIDE its chain
 * task: a foreign record is parked under its owner's slot
 * (copy verified before the seat changes), the reconciling
 * account's own parked record is restored if it has one, and
 * the stamp moves to the reconciling account. The merge then
 * runs exactly as before, against a device record that is
 * this account's — or a guest/legacy one it is claiming.
 */

import { supabase } from '../../utils/supabase';
import {
  FANHOOD_STORAGE_KEY,
  clearFanhood,
  fanhoodRecordFromRow,
  fanhoodRowFromRecord,
  mergeFanhoodRecords,
  parseFanhoodValue,
  readFanhood,
  serializeFanhood,
  writeFanhood,
} from './fanhood';
import type { FanhoodRecord } from './fanhood';
import {
  FANHOOD_OWNER_STAMP_KEY,
  fanhoodSlotKey,
  planFanhoodReconcile,
} from './fanhoodOwner';
import type { FanhoodOwnershipStep } from './fanhoodOwner';
import { createPromiseChain } from './promiseChain';

/** The one serialization point for every fanhood reconcile:
 *  session-establish and post-run alike run through here, so
 *  two whole-record read-modify-writes can never interleave. */
const reconcileChain = createPromiseChain();

async function fetchAccountFanhood(
  userId: string
): Promise<FanhoodRecord | null> {
  try {
    const { data, error } = await supabase
      .from('fanhood')
      .select('user_id, best_depth, deepest, games, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    // Games column only: fanhoodRecordFromRow ignores the
    // best_depth / deepest columns entirely, so a row written
    // before the wipe reads as no fanhood until a game lands.
    return fanhoodRecordFromRow(data);
  } catch {
    return null;
  }
}

async function upsertAccountFanhood(
  userId: string,
  record: FanhoodRecord
): Promise<void> {
  try {
    const row = fanhoodRowFromRecord(userId, record);
    const { error } = await supabase
      .from('fanhood')
      .upsert(row, { onConflict: 'user_id' });
    if (error) {
      // Pre-games-migration table: write the display columns only.
      // Those values are derived from the games record alone
      // (fanhoodRowFromRecord), so even this fallback can never
      // write a total the games didn't earn. The five-game detail
      // stays safe in localStorage and syncs in full once the
      // column exists.
      const { games: _games, ...columnsRow } = row;
      await supabase
        .from('fanhood')
        .upsert(columnsRow, { onConflict: 'user_id' });
    }
  } catch {
    /* the account copy is a mirror — a failed write just means
       this device keeps its local record, as before */
  }
}

/**
 * Merge the local record with the account record. Writes the
 * merged record to localStorage when it differs from what's
 * there, and upserts it to the account when it differs from the
 * account's — the only two writes, each guarded by an actual
 * difference, so a settled state costs zero writes.
 */
async function reconcileRecords(
  userId: string,
  local: FanhoodRecord | null
): Promise<void> {
  const account = await fetchAccountFanhood(userId);
  if (!account && !local) return;
  const merged = mergeFanhoodRecords(local, account);
  if (!merged) return;
  if (serializeFanhood(merged) !== JSON.stringify(local)) {
    writeFanhood(merged);
  }
  if (serializeFanhood(merged) !== JSON.stringify(account)) {
    await upsertAccountFanhood(userId, merged);
  }
}

/* ------------------------------------------------------------------ */
/* Ownership shuffle (Nov 7, 2026 — app/lib/fanhoodOwner.ts)         */
/* ------------------------------------------------------------------ */

/** The stamp: the user id the active device record belongs
 *  to, or null when it is a guest/legacy record. */
function readOwnerStamp(): string | null {
  try {
    const raw = window.localStorage.getItem(FANHOOD_OWNER_STAMP_KEY);
    return raw ? raw : null;
  } catch {
    return null;
  }
}

/** An account's parked record, parse-checked: a slot whose
 *  contents don't parse is no slot at all. */
function readParkedSlot(userId: string): FanhoodRecord | null {
  try {
    return parseFanhoodValue(
      window.localStorage.getItem(fanhoodSlotKey(userId))
    );
  } catch {
    return null;
  }
}

/** setItem + read-back equality: a copy is only believed once
 *  it reads back byte-identical. */
function writeVerified(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return window.localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

/**
 * One shuffle step. Returns false when the step could not be
 * verified — the caller aborts the shuffle there and the
 * reconcile falls back to the plain merge against whatever
 * stands, so a storage failure degrades to the pre-fix
 * behavior and never loses a record: the active seat is only
 * ever replaced after the copy leaving it (or entering it)
 * has been verified in its new home.
 */
function runOwnershipStep(
  step: FanhoodOwnershipStep,
  userId: string,
  stamp: string | null
): boolean {
  switch (step) {
    case 'park-active': {
      if (!stamp) return false;
      const active = readFanhood();
      // The facts said a record stood here; if it has since
      // vanished there is nothing to park and the seat steps
      // still apply.
      if (!active) return true;
      return writeVerified(
        fanhoodSlotKey(stamp),
        serializeFanhood(active)
      );
    }
    case 'restore-slot': {
      const parked = readParkedSlot(userId);
      if (!parked) return false;
      writeFanhood(parked);
      let landed = false;
      try {
        landed =
          window.localStorage.getItem(FANHOOD_STORAGE_KEY) ===
          serializeFanhood(parked);
      } catch {
        landed = false;
      }
      if (!landed) return false;
      try {
        window.localStorage.removeItem(fanhoodSlotKey(userId));
      } catch {
        /* a stale slot copy is benign — the merge unions by
           game, so a later restore of it changes nothing */
      }
      return true;
    }
    case 'clear-active': {
      clearFanhood();
      try {
        return window.localStorage.getItem(FANHOOD_STORAGE_KEY) === null;
      } catch {
        return false;
      }
    }
    case 'claim-stamp':
      return writeVerified(FANHOOD_OWNER_STAMP_KEY, userId);
    case 'merge':
      return true;
  }
}

/**
 * Brings the device record's ownership in line with the
 * reconciling account, per planFanhoodReconcile. Runs ONLY
 * inside a chain task, immediately before the merge reads the
 * device record — parking outside the task would race the
 * very read-modify-writes the chain exists to serialize.
 * Never throws: unreadable facts or a failed step degrade to
 * the plain merge, today's behavior.
 */
function resolveDeviceRecordOwnership(userId: string): void {
  let stamp: string | null;
  let steps: FanhoodOwnershipStep[];
  try {
    stamp = readOwnerStamp();
    steps = planFanhoodReconcile({
      stamp,
      accountId: userId,
      hasParkedSlot: readParkedSlot(userId) !== null,
      hasActiveRecord: readFanhood() !== null,
    }).steps;
  } catch {
    return;
  }
  for (const step of steps) {
    if (step === 'merge') return;
    let ok = false;
    try {
      ok = runOwnershipStep(step, userId, stamp);
    } catch {
      ok = false;
    }
    if (!ok) return;
  }
}

/* ------------------------------------------------------------------ */
/* Session-establish reconcile (once per user per page session)      */
/* ------------------------------------------------------------------ */

let reconciledUserId: string | null = null;
let reconcileInFlight = false;
// The current user's reconcile as a settle promise, so a surface
// that renders FROM the record (the garage2 game card is the first)
// can tell "no fanhood yet" apart from "the account merge hasn't
// landed yet" — the fetch itself is unchanged, still one attempt.
let reconcileSettle: { userId: string; promise: Promise<void> } | null =
  null;
/** Bumped by forgetAccountFanhoodSync: a session reconcile
 *  scheduled under an older epoch belongs to a session that
 *  has ended, and when its turn on the chain comes it does
 *  nothing — the new session schedules its own. */
let syncEpoch = 0;

export function reconcileAccountFanhood(userId: string): void {
  if (!userId) return;
  // initUserAndLoadRankings runs on mount AND on every auth-state
  // change; reconcile once per user so token refreshes and repeat
  // inits never turn into a fetch pattern.
  if (reconciledUserId === userId || reconcileInFlight) return;
  reconciledUserId = userId;
  reconcileInFlight = true;
  const epochAtSchedule = syncEpoch;
  // On the chain (F5): this reconcile's reads happen when it
  // RUNS — after any earlier reconcile (a post-run push, a
  // previous session's) has fully settled — never from a
  // snapshot captured at schedule time.
  const promise = reconcileChain.enqueue(async () => {
    try {
      if (epochAtSchedule !== syncEpoch) return;
      // The ownership shuffle runs here — inside the task,
      // after the epoch check (a dead session's queued task
      // must not shuffle storage under its successor) and
      // before the merge reads the device record.
      resolveDeviceRecordOwnership(userId);
      await reconcileRecords(userId, readFanhood());
    } catch {
      /* local-only is always a valid state */
    } finally {
      // Clear the in-flight flag only while this reconcile is
      // still the current one: a forget + a new account's
      // schedule may have replaced the settle entry while
      // this task waited on the chain, and the replacement's
      // flag is not ours to clear.
      if (reconcileSettle?.promise === promise) {
        reconcileInFlight = false;
      }
    }
  });
  reconcileSettle = { userId, promise };
  void promise;
}

/**
 * Resolves once the session reconcile for this user has settled —
 * merged, confirmed empty, or silently degraded to local-only.
 * Starts the same reconcile first when it hasn't run for this
 * user (a deep-linked surface can mount before the session init
 * gets there). Never rejects: a failed merge is a settled state.
 */
export function fanhoodReconcileSettled(
  userId: string | null
): Promise<void> {
  if (!userId) return Promise.resolve();
  if (reconcileSettle?.userId === userId) return reconcileSettle.promise;
  reconcileAccountFanhood(userId);
  return reconcileSettle?.userId === userId
    ? reconcileSettle.promise
    : Promise.resolve();
}

/** Sign-out: forget who was reconciled so a different account
 *  signing in on this device reconciles fresh. The local record
 *  itself is deliberately left alone — it is the device's record,
 *  and surfaces fall back to it (today's guest semantics). The
 *  ownership stamp is left alone too: the record stays the
 *  signed-out account's, visibly, and the next account's
 *  reconcile parks it rather than absorbing it.
 *  The in-flight flag and the epoch are part of the forgetting
 *  (F5): leaving reconcileInFlight set let a sign-out that
 *  landed mid-reconcile silently skip the NEXT account's
 *  session reconcile, and a still-queued reconcile from the
 *  dead session must not run its writes under the new one —
 *  the epoch bump is what retires it. */
export function forgetAccountFanhoodSync(): void {
  syncEpoch += 1;
  reconciledUserId = null;
  reconcileSettle = null;
  reconcileInFlight = false;
}

/* ------------------------------------------------------------------ */
/* Post-run push                                                      */
/* ------------------------------------------------------------------ */

/**
 * After a run settles in the game: bring the account (and, via the
 * merge, this device) up to the settled record. Fire-and-forget;
 * guests and failures are silent no-ops.
 *
 * On the same chain as the session reconcile (F5), and the
 * local candidate is composed when the task RUNS: the device
 * record as it stands then, unioned with the settled record
 * this push carries — so a game that landed after the push
 * was triggered is in the merge, and the settled game itself
 * can never be read out of existence by an earlier trigger's
 * stale snapshot. The merge is a per-game union, so composing
 * the candidate this way can only add, never remove.
 */
export async function syncFanhoodAfterRun(
  userId: string | null,
  settledRecord: FanhoodRecord
): Promise<void> {
  if (!userId) return;
  await reconcileChain.enqueue(async () => {
    try {
      // Same discipline as the session reconcile: ownership
      // first (a no-op once this session's reconcile has run
      // and stamped the record), so the record composed below
      // is this account's even if this push somehow reaches
      // the chain ahead of that reconcile.
      resolveDeviceRecordOwnership(userId);
      const localNow =
        mergeFanhoodRecords(readFanhood(), settledRecord) ??
        settledRecord;
      await reconcileRecords(userId, localNow);
    } catch {
      /* local-only is always a valid state */
    }
  });
}
