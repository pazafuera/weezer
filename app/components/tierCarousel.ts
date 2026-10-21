/**
 * Pure planning logic for the tier card's Instagram carousel export.
 *
 * The full tier chart is rendered once, exactly as it always has been,
 * then sliced horizontally into 4:5 images. A cut may only land on an
 * allowed boundary (a tier-section top, a tile-row top, or the top of
 * the footer), so a slice never cuts through a tile or the footer.
 * Every output canvas is the full carousel height; a slice whose
 * source segment is shorter is padded (with the poster blue) by the
 * canvas code that consumes this plan.
 */

export const TIER_CAROUSEL_WIDTH = 2048;
export const TIER_CAROUSEL_HEIGHT = 2560;

export interface TierCarouselSlice {
  /** First source-image pixel row in this slice. */
  start: number;
  /** One past the last source-image pixel row in this slice. */
  end: number;
  /** Source rows copied into the slice (end - start, always <= height). */
  sourceHeight: number;
  /** Output canvas height — always the full carousel height. */
  outputHeight: number;
}

export interface TierCarouselPlanInput {
  /** Total height of the rendered chart image, in image pixels. */
  totalHeight: number;
  /** Safe cut offsets in image pixels (tops of tier sections / tile rows / footer). */
  allowedBoundaries: number[];
  /** End of the header zone: the first cut may not land before this offset. */
  headerEnd?: number;
  /** Start of the footer zone: no cut may land after this offset. */
  footerStart?: number;
  /** Maximum slice height (also the padded output height). */
  maxSliceHeight?: number;
}

/**
 * Plan the slices for one rendered tier chart.
 *
 * Greedy: from the current start, take the farthest allowed boundary
 * that keeps the slice within maxSliceHeight. The first slice always
 * starts at 0 (so it carries the header) and the last slice always
 * ends at totalHeight (so it carries the footer). A chart that fits
 * in one slice yields exactly one slice.
 *
 * Throws when no allowed boundary can keep a slice within the limit —
 * the caller treats that as a failed export rather than cutting
 * through a tile.
 */
export function planTierCarouselSlices(
  input: TierCarouselPlanInput,
): TierCarouselSlice[] {
  const maxSliceHeight = Math.floor(input.maxSliceHeight ?? TIER_CAROUSEL_HEIGHT);
  const totalHeight = Math.floor(input.totalHeight);
  if (!Number.isFinite(totalHeight) || totalHeight <= 0) return [];
  if (!Number.isFinite(maxSliceHeight) || maxSliceHeight <= 0) {
    throw new Error('Tier carousel: max slice height must be positive');
  }

  if (totalHeight <= maxSliceHeight) {
    return [
      {
        start: 0,
        end: totalHeight,
        sourceHeight: totalHeight,
        outputHeight: maxSliceHeight,
      },
    ];
  }

  const headerEnd = Math.max(0, Math.floor(input.headerEnd ?? 0));
  const footerStart = Math.min(
    totalHeight,
    Math.floor(input.footerStart ?? totalHeight),
  );

  const boundaries = Array.from(
    new Set(
      input.allowedBoundaries
        .map((b) => Math.round(b))
        .filter((b) => b > 0 && b < totalHeight && b <= footerStart),
    ),
  ).sort((a, b) => a - b);

  const slices: TierCarouselSlice[] = [];
  let start = 0;
  while (totalHeight - start > maxSliceHeight) {
    const limit = start + maxSliceHeight;
    const earliest = start === 0 ? headerEnd : start + 1;
    let cut = -1;
    for (const boundary of boundaries) {
      if (boundary < earliest) continue;
      if (boundary > limit) break;
      if (boundary > start) cut = boundary;
    }
    if (cut < 0) {
      throw new Error(
        `Tier carousel: no safe cut boundary between ${start} and ${limit}`,
      );
    }
    slices.push({
      start,
      end: cut,
      sourceHeight: cut - start,
      outputHeight: maxSliceHeight,
    });
    start = cut;
  }
  slices.push({
    start,
    end: totalHeight,
    sourceHeight: totalHeight - start,
    outputHeight: maxSliceHeight,
  });
  return slices;
}

/** Ordered filename for one slice of a carousel set. A single-slice
 *  export keeps the original filename untouched. */
export function tierCarouselFilename(
  baseFilename: string,
  index: number,
  count: number,
): string {
  if (count <= 1) return baseFilename;
  const suffix = `-${index + 1}-of-${count}`;
  if (baseFilename.toLowerCase().endsWith('.png')) {
    return `${baseFilename.slice(0, -4)}${suffix}.png`;
  }
  return `${baseFilename}${suffix}`;
}
