'use client';

import { forwardRef } from 'react';
import { SaveImageButton, ShareableVisual, useShareableDownload } from './ShareCardShell';

/** Minimal song shape — structural subset of the app's Song type. */
export type ShareSong = {
  id: string;
  title: string;
  album: string;
  /** Tailwind bg class from the song data, e.g. 'bg-[#0072CE]'. */
  albumColor: string;
  year: number;
  isBSide?: boolean;
};

export type Bucket = 'banger' | 'slaps' | 'mid' | 'skip' | 'trash';

export const Top10CardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function Top10CardVisual({ songs, subtitle }, ref) {
  const top = songs.slice(0, 10);
  return (
    <ShareableVisual ref={ref} title="My Weezer Top 10" subtitle={subtitle}>
      {top.length === 0 ? (
        <p className="py-16 text-center text-2xl font-bold text-slate-400">
          Rank some songs to reveal your Top 10.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {top.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-5 rounded-xl bg-slate-900 border border-slate-800 px-5 py-3"
            >
              <span className="w-12 shrink-0 text-4xl font-black text-white">{i + 1}</span>
              <span
                className={`h-12 w-3 shrink-0 rounded-full ${s.albumColor || 'bg-slate-700'}`}
              />
              <div className="min-w-0">
                <p className="truncate text-2xl font-black uppercase tracking-tight text-white">
                  {s.title}
                </p>
                <p className="truncate text-lg font-bold text-slate-400">
                  {s.album}
                  {s.year ? ` · ${s.year}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ShareableVisual>
  );
});

export default function Top10Card({
  songs,
  subtitle,
}: {
  songs: ShareSong[];
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('my-weezer-top-10.png');
  return (
    <div>
      <Top10CardVisual ref={ref} songs={songs} subtitle={subtitle} />
      <div className="mt-4">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
