'use client';

import { forwardRef, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ALBUMS_BY_ID, ALBUM_NAME_TO_ID } from '../../data/constants';
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

/** Amber lightning-bolt doodle (vector, stretched tall like the mock). */
export function BoltDoodle({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M55 2 L98 2 L72 38 L97 38 L28 98 L42 58 L15 58 Z"
        fill="#d97706"
        stroke="#d97706"
        strokeWidth="7"
        strokeLinejoin="round"
      />
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

/** The app's songs often carry only an album NAME — resolve the strict
 *  album id through the same bridge the app itself uses everywhere. */
export function resolveAlbumId(song: {
  albumId?: string;
  album?: string;
}): string | undefined {
  if (song.albumId) return song.albumId;
  if (song.album) return ALBUM_NAME_TO_ID[song.album];
  return undefined;
}

/** Distinct resolved album ids from a song list, in order — feeds the
 *  collage edge. */
export function distinctAlbumIds(
  songs: Array<{ albumId?: string; album?: string }>,
  max = 5,
): string[] {
  const out: string[] = [];
  for (const s of songs) {
    const id = resolveAlbumId(s);
    if (id && !out.includes(id)) out.push(id);
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
>(function ScrapbookVisual({ artAlbumIds, children }, ref) {
  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden bg-[#f1e8d0] text-slate-900"
    >
      {/* paper grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: `url("${NOISE_BG}")`, opacity: 0.085 }}
      />
      {/* soft Weezer-blue wash behind the header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(640px 340px at 32% 2%, rgba(0,114,206,0.13), transparent 70%)',
        }}
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

      {/* album-cover cascade down the left edge — big overlapping
          tiles spanning the content's full height */}
      {artAlbumIds && artAlbumIds.length > 0 && (
        <div
          aria-hidden="true"
          className="absolute left-[-37px] top-[360px] z-0 h-[825px] w-[242px]"
        >
          {artAlbumIds.slice(0, 5).map((id, i, arr) => {
            const n = arr.length;
            const top = n === 1 ? 290 : (i / (n - 1)) * (825 - 242);
            return (
              <div
                key={`${id}-${i}`}
                className="absolute left-1/2 w-[242px] bg-white p-1.5 shadow-[0_10px_22px_rgba(60,45,10,0.35)]"
                style={{
                  top,
                  transform: `translateX(-50%) rotate(${STRIP_ROTATIONS[i % 5]}deg)`,
                }}
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
            );
          })}
        </div>
      )}

      {/* bolt doodle in the top-left margin */}
      <BoltDoodle className="absolute left-[24px] top-[168px] z-0 h-[108px] w-[76px] rotate-[12deg] opacity-60" />

      {/* top tape banner — centered over the headline block */}
      <div className="absolute left-[196px] top-[30px] z-20 -rotate-2">
        <div className="relative flex h-[64px] w-[440px] items-center justify-center">
          <Tape className="absolute inset-0" />
          <span
            className={`relative text-[27px] tracking-wide text-slate-900 ${markerFont.className}`}
          >
            RANKINGWEEZER.COM
          </span>
        </div>
      </div>

      {children}

      {/* project masthead */}
      <div className="absolute inset-x-12 bottom-[140px] z-20 flex items-center justify-center gap-[14px]">
        <FlyingW className="h-[26px] w-[48px] text-slate-700" />
        <span className="text-[22px] font-black uppercase tracking-[0.22em] text-slate-600">
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
            JOIN THE DEBATE AT RANKINGWEEZER.COM
          </span>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Poster kit — Abby's visual language for the Tribe and Era DNA      */
/* cards: a flat bright-blue field, black silhouette graphics, huge   */
/* chunky display type, white framed elements and halftone texture.   */
/* Cards still render at 1080x1350 (4:5), same as the scrapbook kit.  */
/* ------------------------------------------------------------------ */

/** The flat field blue sampled from Abby's mockups. */
export const POSTER_BLUE = '#039AD1';

/** Domain line in the top-right corner, as in the mockups. */
export function PosterDomain() {
  return (
    <p
      aria-hidden="true"
      className={`absolute right-[48px] top-[30px] text-[42px] font-bold leading-none text-white ${handFont.className}`}
    >
      rankingweezer.com
    </p>
  );
}

/**
 * Black electric-guitar silhouette (body left, neck running right and
 * off the edge), composed from overlapping shapes with the field
 * color carved back out for the waist and the top horn. Renders in a
 * 1080x400 box; the tribe name type sits on top of it.
 */
export function GuitarSilhouette({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 1080 400"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* body + neck, one black mass */}
      <ellipse cx="218" cy="272" rx="170" ry="110" fill="#000" />
      <ellipse cx="308" cy="138" rx="124" ry="94" fill="#000" />
      <polygon points="320,112 520,124 520,172 320,182" fill="#000" />
      <rect x="470" y="128" width="520" height="34" fill="#000" />
      <polygon points="990,116 1080,128 1080,178 990,168" fill="#000" />
      <circle cx="1008" cy="106" r="9" fill="#000" />
      <circle cx="1034" cy="106" r="9" fill="#000" />
      <circle cx="1060" cy="106" r="9" fill="#000" />
      {/* field-color carves: waist + horn notch */}
      <ellipse cx="420" cy="310" rx="86" ry="68" fill={POSTER_BLUE} />
      <ellipse cx="452" cy="56" rx="96" ry="54" fill={POSTER_BLUE} />
    </svg>
  );
}

/** Black vinyl disc with groove rings and a colored label — peeks
 *  out from behind the Tribe card's framed album art. */
export function VinylDisc({
  labelColor,
  className = '',
  style,
}: {
  labelColor: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-full ${className}`}
      style={{
        background:
          'repeating-radial-gradient(circle at center, #050505 0 3px, #1d1d1d 3px 6px)',
        ...style,
      }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: '34%', height: '34%', backgroundColor: labelColor }}
        >
          <div
            className="rounded-full"
            style={{ width: '30%', height: '30%', backgroundColor: POSTER_BLUE }}
          />
        </div>
      </div>
    </div>
  );
}

/** White lightning-burst banner carrying the "THE FACTS:" label.
 *  Sized by the caller; the label text sits in the bolt's wide left
 *  section. */
export function FactsBurst({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`relative ${className}`} style={style}>
      <svg
        viewBox="0 0 460 120"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <polygon
          points="2,34 282,34 244,60 458,60 130,102 164,72 2,72"
          fill="#fff"
        />
      </svg>
      <div className="relative z-10 flex h-full items-center pl-[26px]">
        {children}
      </div>
    </div>
  );
}

/** Primary button for standalone cards (matches the tier card's). */
export function SaveImageButton({
  onClick,
  busy,
  disabled,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
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
