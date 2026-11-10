/**
 * The leaderboard name claim (game front door, Nov 9, 2026).
 *
 * A guest who finishes a game round can claim a username for
 * the board. The claim creates an anonymous Supabase account —
 * a "shell": a real account row with a real id, carrying the
 * claimed username on its profile, but no email or password.
 * The fanhood sync attaches the device record to the shell
 * through the same reconcile every sign-in uses, so the score
 * lands on the board like any player's. Adding an email later
 * converts the SAME account in place (same id, same name,
 * same scores) — nothing migrates.
 *
 * One claim per device (owner ruling, Nov 9, 2026): the claim
 * is remembered on the device under SHELL_CLAIM_KEY, and a
 * device that already claimed is refused a second name. This
 * is a speed bump by design — clearing browser data slips
 * past it, and that is accepted; the board is a friendly one,
 * and rounds stay one-and-done per record regardless.
 *
 * This module is the pure planner + the storage wrapper. The
 * network steps (availability RPC, anonymous sign-in, profile
 * upsert) live in ShellClaimCard, mirroring the onboarding
 * modal's exact sequence.
 */

export const SHELL_CLAIM_KEY = 'weezer-shell-claim';

export interface ShellClaim {
  userId: string;
  username: string;
}

export type ShellClaimPlan =
  | 'signed-in' // a full account session: already on the board
  | 'is-shell' // this session IS a claimed shell
  | 'claimed-on-device' // no session, but this device claimed before
  | 'can-claim'; // a true guest: the claim is available

export function planShellClaim(input: {
  userId: string | null;
  isShell: boolean;
  stored: ShellClaim | null;
}): ShellClaimPlan {
  if (input.userId) return input.isShell ? 'is-shell' : 'signed-in';
  if (input.stored) return 'claimed-on-device';
  return 'can-claim';
}

/**
 * The onboarding modal's username cleaning, verbatim rules:
 * lowercase, trimmed, anything outside [a-z0-9_] stripped,
 * at least 3 characters. The 20-char cap matches the share
 * payload's name field.
 */
export function cleanShellUsername(
  raw: string
): { ok: true; username: string } | { ok: false; reason: string } {
  const username = raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  if (username.length < 3) {
    return { ok: false, reason: 'Names need at least 3 characters.' };
  }
  if (username.length > 20) {
    return { ok: false, reason: 'Names cap at 20 characters.' };
  }
  return { ok: true, username };
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readShellClaim(): ShellClaim | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SHELL_CLAIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ShellClaim>;
    if (
      typeof parsed.userId === 'string' &&
      parsed.userId.length > 0 &&
      typeof parsed.username === 'string' &&
      parsed.username.length > 0
    ) {
      return { userId: parsed.userId, username: parsed.username };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeShellClaim(claim: ShellClaim): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SHELL_CLAIM_KEY, JSON.stringify(claim));
  } catch {
    /* private mode — the claim still happened server-side;
       the device just won't remember it was the claimant. */
  }
}
