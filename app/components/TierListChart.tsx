'use client';

import React, { useRef, useState, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { ALBUM_NAME_TO_ID, BucketType, getAlbumTheme, getAlbumThemeByName } from '../data/constants';
import { cardFromExportFilename, trackAnalytics } from '../lib/analytics';
import { albumTierLabel } from '../lib/albumTiers';
import { AlbumArtwork, SHARE_BUTTON_CLASS } from './SharedUI';
import { displayFont, handFont } from './shareables/fonts';
import { FlyingW, POSTER_BLUE } from './shareables/ShareCardShell';
import { FLYING_W_HANDS_SRC } from './handsData';
import {
  planTierCarouselSlices,
  planTierCarouselStamps,
  tierCarouselFilename,
  TIER_CAROUSEL_HEIGHT,
  TIER_CAROUSEL_WIDTH,
} from './tierCarousel';
import type { TierCarouselSection, TierCarouselSlice } from './tierCarousel';

export interface RankedSong {
  id: string;
  title: string;
  album: string;
  rank: number;
  bucket?: BucketType;
}

export interface RankedAlbum {
  id: string;
  album: string;
  rank: number;
  /** Raw bucket-points mean of the album's songs (1–5 scale).
   *  Drives F-tier membership (see lib/albumTiers); optional so
   *  builders without scores keep the rank-only fallback. */
  score?: number;
}

interface TierListChartProps {
  title: string;
  subtitle: string;
  rankedSongs?: RankedSong[];
  rankedAlbums?: RankedAlbum[];
  username?: string;
  /** Pin the chart to one mode and hide the Songs/Albums toggle —
   *  used by the Shareables gallery, where Songs and Albums are two
   *  separate card entries instead of one toggled chart. Charts that
   *  are not gallery cards (the Fan Stats community chart) omit it
   *  and keep the toggle. */
  fixedView?: 'songs' | 'albums';
}


// 206 Songs Distribution Cutoffs — five tiers (S/A/B/C/F) since
// Oct 2026: the D tier was dropped (the user's call) so the rows line
// up one-to-one with the five buckets below; F takes the whole bottom.
const SONG_TIERS = [
  { label: 'S', color: 'bg-[#FF7F7F]', text: 'text-red-950', max: 10 },
  { label: 'A', color: 'bg-[#FFBF7F]', text: 'text-orange-950', max: 35 },
  { label: 'B', color: 'bg-[#FFFF7F]', text: 'text-yellow-950', max: 80 },
  { label: 'C', color: 'bg-[#7FFF7F]', text: 'text-green-950', max: 130 },
  { label: 'F', color: 'bg-[#BF7FFF]', text: 'text-purple-950', max: 206 },
];

// Album tiers (same five rows). Membership is NOT read off these
// maxes anymore (Nov 8, 2026): S/A/B are rank bands and F is
// score-driven — see lib/albumTiers (albumTierLabel). The maxes stay
// as the S/A/B band documentation; C's and F's are unused sentinels.
const ALBUM_TIERS = [
  { label: 'S', color: 'bg-[#FF7F7F]', text: 'text-red-950', max: 2 },
  { label: 'A', color: 'bg-[#FFBF7F]', text: 'text-orange-950', max: 5 },
  { label: 'B', color: 'bg-[#FFFF7F]', text: 'text-yellow-950', max: 9 },
  { label: 'C', color: 'bg-[#7FFF7F]', text: 'text-green-950', max: 13 },
  { label: 'F', color: 'bg-[#BF7FFF]', text: 'text-purple-950', max: 99 },
];

/* Poster-export headline shadows: html-to-image drops
 * -webkit-text-stroke, so the ink outline is a text-shadow ring
 * (the same treatment as the five poster cards, Nov 8, 2026). */
const POSTER_HEADLINE_SHADOW =
  '3px 0 0 #0C1220, -3px 0 0 #0C1220, 0 3px 0 #0C1220, 0 -3px 0 #0C1220, 2px 2px 0 #0C1220, 2px -2px 0 #0C1220, -2px 2px 0 #0C1220, -2px -2px 0 #0C1220, 5px 5px 0 rgba(12,18,32,0.9)';
const POSTER_SUBHEAD_SHADOW =
  '2px 0 0 #0C1220, -2px 0 0 #0C1220, 0 2px 0 #0C1220, 0 -2px 0 #0C1220, 1.5px 1.5px 0 #0C1220, 1.5px -1.5px 0 #0C1220, -1.5px 1.5px 0 #0C1220, -1.5px -1.5px 0 #0C1220, 4px 4px 0 rgba(12,18,32,0.9)';

// Bucket -> tier mapping: every explicitly bucketed song appears in its
// bucket's tier, even when the ranking is partial and the fixed rank cutoffs
// above would leave the lower tiers empty.
const BUCKET_TIER_LABEL: Record<BucketType, string> = {
  banger: 'S',
  slaps: 'A',
  mid: 'B',
  skip: 'C',
  trash: 'F',
};

/* ------------------------------------------------------------------ */
/* Instagram carousel export: the chart still renders ONCE, exactly   */
/* as before (1024px frame, pixelRatio 2, iOS double-render pass in   */
/* the handler below). The rendered PNG is then sliced horizontally   */
/* into 2048x2560 (4:5) images — Instagram's tallest portrait — with  */
/* cuts only at tier-section / tile-row / footer boundaries measured  */
/* from the export node's own layout, and short slices padded with    */
/* the poster blue.                                                   */
/*                                                                    */
/* Tier labels: each tier's letter is centered over the tier's full   */
/* height, so a mid-tier cut would leave the tier's opening segment   */
/* label-less on its slice (the user's B tier, Oct 22). Two guards:   */
/* the planner treats each glyph's measured band as a forbidden span */
/* (no cut may split the letter itself), and every split-tier         */
/* segment that doesn't carry the original glyph gets the label       */
/* stamped onto its slice over the label column.                      */
/* ------------------------------------------------------------------ */

function loadRenderedImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Tier carousel: rendered image failed to load'));
    image.src = src;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Tier carousel: slice canvas produced no image'));
    }, 'image/png');
  });
}

/** One tier section's measured geometry + label typography, in
 *  rendered-image pixels. The stamp pass repaints split tiers'
 *  labels from these values, so they are read off the chart's own
 *  DOM (computed styles included) rather than restated. */
interface TierCarouselSectionLayout extends TierCarouselSection {
  /** The label cell's computed background (the tier pastel). */
  bandColor: string;
  /** The glyph's computed color. */
  letterColor: string;
  /** The glyph's computed font family stack. */
  fontFamily: string;
  /** The glyph's computed font weight. */
  fontWeight: string;
  /** The glyph's font size in rendered-image pixels. */
  fontSizePx: number;
  /** The glyph's font size in CSS pixels (for document.fonts.load). */
  fontSizeCssPx: number;
}

interface TierCarouselLayout {
  allowedBoundaries: number[];
  headerEnd: number;
  footerStart: number;
  /** The label column's x-extent in rendered-image pixels (every
   *  tier row shares the grid's first column, so one measurement
   *  serves all sections). */
  labelColumn: { x: number; width: number };
  sections: TierCarouselSectionLayout[];
}

/** Safe cut offsets + tier label geometry for one export node, in
 *  rendered-image pixels. Boundaries are the tops of the chart grid,
 *  of each tier section, and of each tile (grouped by the planner
 *  into row tops), plus the top of the footer — so a cut never lands
 *  inside the header, a tile, or the footer.
 *
 *  The glyph band is DERIVED from the label glyph element's own
 *  rect: the badge cell spans the tier's full height and centers
 *  the letter (flex), so the glyph's rect is exactly the band a cut
 *  must not split. If the glyph element is ever missing, fall back
 *  to the cell's middle half — wider than the real line box, i.e.
 *  conservative in the safe direction. */
function measureTierCarouselLayout(
  node: HTMLElement,
  renderedWidth: number,
  renderedHeight: number,
): TierCarouselLayout {
  const rootRect = node.getBoundingClientRect();
  const scale = rootRect.height > 0 ? renderedHeight / rootRect.height : 2;
  const scaleX = rootRect.width > 0 ? renderedWidth / rootRect.width : scale;
  const topOf = (el: Element) =>
    (el.getBoundingClientRect().top - rootRect.top) * scale;
  const bottomOf = (el: Element) =>
    (el.getBoundingClientRect().bottom - rootRect.top) * scale;

  const header = node.querySelector('[data-tier-export-header]');
  const grid = node.querySelector('[data-tier-export-grid]');
  const footer = node.querySelector('[data-tier-export-footer]');

  const boundaries = new Set<number>();
  if (grid) boundaries.add(topOf(grid));
  node
    .querySelectorAll('[data-tier-export-section], [data-tier-export-tile]')
    .forEach((el) => boundaries.add(topOf(el)));
  if (footer) boundaries.add(topOf(footer));

  const sections: TierCarouselSectionLayout[] = [];
  let labelColumn = { x: 0, width: 0 };
  node.querySelectorAll('[data-tier-export-section]').forEach((sectionEl) => {
    const labelEl = sectionEl.querySelector('[data-tier-export-label]');
    const glyphEl = sectionEl.querySelector('[data-tier-export-glyph]');
    if (!labelEl) return;
    const top = topOf(sectionEl);
    const bottom = bottomOf(sectionEl);

    const labelRect = labelEl.getBoundingClientRect();
    if (labelColumn.width === 0) {
      labelColumn = {
        x: (labelRect.left - rootRect.left) * scaleX,
        width: labelRect.width * scaleX,
      };
    }

    let glyphStart: number;
    let glyphEnd: number;
    if (glyphEl) {
      glyphStart = topOf(glyphEl);
      glyphEnd = bottomOf(glyphEl);
    } else {
      const mid = (top + bottom) / 2;
      const halfBand = (bottom - top) / 4;
      glyphStart = mid - halfBand;
      glyphEnd = mid + halfBand;
    }

    const labelStyle = window.getComputedStyle(labelEl);
    const glyphStyle = glyphEl ? window.getComputedStyle(glyphEl) : labelStyle;
    const fontSizeCssPx = parseFloat(glyphStyle.fontSize) || 36;
    sections.push({
      label: (glyphEl?.textContent ?? labelEl.textContent ?? '').trim(),
      top,
      bottom,
      glyphStart,
      glyphEnd,
      bandColor: labelStyle.backgroundColor,
      letterColor: glyphStyle.color,
      fontFamily: glyphStyle.fontFamily,
      fontWeight: glyphStyle.fontWeight,
      fontSizePx: fontSizeCssPx * scale,
      fontSizeCssPx,
    });
  });

  return {
    allowedBoundaries: Array.from(boundaries),
    // The header zone runs until the chart grid starts (its bottom
    // margin included); the first cut may not land inside it.
    headerEnd: grid ? topOf(grid) : header ? bottomOf(header) : 0,
    footerStart: footer ? topOf(footer) : renderedHeight,
    labelColumn,
    sections,
  };
}

/** Best-effort: make sure the display face is loaded before the
 *  stamp pass draws with it on canvas. It already styles the chart
 *  on screen and the html-to-image render, so this normally resolves
 *  immediately; a failure must not fail the export. */
async function ensureStampFont(layout: TierCarouselLayout): Promise<void> {
  const first = layout.sections[0];
  if (!first || typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(
      `${first.fontWeight} ${first.fontSizeCssPx}px ${first.fontFamily}`,
    );
  } catch {
    /* the face is already in use by the page; proceed regardless */
  }
}

async function sliceTierCarouselImage(
  dataUrl: string,
  node: HTMLElement,
): Promise<{ blobs: Blob[]; slices: TierCarouselSlice[] }> {
  const image = await loadRenderedImage(dataUrl);
  const layout = measureTierCarouselLayout(
    node,
    image.naturalWidth,
    image.naturalHeight,
  );
  const slices = planTierCarouselSlices({
    totalHeight: image.naturalHeight,
    allowedBoundaries: layout.allowedBoundaries,
    // Tier-section tops are the cuts a balanced plan prefers when
    // one lands near its ideal — slices break between tiers
    // rather than mid-tier when the heights allow it.
    preferredBoundaries: layout.sections.map((section) => section.top),
    headerEnd: layout.headerEnd,
    footerStart: layout.footerStart,
    maxSliceHeight: TIER_CAROUSEL_HEIGHT,
    // No cut may split a tier's centered label glyph — otherwise
    // the glyph's slice segment shows a letter cut in half, and
    // the segment on the other side shows none at all.
    forbiddenSpans: layout.sections.map((section) => ({
      start: section.glyphStart,
      end: section.glyphEnd,
    })),
  });
  // Every segment of a split tier that does not carry the tier's
  // original glyph gets a stamped label (single-slice charts: none).
  const stamps = planTierCarouselStamps(slices, layout.sections);
  if (stamps.length > 0) await ensureStampFont(layout);

  const blobs: Blob[] = [];
  for (let sliceIndex = 0; sliceIndex < slices.length; sliceIndex++) {
    const slice = slices[sliceIndex];
    const canvas = document.createElement('canvas');
    canvas.width = TIER_CAROUSEL_WIDTH;
    canvas.height = TIER_CAROUSEL_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tier carousel: canvas is not available');
    // Pad first: any part of the canvas the source segment does not
    // cover (a short final slice, or the gap up to the next safe cut)
    // stays the poster blue the chart itself is framed in.
    ctx.fillStyle = POSTER_BLUE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      0,
      slice.start,
      image.naturalWidth,
      slice.sourceHeight,
      0,
      0,
      TIER_CAROUSEL_WIDTH,
      slice.sourceHeight,
    );
    // Stamp split-tier labels over the label column, pixel-aligned
    // with the measured column and the segment's extent in this
    // slice, in the chart's own label typography.
    for (const stamp of stamps) {
      if (stamp.sliceIndex !== sliceIndex) continue;
      const section = layout.sections[stamp.sectionIndex];
      ctx.fillStyle = section.bandColor;
      ctx.fillRect(
        layout.labelColumn.x,
        stamp.y,
        layout.labelColumn.width,
        stamp.height,
      );
      ctx.fillStyle = section.letterColor;
      ctx.font = `${section.fontWeight} ${section.fontSizePx}px ${section.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        section.label,
        layout.labelColumn.x + layout.labelColumn.width / 2,
        stamp.y + stamp.height / 2,
      );
    }
    blobs.push(await canvasToPngBlob(canvas));
  }
  return { blobs, slices };
}

export default function TierListChart({
  title,
  subtitle,
  rankedSongs = [],
  rankedAlbums = [],
  username,
  fixedView,
}: TierListChartProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [exportSaved, setExportSaved] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<'songs' | 'albums'>('songs');
  const viewMode = fixedView ?? internalViewMode;

  const currentTiers = viewMode === 'songs' ? SONG_TIERS : ALBUM_TIERS;

  // Process items using the parent's explicit rankings
  const processedTiers = useMemo(() => {
    return currentTiers.map((tier, index) => {
      const prevMax = index === 0 ? 0 : currentTiers[index - 1].max;
      let items = [];

      if (viewMode === 'songs') {
        items = rankedSongs
          .filter((s) =>
            s.bucket !== undefined
              ? BUCKET_TIER_LABEL[s.bucket] === tier.label
              : s.rank > prevMax && s.rank <= tier.max
          )
          .map((s) => ({ id: s.id, name: s.title, album: s.album, rank: s.rank }));
      } else {
        items = rankedAlbums
          .filter(
            (a) =>
              albumTierLabel(a.rank, a.score, rankedAlbums.length) ===
              tier.label,
          )
          .map((a) => ({ id: a.id, name: a.album, album: a.album, rank: a.rank }));
      }
      return { ...tier, items };
    });
  }, [currentTiers, rankedSongs, rankedAlbums, viewMode]);

  /** The gallery buttons' saved flip (ShareablesGallery): a
   *  successful export confirms on the button itself, briefly. */
  const flashSaved = () => {
    setExportSaved(true);
    setTimeout(() => setExportSaved(false), 2500);
  };

  const handleExport = async () => {
    if (!exportRef.current) return;
    setExportFailed(false);
    setExportSaved(false);
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        // Wait for every image inside the export copy to finish
        // loading before the first capture. An image that exists
        // only in this hidden node (the header's flying-W hands)
        // can still be in flight when the export starts: the
        // owner's first albums download shipped without the hands
        // while his songs download, exported moments later from a
        // warm cache, had them (Nov 8, 2026). Images that also
        // render on screen are already complete and skip the wait.
        const exportNode = exportRef.current!;
        const pendingImages = Array.from(
          exportNode.querySelectorAll('img'),
        ).filter((img) => !img.complete || img.naturalWidth === 0);
        if (pendingImages.length > 0) {
          await Promise.all(
            pendingImages.map(
              (img) =>
                new Promise<void>((resolve) => {
                  if (img.complete && img.naturalWidth > 0) {
                    resolve();
                    return;
                  }
                  const done = () => resolve();
                  img.addEventListener('load', done, { once: true });
                  img.addEventListener('error', done, { once: true });
                  setTimeout(done, 2500);
                }),
            ),
          );
        }
        // iOS Safari sometimes renders blank on the first pass with foreignObjects.
        // We generate it once invisibly, then generate it again for safety.
        await toPng(exportRef.current!, { quality: 0.1, pixelRatio: 1 });
        
        const dataUrl = await toPng(exportRef.current!, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: POSTER_BLUE,
        });
        
        const baseFilename = `${username ? `${username}-` : ''}weezer-${viewMode}-tiers.png`;
        // Analytics: the tier chart exports through its own
        // funnel (not exportNodeAsPng) — same share-initiated
        // event, card resolved from the composed filename.
        const tierCard = cardFromExportFilename(baseFilename);
        if (tierCard) trackAnalytics('share_initiated', { card: tierCard });

        // Slice the one rendered chart into the ordered 4:5 set.
        // A chart short enough for a single slice keeps the original
        // filename and behaves exactly like the old single-PNG export.
        const { blobs, slices } = await sliceTierCarouselImage(
          dataUrl,
          exportRef.current!,
        );
        const filenames = slices.map((_, index) =>
          tierCarouselFilename(baseFilename, index, slices.length),
        );
        const files = blobs.map(
          (blob, index) => new File([blob], filenames[index], { type: 'image/png' }),
        );

        // CHECK FOR iOS / MOBILE DEVICE CAPABILITIES
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isMobile && navigator.share) {
          try {
            if (navigator.canShare && navigator.canShare({ files })) {
              await navigator.share({
                files,
                title: 'My Weezer Tier List',
              });
              flashSaved();
              setIsExporting(false);
              return;
            }
          } catch (shareErr) {
            console.error('Native sharing failed or was canceled', shareErr);
          }
        }

        // STANDARD DESKTOP FALLBACK — the whole set, in order.
        for (let index = 0; index < blobs.length; index++) {
          const blobUrl = URL.createObjectURL(blobs[index]);
          const link = document.createElement('a');
          link.download = filenames[index];
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          if (index < blobs.length - 1) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
        flashSaved();

      } catch (err) {
        console.error('Failed to export tier list', err);
        // The failure used to exist only in the console — the
        // button just went back to its label. Show it, briefly,
        // on the button itself (same pattern as the gallery).
        setExportFailed(true);
        setTimeout(() => setExportFailed(false), 2500);
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  const renderTierGrid = (isExportMode: boolean) => {
    /* The gallery (fixedView) chart renders the poster board from
     * the Nov 8, 2026 remake — on screen AND in the export, one
     * design (the owner: "the preview should look exactly like the
     * download"): white plaque, ink frame and dividers, big album
     * covers. The slicer's data attributes and the label cell's
     * pastel background are unchanged — it measures both. Every
     * other surface keeps the dark panel. */
    const poster = !!fixedView;
    return (
    <div data-tier-export-grid="true" className={poster
      ? 'bg-white border-[3px] border-[#0C1220] flex flex-col w-full rounded-2xl overflow-hidden shadow-[6px_6px_0_rgba(12,18,32,0.85)]'
      : `bg-black p-0.5 sm:p-1 flex flex-col gap-0.5 sm:gap-1 w-full rounded-xl overflow-hidden ${isExportMode ? '' : 'border border-slate-800'}`}>
      {processedTiers.map((tier, tierIndex) => (
        <div
          key={tier.label}
          data-tier-export-section="true"
          className={poster
            ? `grid ${isExportMode ? 'grid-cols-[6rem_1fr]' : 'grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]'} w-full ${tierIndex > 0 ? 'border-t-[3px] border-[#0C1220]' : ''}`
            : `grid ${isExportMode ? 'grid-cols-[6rem_1fr]' : 'grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]'} bg-black gap-0.5 sm:gap-1 min-h-[80px] w-full`}
        >
          {/* TIER BADGE — the carousel slicer measures this cell
              and the glyph span inside it: the letter is centered
              over the tier's full height, so its band is protected
              from cuts and split segments get a stamped label. */}
          <div data-tier-export-label="true" className={`w-full h-full flex items-center justify-center ${tier.color} ${poster ? 'border-r-[3px] border-[#0C1220]' : ''}`}>
            <span data-tier-export-glyph="true" className={`text-2xl sm:text-4xl ${displayFont.className} ${tier.text}`}>
              {tier.label}
            </span>
          </div>

          {/* SCROLLING CONTAINER */}
          <div className={`flex-1 min-w-0 w-full h-full relative ${poster ? 'bg-white' : 'bg-slate-900'}`}>
            <div
              className={`w-full h-full ${
                isExportMode
                  ? `flex flex-wrap content-start ${poster ? 'gap-2 p-2' : 'gap-1 p-1'}`
                  : poster && viewMode === 'albums'
                    ? 'flex flex-wrap content-start gap-1.5 p-1.5'
                    : 'flex overflow-x-auto flex-nowrap gap-0.5 sm:gap-1 p-0.5 sm:p-1 overscroll-x-contain custom-tier-scrollbar'
              }`}
            >
              {tier.items.length === 0 ? (
                <div className="flex items-center px-4">
                  <span className={`text-xs font-bold italic ${poster ? 'text-slate-400' : 'text-slate-700'}`}>No items</span>
                </div>
              ) : (
                tier.items.map((item) => {
                  const resolvedId = viewMode === 'albums' ? item.id : (ALBUM_NAME_TO_ID[item.album] || 'unknown');
                  const theme = viewMode === 'albums' ? getAlbumThemeByName(item.album) : getAlbumTheme(item);

                  // ALBUMS VIEW (Uses actual Album Artwork)
                  if (viewMode === 'albums') {
                    return (
                      <div
                        key={item.id}
                        data-tier-export-tile="true"
                        className={`${poster ? (isExportMode ? 'w-32 h-32' : 'w-24 h-24 sm:w-28 sm:h-28') : 'w-20 h-20 sm:w-24 sm:h-24'} shrink-0 p-1 flex items-center justify-center ${
                          isExportMode ? '' : 'hover:scale-[1.02] transition-transform cursor-default'
                        }`}
                        title={`#${item.rank} ${item.name}`}
                      >
                        <div className={`w-full h-full relative overflow-hidden shadow-sm ${poster ? 'rounded-lg border-2 border-[#0C1220] bg-white' : 'rounded-md border border-slate-700 bg-slate-800'}`}>
                          <AlbumArtwork albumId={resolvedId} className="absolute inset-0 w-full h-full object-cover" />
                          <div className={`absolute bottom-0 right-0 font-black ${poster ? 'bg-[#0C1220] text-white text-[11px] px-2 py-0.5 rounded-tl-lg' : 'bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded-tl-md backdrop-blur-sm'}`}>
                            #{item.rank}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // SONGS VIEW (Uses colored text blocks)
                  return (
                    <div
                      key={item.id}
                      data-tier-export-tile="true"
                      className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center p-1 text-center select-none ${poster ? 'border-2 border-[#0C1220]' : 'border border-slate-700'} ${
                        isExportMode ? '' : 'hover:scale-[1.02] transition-transform cursor-default'
                      }`}
                      style={{ backgroundColor: theme.bg, color: theme.text }}
                      title={`#${item.rank} ${item.name} (${item.album})`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight line-clamp-4 text-balance uppercase">
                        {item.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
    );
  };

  // Export attribution (header, top right — where the old white CTA
  // box sat). Guests have no username to credit.
  const attributionLine = username
    ? `Tier list for @${username} generated by RankingWeezer.com`
    : 'Tier list generated by RankingWeezer.com';

  /* Poster export header copy (gallery cards only, Nov 8, 2026
   * remake): the headline names the chart, the subhead bridges to
   * the full song ranking the album order came from. Counts adapt
   * to partial rankings so the copy never claims 206 ranked songs
   * the user hasn't ranked. */
  const posterHeadline =
    viewMode === 'albums' ? 'MY WEEZER ALBUM TIERS' : 'MY WEEZER SONG TIERS';
  const posterSubhead =
    viewMode === 'albums'
      ? rankedSongs.length >= 206
        ? 'from my ranking of all 206 songs'
        : 'from my song rankings'
      : rankedSongs.length >= 206
        ? 'all 206 songs, ranked'
        : `${rankedSongs.length} songs, ranked`;

  /* The poster header and footer, shared by the on-screen gallery
   * card and the hidden export copy (one source of truth — the
   * owner, Nov 8, 2026: "the preview should look exactly like the
   * download"). The export sizes are tuned so the whole ALBUMS
   * chart fits one 4:5 carousel slice (2048x2560 at pixelRatio 2). */
  const renderPosterHeader = (size: 'export' | 'visible') => {
    const ex = size === 'export';
    return (
      <div
        {...(ex ? { 'data-tier-export-header': 'true' } : {})}
        className={`relative text-center ${ex ? 'mb-5 pb-2' : 'mb-4'}`}
      >
        {/* The hands art is an inlined data URI (handsData.ts): a
            network file raced the export on cold caches and the
            albums download shipped without it — three times. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FLYING_W_HANDS_SRC}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2 opacity-[0.38] ${ex ? 'top-[-28px] w-[920px]' : 'top-[-14px] w-[600px]'}`}
        />
        <div className="relative">
          <p
            className={`font-bold leading-none text-white ${handFont.className} ${ex ? 'text-[34px]' : 'text-[22px]'}`}
            style={{ textShadow: POSTER_SUBHEAD_SHADOW }}
          >
            rankingweezer.com
          </p>
          <h2
            className={`whitespace-nowrap leading-none text-white ${displayFont.className} ${ex ? 'mt-3 text-[68px]' : 'mt-2 text-[30px] sm:text-[40px]'}`}
            style={{ textShadow: POSTER_HEADLINE_SHADOW }}
          >
            {posterHeadline}
          </h2>
          <p
            className={`font-bold leading-none text-white ${handFont.className} ${ex ? 'mt-2 text-[40px]' : 'mt-1.5 text-[23px] sm:text-[25px]'}`}
            style={{ textShadow: POSTER_SUBHEAD_SHADOW }}
          >
            {posterSubhead}
          </p>
          {username && (
            <div
              className={`inline-block -rotate-1 rounded-xl border-[#0C1220] bg-[#FFC72C] shadow-[4px_4px_0_rgba(12,18,32,0.85)] ${ex ? 'mt-4 border-[3px] px-6 py-2' : 'mt-3 border-2 px-4 py-1'}`}
            >
              <span
                className={`tracking-wide text-[#0C1220] ${displayFont.className} ${ex ? 'text-[24px]' : 'text-[15px]'}`}
              >
                TIER LIST BY @{username.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPosterFooter = (size: 'export' | 'visible') => {
    const ex = size === 'export';
    return (
      <div
        {...(ex ? { 'data-tier-export-footer': 'true' } : {})}
        className={`flex items-center ${ex ? 'gap-4 pt-7' : 'gap-3 pt-4'}`}
      >
        <FlyingW
          className={
            ex
              ? 'h-[30px] w-[55px] shrink-0 text-white'
              : 'h-[18px] w-[33px] shrink-0 text-white'
          }
        />
        <span
          className={`font-black uppercase text-white ${ex ? 'whitespace-nowrap text-[22px] tracking-[0.12em]' : 'text-[11px] leading-snug tracking-[0.1em]'}`}
        >
          All My Favorite Songs · The Weezer Song Ranking Project
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full overflow-hidden">
      
      {/* INJECT CUSTOM SCROLLBAR CSS FOR DESKTOP MOUSE USERS */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-tier-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #334155 transparent;
        }
        .custom-tier-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-tier-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-tier-scrollbar::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
      `}} />

      {/* TOGGLE SWITCH — gallery cards pass fixedView and get no
          toggle: Songs and Albums are separate card entries there. */}
      {!fixedView && (
      <div className="flex justify-center">
        <div className="bg-slate-200/90 p-1 rounded-2xl inline-flex shadow-inner">
          <button
            onClick={() => setInternalViewMode('songs')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              viewMode === 'songs'
                ? 'bg-white text-[#0072CE] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Top Songs
          </button>
          <button
            onClick={() => setInternalViewMode('albums')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              viewMode === 'albums'
                ? 'bg-white text-[#0072CE] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Albums
          </button>
        </div>
      </div>
      )}

      {/* WEB UI VISIBLE CHART — the gallery card IS the poster card
          (same header, board and footer as the export below); every
          other surface keeps the dark panel. */}
      {fixedView ? (
        <div
          className="relative w-full overflow-hidden rounded-[18px] p-4 sm:p-5"
          style={{ backgroundColor: POSTER_BLUE }}
        >
          {renderPosterHeader('visible')}
          {renderTierGrid(false)}
          {renderPosterFooter('visible')}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-2xl p-3 sm:p-5 shadow-xl border border-slate-800 space-y-4 w-full overflow-hidden">
          {/* HEADER */}
          <div className="text-center mb-2">
            <h2 className={`text-2xl sm:text-3xl text-white tracking-wide ${displayFont.className}`}>
              {title}
            </h2>
          </div>

          {/* Renders horizontal scroll version safely! */}
          {renderTierGrid(false)}
        </div>
      )}

      {/* HIDDEN EXPORT CHART (Pre-rendered explicitly for Image Capture).
          Same 1024px frame and mechanics as always; the field is now
          the poster kit's bright blue (Abby's direction) with the
          chart grid seated on it as the canonical dark tier panel. */}
      <div className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none">
        <div ref={exportRef} className="w-[1024px] p-8" style={{ backgroundColor: POSTER_BLUE }}>

          {fixedView ? (
          <>
          {/* POSTER HEADER + FOOTER (gallery cards, Nov 8, 2026
              remake) — the shared renderers above, so the export is
              the on-screen card, byte for byte in structure. */}
          {renderPosterHeader('export')}

          {/* Renders full wrap desktop version */}
          {renderTierGrid(true)}

          {renderPosterFooter('export')}
          </>
          ) : (
          <>
          {/* BRANDING HEADER FOR EXPORT */}
          <div data-tier-export-header="true" className="flex items-start justify-between border-b-2 border-white/50 pb-6 mb-8">
            <div className="flex-1 pr-8">
              <h2 className={`text-6xl text-white leading-none mb-2 ${displayFont.className}`}>
                All My Favorite Songs
              </h2>
              <h3 className="text-2xl font-black text-white/85 uppercase tracking-widest">
                The Weezer Song Ranking Project
              </h3>
            </div>

            {/* ATTRIBUTION — replaces the old white CTA box. The
                export's single call to action lives in the footer
                (last carousel slice); the header just credits the
                list's owner and the site. */}
            <p
              className={`w-[340px] shrink-0 text-right text-[34px] font-bold leading-tight text-white ${handFont.className}`}
            >
              {attributionLine}
            </p>
          </div>

          {/* Renders full wrap desktop version */}
          {renderTierGrid(true)}

          {/* FOOTER — the export's one call to action. The carousel
              slicer keeps this block in the final slice; single-slice
              exports show it under the header on the same image. */}
          <div data-tier-export-footer="true" className={`text-center pt-6 text-white text-3xl ${handFont.className}`}>
            Make your own Weezer tier list at RankingWeezer.com
          </div>
          </>
          )}
        </div>
      </div>

      {/* SHARE BUTTON — the uniform gallery button (owner,
          Nov 6): SHARE_BUTTON_CLASS, label "Share", the same
          busy/failed/saved flips as ShareablesGallery's
          LibraryItem and ThumbnailItem buttons. The tier cards
          were the last 📸 holdouts. data-tier-save still marks
          this instance's share control so the Tier List modal's
          pinned footer button (ShareablesGallery) can trigger
          THIS instance's export and mirror its state (UAT P-11). */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        data-tier-save="true"
        className={`w-full ${SHARE_BUTTON_CLASS} text-xs py-3 px-3 rounded-xl disabled:opacity-50 ${exportFailed ? 'bg-rose-500' : exportSaved ? 'bg-emerald-500' : 'bg-[#0072CE] hover:bg-blue-600'}`}
      >
        <span>{isExporting ? 'Generating Image...' : exportFailed ? "Couldn't generate — try again" : exportSaved ? '✓ Saved!' : 'Share'}</span>
      </button>
    </div>
  );
}
