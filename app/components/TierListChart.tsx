'use client';

import React, { useRef, useState, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { ALBUM_NAME_TO_ID, BucketType } from '../data/constants';
import { AlbumArtwork } from './SharedUI';
import { displayFont, handFont } from './shareables/fonts';
import { POSTER_BLUE } from './shareables/ShareCardShell';
import {
  planTierCarouselSlices,
  tierCarouselFilename,
  TIER_CAROUSEL_HEIGHT,
  TIER_CAROUSEL_WIDTH,
} from './tierCarousel';
import type { TierCarouselSlice } from './tierCarousel';

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

// OFFICIAL WEEZER ALBUM COLOR IDENTITIES
const ALBUM_COLORS: Record<string, { bg: string; text: string }> = {
  'The Blue Album': { bg: 'bg-[#0072CE]', text: 'text-white' },
  'Pinkerton': { bg: 'bg-[#1a1a1a]', text: 'text-pink-300' },
  'Green Album': { bg: 'bg-emerald-500', text: 'text-emerald-950' },
  'Maladroit': { bg: 'bg-amber-900', text: 'text-amber-100' },
  'Make Believe': { bg: 'bg-zinc-800', text: 'text-zinc-100' },
  'Red Album': { bg: 'bg-red-600', text: 'text-white' },
  'Raditude': { bg: 'bg-yellow-400', text: 'text-yellow-950' },
  'Hurley': { bg: 'bg-[#5c3a21]', text: 'text-orange-100' },
  'Death to False Metal': { bg: 'bg-[#005fA3]', text: 'text-amber-300' },
  'EWBAITE': { bg: 'bg-amber-600', text: 'text-amber-50' },
  'Everything Will Be Alright in the End': { bg: 'bg-amber-600', text: 'text-amber-50' },
  'White Album': { bg: 'bg-slate-100', text: 'text-slate-600' },
  'Pacific Daydream': { bg: 'bg-fuchsia-500', text: 'text-white' },
  'Teal Album': { bg: 'bg-teal-400', text: 'text-teal-950' },
  'Black Album': { bg: 'bg-black', text: 'text-slate-300' },
  'OK Human': { bg: 'bg-sky-300', text: 'text-sky-950' },
  'Van Weezer': { bg: 'bg-purple-600', text: 'text-purple-100' },
  'SZNZ: Spring': { bg: 'bg-lime-400', text: 'text-lime-950' },
  'SZNZ: Summer': { bg: 'bg-amber-400', text: 'text-amber-950' },
  'SZNZ: Autumn': { bg: 'bg-orange-600', text: 'text-white' },
  'SZNZ: Winter': { bg: 'bg-cyan-200', text: 'text-cyan-950' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-800', text: 'text-slate-100' };

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

// Album Ranking Cutoffs (same five-row shape: C ≤13, F takes the rest)
const ALBUM_TIERS = [
  { label: 'S', color: 'bg-[#FF7F7F]', text: 'text-red-950', max: 2 },
  { label: 'A', color: 'bg-[#FFBF7F]', text: 'text-orange-950', max: 5 },
  { label: 'B', color: 'bg-[#FFFF7F]', text: 'text-yellow-950', max: 9 },
  { label: 'C', color: 'bg-[#7FFF7F]', text: 'text-green-950', max: 13 },
  { label: 'F', color: 'bg-[#BF7FFF]', text: 'text-purple-950', max: 99 },
];

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

/** Safe cut offsets for one export node, in rendered-image pixels.
 *  Boundaries are the tops of the chart grid, of each tier section,
 *  and of each tile (grouped by the planner into row tops), plus the
 *  top of the footer — so a cut never lands inside the header, a
 *  tile, or the footer. */
function measureTierCarouselCuts(
  node: HTMLElement,
  renderedHeight: number,
): { allowedBoundaries: number[]; headerEnd: number; footerStart: number } {
  const rootRect = node.getBoundingClientRect();
  const scale = rootRect.height > 0 ? renderedHeight / rootRect.height : 2;
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

  return {
    allowedBoundaries: Array.from(boundaries),
    // The header zone runs until the chart grid starts (its bottom
    // margin included); the first cut may not land inside it.
    headerEnd: grid ? topOf(grid) : header ? bottomOf(header) : 0,
    footerStart: footer ? topOf(footer) : renderedHeight,
  };
}

async function sliceTierCarouselImage(
  dataUrl: string,
  node: HTMLElement,
): Promise<{ blobs: Blob[]; slices: TierCarouselSlice[] }> {
  const image = await loadRenderedImage(dataUrl);
  const cuts = measureTierCarouselCuts(node, image.naturalHeight);
  const slices = planTierCarouselSlices({
    totalHeight: image.naturalHeight,
    allowedBoundaries: cuts.allowedBoundaries,
    headerEnd: cuts.headerEnd,
    footerStart: cuts.footerStart,
    maxSliceHeight: TIER_CAROUSEL_HEIGHT,
  });

  const blobs: Blob[] = [];
  for (const slice of slices) {
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
          .filter((a) => a.rank > prevMax && a.rank <= tier.max)
          .map((a) => ({ id: a.id, name: a.album, album: a.album, rank: a.rank }));
      }
      return { ...tier, items };
    });
  }, [currentTiers, rankedSongs, rankedAlbums, viewMode]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setExportFailed(false);
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        // iOS Safari sometimes renders blank on the first pass with foreignObjects. 
        // We generate it once invisibly, then generate it again for safety.
        await toPng(exportRef.current!, { quality: 0.1, pixelRatio: 1 });
        
        const dataUrl = await toPng(exportRef.current!, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: POSTER_BLUE,
        });
        
        const baseFilename = `${username ? `${username}-` : ''}weezer-${viewMode}-tiers.png`;

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

  const renderTierGrid = (isExportMode: boolean) => (
    <div data-tier-export-grid="true" className={`bg-black p-0.5 sm:p-1 flex flex-col gap-0.5 sm:gap-1 w-full rounded-xl overflow-hidden ${isExportMode ? '' : 'border border-slate-800'}`}>
      {processedTiers.map((tier) => (
        <div
          key={tier.label}
          data-tier-export-section="true"
          className={`grid ${isExportMode ? 'grid-cols-[6rem_1fr]' : 'grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]'} bg-black gap-0.5 sm:gap-1 min-h-[80px] w-full`}
        >
          {/* TIER BADGE */}
          <div className={`w-full h-full flex items-center justify-center ${tier.color}`}>
            <span className={`text-2xl sm:text-4xl ${displayFont.className} ${tier.text}`}>
              {tier.label}
            </span>
          </div>

          {/* SCROLLING CONTAINER */}
          <div className="flex-1 min-w-0 bg-slate-900 w-full h-full relative">
            <div 
              className={`w-full h-full ${
                isExportMode 
                  ? 'flex flex-wrap gap-1 p-1 content-start' 
                  : 'flex overflow-x-auto flex-nowrap gap-0.5 sm:gap-1 p-0.5 sm:p-1 overscroll-x-contain custom-tier-scrollbar'
              }`}
            >
              {tier.items.length === 0 ? (
                <div className="flex items-center px-4">
                  <span className="text-xs font-bold text-slate-700 italic">No items</span>
                </div>
              ) : (
                tier.items.map((item) => {
                  const resolvedId = viewMode === 'albums' ? item.id : (ALBUM_NAME_TO_ID[item.album] || 'unknown');
                  const theme = ALBUM_COLORS[item.album] || DEFAULT_COLOR;

                  // ALBUMS VIEW (Uses actual Album Artwork)
                  if (viewMode === 'albums') {
                    return (
                      <div
                        key={item.id}
                        data-tier-export-tile="true"
                        className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 p-1 flex items-center justify-center ${
                          isExportMode ? '' : 'hover:scale-[1.02] transition-transform cursor-default'
                        }`}
                        title={`#${item.rank} ${item.name}`}
                      >
                        <div className="w-full h-full relative rounded-md overflow-hidden border border-slate-700 shadow-sm bg-slate-800">
                          <AlbumArtwork albumId={resolvedId} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-tl-md backdrop-blur-sm">
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
                      className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center p-1 text-center select-none ${theme.bg} ${theme.text} ${
                        isExportMode ? '' : 'hover:scale-[1.02] transition-transform cursor-default'
                      }`}
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

  // Export attribution (header, top right — where the old white CTA
  // box sat). Guests have no username to credit.
  const attributionLine = username
    ? `Tier list for @${username} generated by RankingWeezer.com`
    : 'Tier list generated by RankingWeezer.com';

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

      {/* WEB UI VISIBLE CHART */}
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

      {/* HIDDEN EXPORT CHART (Pre-rendered explicitly for Image Capture).
          Same 1024px frame and mechanics as always; the field is now
          the poster kit's bright blue (Abby's direction) with the
          chart grid seated on it as the canonical dark tier panel. */}
      <div className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none">
        <div ref={exportRef} className="w-[1024px] p-8" style={{ backgroundColor: POSTER_BLUE }}>

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
        </div>
      </div>

      {/* SAVE / SHARE BUTTON — data-tier-save marks this
          instance's save control so the Tier List modal's pinned
          footer button (ShareablesGallery) can trigger THIS
          instance's export and mirror its state (UAT P-11). */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        data-tier-save="true"
        className={`w-full ${exportFailed ? 'bg-rose-500' : 'bg-[#0072CE] hover:bg-blue-600'} active:scale-98 text-white font-black py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer`}
      >
        <span>{isExporting ? 'Generating Image...' : exportFailed ? "Couldn't generate — try again" : '📸 Save Tier List as Image'}</span>
      </button>
    </div>
  );
}
