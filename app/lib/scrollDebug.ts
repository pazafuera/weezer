/**
 * Scroll-restoration debug instrumentation (temporary, Nov 6, 2026).
 *
 * Three correct-in-code scroll-restore mechanisms have failed the
 * owner's iPhone retest, so this module exists to capture EVIDENCE
 * from his actual device instead of a fourth blind fix. It is
 * instrumentation only — nothing in here changes navigation or
 * scrolling behavior.
 *
 * Activation: visiting any page with ?scrolldebug=1 in the URL sets
 * a sessionStorage flag; the overlay (ScrollDebugOverlay) renders
 * only while the flag is set, and the flag dies with the tab.
 * When the flag is off, logScrollDebug() is a sessionStorage read
 * and an immediate return — effectively free, and production
 * behavior is completely unchanged for anyone who never sets it.
 *
 * The log is a module-level ring buffer (last 40 events), each
 * stamped with milliseconds relative to the first event, so the
 * owner can copy it out of the overlay and paste it back.
 */

export const SCROLL_DEBUG_FLAG = 'weezer-scrolldebug';

const MAX_EVENTS = 40;

interface ScrollDebugEvent {
  t: number;
  text: string;
}

let events: ScrollDebugEvent[] = [];
let t0: number | null = null;
const listeners = new Set<() => void>();

function flagOn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SCROLL_DEBUG_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Turn the flag on when the current URL asks for it. Called by
 *  the overlay on mount and by logScrollDebug itself, so the very
 *  first navigation after landing on a ?scrolldebug=1 URL is
 *  already captured. */
export function activateScrollDebugFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URL(window.location.href).searchParams.get('scrolldebug') === '1') {
      window.sessionStorage.setItem(SCROLL_DEBUG_FLAG, '1');
    }
  } catch {
    /* a malformed URL must never break the app */
  }
  return flagOn();
}

export function isScrollDebugOn(): boolean {
  return flagOn();
}

export function disableScrollDebug(): void {
  try {
    window.sessionStorage.removeItem(SCROLL_DEBUG_FLAG);
  } catch {
    /* ignore */
  }
  events = [];
  t0 = null;
  listeners.forEach((fn) => fn());
}

/** Append one event. No-op (one storage read) while the flag is
 *  off, except that a ?scrolldebug=1 URL switches it on first. */
export function logScrollDebug(text: string): void {
  if (typeof window === 'undefined') return;
  if (!flagOn() && !activateScrollDebugFromUrl()) return;
  const now = performance.now();
  if (t0 === null) t0 = now;
  events = [...events.slice(-(MAX_EVENTS - 1)), { t: Math.round(now - t0), text }];
  listeners.forEach((fn) => fn());
}

export function getScrollDebugEvents(): ScrollDebugEvent[] {
  return events;
}

export function scrollDebugLogText(): string {
  const header = `scrolldebug log (${events.length} events, ms relative to first)`;
  const lines = events.map((e) => `+${e.t}ms ${e.text}`);
  return [header, ...lines].join('\n');
}

export function subscribeScrollDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
