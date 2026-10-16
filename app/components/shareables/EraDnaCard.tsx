'use client';

import { forwardRef } from 'react';
import { DownloadPngButton, ShareableVisual, useShareableDownload } from './ShareCardShell';
import type { ShareSong } from './Top10Card';

export const ERAS = [
  { key: 'blue', label: '1994–1996', name: 'The Blue Era', test: (y: number) => y >= 1994 && y <= 1996 },
  { key: 'y2k', label: '2001–2005', name: 'Y2K Weezer', test: (y: number) => y >= 2001 && y <= 2005 },
  { key: 'red', label: '2008–2010', name: 'The Red Era', test: (y: number) => y >= 2008 && y <= 2010 },
  { key: 'comeback', label: '2014–2019', name: 'The Comeback', test: (y: number) => y >= 2014 && y <= 2019 },
  { key: 'new', label: '2021+', name: 'New Horizons', test: (y: number) => y >= 2021 },
];

export const EraDnaCardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function EraDnaCardVisual({ songs, subtitle }, ref) {
  const dist = ERAS.map((e) => {
    const count = songs.filter((s) => (s.year || 0) > 0 && e.test(s.year)).length;
    return { ...e, count };
  });
  const total = dist.reduce((a, d) => a + d.count, 0);
  const top = dist.reduce((a, d) => (d.count > a.count ? d : a), dist[0]);

  return (
    <ShareableVisual
      ref={ref}
      title="My Era DNA"
      subtitle={subtitle ?? 'Where your taste lives across Weezer history'}
    >
      {total === 0 ? (
        <p className="py-16 text-center text-2xl text-slate-400">
          Rank some songs to map your Era DNA.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {dist.map((d) => {
            const pct = Math.round((d.count / total) * 100);
            const isTop = d.key === top.key && d.count > 0;
            return (
              <div key={d.key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <p className="text-xl font-bold">
                    {d.name} <span className="font-normal text-slate-500">· {d.label}</span>
                  </p>
                  <p className="text-xl font-black text-amber-400">{pct}%</p>
                </div>
                <div className="h-5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${isTop ? 'bg-amber-400' : 'bg-slate-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {top.count > 0 && (
            <p className="mt-2 text-center text-2xl">
              Your dominant era: <span className="font-black text-amber-400">{top.name}</span>
            </p>
          )}
        </div>
      )}
    </ShareableVisual>
  );
});

export default function EraDnaCard({
  songs,
  subtitle,
}: {
  songs: ShareSong[];
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('my-weezer-era-dna.png');
  return (
    <div>
      <EraDnaCardVisual ref={ref} songs={songs} subtitle={subtitle} />
      <div className="mt-4">
        <DownloadPngButton onClick={download} label={busy ? 'Rendering…' : 'Download PNG'} />
      </div>
    </div>
  );
}
