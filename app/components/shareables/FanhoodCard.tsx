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
            className={`absolute inset-x-[64px] top-[104px] text-center text-[76px] leading-[1.05] text-white ${displayFont.className}`}
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

          <p className="absolute inset-x-[40px] bottom-[92px] text-center text-[27px] font-semibold uppercase leading-snug tracking-[0.14em] text-white/95">
            All My Favorite Songs: The Weezer Song Ranking Project
          </p>
          <p
            className={`absolute inset-x-[40px] bottom-[26px] text-center text-[46px] font-bold leading-none ${handFont.className}`}
          >
            see if YOU can get back to the shack at rankingweezer.com
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
