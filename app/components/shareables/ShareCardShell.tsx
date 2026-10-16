'use client';

import { forwardRef, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ALBUMS_BY_ID } from '../../data/constants';
import { exportNodeAsPng } from './exportImage';
import type { ExportMode } from './exportImage';
import { handFont, markerFont } from './fonts';

/* ------------------------------------------------------------------ */
/* Scrapbook kit — shared visual language for the shareable cards:     */
/* cream paper, album-cover collage along the left edge, tape, brush   */
/* banners, Polaroids, handwritten (Caveat) notes and marker           */
/* (Permanent Marker) display type. Cards render at 1080x1350 (4:5).   */
/* ------------------------------------------------------------------ */

const NOISE_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E";

const TAPE_CLIP =
  'polygon(2% 6%, 98% 0%, 100% 88%, 97% 100%, 3% 95%, 0% 14%)';

/** The site's own Flying W graphic (same path as SharedUI's FlyingWIcon). */
export function FlyingW({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 1000 550" className={className} style={style} fill="currentColor" aria-hidden="true">
      <path d="M 0,0 L 240,0 L 330,260 L 500,150 L 670,260 L 760,0 L 1000,0 L 1000,65 L 870,65 L 870,125 L 960,125 L 960,190 L 760,190 L 630,540 L 500,310 L 370,540 L 240,190 L 40,190 L 40,125 L 130,125 L 130,65 L 0,65 Z" />
    </svg>
  );
}

export function Tape({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`shadow-sm ${className}`}
      style={{
        backgroundColor: 'rgba(236, 219, 141, 0.78)',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 6px, transparent 6px 12px)',
        clipPath: TAPE_CLIP,
        ...style,
      }}
    />
  );
}

/** Rough brush-stroke silhouette (SVG) — banners and highlight swipes. */
export function BrushStroke({
  color,
  className = '',
  style,
}: {
  color: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1080 90"
      preserveAspectRatio="none"
      className={className}
      style={style}
    >
      <path
        d="M6 30 C 200 12, 420 38, 640 22 C 820 10, 960 26, 1074 18 L 1070 58 C 880 76, 640 56, 420 72 C 260 82, 120 70, 8 64 Z"
        fill={color}
      />
    </svg>
  );
}

/** Taped Polaroid of an album cover. */
export function Polaroid({
  albumId,
  caption,
  rotate = -5,
  className = '',
  style,
}: {
  albumId?: string;
  caption?: string;
  rotate?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const album = albumId ? ALBUMS_BY_ID[albumId] : undefined;
  const src = album?.cover ?? '/albums/fallback.jpg';
  return (
    <div
      className={`bg-white p-3 pb-4 shadow-[0_18px_36px_rgba(60,45,10,0.35)] ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
    >
      <div className="relative">
        <Tape className="absolute -top-5 left-1/2 z-10 h-9 w-32 -translate-x-1/2 -rotate-3" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={album?.name ?? 'Album cover'}
          className="aspect-square w-full object-cover"
        />
      </div>
      {caption && (
        <p
          className={`mt-2 text-center text-[26px] leading-none text-slate-700 ${handFont.className}`}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

export function albumCoverSrc(albumId?: string): string {
  return (albumId && ALBUMS_BY_ID[albumId]?.cover) || '/albums/fallback.jpg';
}

/** Distinct album ids from a song list, in order — feeds the collage edge. */
export function distinctAlbumIds(
  songs: Array<{ albumId?: string }>,
  max = 5,
): string[] {
  const out: string[] = [];
  for (const s of songs) {
    if (s.albumId && !out.includes(s.albumId)) out.push(s.albumId);
    if (out.length >= max) break;
  }
  return out;
}

const STRIP_ROTATIONS = [-7, 5, -4, 6, -5];

/**
 * The scrapbook frame every card renders inside: cream paper with
 * grain and coffee rings, the user's own album covers collaged down
 * the left edge, a tape banner with the domain up top, a username
 * sticker, the project masthead, and the brush CTA along the bottom.
 * Card content sits right of the collage strip.
 */
export const ScrapbookVisual = forwardRef<
  HTMLDivElement,
  { subtitle?: string; artAlbumIds?: string[]; children: ReactNode }
>(function ScrapbookVisual({ subtitle, artAlbumIds, children }, ref) {
  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden bg-[#f1e8d0] text-slate-900"
    >
      {/* paper grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: `url("${NOISE_BG}")`, opacity: 0.05 }}
      />
      {/* coffee rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-72 h-64 w-64 rounded-full border-[10px] border-[#b98a4a]/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 bottom-80 h-52 w-52 rounded-full border-[8px] border-[#b98a4a]/10"
      />

      {/* album-cover collage down the left edge */}
      {artAlbumIds && artAlbumIds.length > 0 && (
        <div
          aria-hidden="true"
          className="absolute bottom-[150px] left-[-30px] top-[120px] z-0 flex w-[215px] flex-col items-center"
        >
          {artAlbumIds.slice(0, 5).map((id, i) => (
            <div
              key={`${id}-${i}`}
              className="relative -mb-8 w-[176px] bg-white p-1.5 shadow-[0_10px_22px_rgba(60,45,10,0.35)]"
              style={{ transform: `rotate(${STRIP_ROTATIONS[i % 5]}deg)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={albumCoverSrc(id)}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {i % 2 === 0 && (
                <Tape className="absolute -top-4 left-1/2 z-10 h-7 w-24 -translate-x-1/2 -rotate-6" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* top tape banner */}
      <div className="absolute left-12 top-9 z-20 -rotate-2">
        <div className="relative flex h-[64px] w-[440px] items-center justify-center">
          <Tape className="absolute inset-0" />
          <span
            className={`relative text-[27px] tracking-wide text-slate-900 ${markerFont.className}`}
          >
            RANKINGWEEZER.COM
          </span>
        </div>
      </div>

      {/* username sticker */}
      {subtitle && (
        <div className="absolute right-12 top-10 z-20 rotate-3 rounded-md bg-white/90 px-4 py-1.5 shadow-md">
          <span className={`text-[30px] leading-none text-slate-700 ${handFont.className}`}>
            {subtitle}
          </span>
        </div>
      )}

      {children}

      {/* project masthead */}
      <div className="absolute inset-x-12 bottom-[140px] z-20 flex items-center justify-center gap-3">
        <FlyingW className="h-[22px] w-[40px] text-slate-700" />
        <span className="text-[19px] font-black uppercase tracking-[0.22em] text-slate-600">
          All My Favorite Songs · The Weezer Song Ranking Project
        </span>
      </div>

      {/* bottom brush CTA */}
      <div className="absolute inset-x-12 bottom-9 z-20">
        <div className="relative flex h-[96px] items-center justify-center">
          <BrushStroke color="#141414" className="absolute inset-0 h-full w-full" />
          <span
            className={`relative text-[36px] tracking-wide text-white ${markerFont.className}`}
          >
            SETTLE THE DEBATE AT RANKINGWEEZER.COM
          </span>
        </div>
      </div>
    </div>
  );
});

/** Primary button for standalone cards (matches the tier card's). */
export function SaveImageButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
    >
      <span>{busy ? 'Generating Image...' : '📸 Download Image'}</span>
    </button>
  );
}

/** Hook wiring a visual's ref to the PNG export. */
export function useShareableDownload(filename: string, mode: ExportMode = 'auto') {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportNodeAsPng(ref.current, filename, mode);
    } finally {
      setBusy(false);
    }
  };
  return { ref, busy, download };
}
