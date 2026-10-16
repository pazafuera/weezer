'use client';

import { forwardRef } from 'react';
import {
  BrushStroke,
  FlyingW,
  SaveImageButton,
  ScrapbookVisual,
  distinctAlbumIds,
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

/** Compact album tag for the right edge of a list row, e.g. "Blue '94". */
function albumTag(song: ShareSong): string {
  const name = song.album.replace(/\s*\(.*?\)\s*/g, '').trim();
  const short = name
    .replace(/^Weezer\s*/i, '')
    .replace(/^The\s+/i, '')
    .split(' ')
    .slice(0, 2)
    .join(' ');
  const yr = `'${String(song.year).slice(2)}`;
  return `${short || name} ${yr}`.toUpperCase();
}

const ROW_H = 70;

export const Top10CardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function Top10CardVisual({ songs, subtitle }, ref) {
  const top = songs.slice(0, 10);
  const albumCount = new Set(top.map((s) => s.album)).size;

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle} artAlbumIds={distinctAlbumIds(top)}>
      <div className="absolute bottom-[190px] left-[184px] right-[60px] top-[128px]">
        {/* header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className={`text-[76px] leading-[0.95] text-slate-900 ${markerFont.className}`}>
              MY WEEZER
            </div>
            <div className="relative inline-block">
              <span className={`relative z-10 text-[76px] leading-[0.95] text-slate-900 ${markerFont.className}`}>
                TOP 10
              </span>
              <BrushStroke
                color="#fbbf24"
                className="absolute -bottom-1 left-0 z-0 h-[26px] w-full"
              />
            </div>
          </div>
          <div className="flex w-[300px] flex-col items-end pt-2">
            <FlyingW className="w-[118px] -rotate-3 text-[#0072CE]" />
            <p className={`mt-4 text-right text-[30px] leading-tight text-slate-600 ${handFont.className}`}>
              {top.length} songs. {albumCount} album{albumCount === 1 ? '' : 's'}. 1
              perfect list?
            </p>
            <div className="relative mt-4 max-w-[290px] rotate-1 rounded-2xl rounded-br-sm bg-white px-4 py-2 shadow-md">
              <span className={`text-[27px] leading-tight text-slate-800 ${handFont.className}`}>
                Rate my taste (or roast it)!
              </span>
            </div>
          </div>
        </div>

        {/* list on a sheet of notebook paper */}
        <div className="relative mt-7 rotate-[-0.4deg] rounded-[4px] bg-[#fdfaf0] px-8 pb-4 pt-5 shadow-[0_20px_40px_rgba(60,45,10,0.28)]">
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
              <span className="min-w-0 flex-1 truncate text-[32px] font-black uppercase tracking-tight text-slate-900">
                {song.title}
              </span>
              {song.isBSide && (
                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-[17px] font-black uppercase tracking-wider text-violet-700">
                  B-Side
                </span>
              )}
              <span className={`h-5 w-5 shrink-0 rounded-full ${song.albumColor}`} />
              <span className="w-[168px] shrink-0 truncate text-[21px] font-bold uppercase tracking-wider text-slate-500">
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

        {/* debate prompt */}
        <p className={`mt-7 -rotate-1 text-[36px] text-slate-700 ${handFont.className}`}>
          the debate rages on — where's yours?
        </p>
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
