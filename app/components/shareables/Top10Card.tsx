'use client';

import { forwardRef } from 'react';
import { ALBUMS_BY_ID } from '../../data/constants';
import {
  BrushStroke,
  FlyingW,
  SaveImageButton,
  ScrapbookVisual,
  Tape,
  distinctAlbumIds,
  resolveAlbumId,
  useShareableDownload,
} from './ShareCardShell';
import { handFont, markerFont } from './fonts';

/** Triage buckets, matching the app's BucketType. */
export type Bucket = 'banger' | 'slaps' | 'mid' | 'skip' | 'trash';

/** Minimal song shape — structural subset of the app's Song type. */
export type ShareSong = {
  id: string;
  title: string;
  album: string;
  /** Tailwind bg class from the song data, e.g. 'bg-[#0072CE]'. */
  albumColor: string;
  year: number;
  isBSide?: boolean;
  albumId?: string;
};

/** Compact album tag for the right edge of a list row, e.g. "Blue".
 *  Resolves the canonical album via the app's name bridge. No year,
 *  no truncation — the tag is short by construction. */
function albumTag(song: ShareSong): string {
  const id = resolveAlbumId(song);
  const canonical = (id && ALBUMS_BY_ID[id]?.name) || song.album;
  const short = canonical
    .replace(/^The\s+/i, '')
    .replace(/\s+Album$/i, '')
    .split(' ')
    .slice(0, 2)
    .join(' ');
  return short.toUpperCase();
}

const ROW_H = 76;

export const Top10CardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function Top10CardVisual({ songs, subtitle }, ref) {
  const top = songs.slice(0, 10);

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle} artAlbumIds={distinctAlbumIds(top)}>
      <div className="absolute bottom-[190px] left-[184px] right-[60px] top-[128px]">
        {/* header — title block left, big tilted W + challenge bubble right */}
        <div className="relative h-[228px]">
          <div className="absolute left-0 top-[-24px]">
            <div className={`text-[76px] leading-[1.0] text-slate-900 ${markerFont.className}`}>
              My Top 10
            </div>
            <div className="relative mt-1 inline-block">
              <span className={`relative z-10 text-[76px] leading-[1.0] text-slate-900 ${markerFont.className}`}>
                Weezer Songs
              </span>
              <BrushStroke
                color="#fbbf24"
                className="absolute -bottom-2 left-0 z-0 h-[22px] w-full"
              />
            </div>
          </div>
          <FlyingW className="absolute right-0 top-[-16px] h-[105px] w-[190px] rotate-[8deg] text-[#0072CE]" />
          <div className="absolute right-0 top-[148px] rotate-1 rounded-2xl rounded-br-sm bg-white px-5 py-2.5 shadow-lg">
            <span className={`whitespace-nowrap text-[33px] leading-none text-slate-800 ${handFont.className}`}>
              Undone by my rankings? Getchoo a list of your own.
            </span>
          </div>
        </div>

        {/* list on a sheet of notebook paper, taped to the page */}
        <div className="relative mt-5 rotate-[-0.4deg] rounded-[4px] bg-[#fdfaf0] px-8 pb-3 pt-5 shadow-[0_20px_40px_rgba(60,45,10,0.28)]">
          <Tape className="absolute -top-4 left-10 z-10 h-8 w-28 -rotate-6" />
          <Tape className="absolute -top-4 right-10 z-10 h-8 w-28 rotate-3" />
          {top.map((song, i) => (
            <div
              key={song.id}
              className={`flex items-center gap-5 ${i > 0 ? 'border-t-2 border-dashed border-slate-300/70' : ''}`}
              style={{ height: ROW_H }}
            >
              <span
                className={`w-14 shrink-0 text-center text-[44px] leading-none text-[#0072CE] ${markerFont.className}`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[30px] font-extrabold uppercase leading-[1.05] tracking-tight text-slate-900">
                {song.title}
              </span>
              {song.isBSide && (
                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-[17px] font-black uppercase tracking-wider text-violet-700">
                  B-Side
                </span>
              )}
              <span className="w-[150px] shrink-0 text-right text-[20px] font-bold uppercase tracking-wider text-slate-500">
                {albumTag(song)}
              </span>
            </div>
          ))}
          {top.length === 0 && (
            <p className={`py-16 text-center text-[34px] text-slate-500 ${handFont.className}`}>
              Rank some songs and your Top 10 appears here.
            </p>
          )}
        </div>

      </div>
    </ScrapbookVisual>
  );
});

/** Standalone Top 10 card with its own built-in download button. */
export function Top10Card({
  songs,
  subtitle,
}: {
  songs: ShareSong[];
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('weezer-top-10');
  return (
    <div>
      <div className="flex justify-center overflow-hidden rounded-3xl bg-[#e9e2cc]">
        <div style={{ transform: 'scale(0.32)', transformOrigin: 'top center', height: 432, width: 1080 * 0.32 }}>
          <Top10CardVisual ref={ref} songs={songs} subtitle={subtitle} />
        </div>
      </div>
      <div className="mt-3">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
