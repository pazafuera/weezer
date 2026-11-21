/**
 * Sort paths (owner, Nov 14, 2026): before a fresh sorter
 * sees the deck, they pick how much of the catalog to take
 * on — the casual set (Blue + Pinkerton + the singles), a
 * hand-picked set of albums, or all 206. A path is only a
 * scope on what the deck deals: buckets, saves, and stats
 * are untouched, songs outside the path simply stay
 * unstarted, and changing paths never loses a sorted song.
 *
 * Device-local for now (same precedent as the refine
 * decisions and lower-bucket opt-ins): the choice lives in
 * localStorage and is read after mount.
 */
import { FULL_SONG_POOL, SINGLE_SONG_IDS } from '../data/constants';

export type SortPath =
  | { kind: 'all' }
  | { kind: 'casual' }
  | { kind: 'albums'; albums: string[] };

const STORAGE_KEY = 'weezer-sort-path';

export function loadSortPath(): SortPath | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseSortPath(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Validate an unknown value as a sort path (the device copy
 *  parsed from JSON, or the database's jsonb value). */
export function parseSortPath(raw: unknown): SortPath | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as SortPath;
  if (parsed.kind === 'all' || parsed.kind === 'casual') return parsed;
  if (
    parsed.kind === 'albums' &&
    Array.isArray(parsed.albums) &&
    parsed.albums.length > 0 &&
    parsed.albums.every((a) => typeof a === 'string')
  ) {
    return parsed;
  }
  return null;
}

function writeSortPathLocal(path: SortPath): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(path));
  } catch {
    /* storage unavailable — the in-memory choice still holds
       for the session. */
  }
}

/**
 * The database bridge (owner, Nov 20, 2026): the context
 * registers a writer once its probe proves the sort_path
 * column exists, and every saveSortPath then mirrors the
 * choice to the fan's row — the path follows the account
 * like the rankings do, instead of living and dying with
 * one browser's storage. Unregistered (signed out, or the
 * column not there yet), the path stays device-local,
 * exactly as before.
 */
let sortPathDbWriter: ((path: SortPath) => void) | null = null;

export function registerSortPathDbWriter(
  writer: ((path: SortPath) => void) | null
): void {
  sortPathDbWriter = writer;
}

export function saveSortPath(path: SortPath): void {
  writeSortPathLocal(path);
  try {
    sortPathDbWriter?.(path);
  } catch {
    /* the device copy already landed — the mirror is a bonus */
  }
}

/** Write only the device copy — for applying a value that
 *  CAME from the database, so it isn't written straight back. */
export function saveSortPathLocal(path: SortPath): void {
  writeSortPathLocal(path);
}

/** The song ids a path scopes to, in pool order. The 'all'
 *  path is the whole pool. */
export function sortPathSongIds(path: SortPath): string[] {
  if (path.kind === 'casual') return Array.from(CASUAL_SONG_IDS);
  if (path.kind === 'albums') {
    return FULL_SONG_POOL.filter((s) => path.albums.includes(s.album)).map(
      (s) => s.id
    );
  }
  return FULL_SONG_POOL.map((s) => s.id);
}

/** The casual set: Blue + Pinkerton + every single. Matches
 *  the triage sections it scopes to (Blue, Pinkerton, and
 *  the Singles block), so the count below is the exact size
 *  of the casual deck. */
const casualIds = new Set<string>();
FULL_SONG_POOL.forEach((s) => {
  if (s.album === 'The Blue Album' || s.album === 'Pinkerton') {
    casualIds.add(s.id);
  }
});
SINGLE_SONG_IDS.forEach((id) => casualIds.add(id));
export const CASUAL_SONG_IDS: ReadonlySet<string> = casualIds;

export function sortPathLabel(path: SortPath): string {
  if (path.kind === 'casual') return 'Blue, Pinkerton + the hits';
  if (path.kind === 'albums')
    return path.albums.length === 1
      ? path.albums[0]
      : `${path.albums.length} albums`;
  return 'All 206';
}
