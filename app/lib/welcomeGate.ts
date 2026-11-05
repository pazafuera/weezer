/**
 * Pure frequency gate for the welcome interstitial (Nov 4, 2026).
 *
 * Mark's rule: a welcome is welcome ONCE — on a genuinely new
 * session, or on a return after a real absence — not on every
 * app open. The decision is a pure function of two storage
 * values so it can be proven without a browser (see
 * harness/welcome-gate-harness.cjs); WelcomeInterstitial owns
 * the storage reads/writes and, per the fail-closed rule there,
 * any storage failure (private mode, quota, disabled storage)
 * means NO welcome — the app just boots.
 */

export const WELCOME_SESSION_KEY = 'weezer-welcome-session-v1';
export const WELCOME_LAST_SHOWN_KEY = 'weezer-welcome-last-shown-v1';

/** A returning visitor sees the welcome again only after this
 *  long away: 8 hours. */
export const WELCOME_REPEAT_INTERVAL_MS = 8 * 60 * 60 * 1000;

export interface WelcomeGateState {
  /** The sessionStorage flag is present: the welcome already
   *  showed (or is showing) in this browser session. */
  sessionShown: boolean;
  /** The localStorage last-shown timestamp (ms epoch), parsed;
   *  null when absent or unparseable. */
  lastShownAt: number | null;
}

/** Parse the stored last-shown value. Anything that isn't a
 *  plain positive number (garbage, a hand-edited value, an
 *  empty string) reads as "never shown" rather than crashing
 *  or suppressing the welcome forever. */
export function parseWelcomeLastShown(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Eligible when BOTH:
 * - the welcome hasn't shown in this browser session, and
 * - it has never shown, or the last showing was at least
 *   WELCOME_REPEAT_INTERVAL_MS ago.
 * A last-shown timestamp in the future (clock skew) reads as
 * "just shown" — the age is negative, never >= the interval.
 */
export function isWelcomeEligible(
  state: WelcomeGateState,
  now: number
): boolean {
  if (state.sessionShown) return false;
  if (state.lastShownAt === null) return true;
  return now - state.lastShownAt >= WELCOME_REPEAT_INTERVAL_MS;
}
