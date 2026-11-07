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
 *                  renders nothing. A plain signed-in boot lands
 *                  here too: the row loaded, but nothing was
 *                  SAVED yet, so there is nothing to announce.
 * - 'saving'     — the latest edit is written on the device and
 *                  queued, but the database write is not yet
 *                  confirmed.
 * - 'saved'      — the latest edit is CONFIRMED in the database.
 *                  `savedAt` carries the confirmation time. Only
 *                  the queue's confirmed write sets this phase —
 *                  never an edit, and never a boot (the
 *                  database-authority boot performs no writes at
 *                  all; see bootSaveState below).
 * - 'failed'     — the write exhausted its retries. The payload
 *                  is retained on the device and the app keeps
 *                  trying; this phase pairs with the SyncNotice.
 * - 'local-only' — there is no signed-in account to save TO
 *                  (guest, or a stranded owner whose session
 *                  died): the work is saved on this device only,
 *                  and the copy must never claim otherwise.
 *
 * Two display rules sit on top of the standing state (the
 * owner's rulings, Nov 7, after the overhaul shipped):
 * - The header strip shows the save state ONLY on the ranking-
 *   editing screens (triage, refine, final review) — see
 *   SAVE_INDICATOR_STEPS. The state itself stays global: the
 *   account drawer's Saving card reads it on demand anywhere.
 * - On the strip, the SUCCESS notice is transient: it shows for
 *   SAVE_NOTICE_MS after the confirmed write, then clears back
 *   to nothing (saveNoticeCopy). 'saving' shows only while a
 *   save is in flight, and the warning phases persist for as
 *   long as their condition lasts — they never auto-expire.
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

/** How long the header strip's success notice stays up after a
 *  confirmed write before it clears itself (the owner's ruling:
 *  "It's fine to have a saved notice, but it shouldn't
 *  persist."). Warnings are NOT on this clock. */
export const SAVE_NOTICE_MS = 4000;

/**
 * The steps the header save strip belongs to: the ranking-
 * editing screens only — the sort/triage flow ('triage'), the
 * Refine stages and their head-to-head matchups interstitial
 * ('rank_buckets' — the interstitial renders inside that step),
 * and Final Review ('master'). Everywhere else (dashboard,
 * game, shareables, fan stats, profiles, orientation, …) the
 * strip never renders: a save notice is only relevant where
 * ranking edits happen.
 */
export const SAVE_INDICATOR_STEPS: ReadonlySet<string> = new Set([
  'triage',
  'rank_buckets',
  'master',
]);

export function isSaveIndicatorStep(step: string): boolean {
  return SAVE_INDICATOR_STEPS.has(step);
}

/**
 * The save state a signed-in boot STARTS from. Boot writes
 * nothing (the database-authority model: the row is fetched,
 * period), so no boot may start 'saved' — a plain row load
 * saved nothing, and the state starts IDLE. (The pre-overhaul
 * code announced "All changes saved" at every boot, which read
 * as a claim about work the owner hadn't done.) The one boot
 * with something to say is a boot HOLDING an unsent-changes
 * buffer (app/lib/bootState.ts): that work sits on this device
 * only, unconfirmed, and the state starts 'local-only' saying
 * exactly that — it folds into the row through the user's next
 * edit, or stays visibly waiting.
 */
export function bootSaveState(args: {
  /** The boot held a device buffer as the pending state. */
  hasPendingBuffer: boolean;
  /** The held buffer's own save time, when it carries one. */
  bufferSavedAt?: number | null;
}): SaveState {
  if (args.hasPendingBuffer) {
    return { phase: 'local-only', savedAt: args.bufferSavedAt ?? null };
  }
  return INITIAL_SAVE_STATE;
}

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
 * The standing state's one line, or null when there is nothing
 * to say. These strings are the contract: 'saved' is only ever
 * derived from a confirmed write, never from an edit. This is
 * the vocabulary the account drawer's Saving card reads (the
 * on-demand record — there, the last-saved line stands for as
 * long as it is the latest word). The header strip reads
 * saveNoticeCopy instead, which applies the transient-success
 * rule on top.
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

/**
 * The header strip's line at a given moment. Same vocabulary as
 * saveIndicatorCopy, with the success notice made transient:
 * a 'saved' state shows only inside SAVE_NOTICE_MS of its
 * confirmation time (anchored to `savedAt`, so re-entering an
 * editing screen late never resurrects it, and entering
 * mid-window shows only the remainder). Because the line is
 * derived from the CURRENT state, an edit that lands during
 * the window replaces the notice with 'Saving…' immediately —
 * there is no pending expiry that can stomp a newer state; the
 * strip's timer only ever re-derives this function. The
 * warning phases ignore the clock entirely: they show for as
 * long as the condition lasts, and clear when a later
 * confirmed write succeeds (into the transient success above).
 * A 'saved' state with no confirmation time is a standing
 * record for the drawer, never a strip notice.
 */
export function saveNoticeCopy(state: SaveState, nowMs: number): string | null {
  if (state.phase === 'saved') {
    if (state.savedAt === null) return null;
    if (nowMs - state.savedAt >= SAVE_NOTICE_MS) return null;
    return `All changes saved · ${formatTimeOfDay(state.savedAt)}`;
  }
  return saveIndicatorCopy(state);
}
