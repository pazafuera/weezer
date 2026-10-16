'use client';

import { forwardRef } from 'react';
import { BrushStroke, FlyingW, SaveImageButton, ScrapbookVisual, distinctAlbumIds, useShareableDownload } from './ShareCardShell';
import { handFont, markerFont } from './fonts';
import type { ShareSong } from './Top10Card';
import { FULL_SONG_POOL } from '../../data/constants';
import { MIN_QUALIFYING_RATINGS } from '../../lib/fanStatsMethodology';

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
  // ERA DISTRIBUTION. `songs` is the user's RATED songs only (real
  // buckets — 'unknown' marks and unrated songs never reach this card).
  //
  // With a real sample (>= MIN_QUALIFYING_RATINGS rated songs), each
  // era's weight is its rated count BLENDED with coverage: the count is
  // discounted by how much of the era's catalog the user actually
  // knows — weight = count × (0.5 + 0.5 × count/catalog). Songs the
  // user doesn't know count as absence, so the profile shifts toward
  // the eras their fandom covers: rating 20 of 31 Blue-era songs and
  // nothing else still reads as ~100% Blue Era, while a fan who rated
  // everything keeps the plain count distribution (coverage is 1.0 in
  // every era, so the discount vanishes). Below the sample floor, fall
  // back to the plain share of rated songs so a brand-new fan's card
  // isn't mostly absence.
  const ratedTotal = songs.length;
  const useCoverage = ratedTotal >= MIN_QUALIFYING_RATINGS;
  const dist = ERAS.map((e) => {
    const count = songs.filter((s) => (s.year || 0) > 0 && e.test(s.year)).length;
    const catalog = FULL_SONG_POOL.filter(
      (s) => (s.year || 0) > 0 && e.test(s.year)
    ).length;
    const coverage = catalog > 0 ? count / catalog : 0;
    const weight = useCoverage ? count * (0.5 + 0.5 * coverage) : count;
    return { ...e, count, weight };
  });
  const totalWeight = dist.reduce((a, d) => a + d.weight, 0);
  const withPct = dist.map((d) => ({
    ...d,
    pct: totalWeight > 0 ? Math.round((d.weight / totalWeight) * 100) : 0,
  }));
  const total = ratedTotal;
  const top = withPct.reduce((a, d) => (d.weight > a.weight ? d : a), withPct[0]);
  const topPct = top.pct;
  const artIds = distinctAlbumIds([
    ...songs.filter((s) => (s.year || 0) > 0 && top.test(s.year)),
    ...songs,
  ]);

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle} artAlbumIds={artIds}>
      <div className="absolute bottom-[190px] left-[184px] right-[60px] top-[140px]">
        {total === 0 ? (
          <p
            className={`pt-64 text-center text-[54px] text-slate-700 ${handFont.className}`}
          >
            Rank some songs to map your Era DNA!
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-6">
              <p className="relative inline-block">
                <span
                  className={`relative z-10 text-[46px] tracking-wide text-slate-800 ${markerFont.className}`}
                >
                  MY ERA DNA
                </span>
                <BrushStroke
                  color="#fbbf24"
                  className="absolute -bottom-2 left-0 z-0 h-[18px] w-full"
                />
              </p>
              <FlyingW className="w-[150px] shrink-0 rotate-[8deg] text-[#0072CE]" />
            </div>
            <h2
              className={`mt-4 text-[118px] leading-[0.95] text-slate-900 ${markerFont.className}`}
            >
              YOU ARE {topPct}%{' '}
              <span style={{ color: top.color }}>{top.name.toUpperCase()}</span>
            </h2>
            <div className="mt-5 inline-block -rotate-1 rounded-2xl rounded-bl-sm bg-white px-5 py-2.5 shadow-lg">
              <span
                className={`text-[42px] leading-none text-slate-800 ${handFont.className}`}
              >
                {ERA_QUIPS[top.key]}
              </span>
            </div>

            <div className="mt-9">
              {withPct.map((d, i) => {
                const pct = d.pct;
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
