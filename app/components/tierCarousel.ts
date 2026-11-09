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

/** A vertical span of the rendered chart that no cut may pass
 *  through — in practice each tier label's glyph band: the tier's
 *  letter is centered over the tier's full height, so a cut through
 *  the band would split the letter itself between two slices. A cut
 *  landing exactly on `start` or `end` is fine (the glyph stays
 *  whole on one side). */
export interface TierCarouselForbiddenSpan {
  start: number;
  end: number;
}

export interface TierCarouselPlanInput {
  /** Total height of the rendered chart image, in image pixels. */
  totalHeight: number;
  /** Safe cut offsets in image pixels (tops of tier sections / tile rows / footer). */
  allowedBoundaries: number[];
  /** Subset of the allowed boundaries a balanced plan prefers when
   *  one lands near its ideal cut — in practice the tier-section
   *  tops, so slices break between tiers rather than mid-tier when
   *  the heights allow it. */
  preferredBoundaries?: number[];
  /** End of the header zone: the first cut may not land before this offset. */
  headerEnd?: number;
  /** Start of the footer zone: no cut may land after this offset. */
  footerStart?: number;
  /** Maximum slice height (also the padded output height). */
  maxSliceHeight?: number;
  /** Spans no cut may pass through (tier glyph bands). */
  forbiddenSpans?: TierCarouselForbiddenSpan[];
}

/** One tier section's geometry in rendered-image pixels, measured
 *  from the export node's layout. The glyph band is the label
 *  letter's own rect: the letter is vertically centered in a label
 *  cell that spans the tier's full height, so the band sits mid-tier. */
export interface TierCarouselSection {
  /** Tier label letter (e.g. 'B'). */
  label: string;
  /** Section top in image pixels. */
  top: number;
  /** Section bottom in image pixels. */
  bottom: number;
  /** Glyph band start (inclusive) in image pixels. */
  glyphStart: number;
  /** Glyph band end (exclusive) in image pixels. */
  glyphEnd: number;
}

/** A label to stamp onto one slice: a tier was split by a cut and
 *  this slice's segment of the tier does not contain the tier's
 *  original (centered) glyph, so the segment gets its own label —
 *  the tier's pastel band repainted over the label column for
 *  exactly this segment's extent, letter centered within it. */
export interface TierCarouselStamp {
  /** Index into the sections array the stamp belongs to. */
  sectionIndex: number;
  /** Tier label letter to draw. */
  label: string;
  /** Slice the stamp is drawn on. */
  sliceIndex: number;
  /** Segment top within that slice's canvas, in image pixels. */
  y: number;
  /** Segment height within that slice's canvas, in image pixels. */
  height: number;
  /** Segment top in source-image pixels (y + slice.start). */
  sourceY: number;
}

/**
 * Plan the label stamps for a sliced chart.
 *
 * For every tier section × slice pair whose intersection is
 * non-empty, exactly one complete glyph must be visible: either the
 * slice fully contains the tier's original glyph band (the rendered
 * letter shows as-is, no stamp) or the segment gets a stamp. With
 * glyph-band protection in the slice planner the band is never
 * split, so each segment either wholly contains it or does not
 * touch it — and even if a band were split, the stamp repaints the
 * label column for the whole segment, covering any partial glyph.
 * A single-slice chart (short charts, the albums view) therefore
 * always yields zero stamps.
 */
export function planTierCarouselStamps(
  slices: TierCarouselSlice[],
  sections: TierCarouselSection[],
): TierCarouselStamp[] {
  const stamps: TierCarouselStamp[] = [];
  sections.forEach((section, sectionIndex) => {
    slices.forEach((slice, sliceIndex) => {
      const segTop = Math.max(section.top, slice.start);
      const segBottom = Math.min(section.bottom, slice.end);
      if (segTop >= segBottom) return;
      const carriesGlyph =
        section.glyphStart >= slice.start && section.glyphEnd <= slice.end;
      if (carriesGlyph) return;
      stamps.push({
        sectionIndex,
        label: section.label,
        sliceIndex,
        y: segTop - slice.start,
        height: segBottom - segTop,
        sourceY: segTop,
      });
    });
  });
  return stamps;
}

/**
 * Plan the slices for one rendered tier chart.
 *
 * Balanced first: split into as few slices as can be dealt
 * evenly, each as close to totalHeight / count as the allowed
 * boundaries permit — a carousel whose images carry similar
 * weight, not max-filled slices trailed by a stub (owner: "the
 * cuts are awkward", Nov 8, 2026). When the fewest-count split
 * has no feasible cut, one or two extra slices are tried before
 * giving up. Tier-section tops (preferredBoundaries) win cuts
 * that land near the ideal. If no balanced plan satisfies every
 * constraint, fall back to the original greedy max-fill. Either
 * way the first slice
 * starts at 0 (so it carries the header) and the last slice ends
 * at totalHeight (so it carries the footer). A chart that fits in
 * one slice yields exactly one slice.
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

  // Glyph-band protection: a cut strictly inside a forbidden span
  // would split a tier's centered letter between two slices, so
  // such boundaries are unusable. Landing exactly on a span edge
  // keeps the glyph whole and stays allowed.
  const forbiddenSpans = (input.forbiddenSpans ?? [])
    .map((span) => ({
      start: Math.round(span.start),
      end: Math.round(span.end),
    }))
    .filter((span) => span.end > span.start && span.start < totalHeight && span.end > 0)
    .sort((a, b) => a.start - b.start);
  const isForbiddenCut = (boundary: number) =>
    forbiddenSpans.some(
      (span) => boundary > span.start && boundary < span.end,
    );

  // -- Balanced plan (see the doc comment above). Returns null when
  // the boundaries cannot support an even split under the rules;
  // the greedy fallback below then applies.
  const preferred = new Set(
    (input.preferredBoundaries ?? []).map((b) => Math.round(b)),
  );
  const minSliceHeight = Math.floor(maxSliceHeight * 0.25);
  const planBalancedForCount = (count: number): TierCarouselSlice[] | null => {
    if (count < 2) return null;
    const target = totalHeight / count;
    const result: TierCarouselSlice[] = [];
    let start = 0;
    for (let i = 1; i < count; i++) {
      const ideal = target * i;
      const remaining = count - i;
      const earliest = start === 0 ? headerEnd : start + 1;
      let best: number | null = null;
      let bestScore = Infinity;
      let bestPreferred: number | null = null;
      let bestPreferredScore = Infinity;
      for (const boundary of boundaries) {
        if (boundary <= start || boundary < earliest) continue;
        if (boundary - start > maxSliceHeight) break;
        if (boundary - start < minSliceHeight) continue;
        if (isForbiddenCut(boundary)) continue;
        const rest = totalHeight - boundary;
        if (rest > remaining * maxSliceHeight) continue;
        if (rest < remaining * minSliceHeight) continue;
        const score = Math.abs(boundary - ideal);
        if (score < bestScore) {
          bestScore = score;
          best = boundary;
        }
        if (preferred.has(boundary) && score < bestPreferredScore) {
          bestPreferredScore = score;
          bestPreferred = boundary;
        }
      }
      const cut =
        bestPreferred !== null && bestPreferredScore <= bestScore + 48
          ? bestPreferred
          : best;
      if (cut === null) return null;
      result.push({
        start,
        end: cut,
        sourceHeight: cut - start,
        outputHeight: maxSliceHeight,
      });
      start = cut;
    }
    const lastHeight = totalHeight - start;
    if (lastHeight <= 0 || lastHeight > maxSliceHeight) return null;
    result.push({
      start,
      end: totalHeight,
      sourceHeight: lastHeight,
      outputHeight: maxSliceHeight,
    });
    return result;
  };
  // Try the fewest slice count first, then one or two more. The
  // fewest-count split is often geometrically impossible: a total
  // just over a multiple of the slice height leaves only a sliver
  // of feasible cut positions (for a 5,091px chart, the two-slice
  // cut must land within a ~30px window), and falling back to
  // greedy max-fill for that case is exactly what produced fat
  // slices with a footer-only stub. One extra slice widens the
  // target window enormously and still reads as a tight set.
  const minCount = Math.ceil(totalHeight / maxSliceHeight);
  for (let count = minCount; count <= minCount + 2; count++) {
    const balanced = planBalancedForCount(count);
    if (balanced) return balanced;
  }

  const slices: TierCarouselSlice[] = [];
  let start = 0;
  while (totalHeight - start > maxSliceHeight) {
    const limit = start + maxSliceHeight;
    const earliest = start === 0 ? headerEnd : start + 1;
    let cut = -1;
    for (const boundary of boundaries) {
      if (boundary < earliest) continue;
      if (boundary > limit) break;
      if (isForbiddenCut(boundary)) continue;
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
