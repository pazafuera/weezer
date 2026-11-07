/**
 * The last signed-in user on this device (Nov 7, 2026).
 *
 * Why this exists — the stranded-owner incident: the owner's
 * Supabase session died overnight (an evicted token, a refresh
 * race between his phone and tablet). Boot found no session and
 * fell into the guest path, which loaded his local snapshot — so
 * the app looked fully functional on his data while the menu
 * showed him the guest upsell card. Worse, the state was not just
 * cosmetic: saves silently no-opped (the sync queue never engages
 * without a user), and any edit he made would have been stamped
 * as guest work (userId: null) and discarded at his next sign-in
 * by the boot precedence.
 *
 * The app could not tell "session died" from "never signed in"
 * because nothing remembered that a session had ever existed.
 * This record is that memory: a single user id in localStorage,
 * written on every signed-in boot and save, NEVER cleared when a
 * session is merely absent, and cleared only by an explicit
 * sign-out (handleSignOut clears it BEFORE calling
 * supabase.auth.signOut(), so the auth listener can tell a
 * deliberate exit from a death). It feeds two things:
 *
 * - Detection (detectStrandedState): no session + a remembered
 *   user + meaningful local progress = a stranded owner, not a
 *   guest. AppShell renders a signed-out card for them.
 * - Defusing (resolveSnapshotStampUserId): while stranded, edits
 *   stamp the remembered user on their snapshot, so the next
 *   signed-in boot recovers them as that account's own
 *   unsent-edits buffer (app/lib/bootRankings.ts) instead of
 *   discarding them as guest work.
 *
 * Storage failures (private mode, quota, a browser without
 * localStorage) degrade silently to the pre-fix behavior: no
 * record, no stranded state, null guest stamps. Pure functions
 * take an optional storage so the rankings harness can pin the
 * behavior against a fake (harness/rankings-sync-harness.cjs,
 * scenario (h)).
 */

export const LAST_USER_KEY = 'weezer-last-user';

/** The slice of the Web Storage API this module uses. */
export interface LastUserStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function defaultStorage(): LastUserStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The remembered user id, or null when this device has none —
 *  a true guest, a fresh device, or a deliberate sign-out. */
export function readLastUserId(
  storage: LastUserStorage | null = defaultStorage()
): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(LAST_USER_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Remember who is signed in on this device. Called on every
 *  signed-in boot and every signed-in save, so the record tracks
 *  the CURRENT account when a device changes hands via sign-in. */
export function rememberLastUserId(
  userId: string,
  storage: LastUserStorage | null = defaultStorage()
): void {
  if (!storage || !userId) return;
  try {
    storage.setItem(LAST_USER_KEY, userId);
  } catch {
    /* private mode / quota: no record, pre-fix behavior */
  }
}

/** Forget the remembered user. Called ONLY by an explicit
 *  sign-out (delete-account ends in sign-out) — never by a
 *  session's absence, which is exactly the case the record
 *  exists to recognize. */
export function forgetLastUserId(
  storage: LastUserStorage | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(LAST_USER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The user stamp a rankings snapshot carries (written by
 * syncRankingsToDatabase on every edit). A live session stamps
 * its own user. With no session, the stamp falls back to the
 * remembered user — the stranded defuse: those edits ARE that
 * account's work, and the boot resolver recovers stamped work
 * while discarding (or merely merging) unstamped work. A true
 * guest — no session, no remembered user — stamps null, exactly
 * as before.
 */
export function resolveSnapshotStampUserId(
  sessionUserId: string | null | undefined,
  lastUserId: string | null | undefined
): string | null {
  return sessionUserId ?? lastUserId ?? null;
}

/**
 * Stranded = this device remembers a signed-in user (the record,
 * or a user stamp already on the snapshot) AND holds meaningful
 * local progress — but no session is live. The caller only asks
 * in the no-session state; a live session is never stranded.
 */
export function detectStrandedState(args: {
  lastUserId: string | null | undefined;
  snapshotUserId: string | null | undefined;
  hasProgress: boolean;
}): boolean {
  return args.hasProgress && !!(args.lastUserId || args.snapshotUserId);
}
