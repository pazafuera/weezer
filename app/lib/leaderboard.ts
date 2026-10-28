/**
 * The fanhood leaderboard — pure standings logic.
 *
 * The rows come from the get_fanhood_leaderboard() SECURITY DEFINER
 * function (supabase/migrations/20261027_fanhood_games.sql — file
 * only until Mark runs it): username, total depth, games played,
 * and per-game scores for every player who has finished at least
 * one game (an old-game best counts as a finish with 0 games
 * played). The friends board is this same list filtered against
 * the existing friendships data — no second query, and a future
 * county board is another filter over the same rows.
 *
 * Ranking (composition v1): completers (all five games) rank by
 * total first; in-progress players follow, by games played, then
 * total. A per-game board ranks that game's finishers by their
 * score in it. Ties break on the total, then the username, so the
 * order is fully deterministic.
 */

import { LORE_GAMES } from '../data/loreGame';
import type { LoreGameId } from '../data/loreGame';

export interface LeaderboardEntry {
  username: string;
  totalDepth: number;
  gamesPlayed: number;
  gameScores: Partial<Record<LoreGameId, number>>;
}

export type LeaderboardScope = 'all' | LoreGameId;

const KNOWN_GAME_IDS = new Set<string>(LORE_GAMES.map((g) => g.id));
export const TOTAL_GAMES = LORE_GAMES.length;

/** RPC rows → standings entries, with the same defensiveness as
 *  the fanhood row mapping: anything malformed is dropped, never
 *  repaired into a fake row. */
export function parseLeaderboardRows(data: unknown): LeaderboardEntry[] {
  if (!Array.isArray(data)) return [];
  const entries: LeaderboardEntry[] = [];
  for (const raw of data) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.username !== 'string' || row.username.length === 0) {
      continue;
    }
    if (typeof row.total_depth !== 'number' || !Number.isFinite(row.total_depth)) {
      continue;
    }
    const gameScores: Partial<Record<LoreGameId, number>> = {};
    if (typeof row.game_scores === 'object' && row.game_scores !== null) {
      for (const [id, score] of Object.entries(
        row.game_scores as Record<string, unknown>
      )) {
        if (KNOWN_GAME_IDS.has(id) && typeof score === 'number') {
          gameScores[id as LoreGameId] = score;
        }
      }
    }
    entries.push({
      username: row.username,
      totalDepth: row.total_depth,
      gamesPlayed:
        typeof row.games_played === 'number' ? row.games_played : 0,
      gameScores,
    });
  }
  return entries;
}

const byUsername = (a: LeaderboardEntry, b: LeaderboardEntry): number =>
  a.username.localeCompare(b.username);

/** The standings in display order for a scope. Pure — returns a
 *  new array; for a game scope, only that game's finishers appear. */
export function rankLeaderboard(
  entries: LeaderboardEntry[],
  scope: LeaderboardScope
): LeaderboardEntry[] {
  if (scope !== 'all') {
    return entries
      .filter((e) => e.gameScores[scope] !== undefined)
      .sort(
        (a, b) =>
          (b.gameScores[scope] ?? 0) - (a.gameScores[scope] ?? 0) ||
          b.totalDepth - a.totalDepth ||
          byUsername(a, b)
      );
  }
  return [...entries].sort((a, b) => {
    const aDone = a.gamesPlayed >= TOTAL_GAMES ? 0 : 1;
    const bDone = b.gamesPlayed >= TOTAL_GAMES ? 0 : 1;
    if (aDone !== bDone) return aDone - bDone;
    if (aDone === 1 && a.gamesPlayed !== b.gamesPlayed) {
      return b.gamesPlayed - a.gamesPlayed;
    }
    return b.totalDepth - a.totalDepth || byUsername(a, b);
  });
}

/** The friends board: the worldwide rows whose username is in the
 *  friend set (the caller includes the player's own username, so
 *  they see themselves among their friends). */
export function filterLeaderboardFriends(
  entries: LeaderboardEntry[],
  usernames: Iterable<string>
): LeaderboardEntry[] {
  const set = new Set(usernames);
  return entries.filter((e) => set.has(e.username));
}
