'use client';

import { forwardRef } from 'react';
import {
  FactsBurst,
  MusicNotesDoodle,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
import { fanhoodDisplay } from '../../lib/fanhood';
import type { FanhoodRecord } from '../../lib/fanhood';

/**
 * The fanhood card — the depth game's verdict as a shareable, in
 * the poster system (Abby's language: flat #039AD1 field, Lilita
 * One display type, white burst, black doodle). It renders ONLY
 * from an established fanhood (app/lib/fanhood.ts): the gallery
 * includes it once a first run has landed, and the Sweater Thread
 * carries the play-the-game prompt for everyone else — so this
 * visual's null state is a defensive placeholder, never the plan.
 *
 * Copy is Mark's, locked with the game (Oct 27, 2026): the header
 * is the game's name, the statement is the results screen's own
 * verdict ("You're a" + his fanhood title), and the facts are the
 * established record — best depth, plus the best run's deepest
 * single answer when one is stored.
 */
export const FanhoodCardVisual = forwardRef<
  HTMLDivElement,
  { fanhood: FanhoodRecord | null; subtitle?: string }
>(function FanhoodCardVisual({ fanhood }, ref) {
  const display = fanhoodDisplay(fanhood);
  const title = display?.title ?? null;
  // The title renders on one line, auto-sized down until it fits —
  // the Tribe card's sizing rule (its longest title here is
  // "MEMBER OF THE FAN CLUB").
  const titleSize = title
    ? Math.max(76, Math.min(168, Math.floor(1740 / title.length)))
    : 0;

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{ backgroundColor: POSTER_BLUE }}
    >
      <PosterDomain />
      {!display || !title ? (
        <div className="absolute inset-0 flex items-center justify-center px-[100px]">
          <p
            className={`text-center text-[56px] font-bold leading-tight ${handFont.className}`}
          >
            Play the game to earn your fanhood card!
          </p>
        </div>
      ) : (
        <>
          {/* Header: the game's name, in display type. */}
          <h2
            className={`absolute inset-x-[64px] top-[104px] text-center text-[76px] leading-[1.05] text-white ${displayFont.className}`}
          >
            HOW RARE A WEEZER FAN ARE YOU?
          </h2>

          <p
            className={`absolute inset-x-[60px] top-[396px] text-center text-[72px] font-bold leading-none ${handFont.className}`}
          >
            You&apos;re a...
          </p>

          <h3
            className={`absolute inset-x-0 top-[492px] whitespace-nowrap text-center leading-none text-white ${displayFont.className}`}
            style={{ fontSize: titleSize }}
          >
            {title.toUpperCase()}
          </h3>

          <p
            className={`absolute inset-x-0 top-[716px] text-center text-[64px] leading-none text-white ${displayFont.className}`}
          >
            {display.depth.toLocaleString()} DEEP
          </p>

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
              You went {display.depth.toLocaleString()} deep.
            </p>
            {display.deepest && (
              <p className="mt-[18px] text-[40px] leading-[1.3]">
                Deepest answer: {display.deepest.answer} —{' '}
                {display.deepest.depth.toLocaleString()} deep.
              </p>
            )}
          </div>

          {/* Black notes doodle, right column (the poster's
              silhouette slot, where the Tribe card frames its
              signature album). */}
          <MusicNotesDoodle className="absolute right-[64px] top-[880px] h-[300px] w-[320px]" />

          <p className="absolute inset-x-[40px] bottom-[92px] text-center text-[27px] font-semibold uppercase leading-snug tracking-[0.14em] text-white/95">
            All My Favorite Songs: The Weezer Song Ranking Project
          </p>
          <p
            className={`absolute inset-x-[40px] bottom-[26px] text-center text-[46px] font-bold leading-none ${handFont.className}`}
          >
            find out how rare a fan YOU are at rankingweezer.com
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
