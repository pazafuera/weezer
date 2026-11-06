/**
 * Pending scroll restore, persisted across documents (Nov 6, 2026).
 *
 * The diagnosis (the owner's 31-event scrolldebug log, preview-10):
 * a Back landing worked perfectly in-page — the popstate handler
 * found the recorded scroll (2704), set the pending restore, and
 * the restore loop started — and ~213ms later the document
 * RELOADED (pagehide persisted=false, then a fresh BOOT), rebooting
 * the app at scrollY=0 and wiping the landing. The only reloader in
 * the app is the stale-build watchdog (BuildVersionCheck): around
 * an iOS Back landing one of its triggers fires, it sees a build-id
 * mismatch (any long-lived session spanning a deploy), and reloads
 * mid-landing. Its state-safety argument — "the current step is
 * mirrored in ?step=" — covers the STEP only; scroll position lives
 * in the nav stack's memory and dies with the document.
 *
 * The reconnect: when a pop landing sets the pending scroll
 * restore, WeezerContext also writes it through to sessionStorage
 * (per-tab, dies with the tab). If the document is reloaded before
 * the restore settles, the next document's restore effect finds the
 * record on boot — the watchdog's own reload lands the app back on
 * the SAME step via ?step= — and runs the same restore loop.
 * BuildVersionCheck additionally refuses to reload while a fresh
 * record exists, so in the common case the landing never gets
 * interrupted at all; this record is the belt to that suspenders.
 *
 * Lifecycle (all enforced by the callers + the freshness window):
 * - Written ONLY by a popstate landing (never by fresh navigation),
 *   so a genuinely fresh visit can never find one: a new tab starts
 *   with empty sessionStorage, and the record is at most
 *   MAX_AGE_MS old when honored.
 * - NOT cleared when the in-page restore consumes the pending ref
 *   (round 2 — the owner's second retest log): round 1 cleared it
 *   at consumption, ~1.1s before the watchdog's async check
 *   reached its reload decision; the skip found nothing, the page
 *   reloaded anyway, and the boot restore then found nothing
 *   either. The record means "the most recent Back landing's
 *   target, valid for its whole freshness window" and clears
 *   ONLY when a fresh push/replace/reset navigation supersedes
 *   it (deliberate taps start at the top, exactly as before),
 *   when a pop landing is guard-rewritten, when the boot restore
 *   applies it, or when it goes stale (self-cleaned on read).
 * - Storage failures (private mode / quota / malformed JSON)
 *   degrade silently to the pre-fix behavior: the record simply
 *   isn't there, and everything proceeds as it did before.
 */

export const PENDING_SCROLL_RESTORE_KEY = 'weezer-pending-scroll-restore';

/** How long a persisted restore stays honorable. A pop landing's
 *  restore settles in well under the restore loop's ~2s deadline;
 *  15s comfortably covers a watchdog reload + reboot + the landed
 *  step's data-driven sections mounting, while staying far too
 *  short for a record to leak into a later, unrelated visit. */
export const PENDING_SCROLL_RESTORE_MAX_AGE_MS = 15_000;

export interface PendingScrollRestore {
  /** The step the pop landing landed on. */
  step: string;
  /** The scrollY recorded for that entry when it was last left. */
  y: number;
  /** The nav-stack index of the landed entry (evidence/forensics;
   *  the boot restore keys on the step, which is what the reload
   *  preserves via ?step=). */
  navIndex: number;
  /** Wall-clock write time (Date.now()). */
  ts: number;
}

export function serializePendingScrollRestore(
  record: PendingScrollRestore
): string {
  return JSON.stringify(record);
}

/** Parse a stored record, rejecting anything malformed (wrong
 *  types, negative scroll, non-integer index). Pure: the caller
 *  decides freshness separately. */
export function parsePendingScrollRestore(
  raw: string | null
): PendingScrollRestore | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const r = parsed as Partial<PendingScrollRestore>;
    if (typeof r.step !== 'string' || r.step.length === 0) return null;
    if (typeof r.y !== 'number' || !Number.isFinite(r.y) || r.y < 0) {
      return null;
    }
    if (
      typeof r.navIndex !== 'number' ||
      !Number.isInteger(r.navIndex) ||
      r.navIndex < 0
    ) {
      return null;
    }
    if (typeof r.ts !== 'number' || !Number.isFinite(r.ts) || r.ts <= 0) {
      return null;
    }
    return { step: r.step, y: r.y, navIndex: r.navIndex, ts: r.ts };
  } catch {
    return null;
  }
}

/** A record is honorable only inside its freshness window. A
 *  timestamp in the future (clock moved) is not honored. */
export function isFreshPendingScrollRestore(
  record: PendingScrollRestore,
  now: number
): boolean {
  const age = now - record.ts;
  return age >= 0 && age <= PENDING_SCROLL_RESTORE_MAX_AGE_MS;
}

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode / quota: the fix degrades to in-page restore */
  }
}

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Write a pop landing's owed restore through to sessionStorage so
 *  it survives a document reload. Never throws. */
export function persistPendingScrollRestore(
  record: PendingScrollRestore
): void {
  storageSet(PENDING_SCROLL_RESTORE_KEY, serializePendingScrollRestore(record));
}

/** Read the persisted restore if one exists AND is still fresh.
 *  A stored record that is stale or malformed is removed on the
 *  way out (self-cleaning), so it can't be re-read forever or hold
 *  the watchdog's skip open past its window. Never throws. */
export function readFreshPendingScrollRestore(
  now: number = Date.now()
): PendingScrollRestore | null {
  const raw = storageGet(PENDING_SCROLL_RESTORE_KEY);
  if (raw === null) return null;
  const record = parsePendingScrollRestore(raw);
  if (!record || !isFreshPendingScrollRestore(record, now)) {
    storageRemove(PENDING_SCROLL_RESTORE_KEY);
    return null;
  }
  return record;
}

/** True while a fresh persisted restore exists — the watchdog's
 *  "do not reload right now" signal. */
export function hasFreshPendingScrollRestore(
  now: number = Date.now()
): boolean {
  return readFreshPendingScrollRestore(now) !== null;
}

/** Drop any persisted restore. Called when the boot restore
 *  applies the record, when fresh navigation supersedes it, and
 *  when a pop landing is guard-rewritten. Deliberately NOT called
 *  when the in-page restore consumes the pending ref — see the
 *  round-2 lifecycle note at the top of this file. Never throws. */
export function clearPendingScrollRestore(): void {
  storageRemove(PENDING_SCROLL_RESTORE_KEY);
}
