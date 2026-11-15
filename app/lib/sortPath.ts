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
    const parsed = JSON.parse(raw) as SortPath;
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
  } catch {
    return null;
  }
}

export function saveSortPath(path: SortPath): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(path));
  } catch {
    /* storage unavailable — the in-memory choice still holds
       for the session. */
  }
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
