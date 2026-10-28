'use client';

/**
 * The established fanhood — the depth game's durable verdict.
 *
 * FIVE-GAME MODEL (Oct 27, 2026). A player's fanhood is the SUM of
 * their finished game scores across the five themed games of How
 * Rare a Weezer Fan Are You? — each game is one-and-done: a
 * finished game writes its result ONCE and it never changes, and
 * finishing a game can only add to the total. The overall title
 * comes from the compound ladder (totalTitleForDepth in
 * app/data/loreGame.ts); a single game's own verdict keeps using
 * the per-game ladder (titleForDepth), and surfaces label the two
 * distinctly.
 *
 * Stored record (localStorage key 'weezer-lore-best' — the game's
 * original key, deliberately not renamed, so saved state keeps
 * working):
 *   { games: { game1?: { score, deepest, finishedAt, log }, … },
 *     legacyBest: { bestDepth, deepest, updatedAt } | null,
 *     updatedAt: ISO string | null }
 *
 * `deepest` per game is that game's single deepest answer — the
 * brag the Thread and the card quote (the deepest across games
 * wins the quote). `log` is the per-prompt record of the finished
 * game (prompt id, landed answer or null, depth earned) — it
 * powers the picker's "Every answer" view for locked games.
 *
 * LEGACY MIGRATION (Mark-vetoable, flagged in REPORT.md): records
 * from the old single game — the { bestDepth, deepest, updatedAt }
 * shape, and behind it the bare-number and { depth, band } shapes
 * — are preserved as `legacyBest`. Until the player finishes a
 * new-system game, every surface keeps showing the legacy verdict
 * exactly as it did; once any game is finished, the fanhood is the
 * games total and the legacy best no longer counts.
 *
 * For signed-in players the record ALSO lives on their account
 * (public.fanhood; see app/lib/fanhoodSync.ts) and follows them
 * across browsers and devices. localStorage stays the surface
 * every reader uses; the account copy is merged into it whenever a
 * session is established and after every recorded game. Guests are
 * local-only. Until the games-column migration is applied, sync
 * degrades silently to the legacy columns and local behavior.
 */

import { useSyncExternalStore } from 'react';
import { LORE_GAMES, titleForDepth, totalTitleForDepth } from '../data/loreGame';
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

/** A best depth earned under the old single game, preserved. */
export interface FanhoodLegacyBest {
  bestDepth: number;
  deepest: FanhoodDeepest | null;
  updatedAt: string | null;
}

export interface FanhoodRecord {
  games: Partial<Record<LoreGameId, FanhoodGameResult>>;
  legacyBest: FanhoodLegacyBest | null;
  /** ISO timestamp of the last change; null for undated legacy. */
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

/** The deepest single answer behind the fanhood: across finished
 *  games when there are any, else the legacy best's. */
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
  if (best) return best;
  if (fanhoodGamesPlayed(record) > 0) return null;
  return record.legacyBest?.deepest ?? null;
}

export interface FanhoodDisplay {
  depth: number;
  title: string;
  deepest: FanhoodDeepest | null;
  /** True when the display is the preserved old-game verdict. */
  legacy: boolean;
  gamesPlayed: number;
}

/**
 * What every fanhood surface shows. New-system results exist →
 * the compound total and its title. Otherwise the legacy verdict,
 * exactly as the old game left it. Null when no fanhood exists.
 */
export function fanhoodDisplay(
  record: FanhoodRecord | null
): FanhoodDisplay | null {
  if (!record) return null;
  const played = fanhoodGamesPlayed(record);
  if (played > 0) {
    const total = fanhoodTotal(record);
    return {
      depth: total,
      title: totalTitleForDepth(total),
      deepest: fanhoodDeepestAnswer(record),
      legacy: false,
      gamesPlayed: played,
    };
  }
  if (record.legacyBest) {
    return {
      depth: record.legacyBest.bestDepth,
      title: titleForDepth(record.legacyBest.bestDepth),
      deepest: record.legacyBest.deepest,
      legacy: true,
      gamesPlayed: 0,
    };
  }
  return null;
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

function parseLegacyBest(value: unknown): FanhoodLegacyBest | null {
  if (typeof value !== 'object' || value === null) return null;
  const l = value as Record<string, unknown>;
  if (typeof l.bestDepth !== 'number' || !Number.isFinite(l.bestDepth)) {
    return null;
  }
  if (l.bestDepth <= 0) return null;
  return {
    bestDepth: l.bestDepth,
    deepest: isDeepest(l.deepest) ? l.deepest : null,
    updatedAt: typeof l.updatedAt === 'string' ? l.updatedAt : null,
  };
}

function legacyRecord(best: FanhoodLegacyBest): FanhoodRecord {
  return { games: {}, legacyBest: best, updatedAt: best.updatedAt };
}

/** Any stored shape → the current record, or null when nothing
 *  usable is stored. Every older shape lands in `legacyBest`. */
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
    return parsed > 0
      ? legacyRecord({ bestDepth: parsed, deepest: null, updatedAt: null })
      : null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  // Current (five-game) shape.
  if ('games' in obj || 'legacyBest' in obj) {
    const games = parseGamesMap(obj.games);
    const legacyBest = parseLegacyBest(obj.legacyBest);
    if (Object.keys(games).length === 0 && !legacyBest) return null;
    return {
      games,
      legacyBest,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
    };
  }
  // The account-era shape: { bestDepth, deepest, updatedAt }.
  if (typeof obj.bestDepth === 'number' && Number.isFinite(obj.bestDepth)) {
    const legacy = parseLegacyBest(obj);
    return legacy ? legacyRecord(legacy) : null;
  }
  // Legacy shape 2: the { depth, band } object (through v7).
  if (typeof obj.depth === 'number' && Number.isFinite(obj.depth)) {
    return obj.depth > 0
      ? legacyRecord({ bestDepth: obj.depth, deepest: null, updatedAt: null })
      : null;
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
    legacyBest: current?.legacyBest ?? null,
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

function mergeLegacyBest(
  a: FanhoodLegacyBest | null,
  b: FanhoodLegacyBest | null
): FanhoodLegacyBest | null {
  if (!a) return b;
  if (!b) return a;
  if (a.bestDepth !== b.bestDepth) return a.bestDepth > b.bestDepth ? a : b;
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
 * tie keeps the higher score, then `a`). Legacy bests merge by the
 * old rule (deeper wins, then deepest-carrier, then newer). The
 * total is never stored — it is always recomputed from the map.
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
    legacyBest: mergeLegacyBest(a.legacyBest, b.legacyBest),
    updatedAt: laterIso(a.updatedAt, b.updatedAt),
  };
}

/** A public.fanhood row, as the client reads it back. `games` is
 *  absent until the games migration is applied. */
export interface FanhoodRow {
  user_id: string;
  best_depth: number;
  deepest: unknown;
  games?: unknown;
  updated_at: unknown;
}

/** Row → record. The row's best_depth/deepest columns mirror the
 *  DISPLAY values (fanhoodRowFromRecord), so a row with no games
 *  reconstructs its fanhood as a legacy best; a row with games is
 *  self-sufficient and the columns are just its mirror. */
export function fanhoodRecordFromRow(
  row: FanhoodRow | null | undefined
): FanhoodRecord | null {
  if (!row) return null;
  const games = parseGamesMap(row.games);
  const updatedAt =
    typeof row.updated_at === 'string' ? row.updated_at : null;
  if (Object.keys(games).length > 0) {
    return { games, legacyBest: null, updatedAt };
  }
  if (typeof row.best_depth !== 'number' || !Number.isFinite(row.best_depth)) {
    return null;
  }
  const legacy = parseLegacyBest({
    bestDepth: row.best_depth,
    deepest: row.deepest,
    updatedAt,
  });
  return legacy ? { games: {}, legacyBest: legacy, updatedAt } : null;
}

/** Record → the row shape an upsert writes: the games map plus the
 *  legacy columns mirroring the display (total when games exist,
 *  else the legacy best), so older readers and the leaderboard's
 *  fallback see the same fanhood the surfaces show. */
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
