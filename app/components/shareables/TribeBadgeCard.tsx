'use client';

import { forwardRef, Fragment } from 'react';
import type { CSSProperties } from 'react';
import { albumCoverSrc, resolveAlbumId } from './ShareCardShell';
import {
  FactsBurst,
  FlyingW,
  GuitarSilhouette,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  VinylDisc,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
import type { Bucket, ShareSong } from './Top10Card';

/** Why this doodle is defined locally instead of imported from
 *  ShareCardShell: the deployed-bundle fault proven on 2026-11-03
 *  (FanhoodCard, React #130) recurred on 2026-11-04 in the preview
 *  build — the shared export can be dropped from a deployed
 *  bundle, a module-local copy cannot. Top10Card, Top10AlbumsCard
 *  and FanhoodCard carry their own copies for the same reason.
 *  This card's copy fills with currentColor: the Option B badge
 *  layout sets it in white over the field, where the other cards'
 *  copies sit in black. */
function MusicNotesDoodle({
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
      fill="currentColor"
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

export type Tribe = {
  /** Canonical tribe key, e.g. '90s Purist' — keys TRIBE_INK. */
  name: string;
  /** The name as it renders on the card, exactly as locked:
   *  '90s PURIST keeps its leading apostrophe and lowercase s. */
  displayName: string;
  /** First-person diagnosis line (copy sheet: Purist LOCKED, the
   *  other five still DRAFTs awaiting the owner's edit). */
  diagnosis: string;
  /** First-person "THE FACTS" line, filled from the user's rankings. */
  fact: string;
};

/**
 * Transparent, rule-based tribe assignment. Checked in precedence order;
 * the first matching rule wins. Rules use only year, isBSide, and album
 * spread — no hardcoded album titles. The thresholds are the copy
 * sheet's; the fact lines are the same computations as the old
 * second-person stats, reworded into the sheet's first-person
 * patterns (the words and the math can't drift apart).
 */
export function computeTribe(
  songs: ShareSong[],
  triageMap: Record<string, Bucket>,
): Tribe | null {
  // 'unknown' ("Don't Know It") songs are not ranked and never count
  // toward tribe denominators.
  const ranked = songs.filter((s) => {
    const b = triageMap[s.id];
    return b !== undefined && b !== 'unknown';
  });
  if (ranked.length === 0) return null;
  const top = ranked.filter(
    (s) => triageMap[s.id] === 'banger' || triageMap[s.id] === 'slaps',
  );
  const inYears = (a: number, b: number) => (s: ShareSong) =>
    (s.year || 0) >= a && (s.year || 0) <= b;

  if (top.length >= 5) {
    const early = top.filter(inYears(1994, 1996)).length;
    if (early / top.length >= 0.7) {
      return {
        name: "'90s Purist",
        displayName: "'90s PURIST",
        diagnosis: "I haven't emotionally left 1997.",
        fact: `${early} of my top ${top.length} songs are from the '90s`,
      };
    }
  }

  const bsides = ranked.filter((s) => s.isBSide).length;
  if (ranked.length >= 10 && bsides / ranked.length >= 0.4) {
    return {
      name: 'Deep-Cuts Digger',
      displayName: 'DEEP-CUTS DIGGER',
      diagnosis: "The deep cuts aren't deep to me. They're home.",
      fact: `${bsides} of my ${ranked.length} ranked songs are deep cuts`,
    };
  }

  if (top.length >= 8) {
    const albums = new Set(top.map((s) => s.album));
    if (albums.size >= 6) {
      return {
        name: 'Catalog Completist',
        displayName: 'CATALOG COMPLETIST',
        diagnosis: 'I refuse to leave a single era behind.',
        fact: `My top songs span ${albums.size} different albums`,
      };
    }
  }

  if (top.length >= 5) {
    const modern = top.filter(inYears(2014, 2030)).length;
    if (modern / top.length >= 0.6) {
      return {
        name: 'New School',
        displayName: 'NEW SCHOOL',
        diagnosis: 'I like the new albums. Loudly, and in public.',
        fact: `${modern} of my top ${top.length} songs are from 2014 or later`,
      };
    }
    const y2k = top.filter(inYears(2001, 2005)).length;
    if (y2k / top.length >= 0.6) {
      return {
        name: 'Y2K Rocker',
        displayName: 'Y2K ROCKER',
        diagnosis: "The 2000s weren't a comeback. They were my era.",
        fact: `${y2k} of my top ${top.length} songs are from 2001–2005`,
      };
    }
  }

  return {
    name: 'Banger Hunter',
    displayName: 'BANGER HUNTER',
    diagnosis: "I don't overthink it. If it slaps, it slaps.",
    fact: `I ranked ${top.length} songs as bangers or slaps`,
  };
}

const TRIBE_INK: Record<string, string> = {
  "'90s Purist": '#0072CE',
  'Deep-Cuts Digger': '#7c3aed',
  'Catalog Completist': '#047857',
  'New School': '#ea580c',
  'Y2K Rocker': '#0f766e',
  'Banger Hunter': '#b3352b',
};

function dominantAlbumId(songs: ShareSong[]): string | undefined {
  const counts = new Map<string, number>();
  for (const s of songs) {
    const id = resolveAlbumId(s);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [id, c] of counts) {
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  }
  return best ?? (songs[0] ? resolveAlbumId(songs[0]) : undefined);
}

export const TribeBadgeCardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; triageMap: Record<string, Bucket>; subtitle?: string }
>(function TribeBadgeCardVisual({ songs, triageMap }, ref) {
  const tribe = computeTribe(songs, triageMap);
  const ink = (tribe && TRIBE_INK[tribe.name]) || '#141414';
  const domAlbumId = dominantAlbumId(songs);
  // The tribe name ALWAYS renders on one line (the copy sheet's layout
  // rule) — auto-sized down from the mockup's scale until it fits.
  const nameSize = tribe
    ? Math.max(84, Math.min(158, Math.floor(1740 / tribe.displayName.length)))
    : 0;
  // Locked Purist flourish: the year is highlighted amber.
  const diagnosisParts = tribe ? tribe.diagnosis.split('1997') : [];

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{
        backgroundColor: POSTER_BLUE,
        // The share page's halftone dot field (same values as
        // app/share/page.tsx) — texture behind everything, no
        // layout impact.
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
        backgroundSize: '20px 20px',
      }}
    >
      <PosterDomain />
      {!tribe ? (
        <div className="absolute inset-0 flex items-center justify-center px-[100px]">
          <p
            className={`text-center text-[56px] font-bold leading-tight ${handFont.className}`}
          >
            Rank some songs to earn your tribe badge!
          </p>
        </div>
      ) : (
        <>
          {/* Option B — "the badge" (tribe-redesign mock, chosen
              Nov 5): intro pill 92 / name stamped across the
              upright guitar at 452 / diagnosis tight underneath
              at 736 / facts 896 + album frame 892 / footer. The
              guitar stands upright in solid ink at card center
              behind the name; the diagnosis sits on clean blue
              below the guitar's body (which ends ~694). Zone
              audit in REPORT.md (cards recomposition, C4). */}
          <GuitarSilhouette
            className="absolute inset-0 h-full w-full"
            transform="translate(190 300) scale(1.05)"
            fill="#0C1220"
            style={{ opacity: 0.95 }}
          />
          <MusicNotesDoodle className="absolute left-[812px] top-[178px] w-[104px] text-white opacity-90" />

          {/* The intro as the share page's inverted ink pill —
              same words, same 40px light line, still one line
              (the pill fits: text 963px + 68px padding = 1031px
              of the 1080 card, audited with real font metrics). */}
          <div className="absolute inset-x-0 top-[92px] text-center">
            <span className="inline-block whitespace-nowrap rounded-2xl bg-[#0C1220] px-[34px] py-[18px] text-[40px] font-light leading-none text-white">
              Based on my ranking of every Weezer song, I&apos;m a...
            </span>
          </div>

          <h2
            className={`absolute inset-x-0 top-[452px] z-[5] whitespace-nowrap text-center leading-none text-white ${displayFont.className}`}
            style={{
              fontSize: nameSize,
              WebkitTextStroke: '3px #0C1220',
              textShadow: '5px 5px 0 rgba(12,18,32,0.9)',
            }}
          >
            {tribe.displayName}
          </h2>
          <p
            className={`absolute inset-x-[60px] top-[736px] whitespace-nowrap text-center text-[54px] font-bold leading-[1.2] ${handFont.className}`}
          >
            {diagnosisParts.map((part, i) => (
              <Fragment key={i}>
                {part}
                {i < diagnosisParts.length - 1 && (
                  <span className="text-amber-400">1997</span>
                )}
              </Fragment>
            ))}
          </p>

          {/* THE FACTS — burst + the fact, left column (Option B
              seats the block 16px lower than the old layout) */}
          <div className="absolute left-[64px] top-[896px] w-[400px]">
            <FactsBurst className="-ml-[30px] h-[104px] w-[420px] -rotate-2">
              <span
                className={`text-[48px] leading-none text-black ${displayFont.className}`}
              >
                THE FACTS:
              </span>
            </FactsBurst>
            <p className="mt-[28px] text-[46px] leading-[1.3]">{tribe.fact}</p>
          </div>

          {/* Signature album: white frame, vinyl peeking out —
              Option B steps the frame down to 280px and rescales
              the peek to match (300px disc at -125 / -10) */}
          {domAlbumId && (
            <div className="absolute right-[64px] top-[892px] w-[280px]">
              <VinylDisc
                labelColor={ink}
                className="absolute -right-[125px] top-[-10px] h-[300px] w-[300px]"
              />
              <div className="relative z-10 border-[3px] border-[#0C1220] bg-white p-[14px] shadow-[6px_6px_0_rgba(12,18,32,0.9)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(domAlbumId)}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* THE standard card footer (Nov 5 — one footer on every
              card, at Mark's direction). This REPLACES this card's
              locked colon-form footer and its "find out what kind
              of fan YOU are…" line; the override is recorded in
              REPORT.md (C1). */}
          <div className="absolute inset-x-12 bottom-[92px] z-10 flex items-center justify-center gap-[14px]">
            <FlyingW className="h-[26px] w-[48px] text-white" />
            <span className="whitespace-nowrap text-[22px] font-black uppercase tracking-[0.22em] text-white/95">
              All My Favorite Songs · The Weezer Song Ranking Project
            </span>
          </div>
          <p
            className={`absolute inset-x-12 bottom-[30px] z-10 whitespace-nowrap text-center text-[44px] font-bold leading-none text-white ${handFont.className}`}
          >
            JOIN THE DEBATE AT RANKINGWEEZER.COM
          </p>
        </>
      )}
    </div>
  );
});

export default function TribeBadgeCard({
  songs,
  triageMap,
  subtitle,
}: {
  songs: ShareSong[];
  triageMap: Record<string, Bucket>;
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('my-weezer-tribe.png');
  return (
    <div>
      <TribeBadgeCardVisual ref={ref} songs={songs} triageMap={triageMap} subtitle={subtitle} />
      <div className="mt-4">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
