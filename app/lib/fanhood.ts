'use client';

/**
 * The established fanhood — the depth game's durable verdict.
 *
 * A player's fanhood is ESTABLISHED by their best finished run of
 * How Rare a Weezer Fan Are You? and read back by surfaces that
 * never mount the game (the Sweater Thread's fanhood stop, the
 * Shareables fanhood card). It lives in localStorage under the
 * game's original best-score key ('weezer-lore-best') — the key is
 * an internal identifier and deliberately NOT renamed in the v8
 * display rename, so saved state keeps working.
 *
 * Stored record:
 *   { bestDepth, deepest: { answer, promptLabel, depth } | null,
 *     updatedAt: ISO string | null }
 *
 * `deepest` is the best run's single deepest answer — the brag the
 * Thread and the card quote. Legacy values migrate on read:
 *   - a bare number (the game's first best-score shape) becomes
 *     { bestDepth: n, deepest: null, updatedAt: null };
 *   - the { depth, band } object the game wrote through v7 becomes
 *     { bestDepth: depth, deepest: null, updatedAt: null }.
 * A migrated record is only rewritten in the new shape when a new
 * best is set — reads never write.
 *
 * For signed-in players the record ALSO lives on their account
 * (public.fanhood; see app/lib/fanhoodSync.ts) and follows them
 * across browsers and devices — iOS home-screen web apps and
 * Safari keep separate localStorage, so a device-only record is
 * invisible from the other. localStorage stays the surface every
 * reader uses; the account copy is merged into it (deeper wins)
 * whenever a session is established and after every settled run.
 * Guests are local-only, exactly as before.
 */

import { useSyncExternalStore } from 'react';

export interface FanhoodDeepest {
  /** The answer as displayed in the game (canonical form). */
  answer: string;
  /** The prompt it answered (the prompt's own text). */
  promptLabel: string;
  /** The depth that single answer earned. */
  depth: number;
}

export interface FanhoodRecord {
  /** The player's best finished-run depth. Their fanhood title is
   *  titleForDepth(bestDepth) — never stored, always derived, so
   *  the ladder can't drift from the record. */
  bestDepth: number;
  deepest: FanhoodDeepest | null;
  /** ISO timestamp of the run that set the best; null when the
   *  record migrated from a legacy value that carried no date. */
  updatedAt: string | null;
}

export const FANHOOD_STORAGE_KEY = 'weezer-lore-best';

/* ------------------------------------------------------------------ */
/* Parse / serialize (pure — the harness exercises these directly)     */
/* ------------------------------------------------------------------ */

function isDeepest(value: unknown): value is FanhoodDeepest {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Partial<FanhoodDeepest>;
  return (
    typeof d.answer === 'string' &&
    typeof d.promptLabel === 'string' &&
    typeof d.depth === 'number'
  );
}

/** Any stored shape → the current record, or null when nothing
 *  usable is stored. */
export function parseFanhoodValue(raw: string | null): FanhoodRecord | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  // Legacy shape 1: the bare number.
  if (typeof parsed === 'number' && Number.isFinite(parsed)) {
    return { bestDepth: parsed, deepest: null, updatedAt: null };
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  // Current shape.
  if (typeof obj.bestDepth === 'number' && Number.isFinite(obj.bestDepth)) {
    return {
      bestDepth: obj.bestDepth,
      deepest: isDeepest(obj.deepest) ? obj.deepest : null,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
    };
  }
  // Legacy shape 2: the { depth, band } object (through v7).
  if (typeof obj.depth === 'number' && Number.isFinite(obj.depth)) {
    return { bestDepth: obj.depth, deepest: null, updatedAt: null };
  }
  return null;
}

export function serializeFanhood(record: FanhoodRecord): string {
  return JSON.stringify(record);
}

/* ------------------------------------------------------------------ */
/* Storage access + change notification                                */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notifyFanhoodChanged(): void {
  listeners.forEach((cb) => cb());
}

export function readFanhood(): FanhoodRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseFanhoodValue(
      window.localStorage.getItem(FANHOOD_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeFanhood(record: FanhoodRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      FANHOOD_STORAGE_KEY,
      serializeFanhood(record)
    );
  } catch {
    /* storage unavailable — the fanhood simply doesn't persist */
  }
  notifyFanhoodChanged();
}

/**
 * Settles a finished run against the established fanhood. A run
 * only replaces the record when it goes deeper than the best —
 * fanhood can move up, never down. `isNewBest` keeps the game's
 * long-standing meaning: a previous best existed AND this run beat
 * it (a first-ever run establishes the fanhood without the "new
 * best" fanfare).
 */
export function settleFanhoodRun(
  total: number,
  deepest: FanhoodDeepest | null
): {
  record: FanhoodRecord;
  previous: FanhoodRecord | null;
  isNewBest: boolean;
} {
  const previous = readFanhood();
  if (!previous || total > previous.bestDepth) {
    const record: FanhoodRecord = {
      bestDepth: total,
      deepest,
      updatedAt: new Date().toISOString(),
    };
    writeFanhood(record);
    return { record, previous, isNewBest: previous !== null };
  }
  return { record: previous, previous, isNewBest: false };
}

/* ------------------------------------------------------------------ */
/* Merge + account-row mapping (pure — the harness exercises these)   */
/* ------------------------------------------------------------------ */

/**
 * Reconciles two views of the same player's fanhood — the device
 * record and the account record (public.fanhood) — into one. The
 * deeper best wins outright: fanhood only ever moves up. On a tie,
 * the record carrying a deepest answer wins (it can prove the brag
 * the Thread and the card quote); then the more recently set record.
 * Null means "no fanhood there" and always loses.
 */
export function mergeFanhoodRecords(
  a: FanhoodRecord | null,
  b: FanhoodRecord | null
): FanhoodRecord | null {
  if (!a) return b;
  if (!b) return a;
  if (a.bestDepth !== b.bestDepth) {
    return a.bestDepth > b.bestDepth ? a : b;
  }
  if ((a.deepest === null) !== (b.deepest === null)) {
    return a.deepest !== null ? a : b;
  }
  const aTime = a.updatedAt ? Date.parse(a.updatedAt) : NaN;
  const bTime = b.updatedAt ? Date.parse(b.updatedAt) : NaN;
  if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
    return aTime > bTime ? a : b;
  }
  if (Number.isNaN(aTime) !== Number.isNaN(bTime)) {
    return Number.isNaN(aTime) ? b : a;
  }
  return a;
}

/** A public.fanhood row, as the client reads it back. */
export interface FanhoodRow {
  user_id: string;
  best_depth: number;
  deepest: unknown;
  updated_at: unknown;
}

/** Row → record, with parseFanhoodValue's defensiveness: a malformed
 *  deepest is dropped, a non-numeric best_depth voids the row. */
export function fanhoodRecordFromRow(
  row: FanhoodRow | null | undefined
): FanhoodRecord | null {
  if (!row) return null;
  if (typeof row.best_depth !== 'number' || !Number.isFinite(row.best_depth)) {
    return null;
  }
  return {
    bestDepth: row.best_depth,
    deepest: isDeepest(row.deepest) ? row.deepest : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

/** Record → the row shape an upsert writes. A record with no
 *  timestamp (migrated from a legacy local value) is stamped now —
 *  being written to the account IS its establishment there. */
export function fanhoodRowFromRecord(
  userId: string,
  record: FanhoodRecord
): { user_id: string; best_depth: number; deepest: FanhoodDeepest | null; updated_at: string } {
  return {
    user_id: userId,
    best_depth: record.bestDepth,
    deepest: record.deepest,
    updated_at: record.updatedAt ?? new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* React binding (useSyncExternalStore)                                */
/* ------------------------------------------------------------------ */

function subscribeFanhood(onChange: () => void): () => void {
  listeners.add(onChange);
  // Cross-tab writes surface through the storage event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === FANHOOD_STORAGE_KEY) onChange();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(onChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

// useSyncExternalStore needs a referentially stable snapshot: cache
// the parsed record against the raw string it came from.
let snapshotRaw: string | null | undefined;
let snapshotRecord: FanhoodRecord | null = null;

function getFanhoodSnapshot(): FanhoodRecord | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(FANHOOD_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotRecord = parseFanhoodValue(raw);
  }
  return snapshotRecord;
}

function getServerFanhoodSnapshot(): FanhoodRecord | null {
  return null;
}

/** The established fanhood, live: null until a first run lands. */
export function useFanhood(): FanhoodRecord | null {
  return useSyncExternalStore(
    subscribeFanhood,
    getFanhoodSnapshot,
    getServerFanhoodSnapshot
  );
}
