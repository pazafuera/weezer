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
 * Black ACOUSTIC-guitar silhouette, drawn directly in card
 * coordinates (viewBox 0 0 1080 1350 — the caller stretches it over
 * the whole card): round lower bout, pinched waist, smaller upper
 * bout, the soundhole carved out in field blue, a tapered neck
 * running diagonally down-right, and a paddle headstock with 3+3
 * tuner pegs. The outline is a Catmull-Rom-smoothed loop generated
 * numerically, and the placement is verified against the Tribe
 * card's text zones (name zone y 308–466, diagnosis zone y 782–849):
 * only the body's smooth shoulder crosses the name zone's lower
 * band; the soundhole clears it by 52px, the waist dip passes 2px
 * below it, and the headstock (x 916–1057, y 650–760) clears the
 * name zone by 184px and the diagnosis zone by 22px — nothing busy
 * sits near any text, and no pegs trail the tribe name.
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
      viewBox="0 0 1080 1350"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* body — smoothed acoustic outline */}
      <path
        d="M 528.8 558.3 C 528.2 539, 518 530.8, 507.6 518.3 C 497.3 505.8, 483.8 492.9, 466.6 483.1 C 449.4 473.3, 423.5 461.8, 404.2 459.3 C 384.9 456.8, 365.1 470.2, 350.7 468 C 336.4 465.9, 331.3 456.1, 318.3 446.5 C 305.3 436.9, 290.1 420.1, 272.8 410.3 C 255.6 400.5, 234.2 390.1, 214.9 387.5 C 195.6 385, 174.2 388.3, 157 395.2 C 139.8 402.2, 123.4 417.1, 111.7 429.2 C 99.9 441.3, 92 457.1, 86.4 467.9 C 80.8 478.6, 80.1 485.1, 78 494 C 75.9 502.9, 73.8 509, 74.1 521.2 C 74.4 533.3, 74.6 550.9, 79.9 567 C 85.1 583, 93.3 603.6, 105.7 617.4 C 118.1 631.2, 135.9 643.5, 154.4 649.7 C 172.8 655.9, 196.6 655.9, 216.4 654.7 C 236.2 653.4, 257.3 645, 273.1 642 C 289 639.1, 298 632.5, 311.8 636.9 C 325.6 641.2, 337.6 662, 356 668.2 C 374.5 674.4, 402.7 675.4, 422.5 674.2 C 442.3 672.9, 460 667.2, 474.8 660.5 C 489.6 653.8, 502.4 650.9, 511.4 633.8 C 520.4 616.8, 529.4 577.6, 528.8 558.3 Z"
        fill="#000"
      />
      {/* neck */}
      <path
        d="M 515.9 563.5 L 928.3 672.7 L 920.6 706.1 L 502.1 623.5 Z"
        fill="#000"
      />
      {/* headstock */}
      <path
        d="M 921.9 670.1 L 956.5 661.7 L 1012.9 671.2 L 1046.1 689.4 L 1057 713 L 1050.2 732.5 L 1021.9 743.5 L 956.5 733.1 L 915.9 706.2 Z"
        fill="#000"
      />
      {/* tuner pegs, 3 + 3 */}
      <circle cx="971.4" cy="658.1" r="8.5" fill="#000" />
      <circle cx="1003.2" cy="662.5" r="8.5" fill="#000" />
      <circle cx="1033.1" cy="674.7" r="8.5" fill="#000" />
      <circle cx="952.7" cy="739.2" r="8.5" fill="#000" />
      <circle cx="983.2" cy="749.2" r="8.5" fill="#000" />
      <circle cx="1015.4" cy="751.4" r="8.5" fill="#000" />
      {/* soundhole, carved in field blue */}
      <circle cx="405.7" cy="569.7" r="51.3" fill={POSTER_BLUE} />
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

/** Hand-drawn black music notes doodle, as in Abby's mockups — a
 *  beamed pair plus a single flagged eighth note. Decorative only. */
export function MusicNotesDoodle({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 320 300"
      className={className}
      style={style}
      fill="#000"
      aria-hidden="true"
    >
      {/* beamed pair */}
      <rect x="82" y="118" width="8" height="126" />
      <rect x="172" y="94" width="8" height="126" />
      <polygon points="82,118 180,94 180,126 82,150" />
      <ellipse cx="58" cy="252" rx="27" ry="19" transform="rotate(-18 58 252)" />
      <ellipse cx="148" cy="228" rx="27" ry="19" transform="rotate(-18 148 228)" />
      {/* single flagged eighth note */}
      <rect x="271" y="64" width="8" height="104" />
      <path d="M271 64 C 302 76, 310 104, 298 134 C 304 102, 294 84, 271 74 Z" />
      <ellipse cx="250" cy="176" rx="24" ry="17" transform="rotate(-18 250 176)" />
    </svg>
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
