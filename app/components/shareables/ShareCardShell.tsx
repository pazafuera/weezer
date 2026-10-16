'use client';

import { forwardRef, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ALBUMS_BY_ID } from '../../data/constants';
import { exportNodeAsPng } from './exportImage';
import type { ExportMode } from './exportImage';
import { handFont, markerFont } from './fonts';

/* ------------------------------------------------------------------ */
/* Scrapbook kit — shared visual language for the v3 shareable cards:  */
/* cream paper, tape, brush banners, rubber stamps, Polaroids,         */
/* handwritten (Caveat) annotations and marker (Permanent Marker)      */
/* display type. Cards render at a fixed 1080x1350 (4:5) — the        */
/* tallest Instagram/Facebook feed crop.                               */
/* ------------------------------------------------------------------ */

const NOISE_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E";

const TAPE_CLIP =
  'polygon(2% 6%, 98% 0%, 100% 88%, 97% 100%, 3% 95%, 0% 14%)';

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

/** Rubber-stamp label: rotated, double-ring ink border, marker type. */
export function Stamp({
  children,
  color = '#b3352b',
  rotate = -6,
  className = '',
  style,
}: {
  children: ReactNode;
  color?: string;
  rotate?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-block rounded-lg px-4 py-1 uppercase ${markerFont.className} ${className}`}
      style={{
        color,
        border: `4px solid ${color}`,
        outline: `2px solid ${color}`,
        outlineOffset: '3px',
        transform: `rotate(${rotate}deg)`,
        opacity: 0.92,
        fontSize: '30px',
        letterSpacing: '0.04em',
        backgroundColor: 'rgba(255,255,255,0.25)',
        ...style,
      }}
    >
      {children}
    </span>
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

export function DoodleStar({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className} style={style}>
      <path
        d="M50 6 L61 38 L95 38 L67 58 L77 92 L50 70 L23 92 L33 58 L5 38 L39 38 Z"
        fill="none"
        stroke="#92400e"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function albumCoverSrc(albumId?: string): string {
  return (albumId && ALBUMS_BY_ID[albumId]?.cover) || '/albums/fallback.jpg';
}

/**
 * The scrapbook frame every v3 card renders inside: cream paper with
 * grain and coffee rings, punched binder holes down the left edge, a
 * tape banner with the domain up top, a username sticker, and the black
 * brush CTA along the bottom. Content goes in the middle ~1000px.
 */
export const ScrapbookVisual = forwardRef<
  HTMLDivElement,
  { subtitle?: string; children: ReactNode }
>(function ScrapbookVisual({ subtitle, children }, ref) {
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
      {/* binder holes */}
      <div
        aria-hidden="true"
        className="absolute bottom-10 left-5 top-40 flex flex-col justify-between"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-5 w-5 rounded-full bg-[#ddd0ab] shadow-[inset_0_2px_4px_rgba(90,70,20,0.45)]"
          />
        ))}
      </div>

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

      {/* bottom brush CTA */}
      <div className="absolute inset-x-12 bottom-9 z-20">
        <div className="relative flex h-[96px] items-center justify-center">
          <BrushStroke color="#141414" className="absolute inset-0 h-full w-full" />
          <span
            className={`relative text-[38px] tracking-wide text-white ${markerFont.className}`}
          >
            MAKE YOURS AT RANKINGWEEZER.COM
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
