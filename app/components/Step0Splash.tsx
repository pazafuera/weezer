'use client';

import React, { useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';

/** The dashboard hero's tape strip (StepGarage2's TapeStrip recipe):
 *  yellow label, slight tilt, hard little shadow. Still used by
 *  the signed-in / loading splash below. */
function TapeStrip({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <span className="inline-block -rotate-2 whitespace-nowrap bg-[#FFE066] px-2.5 py-[5px] text-[10px] font-black uppercase tracking-[0.12em] text-[#231a00] shadow-[0_2px_5px_rgba(0,0,0,0.18)] sm:text-xs sm:tracking-[0.14em]">
        {children}
      </span>
    </div>
  );
}

/** The dashboard hero's button recipe (ink border, hard offset
 *  shadow, press that slides the button onto its shadow), sized for
 *  this page's stacked full-width CTAs. Signed-in branch only. */
const SPLASH_BTN_PRIMARY =
  'w-full cursor-pointer rounded-[14px] border-[2.5px] border-[#0C1220] bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-[3px_3px_0_#0C1220] transition-all hover:bg-sky-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';

const ALBUM_PREVIEWS = [
  { title: 'Pinkerton', cover: '/albums/pinkerton.jpg', rot: '-rotate-12 -mr-3 sm:-mr-4', z: 'z-0' },
  { title: 'Green Album', cover: '/albums/green.jpg', rot: '-rotate-6 -mr-3 sm:-mr-4', z: 'z-10' },
  { title: 'The Blue Album', cover: '/albums/blue.jpg', rot: 'rotate-0', z: 'z-20 scale-105' },
  { title: 'Red Album', cover: '/albums/red.jpg', rot: 'rotate-6 -ml-3 sm:-ml-4', z: 'z-10' },
  { title: 'White Album', cover: '/albums/white.jpg', rot: 'rotate-12 -ml-3 sm:-ml-4', z: 'z-0' },
];

/** The signed-out fan (mockup, Nov 26, 2026): the same five
 *  covers in a gentler fan — Pinkerton −9°, Green −5°, Blue
 *  upright and largest in the middle, Red +5°, White +9°. */
const FAN_COVERS = [
  { title: 'Pinkerton', cover: '/albums/pinkerton.jpg', deg: -9, z: 10, scale: 1 },
  { title: 'Green Album', cover: '/albums/green.jpg', deg: -5, z: 20, scale: 1 },
  { title: 'The Blue Album', cover: '/albums/blue.jpg', deg: 0, z: 30, scale: 1.12 },
  { title: 'Red Album', cover: '/albums/red.jpg', deg: 5, z: 20, scale: 1 },
  { title: 'White Album', cover: '/albums/white.jpg', deg: 9, z: 10, scale: 1 },
];

/** What's inside the Sweater Thread — the expansion list
 *  under the payoff card's main row. Every label is a
 *  heading the Thread itself renders (Step4Wrapped, in
 *  render order; the Fan Tribe is the shareables gallery's
 *  card at the foot of the Thread). Only sections the
 *  Thread always delivers are listed — its conditional
 *  cards (the Core Four, the Consistency Index, the rank
 *  clashes, the Roast) are not promised here. */
const THREAD_CONTENTS = [
  'Fan archetype',
  'Taste DNA',
  'Weezer Era',
  'Fan Tribe',
  'Blue vs Pinkerton',
  'Top Tracks & Albums',
  'Shareables',
];

export default function Step0Splash() {
  const { navigateTo, userId, loadingUser } = useWeezer();

  /** Payoff-card expansion (signed-out view only): the
   *  Thread contents list starts collapsed. */
  const [payoffOpen, setPayoffOpen] = useState(false);

  /** Guest entry — the same orientation hop the old guest
   *  button used. Any stale path-intent stash is cleared so
   *  the in-flow picker makes the call. */
  const startGuest = () => {
    try {
      window.sessionStorage.removeItem('weezer-path-intent');
    } catch {
      /* storage unavailable — the flow degrades to the picker */
    }
    navigateTo('orientation');
  };

  /* SIGNED-IN / LOADING SPLASH — production behavior, kept
   *  intact: while auth is unsettled the block holds (same
   *  shape, nothing tappable); a signed-in user cold-opening
   *  onto the splash gets ONE honest action — continue to
   *  their dashboard. The Nov 26 mockup redesign below is
   *  the signed-out view only. */
  if (loadingUser || userId) {
    return (
      <div className="max-w-xl mx-auto text-center py-0 sm:py-4 space-y-4 sm:space-y-5 animate-in fade-in duration-500">

        {/* HERO SECTION */}
        <div className="space-y-2">
          <div>
            <TapeStrip>All My Favorite Songs</TapeStrip>
            <h1
              className={`mt-3 text-3xl sm:text-4xl text-[#0C1220] tracking-wide leading-tight ${displayFont.className}`}
              style={{ textShadow: '3px 3px 0 rgba(11,30,63,0.35)' }}
            >
              Rank Weezer.
              <span className="block text-[#0072CE]">Settle the Debate.</span>
            </h1>
            <p className="text-xs font-semibold text-[#3D4A63] max-w-md mx-auto mt-2 leading-relaxed">
              Rank the songs you love — a few favorites, one album, or all 218. Compare with friends, and see how the world ranks them.
            </p>
          </div>
        </div>

        {/* CALL TO ACTION — auth-aware (Nov 7, 2026): the
            loading placeholder mirrors the button's shape;
            the signed-in fan gets Continue Ranking. */}
        <div className="space-y-2.5 max-w-sm mx-auto pt-1">
          {loadingUser ? (
            <>
              <button disabled className={`${SPLASH_BTN_PRIMARY} opacity-60 cursor-default`}>
                Start Ranking
              </button>

              <p className="text-[11px] font-bold text-[#3D4A63]">
                No account required.
              </p>

              <p className="text-[11px] font-bold text-[#3D4A63] pt-1">
                Already have an account?{' '}
                <span className="text-[#0072CE] font-black">Sign In</span>
              </p>
            </>
          ) : (
            <button
              onClick={() => navigateTo('dashboard')}
              className={SPLASH_BTN_PRIMARY}
            >
              Continue Ranking
            </button>
          )}
        </div>

        {/* OVERLAPPING ALBUM ARTWORK FAN VISUAL */}
        <div className="py-1 flex items-center justify-center pointer-events-none select-none">
          <div className="flex items-center justify-center">
            {ALBUM_PREVIEWS.map((album, idx) => (
              <div
                key={idx}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-[3px] border-[#0C1220] ${album.rot} ${album.z} shadow-[3px_3px_0_#0C1220] transition-transform duration-300 shrink-0 bg-slate-900`}
              >
                <img
                  src={album.cover}
                  alt={album.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* STACKED REASONS TO PARTICIPATE */}
        <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] px-4 py-3 space-y-3 max-w-md mx-auto text-left">

          {/* REASON 1: BUILD YOUR CANON */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-[#BDE9FF] text-[#0072CE] rounded-xl border-2 border-[#0C1220] shadow-[2px_2px_0_#0C1220] flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-2"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-black text-[#0C1220] leading-tight">Build Your Personal Rankings</h3>
              <p className="text-[12px] font-medium text-[#3D4A63] mt-0.5 leading-snug">
                Rank 218 canon album songs from Blue through Gold.
              </p>
            </div>
          </div>

          {/* REASON 2: CLASH WITH FRIENDS */}
          <div className="flex items-center gap-3.5 border-t border-[#0C1220]/10 pt-3">
            <div className="w-10 h-10 bg-[#F6A8C1] text-purple-700 rounded-xl border-2 border-[#0C1220] shadow-[2px_2px_0_#0C1220] flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-black text-[#0C1220] leading-tight">Compare With Friends</h3>
              <p className="text-[12px] font-medium text-[#3D4A63] mt-0.5 leading-snug">
                Compare your rankings with friends to uncover your taste compatibility (or lack thereof).
              </p>
            </div>
          </div>

          {/* REASON 3: GLOBAL CONSENSUS */}
          <div className="flex items-center gap-3.5 border-t border-[#0C1220]/10 pt-3">
            <div className="w-10 h-10 bg-[#8FE3B0] text-emerald-700 rounded-xl border-2 border-[#0C1220] shadow-[2px_2px_0_#0C1220] flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                {/* Solid globe (owner, Nov 6): the outline globe's
                    continents collapsed into a squiggle at 20px, so
                    the glyph is now a filled earth — meridian and
                    parallels cut out as negative space (evenodd). */}
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2a10 10 0 1 1 0 20 10 10 0 1 1 0-20Zm0 0a4.6 10 0 1 1 0 20 4.6 10 0 1 1 0-20Zm0 0a3.3 10 0 1 1 0 20 3.3 10 0 1 1 0-20ZM3.62 6.55L20.38 6.55A10 10 0 0 1 21.1 7.85L2.9 7.85A10 10 0 0 1 3.62 6.55Zm-0.72 9.6L21.1 16.15A10 10 0 0 1 20.38 17.45L3.62 17.45A10 10 0 0 1 2.9 16.15Z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-black text-[#0C1220] leading-tight">Worldwide Fan Rankings</h3>
              <p className="text-[12px] font-medium text-[#3D4A63] mt-0.5 leading-snug">
                See how you compare to Weezer fans around the world.
              </p>
            </div>
          </div>

        </div>

      </div>
    );
  }

  /* SIGNED-OUT SPLASH — the mockup build (Nov 26, 2026),
   *  revised the same day per the owner's corrections:
   * pale-blue dot-grid field bled over the shell's main area
   * (the StepGarage2 bleed recipe), huge two-line headline,
   * the five-cover fan as the visual hook, one giant
   * guest-entry pill, then the How It Works card and the
   * payoff card. No tape strip, no path cards, no sign-in
   * line — the shell header above carries sign-in in its
   * menu, exactly as the mockup's header does. The button
   * carries no price word (owner's ruling). Type is the
   * site UI font (Inter, from the root layout) throughout —
   * the chunky feel comes from the 900 weight and size,
   * not the shareables display font. */
  return (
    <div
      className="-mx-4 -my-4 bg-[#E9F4FC] px-4 pt-8 pb-14 sm:-mx-6 sm:-my-6 sm:px-6 sm:pt-10 lg:-mx-8 lg:-my-8 lg:px-8 animate-in fade-in duration-500"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.08) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="max-w-2xl mx-auto text-center">

        {/* HEADLINE — exactly two lines at every width:
            each line is nowrap and the size is clamped to
            the viewport (10vw at phone widths, so the long
            line, "Settle the Debate.", fits a 360px screen
            inside the page padding; 72px cap on desktop). */}
        <h1 className="text-[clamp(34px,10vw,72px)] font-black leading-[1.05] tracking-[-0.01em]">
          <span className="block whitespace-nowrap text-[#0C1220]">Rank Weezer.</span>
          <span className="block whitespace-nowrap text-[#0072CE]">Settle the Debate.</span>
        </h1>

        {/* SUBHEAD */}
        <p className="mt-4 text-base sm:text-xl font-semibold text-[#0C1220] leading-snug max-w-md mx-auto">
          Your favorite songs. Your personal ranking. Your place among Weezer fans everywhere.
        </p>

        {/* ALBUM COVER FAN — five covers, Blue upright and
            largest in the center, the rest fanned out with
            soft shadows. Each cover is ~27% of the row, so
            the row scales with the column. */}
        <div className="mt-7 flex items-center justify-center select-none">
          {FAN_COVERS.map((album, idx) => (
            <div
              key={album.title}
              className={`relative aspect-square w-[27%] shrink-0 ${idx > 0 ? '-ml-[9.5%]' : ''}`}
              style={{
                transform: `rotate(${album.deg}deg) scale(${album.scale})`,
                zIndex: album.z,
              }}
            >
              <img
                src={album.cover}
                alt={album.title}
                className="absolute inset-0 h-full w-full rounded-[16%] object-cover shadow-[0_12px_24px_rgba(12,18,32,0.28)]"
              />
            </div>
          ))}
        </div>

        {/* CTA — one giant guest-entry pill, no price
            word (owner's ruling). */}
        <div className="max-w-lg mx-auto mt-9">
          <button
            onClick={startGuest}
            className="flex w-[76%] mx-auto cursor-pointer items-center justify-center gap-2.5 rounded-full border-[3px] border-white/70 bg-[#0072CE] px-6 py-4 text-2xl font-black text-white shadow-[0_14px_30px_rgba(0,114,206,0.35)] transition-all hover:bg-[#0A7AD6] active:scale-[0.98] sm:py-5 sm:text-[32px]"
          >
            Start Ranking
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 12h15m-6-7 7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* MICROCOPY */}
        <p className="mt-3.5 text-sm font-semibold text-slate-600">
          No account required • Rank a few or all 218 songs
        </p>

        {/* HOW IT WORKS — white card, ruled title, three
            pastel-icon columns. */}
        <div className="mt-9 rounded-[28px] bg-white px-4 py-6 sm:px-6 shadow-[0_18px_40px_rgba(12,18,32,0.10)]">
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-slate-200" />
            <h2 className="text-2xl sm:text-[28px] font-black text-[#0C1220]">
              How It Works
            </h2>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100">
            <div className="px-2 sm:px-4">
              <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#D3EBFD] text-[#0072CE]">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-2"
                  />
                </svg>
              </div>
              <h3 className="mt-3 text-[13px] sm:text-base font-black leading-tight text-[#0C1220]">
                Rank Your Favorites
              </h3>
              <p className="mt-1 text-[11px] sm:text-sm font-medium leading-snug text-slate-600">
                Pick the songs you love.
              </p>
            </div>

            <div className="px-2 sm:px-4">
              <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#F9CFE0] text-[#0C1220]">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="5.8" cy="10.3" r="2.3" />
                  <circle cx="12" cy="8" r="3.1" />
                  <circle cx="18.2" cy="10.3" r="2.3" />
                  <path d="M2.5 21c.6-3.8 4.2-6 9.5-6s8.9 2.2 9.5 6z" />
                </svg>
              </div>
              <h3 className="mt-3 text-[13px] sm:text-base font-black leading-tight text-[#0C1220]">
                Compare With Friends
              </h3>
              <p className="mt-1 text-[11px] sm:text-sm font-medium leading-snug text-slate-600">
                See how your taste stacks up.
              </p>
            </div>

            <div className="px-2 sm:px-4">
              <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#CDF0D2] text-[#1B7A43]">
                <svg
                  className="w-6 h-6 sm:w-8 sm:h-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  {/* The solid globe from the signed-in card:
                      filled earth, meridian and parallels cut
                      out as negative space (evenodd). */}
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2a10 10 0 1 1 0 20 10 10 0 1 1 0-20Zm0 0a4.6 10 0 1 1 0 20 4.6 10 0 1 1 0-20Zm0 0a3.3 10 0 1 1 0 20 3.3 10 0 1 1 0-20ZM3.62 6.55L20.38 6.55A10 10 0 0 1 21.1 7.85L2.9 7.85A10 10 0 0 1 3.62 6.55Zm-0.72 9.6L21.1 16.15A10 10 0 0 1 20.38 17.45L3.62 17.45A10 10 0 0 1 2.9 16.15Z"
                  />
                </svg>
              </div>
              <h3 className="mt-3 text-[13px] sm:text-base font-black leading-tight text-[#0C1220]">
                Discover the Consensus
              </h3>
              <p className="mt-1 text-[11px] sm:text-sm font-medium leading-snug text-slate-600">
                Find out where you stand with Weezer fans worldwide.
              </p>
            </div>
          </div>
        </div>

        {/* PAYOFF CARD — the personal-ranking payoff and
            a tilted mini ranking card. Every fan who ranks
            gets a Sweater Thread (the site's own recap), so
            the copy states it flatly — no trophy, no hedge.
            The whole card taps open (owner, Nov 26): beneath
            the main row, a hairline-divided list of what the
            Thread actually contains (THREAD_CONTENTS). The
            chevron at the bottom-right is the affordance;
            it rotates while the list is open. */}
        <button
          type="button"
          onClick={() => setPayoffOpen((open) => !open)}
          aria-expanded={payoffOpen}
          className="mt-5 flex w-full flex-wrap items-center gap-x-4 gap-y-0 sm:gap-x-6 cursor-pointer rounded-[28px] bg-[#CDE8FA] px-4 py-4 sm:px-6 sm:py-5 text-left shadow-[0_14px_30px_rgba(12,18,32,0.08)]"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-xl font-black leading-tight text-[#0C1220]">
              Get Your Personal Weezer Ranking
            </h3>
            <p className="mt-1 text-sm sm:text-base font-medium text-slate-700">
              Plus your Sweater Thread — the recap of your whole ranking, ready to share.
            </p>
          </div>

          <div className="w-[104px] sm:w-[128px] shrink-0 rotate-[6deg] rounded-xl bg-white p-2.5 shadow-[0_10px_20px_rgba(12,18,32,0.18)]">
            <p className="text-center text-[9px] sm:text-[10px] font-black leading-tight tracking-wide text-[#0C1220]">
              YOUR WEEZER RANKING
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-[#E7EDF3]">
                <div className="h-full w-[88%] rounded-full bg-[#5EA9E6]" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#E7EDF3]">
                <div className="h-full w-[70%] rounded-full bg-[#7ED491]" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#E7EDF3]">
                <div className="h-full w-[54%] rounded-full bg-[#FFC72C]" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#E7EDF3]">
                <div className="h-full w-[42%] rounded-full bg-[#F2A0BE]" />
              </div>
            </div>
          </div>

          {payoffOpen && (
            <div className="mt-4 w-full border-t border-[#0C1220]/10 pt-3.5">
              <ul className="space-y-1.5">
                {THREAD_CONTENTS.map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FFC72C]">
                      <svg
                        className="h-2.5 w-2.5 text-[#0C1220]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span className="text-[13px] sm:text-sm font-bold text-[#0C1220]">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-1.5 flex w-full justify-end">
            <svg
              className={`h-4 w-4 text-[#0C1220]/45 transition-transform duration-300 ${payoffOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 9l6 6 6-6"
              />
            </svg>
          </div>
        </button>

        {/* GAME CARD — the trivia game's pitch to anyone
            not ready to rank. White, so it sits beside the
            payoff card as its own thing. The whole card is
            the game's existing front-door entry — the same
            navigateTo('lore') the shell menu's Back to the
            Shack row and the dashboard's game card use. */}
        <button
          type="button"
          onClick={() => navigateTo('lore')}
          className="mt-5 flex w-full cursor-pointer items-center gap-4 sm:gap-6 rounded-[28px] bg-white px-4 py-4 sm:px-6 sm:py-5 text-left shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition-colors hover:bg-sky-50"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-xl font-black leading-tight text-[#0C1220]">
              Not ready to rank?
            </h3>
            <p className="mt-1 text-sm sm:text-base font-medium text-slate-700">
              Test your Weezer knowledge —{' '}
              <span className="whitespace-nowrap">play Back to the Shack.</span>
            </p>
          </div>
          <svg
            className="h-5 w-5 shrink-0 text-[#0C1220]/40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 6l6 6-6 6"
            />
          </svg>
        </button>

      </div>
    </div>
  );
}
