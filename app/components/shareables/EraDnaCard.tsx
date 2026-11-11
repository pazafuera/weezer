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
import type { Bucket, ShareSong } from './Top10Card';
import { eraShares } from '../../lib/profileStats';

export const ERAS = [
  { key: 'blue', label: '1994–1996', name: 'The Purist Era', color: '#d97706', test: (y: number) => y >= 1994 && y <= 1996 },
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
  { songs: ShareSong[]; triageMap: Record<string, Bucket>; subtitle?: string }
>(function EraDnaCardVisual({ songs, triageMap }, ref) {
  // ERA DISTRIBUTION — the Sweater Thread's derivation (owner,
  // Nov 6): where the fan's TOP songs live. `songs` is the user's
  // RATED songs only (real buckets — 'unknown' marks and unrated
  // songs never reach this card), in master order; the top tier is
  // its Banger + Lowkey Slaps subset, and profileStats.eraShares —
  // the exact function the Thread and the public profile page run —
  // weights each top-tier song 1/√(its position in the top tier)
  // toward its era. One implementation everywhere, so the card can
  // never crown a different era than the Thread for the same fan.
  //
  // This replaces the card's own coverage blend (rated count ×
  // (0.5 + 0.5 × coverage of the era's catalog), plain rated share
  // under MIN_QUALIFYING_RATINGS): for a complete rater the blend
  // degenerated to the catalog's own shape — the 60-song New
  // Horizons catalog outweighed the fan's actual top songs — which
  // is exactly the conflict the owner ruled against.
  const ratedTotal = songs.length;
  const topTier = songs.filter(
    (s) => triageMap[s.id] === 'banger' || triageMap[s.id] === 'slaps',
  );
  const shares = eraShares(topTier);
  const pctByKey = new Map(shares.map((s) => [s.key, s.pct]));
  const withPct = ERAS.map((e) => ({ ...e, pct: pctByKey.get(e.key) ?? 0 }));
  const total = ratedTotal;
  // eraShares returns heaviest first (rounded shares, canonical era
  // order breaking ties) — its first entry IS the Thread's top era,
  // taken as-is rather than re-picked here.
  const top = withPct.find((d) => d.key === shares[0]?.key) ?? withPct[0];
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
          {/* The eyebrow as the share page's opening stamp: the
              same string in a solid ink pill, Lilita, tracked,
              uppercase via CSS (strengthening pass, Nov 5 — the
              approved era-dna-strengthen mock). */}
          <div className="absolute inset-x-0 top-[64px] text-center">
            <span
              className={`inline-block whitespace-nowrap rounded-full bg-[#0C1220] px-[30px] pb-[10px] pt-[13px] text-[30px] uppercase leading-none tracking-[3px] text-white ${displayFont.className}`}
            >
              My era DNA:
            </span>
          </div>

          {/* Headline scaled up (116/110 → 148/136) per the
              strengthening mock; the space comes from the eyebrow
              zone and the era rows compressing. Both lines keep
              the Top 10 headline treatment (3px ink stroke + 5px
              hard shadow); the percentage takes the share page's
              yellow numeral (#FFE066, its "206" device) while
              "I AM" stays white and the era name keeps its poster
              era color. On the colored era name the stroke audit
              lives in REPORT.md (cards recomposition, C2, and the
              strengthening pass): the ink outline carries the
              letterforms against the field for every era color —
              Blue's 3.39:1 fill-vs-stroke flag carries forward
              unchanged (the ratio is size-independent; the
              scale-up does not worsen it). */}
          <h2
            className={`absolute inset-x-0 top-[130px] text-center leading-[1.0] ${displayFont.className}`}
          >
            <span
              className="block whitespace-nowrap text-[148px] text-white"
              style={{
                textShadow: '3px 0 0 #0C1220, -3px 0 0 #0C1220, 0 3px 0 #0C1220, 0 -3px 0 #0C1220, 2px 2px 0 #0C1220, 2px -2px 0 #0C1220, -2px 2px 0 #0C1220, -2px -2px 0 #0C1220, 5px 5px 0 rgba(12,18,32,0.9)',
              }}
            >
              I AM{' '}
              <span style={{ color: '#FFE066' }}>{topPct}%</span>
            </span>
            <span
              className="block whitespace-nowrap text-[136px]"
              style={{
                color: POSTER_ERA_COLORS[top.key],
                textShadow: '3px 0 0 #0C1220, -3px 0 0 #0C1220, 0 3px 0 #0C1220, 0 -3px 0 #0C1220, 2px 2px 0 #0C1220, 2px -2px 0 #0C1220, -2px 2px 0 #0C1220, -2px -2px 0 #0C1220, 5px 5px 0 rgba(12,18,32,0.9)',
              }}
            >
              {top.name.toUpperCase()}
            </span>
          </h2>

          {/* The quip as a true inverted fact box (the share
              page's Vibe-box anatomy: ink fill, 3px ink border,
              14px radius, hard shadow), its text at poster weight
              in Lilita 42 — strengthening pass, Nov 5. The wrapper
              goes full-width, as the mock draws it; the longest
              quip (Red Era) measures 775.4px in Lilita at 42px,
              865.4px as a box — audited in REPORT.md. It stays the
              card's one inverted element. */}
          <div className="absolute inset-x-0 top-[436px] text-center">
            <span
              className={`inline-block whitespace-nowrap rounded-[14px] border-[3px] border-[#0C1220] bg-[#0C1220] px-[42px] py-[15px] text-[42px] leading-[1.1] text-white shadow-[5px_5px_0_rgba(12,18,32,0.9)] ${displayFont.className}`}
            >
              {ERA_QUIPS[top.key]}
            </span>
          </div>

          {/* All five eras as white fact boxes (strengthening
              pass, Nov 5 — the share page's Top Anthem / Top Album
              box anatomy): 3px ink border, 16px radius, hard
              shadow. Era color becomes structure: a solid 16px
              spine block at the box's left edge plus the bar fill.
              Name and percentage are Lilita in ink — two poster
              era colors (Y2K lime, Comeback yellow) cannot carry
              text on white, so the numerals stay ink for all five
              (the mock's contrast ruling). The bar rides inside
              the box on a #DCEEF8 track (the shell's backdrop
              color) and keeps the card's longstanding 6% minimum
              sliver for near-zero shares. Rows compress 482 →
              442px of zone (78px boxes, 13px gaps) to fund the
              headline scale-up; the strip keeps its full 200px. */}
          <div className="absolute left-[64px] right-[64px] top-[542px] flex flex-col gap-[13px]">
            {withPct.map((d) => (
              <div
                key={d.key}
                className="flex h-[78px] items-center overflow-hidden rounded-[16px] border-[3px] border-[#0C1220] bg-white pr-[24px] shadow-[4px_4px_0_#0C1220]"
              >
                <div
                  className="mr-[22px] w-[16px] flex-none self-stretch"
                  style={{ backgroundColor: POSTER_ERA_COLORS[d.key] }}
                />
                <p
                  className={`whitespace-nowrap text-[40px] leading-none text-[#0C1220] ${displayFont.className}`}
                >
                  {d.name}
                </p>
                <div className="mx-[26px] h-[22px] flex-1 overflow-hidden rounded-full bg-[#DCEEF8]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(d.pct, 6)}%`,
                      backgroundColor: POSTER_ERA_COLORS[d.key],
                    }}
                  />
                </div>
                <p
                  className={`min-w-[104px] text-right text-[54px] leading-none text-[#0C1220] ${displayFont.className}`}
                >
                  {d.pct}%
                </p>
              </div>
            ))}
          </div>

          {/* Halftone album strip along the bottom, one cover per
              era. Strengthening pass (Nov 5): the strip gains the
              system's frame (3px ink border, 16px radius, hard
              shadow) and pulls in from full bleed to the same
              64px column as the era boxes, so the card reads as
              one composed column. Top (y 1012) and height (200px)
              unchanged; the covers and their black halftone
              overlay are untouched. */}
          <div className="absolute bottom-[138px] left-[64px] right-[64px] flex h-[200px] overflow-hidden rounded-[16px] border-[3px] border-[#0C1220] shadow-[5px_5px_0_rgba(12,18,32,0.9)]">
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
  triageMap,
  subtitle,
}: {
  songs: ShareSong[];
  triageMap: Record<string, Bucket>;
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('my-weezer-era-dna.png');
  return (
    <div>
      <EraDnaCardVisual ref={ref} songs={songs} triageMap={triageMap} subtitle={subtitle} />
      <div className="mt-4">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
