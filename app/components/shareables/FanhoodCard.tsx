'use client';

import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import {
  FactsBurst,
  FlyingW,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
import { fanhoodDisplay } from '../../lib/fanhood';
import type { FanhoodRecord } from '../../lib/fanhood';

/** Why this doodle is defined locally instead of imported from
 *  ShareCardShell: on 2026-11-03 the deployed production bundle
 *  shipped FanhoodCard referencing the shared ShareCardShell export
 *  through a namespace object that never received it (no definition
 *  in any deployed chunk), making the element type undefined and
 *  crashing the Sweater Thread/Shareables gallery (React #130) for
 *  every player with an established standing. A module-local copy
 *  cannot be dropped that way. (ShareCardShell keeps its own export,
 *  but since 2026-11-04 every card that renders the doodle —
 *  FanhoodCard, Top10Card, Top10AlbumsCard — carries a local copy;
 *  the shared export's wiring fault recurred in the 2026-11-04
 *  preview build of the shareables round.) */
function MusicNotesDoodle({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 320 300"
      className={className}
      style={style}
      fill="#000"
      aria-hidden="true"
    >
      {/* beamed pair */}
      <rect x="82" y="118" width="8" height="126" />
      <rect x="172" y="94" width="8" height="126" />
      <polygon points="82,118 180,94 180,126 82,150" />
      <ellipse cx="58" cy="252" rx="27" ry="19" transform="rotate(-18 58 252)" />
      <ellipse cx="148" cy="228" rx="27" ry="19" transform="rotate(-18 148 228)" />
      {/* single flagged eighth note */}
      <rect x="271" y="64" width="8" height="104" />
      <path d="M271 64 C 302 76, 310 104, 298 134 C 304 102, 294 84, 271 74 Z" />
      <ellipse cx="250" cy="176" rx="24" ry="17" transform="rotate(-18 250 176)" />
    </svg>
  );
}

/**
 * The fanhood card — how far back you got, as a shareable, in
 * the poster system (Abby's language: flat #039AD1 field, Lilita
 * One display type, white burst, black doodle). It renders ONLY
 * from an established fanhood (app/lib/fanhood.ts): the gallery
 * includes it once a first game has landed, and the Sweater Thread
 * carries the play-the-game prompt for everyone else — so this
 * visual's null state is a defensive placeholder, never the plan.
 *
 * Copy (reframed Oct 28, 2026): the header is the game's headline
 * question, the statement is the standing stop ("You got back
 * to…" + the stop), and the facts are two — the total points and
 * the rarest answer, when one is stored.
 */
export const FanhoodCardVisual = forwardRef<
  HTMLDivElement,
  { fanhood: FanhoodRecord | null; subtitle?: string }
>(function FanhoodCardVisual({ fanhood }, ref) {
  const display = fanhoodDisplay(fanhood);
  const stop = display?.stop ?? null;
  // The stop renders on one line, auto-sized down until it fits —
  // the Tribe card's sizing rule (its longest stop here is
  // "ISLAND IN THE SUN").
  const stopSize = stop
    ? Math.max(76, Math.min(168, Math.floor(1740 / stop.length)))
    : 0;
  // The header question renders on ONE line too (Nov 5 one-line
  // rule) — the same size-to-fit rule applied to its 30 characters
  // (it wrapped to two lines at the old fixed 76px).
  const headerSize = Math.max(
    44,
    Math.min(76, Math.floor(1740 / 'CAN YOU GET BACK TO THE SHACK?'.length))
  );

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{ backgroundColor: POSTER_BLUE }}
    >
      <PosterDomain />
      {!display || !stop ? (
        <div className="absolute inset-0 flex items-center justify-center px-[100px]">
          <p
            className={`text-center text-[56px] font-bold leading-tight ${handFont.className}`}
          >
            Play the game to earn your card!
          </p>
        </div>
      ) : (
        <>
          {/* Header: the game's headline question, in display type. */}
          <h2
            className={`absolute inset-x-[64px] top-[104px] whitespace-nowrap text-center leading-none text-white ${displayFont.className}`}
            style={{ fontSize: headerSize }}
          >
            CAN YOU GET BACK TO THE SHACK?
          </h2>

          <p
            className={`absolute inset-x-[60px] top-[396px] text-center text-[72px] font-bold leading-none ${handFont.className}`}
          >
            You got back to...
          </p>

          <h3
            className={`absolute inset-x-0 top-[492px] whitespace-nowrap text-center leading-none text-white ${displayFont.className}`}
            style={{ fontSize: stopSize }}
          >
            {stop.toUpperCase()}
          </h3>

          {/* THE FACTS — burst + the record, left column (the Tribe
              card's facts zone, same coordinates). */}
          <div className="absolute left-[64px] top-[880px] w-[560px]">
            <FactsBurst className="-ml-[30px] h-[104px] w-[420px] -rotate-2">
              <span
                className={`text-[48px] leading-none text-black ${displayFont.className}`}
              >
                THE FACTS:
              </span>
            </FactsBurst>
            <p className="mt-[28px] text-[46px] leading-[1.3]">
              You scored {display.depth.toLocaleString()} points.
            </p>
            {display.deepest && (
              <p className="mt-[18px] text-[40px] leading-[1.3]">
                Rarest answer: {display.deepest.answer}.
              </p>
            )}
          </div>

          {/* Black notes doodle, right column (the poster's
              silhouette slot, where the Tribe card frames its
              signature album). */}
          <MusicNotesDoodle className="absolute right-[64px] top-[880px] h-[300px] w-[320px]" />

          {/* THE standard card footer (Nov 5 — one footer on every
              card). Replaces this card's colon-form line and its
              "see if YOU can get back to the shack…" CTA; recorded
              in REPORT.md (C1). */}
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

export default function FanhoodCard({
  fanhood,
  subtitle,
}: {
  fanhood: FanhoodRecord | null;
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('my-weezer-fanhood.png');
  return (
    <div>
      <FanhoodCardVisual ref={ref} fanhood={fanhood} subtitle={subtitle} />
      <div className="mt-4">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
