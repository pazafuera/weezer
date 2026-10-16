'use client';

import { forwardRef } from 'react';
import { DownloadPngButton, ShareableVisual, useShareableDownload } from './ShareCardShell';
import type { Bucket, ShareSong } from './Top10Card';

export type Tribe = { name: string; blurb: string; stat: string };

/**
 * Transparent, rule-based tribe assignment. Checked in precedence order;
 * the first matching rule wins. Rules use only year, isBSide, and album
 * spread — no hardcoded album titles.
 */
export function computeTribe(
  songs: ShareSong[],
  triageMap: Record<string, Bucket>,
): Tribe | null {
  const ranked = songs.filter((s) => triageMap[s.id]);
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
        name: '90s Purist',
        blurb:
          'Your bangers live in 1994–1996. The Blue Album / Pinkerton era is sacred ground.',
        stat: `${early} of your top ${top.length} bangers are from the 90s`,
      };
    }
  }

  const bsides = ranked.filter((s) => s.isBSide).length;
  if (ranked.length >= 10 && bsides / ranked.length >= 0.4) {
    return {
      name: 'Deep-Cuts Digger',
      blurb: 'B-sides, rarities, deluxe tracks — you live beyond the greatest hits.',
      stat: `${bsides} of ${ranked.length} ranked songs are deep cuts`,
    };
  }

  if (top.length >= 8) {
    const albums = new Set(top.map((s) => s.album));
    if (albums.size >= 6) {
      return {
        name: 'Catalog Completist',
        blurb: 'Your love spreads across the whole catalog. No era left behind.',
        stat: `Bangers spanning ${albums.size} albums`,
      };
    }
  }

  if (top.length >= 5) {
    const modern = top.filter(inYears(2014, 2030)).length;
    if (modern / top.length >= 0.6) {
      return {
        name: 'New School',
        blurb: 'Pacific Daydream to Van Weezer — you ride with modern Weezer.',
        stat: `${modern} of ${top.length} bangers from 2014+`,
      };
    }
    const y2k = top.filter(inYears(2001, 2005)).length;
    if (y2k / top.length >= 0.6) {
      return {
        name: 'Y2K Rocker',
        blurb: 'Green, Maladroit, Make Believe — the 2000s are your sweet spot.',
        stat: `${y2k} of ${top.length} bangers from 2001–2005`,
      };
    }
  }

  return {
    name: 'Banger Hunter',
    blurb: 'You know what you like — and most of it slaps.',
    stat: `${top.length} bangers and slaps ranked`,
  };
}

export const TribeBadgeCardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; triageMap: Record<string, Bucket>; subtitle?: string }
>(function TribeBadgeCardVisual({ songs, triageMap, subtitle }, ref) {
  const tribe = computeTribe(songs, triageMap);
  return (
    <ShareableVisual ref={ref} title="My Fan Tribe" subtitle={subtitle}>
      {tribe ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="flex h-48 w-48 items-center justify-center rounded-full bg-amber-400 text-black">
            <span className="px-6 text-3xl font-black uppercase leading-tight">
              {tribe.name}
            </span>
          </div>
          <p className="mt-8 max-w-2xl text-2xl text-slate-300">{tribe.blurb}</p>
          <p className="mt-4 rounded-full bg-slate-800 px-6 py-2 text-lg font-bold text-amber-300">
            {tribe.stat}
          </p>
        </div>
      ) : (
        <p className="py-16 text-center text-2xl text-slate-400">
          Rank some songs to earn your tribe badge.
        </p>
      )}
    </ShareableVisual>
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
        <DownloadPngButton onClick={download} label={busy ? 'Rendering…' : 'Download PNG'} />
      </div>
    </div>
  );
}
