/**
 * Album tier membership (owner's rules, Nov 8, 2026).
 *
 * S / A / B are rank bands (top 2 / top 5 / top 10 of the album
 * ranking). F is score-driven, not a rank band: an album belongs in
 * F when its songs' raw bucket mean is really that bad — under
 * F_SCORE_CEILING on the 1–5 bucket-points scale (banger 5, slaps 4,
 * mid 3, skip 2, trash 1), i.e. its songs average worse than Skip —
 * and the single lowest-ranked album always lands in F too, provided
 * the ranking has at least F_GUARANTEE_MIN_ALBUMS albums (so a short
 * partial ranking never brands its only handful). C takes everything
 * between B and F.
 *
 * F is checked first: a genuinely bad score outranks a good rank.
 */

export const F_SCORE_CEILING = 2.0;
export const F_GUARANTEE_MIN_ALBUMS = 6;

export type AlbumTierLabel = 'S' | 'A' | 'B' | 'C' | 'F';

export function albumTierLabel(
  rank: number,
  rawScore: number | undefined,
  totalAlbums: number,
): AlbumTierLabel {
  if (
    (rawScore !== undefined && rawScore < F_SCORE_CEILING) ||
    (rank === totalAlbums && totalAlbums >= F_GUARANTEE_MIN_ALBUMS)
  ) {
    return 'F';
  }
  if (rank <= 2) return 'S';
  if (rank <= 5) return 'A';
  if (rank <= 10) return 'B';
  return 'C';
}
