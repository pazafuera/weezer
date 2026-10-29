'use client';

/**
 * The established fanhood — the depth game's durable verdict.
 *
 * FIVE-GAME MODEL (Oct 27, 2026). A player's fanhood is the SUM of
 * their finished game scores across the five themed games of Back
 * to the Shack — each game is one-and-done: a finished game writes
 * its result ONCE and it never changes, and finishing a game can
 * only add to the total. Standings are read off the journey's one
 * ladder (the stops in app/data/loreGame.ts): a single game's
 * score names its stop via the run bands, the total names its
 * stop via the total stops — same names on both scales.
 *
 * Stored record (localStorage key 'weezer-lore-best' — the game's
 * original key, deliberately not renamed, so saved state keeps
 * working):
 *   { games: { game1?: { score, deepest, finishedAt, log }, … },
 *     updatedAt: ISO string | null }
 *
 * `deepest` per game is that game's single deepest answer — the
 * brag the Thread and the card quote (the deepest across games
 * wins the quote). `log` is the per-prompt record of the finished
 * game (prompt id, landed answer or null, depth earned) — it
 * powers the picker's "Every answer" view for locked games.
 *
 * LEGACY RETIRED (Mark's full-wipe ruling, Oct 27, 2026): the old
 * single game's fanhood — the { bestDepth, deepest, updatedAt }
 * shape, the bare-number and { depth, band } shapes behind it,
 * and the `legacyBest` field the five-game record briefly carried
 * — no longer counts for anything. A stored value with no
 * finished games establishes NO fanhood, whatever older data it
 * carries, and reads normalize it away so the wipe sticks on the
 * device. Tester-era fanhood started over at zero for everyone;
 * only finished games make a fanhood now.
 *
 * For signed-in players the record ALSO lives on their account
 * (public.fanhood; see app/lib/fanhoodSync.ts) and follows them
 * across browsers and devices. localStorage stays the surface
 * every reader uses; the account copy is merged into it whenever a
 * session is established and after every recorded game. Guests are
 * local-only. Sync degrades silently to local behavior on any
 * failure.
 */

import { useSyncExternalStore } from 'react';
import {
  LORE_GAMES,
  nextStopForTotal,
  stopForTotal,
} from '../data/loreGame';
import type { LoreGameId } from '../data/loreGame';

export interface FanhoodDeepest {
  /** The answer as displayed in the game (canonical form). */
  answer: string;
  /** The prompt it answered (the prompt's own text). */
  promptLabel: string;
  /** The depth that single answer earned. */
  depth: number;
}

export interface FanhoodGameLogEntry {
  promptId: string;
  /** The landed answer's canonical text; null when nothing landed. */
  answer: string | null;
  depth: number;
}

/** One finished game's immutable result. */
export interface FanhoodGameResult {
  score: number;
  deepest: FanhoodDeepest | null;
  /** ISO timestamp of the finish — the recording commit point. */
  finishedAt: string;
  log: FanhoodGameLogEntry[];
}

export interface FanhoodRecord {
  games: Partial<Record<LoreGameId, FanhoodGameResult>>;
  /** ISO timestamp of the last change. */
  updatedAt: string | null;
}

export const FANHOOD_STORAGE_KEY = 'weezer-lore-best';

const KNOWN_GAME_IDS = new Set<string>(LORE_GAMES.map((g) => g.id));

/* ------------------------------------------------------------------ */
/* Derived views (pure)                                                */
/* ------------------------------------------------------------------ */

/** The compound total: the sum of finished game scores. */
export function fanhoodTotal(record: FanhoodRecord | null): number {
  if (!record) return 0;
  return Object.values(record.games).reduce(
    (sum, g) => sum + (g ? g.score : 0),
    0
  );
}

export function fanhoodGamesPlayed(record: FanhoodRecord | null): number {
  if (!record) return 0;
  return Object.keys(record.games).length;
}

/**
 * The picker's start-gate rule (mock v3 — the games are a SERIES,
 * Oct 28, 2026): a game can be started only while it has no
 * recorded result AND every earlier game in LORE_GAMES order has
 * one. Play on the up-next game opens the gate; once a result
 * lands the game is locked at its score and the gate can never
 * open for it again (one-and-done), and finishing it is what
 * unlocks the next game in the series. An out-of-order result
 * (e.g. recorded before the series rule existed) stays played —
 * the check only ever looks at the games before the target.
 */
export function gameCanStart(
  record: FanhoodRecord | null,
  gameId: LoreGameId
): boolean {
  if (record?.games[gameId]) return false;
  const index = LORE_GAMES.findIndex((g) => g.id === gameId);
  if (index <= 0) return index === 0;
  return LORE_GAMES.slice(0, index).every((g) => !!record?.games[g.id]);
}

/** A series row's state, derived from the record alone: a game
 *  with a result is played; a startable game is up next; anything
 *  else is still locked behind the games in front of it. */
export type SeriesRowState = 'played' | 'up-next' | 'locked';

export function seriesRowState(
  record: FanhoodRecord | null,
  gameId: LoreGameId
): SeriesRowState {
  if (record?.games[gameId]) return 'played';
  return gameCanStart(record, gameId) ? 'up-next' : 'locked';
}

const REMAINING_WORDS = ['one', 'two', 'three', 'four'];

/**
 * The combined block's standing line: the stop the total has
 * reached, the distance to the next one, and how much of the
 * series is left. Null until a first game is finished — the same
 * no-fanhood state as every other surface. The stop is the total
 * scale's (stopForTotal via fanhoodDisplay), never a single
 * game's.
 */
export function fanhoodStandingLine(
  record: FanhoodRecord | null
): string | null {
  const display = fanhoodDisplay(record);
  if (!display) return null;
  const next = nextStopForTotal(display.depth);
  const standing = next
    ? `You're at ${display.stop} — ${next.pointsTo.toLocaleString('en-US')} points from ${next.title}`
    : "You're back at the Shack";
  const remaining = LORE_GAMES.length - display.gamesPlayed;
  if (remaining <= 0) return `${standing}. All five games in.`;
  const word = REMAINING_WORDS[remaining - 1] ?? String(remaining);
  return remaining === 1
    ? `${standing}, ${word} game to go.`
    : `${standing}, ${word} games to go.`;
}

/** The deepest single answer behind the fanhood, across the
 *  finished games. */
export function fanhoodDeepestAnswer(
  record: FanhoodRecord | null
): FanhoodDeepest | null {
  if (!record) return null;
  let best: FanhoodDeepest | null = null;
  for (const game of Object.values(record.games)) {
    if (game?.deepest && (!best || game.deepest.depth > best.depth)) {
      best = game.deepest;
    }
  }
  return best;
}

export interface FanhoodDisplay {
  depth: number;
  /** The stop the total has reached (the one ladder's name). */
  stop: string;
  deepest: FanhoodDeepest | null;
  gamesPlayed: number;
}

/**
 * What every fanhood surface shows: the compound total of the
 * finished games and the stop it has reached. Null when no game
 * is finished — the same state as a brand-new player, whatever
 * older fanhood data the device or the account once carried.
 */
export function fanhoodDisplay(
  record: FanhoodRecord | null
): FanhoodDisplay | null {
  if (!record) return null;
  const played = fanhoodGamesPlayed(record);
  if (played === 0) return null;
  const total = fanhoodTotal(record);
  return {
    depth: total,
    stop: stopForTotal(total).title,
    deepest: fanhoodDeepestAnswer(record),
    gamesPlayed: played,
  };
}

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

function parseGameResult(value: unknown): FanhoodGameResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const g = value as Record<string, unknown>;
  if (typeof g.score !== 'number' || !Number.isFinite(g.score)) return null;
  if (typeof g.finishedAt !== 'string') return null;
  const log: FanhoodGameLogEntry[] = [];
  if (Array.isArray(g.log)) {
    for (const entry of g.log) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.promptId !== 'string') continue;
      log.push({
        promptId: e.promptId,
        answer: typeof e.answer === 'string' ? e.answer : null,
        depth: typeof e.depth === 'number' ? e.depth : 0,
      });
    }
  }
  return {
    score: g.score,
    deepest: isDeepest(g.deepest) ? g.deepest : null,
    finishedAt: g.finishedAt,
    log,
  };
}

function parseGamesMap(
  value: unknown
): Partial<Record<LoreGameId, FanhoodGameResult>> {
  const games: Partial<Record<LoreGameId, FanhoodGameResult>> = {};
  if (typeof value !== 'object' || value === null) return games;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!KNOWN_GAME_IDS.has(id)) continue;
    const parsed = parseGameResult(raw);
    if (parsed) games[id as LoreGameId] = parsed;
  }
  return games;
}

/** Any stored shape → the current record, or null when no
 *  finished game is in it. Retired (Oct 27, 2026): every older
 *  shape — the bare number, the { depth, band } object, the
 *  account-era { bestDepth, deepest } object, and a five-game
 *  record's `legacyBest` field — parses to nothing on its own; a
 *  record survives only through its finished games, with any
 *  legacy data it still carries dropped on the floor. */
export function parseFanhoodValue(raw: string | null): FanhoodRecord | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (!('games' in obj)) return null;
  const games = parseGamesMap(obj.games);
  if (Object.keys(games).length === 0) return null;
  return {
    games,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
  };
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
    const raw = window.localStorage.getItem(FANHOOD_STORAGE_KEY);
    const record = parseFanhoodValue(raw);
    // Normalize on load so the legacy wipe sticks on this device:
    // a stored value that no longer establishes a fanhood is
    // cleared, and one that survives only through its games is
    // rewritten without any legacy data it still carried.
    if (raw !== null) {
      if (record === null) {
        window.localStorage.removeItem(FANHOOD_STORAGE_KEY);
      } else if (serializeFanhood(record) !== raw) {
        window.localStorage.setItem(
          FANHOOD_STORAGE_KEY,
          serializeFanhood(record)
        );
      }
    }
    return record;
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
 * The pure core of recording a finished game. One-and-done: if the
 * game already has a result, the record comes back unchanged and
 * `recorded` is false — a game result never changes once recorded.
 */
export function applyGameResult(
  current: FanhoodRecord | null,
  gameId: LoreGameId,
  result: {
    score: number;
    deepest: FanhoodDeepest | null;
    log: FanhoodGameLogEntry[];
  },
  nowIso: string
): { record: FanhoodRecord; recorded: boolean } {
  if (current?.games[gameId]) {
    return { record: current, recorded: false };
  }
  const record: FanhoodRecord = {
    games: {
      ...(current?.games ?? {}),
      [gameId]: {
        score: result.score,
        deepest: result.deepest,
        finishedAt: nowIso,
        log: result.log,
      },
    },
    updatedAt: nowIso,
  };
  return { record, recorded: true };
}

/**
 * Records a finished game into the stored fanhood — the commit
 * point is the game's completion (a started-but-unfinished game
 * never calls this). Writes locally; account sync rides on
 * fanhoodSync after the game settles.
 */
export function recordGameResult(
  gameId: LoreGameId,
  result: {
    score: number;
    deepest: FanhoodDeepest | null;
    log: FanhoodGameLogEntry[];
  }
): { record: FanhoodRecord; recorded: boolean } {
  const applied = applyGameResult(
    readFanhood(),
    gameId,
    result,
    new Date().toISOString()
  );
  if (applied.recorded) writeFanhood(applied.record);
  return applied;
}

/* ------------------------------------------------------------------ */
/* Merge + account-row mapping (pure — the harness exercises these)   */
/* ------------------------------------------------------------------ */

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Reconciles two views of the same player's fanhood — the device
 * record and the account record — into one. Per-game union: a
 * recorded game result is immutable, so a game present on both
 * sides keeps the EARLIER finish (the first recording stands; a
 * tie keeps the higher score, then `a`). The total is never
 * stored — it is always recomputed from the map.
 */
export function mergeFanhoodRecords(
  a: FanhoodRecord | null,
  b: FanhoodRecord | null
): FanhoodRecord | null {
  if (!a) return b;
  if (!b) return a;
  const games: Partial<Record<LoreGameId, FanhoodGameResult>> = {};
  const ids = [...Object.keys(a.games), ...Object.keys(b.games)].filter(
    (id, i, all) => all.indexOf(id) === i
  );
  for (const id of ids) {
    const ga = a.games[id as LoreGameId];
    const gb = b.games[id as LoreGameId];
    if (ga && gb) {
      if (ga.finishedAt !== gb.finishedAt) {
        games[id as LoreGameId] = ga.finishedAt < gb.finishedAt ? ga : gb;
      } else if (ga.score !== gb.score) {
        games[id as LoreGameId] = ga.score > gb.score ? ga : gb;
      } else {
        games[id as LoreGameId] = ga;
      }
    } else {
      const only = ga ?? gb;
      if (only) games[id as LoreGameId] = only;
    }
  }
  return {
    games,
    updatedAt: laterIso(a.updatedAt, b.updatedAt),
  };
}

/** A public.fanhood row, as the client reads it back. `games` is
 *  absent until the games migration is applied. The best_depth /
 *  deepest columns are still selected (they mirror the games
 *  display on write) but are never read back into a fanhood. */
export interface FanhoodRow {
  user_id: string;
  best_depth: number;
  deepest: unknown;
  games?: unknown;
  updated_at: unknown;
}

/** Row → record, from the games column ONLY. A row with no
 *  finished games is no fanhood at all — the retired legacy
 *  columns never reconstruct one, so a pre-wipe account row can't
 *  resurrect an old-game total on a fresh device. */
export function fanhoodRecordFromRow(
  row: FanhoodRow | null | undefined
): FanhoodRecord | null {
  if (!row) return null;
  const games = parseGamesMap(row.games);
  if (Object.keys(games).length === 0) return null;
  const updatedAt =
    typeof row.updated_at === 'string' ? row.updated_at : null;
  return { games, updatedAt };
}

/** Record → the row shape an upsert writes: the games map plus
 *  the best_depth / deepest columns mirroring the games display
 *  (0 / null when no game is finished), so the columns can never
 *  carry a total the games didn't earn. */
export function fanhoodRowFromRecord(
  userId: string,
  record: FanhoodRecord
): {
  user_id: string;
  best_depth: number;
  deepest: FanhoodDeepest | null;
  games: Partial<Record<LoreGameId, FanhoodGameResult>>;
  updated_at: string;
} {
  const display = fanhoodDisplay(record);
  return {
    user_id: userId,
    best_depth: display?.depth ?? 0,
    deepest: display?.deepest ?? null,
    games: record.games,
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

/** The established fanhood, live: null until a first game lands. */
export function useFanhood(): FanhoodRecord | null {
  return useSyncExternalStore(
    subscribeFanhood,
    getFanhoodSnapshot,
    getServerFanhoodSnapshot
  );
}
