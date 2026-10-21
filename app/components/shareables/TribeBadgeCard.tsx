'use client';

import { forwardRef, Fragment } from 'react';
import { albumCoverSrc, resolveAlbumId } from './ShareCardShell';
import {
  FactsBurst,
  GuitarSilhouette,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  VinylDisc,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
import type { Bucket, ShareSong } from './Top10Card';

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
      style={{ backgroundColor: POSTER_BLUE }}
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
          <p className="absolute inset-x-[80px] top-[96px] text-center text-[54px] font-light leading-[1.25]">
            Based on my ranking of every Weezer song, I&apos;m a...
          </p>

          {/* Structured grid: intro 96 / name 308 / diagnosis 782 /
              facts + album 866–880 / footer. The guitar is drawn in
              card coordinates behind the name block — only its
              smooth shoulder crosses the name zone's lower band;
              the diagnosis sits on clean blue below it. */}
          <GuitarSilhouette className="absolute inset-0 h-full w-full" />
          <h2
            className={`absolute inset-x-0 top-[308px] whitespace-nowrap text-center leading-none text-white ${displayFont.className}`}
            style={{ fontSize: nameSize }}
          >
            {tribe.displayName}
          </h2>
          <p
            className={`absolute inset-x-[60px] top-[782px] text-center text-[54px] font-bold leading-tight ${handFont.className}`}
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

          {/* THE FACTS — burst + the fact, left column */}
          <div className="absolute left-[64px] top-[880px] w-[400px]">
            <FactsBurst className="-ml-[30px] h-[104px] w-[420px] -rotate-2">
              <span
                className={`text-[48px] leading-none text-black ${displayFont.className}`}
              >
                THE FACTS:
              </span>
            </FactsBurst>
            <p className="mt-[28px] text-[46px] leading-[1.3]">{tribe.fact}</p>
          </div>

          {/* Signature album: white frame, vinyl peeking out */}
          {domAlbumId && (
            <div className="absolute right-[64px] top-[866px] w-[336px]">
              <VinylDisc
                labelColor={ink}
                className="absolute -right-[150px] top-[-12px] h-[360px] w-[360px]"
              />
              <div className="relative z-10 bg-white p-[14px] shadow-[0_24px_48px_rgba(2,60,90,0.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(domAlbumId)}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
          )}

          <p className="absolute inset-x-[40px] bottom-[92px] text-center text-[27px] font-semibold uppercase leading-snug tracking-[0.14em] text-white/95">
            All My Favorite Songs: The Weezer Song Ranking Project
          </p>
          <p
            className={`absolute inset-x-[40px] bottom-[26px] text-center text-[46px] font-bold leading-none ${handFont.className}`}
          >
            find out what kind of fan YOU are at rankingweezer.com
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
