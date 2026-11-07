/**
 * Stale-metadata heal for saved master lists (Nov 6, 2026).
 *
 * A saved master_list embeds a full copy of each song — title,
 * album, year included — frozen at whatever the catalog said when
 * the row was written. When the catalog later corrects a title,
 * the saved copies do not follow: the owner's own row still reads
 * 'Summer Elaine and Dr. Pepper' long after the catalog learned
 * 'Summer Elaine and Drunk Dori', and every screen that renders
 * from the saved list (Refine above all) shows the stale string.
 *
 * The catalog is the source of truth for the fields it owns. This
 * refresh copies exactly those fields — title, album, year — from
 * the catalog entry with the same id onto each saved entry, and
 * touches nothing else: entry order is preserved, and every
 * non-catalog field on the saved entry (albumColor, isBSide, and
 * anything a save carries beyond the catalog's fields) passes
 * through untouched. Entries whose id the catalog doesn't know
 * pass through unchanged, and entries already current are returned
 * by reference, so a fully current list comes back element-for-
 * element identical.
 *
 * Pure and dependency-free (structural types only) so the rankings
 * harness can replay the heal against it (see
 * harness/rankings-sync-harness.cjs, scenario (e)).
 */

/** The catalog-owned fields a saved master-list entry can stale on. */
export interface CatalogOwnedFields {
  id: string;
  title: string;
  album: string;
  year: number;
}

export function refreshMasterListMetadata<T extends CatalogOwnedFields>(
  masterList: readonly T[],
  catalog: readonly CatalogOwnedFields[]
): T[] {
  const byId = new Map<string, CatalogOwnedFields>();
  for (const song of catalog) {
    if (!byId.has(song.id)) byId.set(song.id, song);
  }
  return masterList.map((song) => {
    const entry = byId.get(song.id);
    if (!entry) return song;
    if (
      song.title === entry.title &&
      song.album === entry.album &&
      song.year === entry.year
    ) {
      return song;
    }
    return { ...song, title: entry.title, album: entry.album, year: entry.year };
  });
}
