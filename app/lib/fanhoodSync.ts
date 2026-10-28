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
 *     deeper best wins). The merged record is written back to
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
 */

import { supabase } from '../../utils/supabase';
import {
  fanhoodRecordFromRow,
  fanhoodRowFromRecord,
  mergeFanhoodRecords,
  readFanhood,
  serializeFanhood,
  writeFanhood,
} from './fanhood';
import type { FanhoodRecord } from './fanhood';

async function fetchAccountFanhood(
  userId: string
): Promise<FanhoodRecord | null> {
  try {
    const { data, error } = await supabase
      .from('fanhood')
      .select('user_id, best_depth, deepest, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
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
    await supabase
      .from('fanhood')
      .upsert(fanhoodRowFromRecord(userId, record), {
        onConflict: 'user_id',
      });
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
/* Session-establish reconcile (once per user per page session)      */
/* ------------------------------------------------------------------ */

let reconciledUserId: string | null = null;
let reconcileInFlight = false;

export function reconcileAccountFanhood(userId: string): void {
  if (!userId) return;
  // initUserAndLoadRankings runs on mount AND on every auth-state
  // change; reconcile once per user so token refreshes and repeat
  // inits never turn into a fetch pattern.
  if (reconciledUserId === userId || reconcileInFlight) return;
  reconciledUserId = userId;
  reconcileInFlight = true;
  void (async () => {
    try {
      await reconcileRecords(userId, readFanhood());
    } catch {
      /* local-only is always a valid state */
    } finally {
      reconcileInFlight = false;
    }
  })();
}

/** Sign-out: forget who was reconciled so a different account
 *  signing in on this device reconciles fresh. The local record
 *  itself is deliberately left alone — it is the device's record,
 *  and surfaces fall back to it (today's guest semantics). */
export function forgetAccountFanhoodSync(): void {
  reconciledUserId = null;
}

/* ------------------------------------------------------------------ */
/* Post-run push                                                      */
/* ------------------------------------------------------------------ */

/**
 * After a run settles in the game: bring the account (and, via the
 * merge, this device) up to the settled record. Fire-and-forget;
 * guests and failures are silent no-ops.
 */
export async function syncFanhoodAfterRun(
  userId: string | null,
  settledRecord: FanhoodRecord
): Promise<void> {
  if (!userId) return;
  try {
    await reconcileRecords(userId, settledRecord);
  } catch {
    /* local-only is always a valid state */
  }
}
