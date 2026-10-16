'use client';

import { forwardRef } from 'react';
import { SaveImageButton, ScrapbookVisual, useShareableDownload } from './ShareCardShell';
import { handFont, markerFont } from './fonts';
import type { ShareSong } from './Top10Card';

export const ERAS = [
  { key: 'blue', label: '1994–1996', name: 'The Blue Era', color: '#d97706', test: (y: number) => y >= 1994 && y <= 1996 },
  { key: 'y2k', label: '2001–2005', name: 'Y2K Weezer', color: '#059669', test: (y: number) => y >= 2001 && y <= 2005 },
  { key: 'red', label: '2008–2010', name: 'The Red Era', color: '#dc2626', test: (y: number) => y >= 2008 && y <= 2010 },
  { key: 'comeback', label: '2014–2019', name: 'The Comeback', color: '#0284c7', test: (y: number) => y >= 2014 && y <= 2019 },
  { key: 'new', label: '2021+', name: 'New Horizons', color: '#9333ea', test: (y: number) => y >= 2021 },
];

const ERA_QUIPS: Record<string, string> = {
  blue: 'You romanticize 1994. Same, honestly.',
  y2k: 'Green Album summers, forever.',
  red: 'You stuck around for the weird years. Respect.',
  comeback: 'Loyal through every era. A real one.',
  new: 'Here for the new stuff. Bold.',
};

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
  const topPct = total > 0 ? Math.round((top.count / total) * 100) : 0;

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle}>
      <div className="absolute inset-x-[76px] bottom-[176px] top-[140px]">
        {total === 0 ? (
          <p
            className={`pt-64 text-center text-[54px] text-slate-700 ${handFont.className}`}
          >
            Rank some songs to map your Era DNA!
          </p>
        ) : (
          <>
            <p
              className={`text-[46px] tracking-wide text-slate-800 ${markerFont.className}`}
            >
              MY ERA DNA
            </p>
            <h2
              className={`mt-4 text-[118px] leading-[0.95] text-slate-900 ${markerFont.className}`}
            >
              YOU ARE {topPct}%{' '}
              <span style={{ color: top.color }}>{top.name.toUpperCase()}</span>
            </h2>
            <p
              className={`mt-4 -rotate-1 text-[44px] text-slate-700 ${handFont.className}`}
            >
              {ERA_QUIPS[top.key]}
            </p>

            <div className="mt-9">
              {dist.map((d, i) => {
                const pct = Math.round((d.count / total) * 100);
                return (
                  <div
                    key={d.key}
                    className="mt-6"
                    style={{ transform: `rotate(${i % 2 === 0 ? -0.4 : 0.3}deg)` }}
                  >
                    <div className="flex items-baseline justify-between">
                      <p className="text-[30px] font-black uppercase tracking-tight text-slate-900">
                        {d.name}{' '}
                        <span className="text-[24px] font-bold text-slate-500">
                          {d.label}
                        </span>
                      </p>
                      <p
                        className={`text-[38px] leading-none ${markerFont.className}`}
                        style={{ color: d.color }}
                      >
                        {pct}%
                      </p>
                    </div>
                    <div className="mt-2 h-[48px] overflow-hidden rounded-full bg-[#e0d4b2]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: d.color,
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 10px, transparent 10px 20px)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ScrapbookVisual>
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
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
