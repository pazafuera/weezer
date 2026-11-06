'use client';

import { forwardRef } from 'react';
import {
  FlyingW,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  albumCoverSrc,
  resolveAlbumId,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
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

/** Abby's brighter bar palette for the poster card — same era
 *  identities as ERAS.color, pushed toward her mockup's fills. The
 *  scrapbook-era ERAS.color values stay untouched for other uses. */
const POSTER_ERA_COLORS: Record<string, string> = {
  blue: '#0B6DAD',
  y2k: '#C6D92D',
  red: '#F23A2E',
  comeback: '#F6CD5F',
  new: '#8A44F2',
};

/** The album that fronts each era in the halftone strip when the
 *  user's own ranked songs don't supply one. */
const ERA_SIGNATURE_ALBUM: Record<string, string> = {
  blue: 'blue',
  y2k: 'green',
  red: 'red',
  comeback: 'white',
  new: 'van-weezer',
};

/* First person throughout (Nov 5): the card says "My era DNA:", so
 * the quips speak as the fan, not to them — pronoun swaps only,
 * every other word as written. Two quips (y2k, comeback, new) carry
 * no pronoun and are unchanged. (Three quips: y2k, comeback, new.) */
const ERA_QUIPS: Record<string, string> = {
  blue: 'I romanticize 1994. Same, honestly.',
  y2k: 'Green Album summers, forever.',
  red: 'I stuck around for the weird years. Respect.',
  comeback: 'Loyal through every era. A real one.',
  new: 'Here for the new stuff. Bold.',
};

/** The user's most-ranked album inside one era (their signature for
 *  that era), falling back to the era's signature album. */
function eraArtId(
  era: (typeof ERAS)[number],
  songs: ShareSong[],
): string {
  const counts = new Map<string, number>();
  let best: string | undefined;
  let bestCount = 0;
  for (const s of songs) {
    if ((s.year || 0) > 0 && era.test(s.year)) {
      const id = resolveAlbumId(s);
      if (id) {
        const c = (counts.get(id) ?? 0) + 1;
        counts.set(id, c);
        if (c > bestCount) {
          best = id;
          bestCount = c;
        }
      }
    }
  }
  return best ?? ERA_SIGNATURE_ALBUM[era.key];
}

/** Black halftone dot screen over a cover, as in the mockup's strip. */
function HalftoneOverlay() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(0,0,0,0.55) 1.8px, transparent 2.2px)',
        backgroundSize: '8px 8px',
      }}
    />
  );
}

export const EraDnaCardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function EraDnaCardVisual({ songs }, ref) {
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
  const stripIds = ERAS.map((e) => eraArtId(e, songs));

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{
        backgroundColor: POSTER_BLUE,
        // The share page's halftone dot field (same values as
        // app/share/page.tsx) — texture behind everything, no
        // layout impact. (The black-dot HalftoneOverlay over the
        // album strip below is a separate, older element and is
        // untouched.)
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
        backgroundSize: '20px 20px',
      }}
    >
      <PosterDomain />
      {total === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-[100px]">
          <p
            className={`text-center text-[56px] font-bold leading-tight ${handFont.className}`}
          >
            Rank some songs to map your Era DNA!
          </p>
        </div>
      ) : (
        <>
          <p
            className={`absolute inset-x-0 top-[72px] text-center text-[58px] font-bold leading-none ${handFont.className}`}
          >
            My era DNA:
          </p>

          {/* Both headline lines take the Top 10 headline
              treatment (3px ink stroke + 5px hard shadow). On the
              colored era name the stroke is a first use — the
              audit lives in REPORT.md (cards recomposition, C2);
              the ink outline carries the letterforms against the
              field for every era color. */}
          <h2
            className={`absolute inset-x-0 top-[148px] text-center leading-[1.0] ${displayFont.className}`}
          >
            <span
              className="block text-[116px] text-white"
              style={{
                WebkitTextStroke: '3px #0C1220',
                textShadow: '5px 5px 0 rgba(12,18,32,0.9)',
              }}
            >
              I AM {topPct}%
            </span>
            <span
              className="block text-[110px]"
              style={{
                color: POSTER_ERA_COLORS[top.key],
                WebkitTextStroke: '3px #0C1220',
                textShadow: '5px 5px 0 rgba(12,18,32,0.9)',
              }}
            >
              {top.name.toUpperCase()}
            </span>
          </h2>

          {/* The quip in an inverted ink box (the share page's
              vibe-box move). The wrapper goes full-width — the
              longest quip (Red Era) only fits one line at the
              card's full width once the box's padding is added —
              and the box rides 12px higher than the old plain
              text (424 → 412) so its bottom edge clears the bars
              at 512. Sizes and words unchanged. */}
          <div className="absolute inset-x-0 top-[412px] text-center">
            <span className="inline-block whitespace-nowrap rounded-2xl bg-[#0C1220] px-[38px] py-[20px] text-[42px] leading-[1.3] text-white">
              {ERA_QUIPS[top.key]}
            </span>
          </div>

          {/* All five eras, her bars: name + pct over a lightened
              track (Nov 5: track white/35 per the card-system mock;
              rows compressed slightly so the album strip below can
              clear the standard two-line footer) */}
          <div className="absolute left-[64px] right-[64px] top-[512px]">
            {withPct.map((d) => (
              <div key={d.key} className="mb-[18px] last:mb-0">
                <div className="flex items-baseline justify-between">
                  <p className="text-[32px] font-medium leading-none">{d.name}</p>
                  <p className="text-[32px] font-semibold leading-none">{d.pct}%</p>
                </div>
                <div className="mt-[8px] h-[42px] overflow-hidden rounded-full bg-white/35">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(d.pct, 6)}%`,
                      backgroundColor: POSTER_ERA_COLORS[d.key],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Halftone album strip along the bottom, one cover per
              era (Nov 5: raised + slightly shortened so it clears
              the standard two-line footer below it) */}
          <div className="absolute inset-x-0 bottom-[138px] flex h-[200px]">
            {stripIds.map((id, i) => (
              <div key={`${id}-${i}`} className="relative h-full flex-1 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(id)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <HalftoneOverlay />
              </div>
            ))}
          </div>

          {/* THE standard card footer (Nov 5 — one footer on every
              card). This card previously carried only a Caveat
              colon-form line and no CTA line; both are replaced by
              the standard pair. */}
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
