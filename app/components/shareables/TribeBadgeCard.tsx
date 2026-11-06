'use client';

import { forwardRef, Fragment } from 'react';
import { albumCoverSrc, resolveAlbumId } from './ShareCardShell';
import {
  FactsBurst,
  FlyingW,
  GuitarSilhouette,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  VinylDisc,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
import type { Bucket, ShareSong } from './Top10Card';

export type Tribe = {
  /** Canonical tribe key, e.g. '90s Purist' — keys TRIBE_INK. */
  name: string;
  /** The name as it renders on the card, exactly as locked:
   *  '90s PURIST keeps its leading apostrophe and lowercase s. */
  displayName: string;
  /** First-person diagnosis line (copy sheet: Purist LOCKED, the
   *  other five still DRAFTs awaiting the owner's edit). */
  diagnosis: string;
  /** First-person "THE FACTS" line, filled from the user's rankings. */
  fact: string;
};

/**
 * Transparent, rule-based tribe assignment. Checked in precedence order;
 * the first matching rule wins. Rules use only year, isBSide, and album
 * spread — no hardcoded album titles. The thresholds are the copy
 * sheet's; the fact lines are the same computations as the old
 * second-person stats, reworded into the sheet's first-person
 * patterns (the words and the math can't drift apart).
 */
export function computeTribe(
  songs: ShareSong[],
  triageMap: Record<string, Bucket>,
): Tribe | null {
  // 'unknown' ("Don't Know It") songs are not ranked and never count
  // toward tribe denominators.
  const ranked = songs.filter((s) => {
    const b = triageMap[s.id];
    return b !== undefined && b !== 'unknown';
  });
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
        name: "'90s Purist",
        displayName: "'90s PURIST",
        diagnosis: "I haven't emotionally left 1997.",
        fact: `${early} of my top ${top.length} songs are from the '90s`,
      };
    }
  }

  const bsides = ranked.filter((s) => s.isBSide).length;
  if (ranked.length >= 10 && bsides / ranked.length >= 0.4) {
    return {
      name: 'Deep-Cuts Digger',
      displayName: 'DEEP-CUTS DIGGER',
      diagnosis: "The deep cuts aren't deep to me. They're home.",
      fact: `${bsides} of my ${ranked.length} ranked songs are deep cuts`,
    };
  }

  if (top.length >= 8) {
    const albums = new Set(top.map((s) => s.album));
    if (albums.size >= 6) {
      return {
        name: 'Catalog Completist',
        displayName: 'CATALOG COMPLETIST',
        diagnosis: 'I refuse to leave a single era behind.',
        fact: `My top songs span ${albums.size} different albums`,
      };
    }
  }

  if (top.length >= 5) {
    const modern = top.filter(inYears(2014, 2030)).length;
    if (modern / top.length >= 0.6) {
      return {
        name: 'New School',
        displayName: 'NEW SCHOOL',
        diagnosis: 'I like the new albums. Loudly, and in public.',
        fact: `${modern} of my top ${top.length} songs are from 2014 or later`,
      };
    }
    const y2k = top.filter(inYears(2001, 2005)).length;
    if (y2k / top.length >= 0.6) {
      return {
        name: 'Y2K Rocker',
        displayName: 'Y2K ROCKER',
        diagnosis: "The 2000s weren't a comeback. They were my era.",
        fact: `${y2k} of my top ${top.length} songs are from 2001–2005`,
      };
    }
  }

  return {
    name: 'Banger Hunter',
    displayName: 'BANGER HUNTER',
    diagnosis: "I don't overthink it. If it slaps, it slaps.",
    fact: `I ranked ${top.length} songs as bangers or slaps`,
  };
}

/** Exported for the public profile page's tribe band, which paints
 *  its rule under the tribe name in the tribe's own ink — the same
 *  color the badge card stamps the name in. */
export const TRIBE_INK: Record<string, string> = {
  "'90s Purist": '#0072CE',
  'Deep-Cuts Digger': '#7c3aed',
  'Catalog Completist': '#047857',
  'New School': '#ea580c',
  'Y2K Rocker': '#0f766e',
  'Banger Hunter': '#b3352b',
};

/** Diagnosis size-to-fit (Tribe punch-up): Caveat Bold at a 58px
 *  cap, stepped down until the line fits the diagnosis box's 892px
 *  measure — the mock's figure (952 box − 60px horizontal padding),
 *  kept so the fitted sizes reproduce the mock's table exactly.
 *  Em advances are hmtx sums measured from the bundled Caveat Bold
 *  (app/api/og/fonts) — the conservative side, since kerning only
 *  narrows. The six lines are a closed set (computeTribe's copy);
 *  fitted sizes: Purist 58, Digger 56, Completist 58,
 *  New School 58, Y2K 52, Banger Hunter 58. */
const DIAGNOSIS_EM: Record<string, number> = {
  "I haven't emotionally left 1997.": 10.737,
  "The deep cuts aren't deep to me. They're home.": 15.706,
  'I refuse to leave a single era behind.': 12.44,
  'I like the new albums. Loudly, and in public.': 14.797,
  "The 2000s weren't a comeback. They were my era.": 17.103,
  "I don't overthink it. If it slaps, it slaps.": 13.524,
};

function diagnosisFontSize(diagnosis: string): number {
  // An unlisted line (a future copy-sheet edit) is estimated from
  // its length at 0.37 em/char — above the widest measured ratio
  // (Y2K's 0.364) — so an unknown line errs small, never clipped.
  const em = DIAGNOSIS_EM[diagnosis] ?? diagnosis.length * 0.37;
  return Math.min(58, Math.floor(892 / em));
}

/** The fact with its count numerals wrapped in the tribe ink (the
 *  punch-up gives the ink this second job, alongside the vinyl
 *  label). The fact strings are single strings from computeTribe;
 *  the counts in the six patterns run 1–3 digits (never more than
 *  206 songs), while the year runs — 2014, 2001–2005 — are 4
 *  digits and the "'90s" in the Purist line is a 2-digit run right
 *  after an apostrophe. Neither of those is a count, so neither is
 *  wrapped. */
function renderFact(fact: string, ink: string) {
  let offset = 0;
  return fact.split(/(\d+)/).map((part, i) => {
    const start = offset;
    offset += part.length;
    if (!/^\d+$/.test(part)) return <Fragment key={i}>{part}</Fragment>;
    const isYear = part.length === 4;
    const isNineties =
      fact[start - 1] === "'" && fact[start + part.length] === 's';
    if (isYear || isNineties) return <Fragment key={i}>{part}</Fragment>;
    return (
      <span key={i} style={{ color: ink }}>
        {part}
      </span>
    );
  });
}

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
>(function TribeBadgeCardVisual({ songs, triageMap }, ref) {
  const tribe = computeTribe(songs, triageMap);
  const ink = (tribe && TRIBE_INK[tribe.name]) || '#141414';
  const domAlbumId = dominantAlbumId(songs);
  // Locked Purist flourish: the year is highlighted amber.
  const diagnosisParts = tribe ? tribe.diagnosis.split('1997') : [];

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{
        backgroundColor: POSTER_BLUE,
        // The share page's halftone dot field (same values as
        // app/share/page.tsx) — texture behind everything, no
        // layout impact.
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
        backgroundSize: '20px 20px',
      }}
    >
      <PosterDomain />
      {!tribe ? (
        <div className="absolute inset-0 flex items-center justify-center px-[100px]">
          <p
            className={`text-center text-[56px] font-bold leading-tight ${handFont.className}`}
          >
            Rank some songs to earn your tribe badge!
          </p>
        </div>
      ) : (
        <>
          {/* Punch-up composition (tribe-punch-mock, built from
              scratch and approved Nov 5 — it supersedes Option B):
              intro pill 88 / badge panel 190 (952×500, guitar
              framed inside at scale 1.30, name STACKED at 152px
              across its body) / diagnosis in the inverted ink fact
              box at 716 / facts box + album frame as one bottom
              row at 886 / standard footer. The music-notes doodle
              is retired in this composition. Zone + fit audit in
              REPORT.md (Tribe punch-up). */}

          {/* The intro as the share page's inverted ink pill —
              same words, same audited 40px light line; it seats
              at 88 so the pill→panel gap matches the
              panel→diagnosis gap (26px each). */}
          <div className="absolute inset-x-0 top-[88px] text-center">
            <span className="inline-block whitespace-nowrap rounded-2xl bg-[#0C1220] px-[34px] py-[18px] text-[40px] font-light leading-none text-white">
              Based on my ranking of every Weezer song, I&apos;m a...
            </span>
          </div>

          {/* Badge panel: the guitar scaled to 1.30 and framed in
              a white plaque, its neck bleeding out of the frame's
              right edge (the clip cuts it at the panel's inner
              edge); the tribe name is stamped across the body,
              stacked one word per line at a flat 152px — one size
              serves all six tribes (binding word COMPLETIST
              measures 855px against the panel's 904px inner
              width; a one-line name caps at ~104px, which is why
              it stacks). The svg element re-seats by the panel's
              offset (-64 / -190) so the silhouette's card
              coordinates match the mock's exactly. */}
          <div className="absolute left-[64px] top-[190px] h-[500px] w-[952px] rounded-2xl border-[3px] border-[#0C1220] bg-white shadow-[6px_6px_0_rgba(12,18,32,0.9)]">
            <div className="absolute inset-0 overflow-hidden rounded-[13px]">
              <GuitarSilhouette
                className="absolute left-[-64px] top-[-190px] h-[1350px] w-[1080px]"
                transform="translate(174 190) scale(1.30)"
                fill="#0C1220"
                style={{ opacity: 0.95 }}
              />
            </div>
            <h2
              className={`absolute inset-0 z-[5] flex flex-col items-center justify-center text-center leading-[0.96] text-white ${displayFont.className}`}
              style={{
                fontSize: 152,
                WebkitTextStroke: '3px #0C1220',
                textShadow: '5px 5px 0 rgba(12,18,32,0.9)',
              }}
            >
              {tribe.displayName.split(' ').map((word, i) => (
                <span key={i} className="block whitespace-nowrap">
                  {word}
                </span>
              ))}
            </h2>
          </div>

          {/* The diagnosis in the family's one inverted fact box
              (Era's quip slot): full column, Caveat Bold kept as
              the fan's voice line, size-to-fit under a 58px cap —
              see diagnosisFontSize. The Purist "1997" amber
              highlight carries over untouched. */}
          <div className="absolute left-[64px] top-[716px] flex h-[104px] w-[952px] items-center justify-center rounded-[14px] border-[3px] border-[#0C1220] bg-[#0C1220] px-[30px] shadow-[5px_5px_0_rgba(12,18,32,0.9)]">
            <p
              className={`whitespace-nowrap font-bold leading-[1.1] text-white ${handFont.className}`}
              style={{ fontSize: diagnosisFontSize(tribe.diagnosis) }}
            >
              {diagnosisParts.map((part, i) => (
                <Fragment key={i}>
                  {part}
                  {i < diagnosisParts.length - 1 && (
                    <span className="text-amber-400">1997</span>
                  )}
                </Fragment>
              ))}
            </p>
          </div>

          {/* THE FACTS — the burst straddles the fact box's top
              edge and gains the family's 3px ink outline so it
              reads on the seam; the fact itself is poster type
              (Lilita 60) in a white fact box, count numerals in
              the tribe ink. At 60px every reachable fact string
              wraps to at most 3 lines (234px in the box's 236px
              text zone — audited over the patterns' maxima), so
              no step-down is implemented. */}
          <div className="absolute left-[34px] top-[830px] z-[6]">
            <FactsBurst outline className="h-[104px] w-[420px] -rotate-2">
              <span
                className={`text-[48px] leading-none text-[#0C1220] ${displayFont.className}`}
              >
                THE FACTS:
              </span>
            </FactsBurst>
          </div>
          <div className="absolute left-[64px] top-[886px] h-[326px] w-[568px] rounded-2xl border-[3px] border-[#0C1220] bg-white pb-[20px] pl-[36px] pr-[32px] pt-[64px] shadow-[4px_4px_0_#0C1220]">
            <p
              className={`text-[60px] leading-[1.3] text-[#0C1220] ${displayFont.className}`}
            >
              {renderFact(tribe.fact, ink)}
            </p>
          </div>

          {/* Signature album: the frame grows to 326px with the
              Era strip's corners to hold its half of the bottom
              row; the vinyl peek is unchanged (300px disc at
              -125 / -10, tribe-ink label). */}
          {domAlbumId && (
            <div className="absolute right-[64px] top-[886px] w-[326px]">
              <VinylDisc
                labelColor={ink}
                className="absolute -right-[125px] top-[-10px] h-[300px] w-[300px]"
              />
              <div className="relative z-10 rounded-2xl border-[3px] border-[#0C1220] bg-white p-[14px] shadow-[5px_5px_0_rgba(12,18,32,0.9)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={albumCoverSrc(domAlbumId)}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
          )}

          {/* THE standard card footer (Nov 5 — one footer on every
              card, at Mark's direction). This REPLACES this card's
              locked colon-form footer and its "find out what kind
              of fan YOU are…" line; the override is recorded in
              REPORT.md (C1). */}
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
