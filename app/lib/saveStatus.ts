/**
 * The owner-facing save state (Nov 7, 2026 — durability overhaul,
 * item 1: visible save state).
 *
 * Four times, ranking work was lost to save failures the owner
 * could not see: the saves looked exactly like success until he
 * came back and found songs reverted. This module is the honest
 * signal's vocabulary. The context tracks a SaveState driven ONLY
 * by the sync queue's confirmed-write signals (a payload counts
 * as saved when the queue confirms the database took it, never
 * when the edit happens), and the AppShell header renders the
 * copy derived here; the account drawer shows the same state next
 * to the save diagnostics.
 *
 * Phases:
 * - 'idle'       — nothing to report (no edits yet, or a guest
 *                  who has not ranked anything). The indicator
 *                  renders nothing.
 * - 'saving'     — the latest edit is written on the device and
 *                  queued, but the database write is not yet
 *                  confirmed.
 * - 'saved'      — the latest edit is CONFIRMED in the database.
 *                  `savedAt` carries the confirmation time when
 *                  one is known; a plain boot onto the account row
 *                  is also 'saved' (what is on screen IS the
 *                  database state) with savedAt null.
 * - 'failed'     — the write exhausted its retries. The payload
 *                  is retained on the device and the app keeps
 *                  trying; this phase pairs with the SyncNotice.
 * - 'local-only' — there is no signed-in account to save TO
 *                  (guest, or a stranded owner whose session
 *                  died): the work is saved on this device only,
 *                  and the copy must never claim otherwise.
 *
 * Pure and dependency-free so the rankings harness can pin the
 * exact strings (scenario (m)).
 */

export type SavePhase =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'local-only';

export interface SaveState {
  phase: SavePhase;
  /** Epoch ms of the last confirmed database write, if known. */
  savedAt: number | null;
}

export const INITIAL_SAVE_STATE: SaveState = { phase: 'idle', savedAt: null };

/** "8:42 AM" — the plain time-of-day the indicator shows. */
export function formatTimeOfDay(epochMs: number): string {
  const d = new Date(epochMs);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mm} ${suffix}`;
}

/**
 * The indicator's one line, or null when it should render
 * nothing. These strings are the contract: 'saved' is only ever
 * derived from a confirmed write (or a boot that loaded the row
 * itself), never from an edit.
 */
export function saveIndicatorCopy(state: SaveState): string | null {
  switch (state.phase) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return state.savedAt !== null
        ? `All changes saved · ${formatTimeOfDay(state.savedAt)}`
        : 'All changes saved';
    case 'failed':
      return "Couldn't save — retrying";
    case 'local-only':
      return 'Saved on this device only';
    case 'idle':
    default:
      return null;
  }
}
