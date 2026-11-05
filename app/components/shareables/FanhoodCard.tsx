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
import { TOTAL_STOPS } from '../../data/loreGame';

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
 * Copy (reframed Oct 28, 2026; context pass Nov 5, 2026): the
 * header is the game's headline question, then a context line for
 * viewers who have never seen the game (assembled from the game's
 * own copy — the picker's "Five rounds. Thirty-five questions."
 * and the gate's "Every point moves you closer to the Shack."),
 * the standing stop huge, a first-person standing sentence built
 * from the stop's own phrase fragment, a mini ladder of all six
 * stops with the current one marked, and the facts — the total
 * points and the rarest answer, when one is stored.
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
  // The standing sentence (Nov 5): first person, built from the
  // stop's own phrase fragment in TOTAL_STOPS — the same fragments
  // youreAtPhrase speaks in second person elsewhere. At the start
  // stop the form is "I'm at Arnold's Diner."; everywhere else,
  // "I made it {phrase}."
  const stopEntry = stop
    ? TOTAL_STOPS.find((s) => s.title === stop) ?? null
    : null;
  const standingSentence = stopEntry
    ? stopEntry.min === 0
      ? `I'm ${stopEntry.phrase}.`
      : `I made it ${stopEntry.phrase}.`
    : null;
  const currentStopIdx = stopEntry ? TOTAL_STOPS.indexOf(stopEntry) : -1;

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

          {/* Context for a viewer who has never seen the game
              (Nov 5): one line, assembled from the game's own
              copy — only the connective "The Weezer trivia game"
              is new wording (flagged in REPORT.md, C3). */}
          <p
            className={`absolute inset-x-[80px] top-[196px] text-center text-[46px] font-bold leading-[1.15] ${handFont.className}`}
          >
            The Weezer trivia game — five rounds, thirty-five
            questions. Every point moves you closer to the Shack.
          </p>

          <h3
            className={`absolute inset-x-0 top-[340px] whitespace-nowrap text-center leading-none text-white ${displayFont.className}`}
            style={{ fontSize: stopSize }}
          >
            {stop.toUpperCase()}
          </h3>

          {/* The standing sentence, first person, under the stop
              name (Nov 5 — replaces the old second-person "You got
              back to…" lead-in). */}
          {standingSentence && (
            <p
              className={`absolute inset-x-[60px] top-[552px] whitespace-nowrap text-center text-[64px] font-bold leading-none ${handFont.className}`}
            >
              {standingSentence}
            </p>
          )}

          {/* The road so far (Nov 5): all six stops in order, the
              dashboard journey bar's language at card scale — gold
              fill up to the current stop, gold dots for stops
              reached, the current stop's label in gold, stops ahead
              dimmed. Labels alternate above/below the line so the
              long names never collide. */}
          <div className="absolute left-[64px] right-[64px] top-[676px] h-[150px]">
            {TOTAL_STOPS.map((s, i) => {
              const above = i % 2 === 0;
              const isCurrent = i === currentStopIdx;
              return (
                <span
                  key={s.title}
                  className={`absolute w-[220px] whitespace-nowrap text-center text-[21px] font-black uppercase leading-tight tracking-wide ${
                    isCurrent
                      ? 'text-[#FFC72C]'
                      : i < currentStopIdx
                        ? 'text-white'
                        : 'text-white/50'
                  }`}
                  style={{
                    left: `${(i / (TOTAL_STOPS.length - 1)) * 100}%`,
                    top: above ? 0 : 102,
                    transform:
                      i === 0
                        ? 'translateX(0)'
                        : i === TOTAL_STOPS.length - 1
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                    textAlign:
                      i === 0 ? 'left' : i === TOTAL_STOPS.length - 1 ? 'right' : 'center',
                  }}
                >
                  {s.title}
                </span>
              );
            })}
            <div className="absolute inset-x-0 top-[64px] h-[12px] rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-[#FFC72C]"
                style={{
                  width: `${(currentStopIdx / (TOTAL_STOPS.length - 1)) * 100}%`,
                }}
              />
            </div>
            {TOTAL_STOPS.map((s, i) => (
              <span
                key={s.title}
                className={`absolute top-[64px] rounded-full border-[3px] border-[#0C1220] ${
                  i <= currentStopIdx ? 'bg-[#FFC72C]' : 'bg-white/40'
                }`}
                style={{
                  left: `${(i / (TOTAL_STOPS.length - 1)) * 100}%`,
                  width: i === currentStopIdx ? 34 : 26,
                  height: i === currentStopIdx ? 34 : 26,
                  transform: `translate(-50%, ${i === currentStopIdx ? -11 : -7}px)`,
                }}
              />
            ))}
          </div>

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
              I scored {display.depth.toLocaleString()} points.
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
