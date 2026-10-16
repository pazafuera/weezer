'use client';

import { forwardRef } from 'react';
import { ALBUMS_BY_ID } from '../../data/constants';
import {
  BrushStroke,
  FlyingW,
  Polaroid,
  SaveImageButton,
  ScrapbookVisual,
  distinctAlbumIds,
  resolveAlbumId,
  useShareableDownload,
} from './ShareCardShell';
import { handFont, markerFont } from './fonts';
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

const TRIBE_INK: Record<string, string> = {
  '90s Purist': '#0072CE',
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
>(function TribeBadgeCardVisual({ songs, triageMap, subtitle }, ref) {
  const tribe = computeTribe(songs, triageMap);
  const ink = (tribe && TRIBE_INK[tribe.name]) || '#141414';
  const words = tribe ? tribe.name.toUpperCase().split(' ') : [];
  const longest = words.reduce((a, w) => Math.max(a, w.length), 0);
  const nameSize = longest <= 5 ? 178 : longest <= 8 ? 150 : 120;
  const domAlbumId = dominantAlbumId(songs);
  const domAlbum = domAlbumId ? ALBUMS_BY_ID[domAlbumId] : undefined;
  const topSongs = songs.filter(
    (s) => triageMap[s.id] === 'banger' || triageMap[s.id] === 'slaps',
  );
  const artIds = distinctAlbumIds([...topSongs, ...songs]);

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle} artAlbumIds={artIds}>
      <div className="absolute bottom-[190px] left-[184px] right-[60px] top-[140px]">
        {!tribe ? (
          <p
            className={`pt-64 text-center text-[54px] text-slate-700 ${handFont.className}`}
          >
            Rank some songs to earn your tribe badge!
          </p>
        ) : (
          <>
            <div className="relative">
              <p className="relative inline-block">
                <span
                  className={`relative z-10 text-[46px] tracking-wide text-slate-800 ${markerFont.className}`}
                >
                  MY FAN TRIBE
                </span>
                <BrushStroke
                  color="#fbbf24"
                  className="absolute -bottom-2 left-0 z-0 h-[18px] w-full"
                />
              </p>
              <FlyingW
                className="absolute right-0 top-[-12px] w-[150px] rotate-[8deg]"
                style={{ color: ink }}
              />
            </div>

            {/* The tribe name in huge marker type, tribe ink */}
            <div className="mt-16 -rotate-2 text-center" style={{ color: ink }}>
              {words.map((w) => (
                <div
                  key={w}
                  className={`leading-[0.95] ${markerFont.className}`}
                  style={{ fontSize: nameSize }}
                >
                  {w}
                </div>
              ))}
            </div>

            <p
              className={`mx-auto mt-12 max-w-[760px] text-center text-[48px] leading-tight text-slate-800 ${handFont.className}`}
            >
              {tribe.blurb}
            </p>

            <p
              className={`mt-8 text-center text-[44px] leading-tight ${handFont.className}`}
              style={{ color: ink }}
            >
              {tribe.stat}
            </p>

            <div className="absolute bottom-[36px] left-2 -rotate-2 rounded-2xl rounded-bl-sm bg-white px-5 py-3 shadow-lg">
              <p
                className={`text-[36px] leading-tight text-slate-700 ${handFont.className}`}
              >
                Certified by science.*
                <br />
                <span className="text-[27px] text-slate-500">*not science</span>
              </p>
            </div>

            {domAlbum && (
              <Polaroid
                albumId={domAlbumId}
                caption={`${domAlbum.name} — patient zero`}
                rotate={5}
                className="absolute bottom-[6px] right-2 w-[228px]"
              />
            )}
          </>
        )}
      </div>
    </ScrapbookVisual>
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
