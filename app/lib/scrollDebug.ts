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
 * V2 (later Nov 6): the log is WRITE-THROUGH PERSISTED to
 * sessionStorage, because both of the owner's v1 repro pastes ended
 * at app boot (+15ms) even though he then navigated — the in-memory
 * buffer was wiped by a document reload somewhere in the flow, and
 * a reload would wipe the app's in-memory nav/scroll state along
 * with it (quite possibly the bug itself). Every event is appended
 * to `weezer-scrolldebug-log` (JSON, capped at 120, oldest dropped)
 * and the buffer rehydrates from it, so the overlay and Copy log
 * show the full tab-session history across reloads. Timestamps are
 * milliseconds on a wall-clock epoch stored in
 * `weezer-scrolldebug-meta`, so relative times stay coherent
 * across reloads (v1 used performance.now, which resets per load).
 *
 * Three evidence lines discriminate the reload hypothesis:
 *   BOOT #n                  — appended once per document load; the
 *                              counter lives in the persisted meta.
 *   pageshow persisted=...   — true means this realm was restored
 *                              from the back/forward cache; false
 *                              means a fresh document load.
 *   pagehide persisted=...   — best effort, recorded on the way
 *                              out (sessionStorage writes are
 *                              synchronous, so it lands).
 * A BOOT #2 appearing mid-repro with persisted=false proves a
 * reload killed the in-memory state; a single BOOT #1 spanning the
 * whole flow (pageshow persisted=true on the Back landing) kills
 * the hypothesis. Storage failures (private mode / quota) degrade
 * silently to v1 in-memory behavior and never throw into app code.
 */

export const SCROLL_DEBUG_FLAG = 'weezer-scrolldebug';

const LOG_KEY = 'weezer-scrolldebug-log';
const META_KEY = 'weezer-scrolldebug-meta';
const MAX_EVENTS = 120;

interface ScrollDebugEvent {
  t: number;
  text: string;
}

interface ScrollDebugMeta {
  /** Wall-clock ms of the session's first event; all timestamps
   *  are relative to it, across every reload in the tab session. */
  epoch: number;
  /** Document loads so far in this tab session. */
  boots: number;
}

let events: ScrollDebugEvent[] = [];
let meta: ScrollDebugMeta | null = null;
let hydrated = false;
let booted = false;
let pageListenersRegistered = false;
const listeners = new Set<() => void>();

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
    /* private mode / quota: degrade to in-memory only */
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

function flagOn(): boolean {
  return storageGet(SCROLL_DEBUG_FLAG) === '1';
}

/** Load the persisted log + meta into memory (once per document).
 *  Silent: appends nothing and notifies nobody, so render-path
 *  readers (the overlay) can call it without side effects. */
function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rawLog = storageGet(LOG_KEY);
    if (rawLog) {
      const parsed: unknown = JSON.parse(rawLog);
      if (Array.isArray(parsed)) {
        events = parsed
          .filter(
            (e): e is ScrollDebugEvent =>
              !!e &&
              typeof (e as ScrollDebugEvent).t === 'number' &&
              typeof (e as ScrollDebugEvent).text === 'string',
          )
          .slice(-MAX_EVENTS);
      }
    }
    const rawMeta = storageGet(META_KEY);
    if (rawMeta) {
      const parsed: unknown = JSON.parse(rawMeta);
      if (
        parsed &&
        typeof (parsed as ScrollDebugMeta).epoch === 'number' &&
        typeof (parsed as ScrollDebugMeta).boots === 'number'
      ) {
        meta = {
          epoch: (parsed as ScrollDebugMeta).epoch,
          boots: (parsed as ScrollDebugMeta).boots,
        };
      }
    }
  } catch {
    events = [];
    meta = null;
  }
}

function persist(): void {
  storageSet(LOG_KEY, JSON.stringify(events));
  if (meta) storageSet(META_KEY, JSON.stringify(meta));
}

function appendRaw(text: string): void {
  hydrate();
  if (!meta) meta = { epoch: Date.now(), boots: 0 };
  const t = Math.max(0, Math.round(Date.now() - meta.epoch));
  events = [...events.slice(-(MAX_EVENTS - 1)), { t, text }];
  persist();
  listeners.forEach((fn) => fn());
}

function onPageShow(event: PageTransitionEvent): void {
  if (flagOn()) appendRaw(`pageshow persisted=${event.persisted}`);
}

function onPageHide(event: PageTransitionEvent): void {
  if (flagOn()) appendRaw(`pagehide persisted=${event.persisted}`);
}

function registerPageListeners(): void {
  if (pageListenersRegistered || typeof window === 'undefined') return;
  pageListenersRegistered = true;
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('pagehide', onPageHide);
}

/** Once per document load: bump the persisted boot counter and log
 *  the BOOT #n marker. A bfcache restore keeps this realm alive, so
 *  it does NOT re-boot — the pageshow persisted=true line is that
 *  case's marker instead. */
function boot(): void {
  if (booted || typeof window === 'undefined' || !flagOn()) return;
  booted = true;
  hydrate();
  if (!meta) meta = { epoch: Date.now(), boots: 0 };
  meta.boots += 1;
  registerPageListeners();
  appendRaw(`BOOT #${meta.boots}`);
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
  if (flagOn()) boot();
  return flagOn();
}

export function isScrollDebugOn(): boolean {
  const on = flagOn();
  if (on) boot();
  return on;
}

export function disableScrollDebug(): void {
  storageRemove(SCROLL_DEBUG_FLAG);
  storageRemove(LOG_KEY);
  storageRemove(META_KEY);
  events = [];
  meta = null;
  hydrated = true;
  booted = false;
  listeners.forEach((fn) => fn());
}

/** Append one event. No-op (one storage read) while the flag is
 *  off, except that a ?scrolldebug=1 URL switches it on first. */
export function logScrollDebug(text: string): void {
  if (typeof window === 'undefined') return;
  if (!flagOn() && !activateScrollDebugFromUrl()) return;
  boot();
  appendRaw(text);
}

export function getScrollDebugEvents(): ScrollDebugEvent[] {
  hydrate();
  return events;
}

export function scrollDebugLogText(): string {
  hydrate();
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
