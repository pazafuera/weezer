/**
 * tribeFrame.ts — the Fan Tribe card's signature-album ("Exhibit
 * A") derivation (owner ruling, Nov 7, 2026 — Build 8).
 *
 * The frame shows the album of the fan's TOP SONGS — the songs
 * they put in the top buckets ('banger' / 'slaps', the same
 * "top" the tribe rules themselves use in computeTribe) — NOT
 * the most-counted album across the whole ranked list. The
 * whole-list count let a big ranked tail outvote the fan's
 * actual favorites: on the owner's own data, 18 ranked B-sides
 * made the frame B-Sides & Rarities while his top songs are
 * Blue Album songs. Pure and dependency-light (constants only)
 * so the rankings harness can pin it (scenario (p)).
 *
 * Fallbacks, in order: if the fan has no top-bucket songs at
 * all, the whole RANKED list decides (yesterday's behavior —
 * a mid-heavy fan still gets the frame their rankings point
 * at); if nothing resolves, the first song's album (the
 * pre-ruling last resort); if there are no songs, undefined
 * and the card renders without a frame.
 */

import { ALBUM_NAME_TO_ID } from '../data/constants';

type FrameSong = {
  id: string;
  album?: string;
  albumId?: string;
};

function resolve(song: FrameSong): string | undefined {
  if (song.albumId) return song.albumId;
  if (song.album) return ALBUM_NAME_TO_ID[song.album];
  return undefined;
}

function dominantIn(pool: FrameSong[]): string | undefined {
  const counts = new Map<string, number>();
  for (const s of pool) {
    const id = resolve(s);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  counts.forEach((c, id) => {
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  });
  return best;
}

export function dominantTribeAlbumId(
  songs: FrameSong[],
  triageMap: Record<string, string>
): string | undefined {
  const top = songs.filter((s) => {
    const b = triageMap[s.id];
    return b === 'banger' || b === 'slaps';
  });
  if (top.length > 0) {
    const fromTop = dominantIn(top);
    if (fromTop) return fromTop;
  }
  const ranked = songs.filter((s) => {
    const b = triageMap[s.id];
    return b !== undefined && b !== 'unknown';
  });
  const fromRanked = dominantIn(ranked);
  if (fromRanked) return fromRanked;
  return songs[0] ? resolve(songs[0]) : undefined;
}
