'use client';

import React from 'react';
import { useWeezer } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';
import { FULL_SONG_POOL } from '../data/constants';

/** The dashboard hero's tape strip (StepGarage2's TapeStrip recipe):
 *  yellow label, slight tilt, hard little shadow. */
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
 *  this page's stacked full-width CTAs. */
const SPLASH_BTN_PRIMARY =
  'w-full cursor-pointer rounded-[14px] border-[2.5px] border-[#0C1220] bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-[3px_3px_0_#0C1220] transition-all hover:bg-sky-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]';

/** The path cards below the hero mirror the in-flow
 *  SortPathPicker's card recipe (Step1Triage) so the choice
 *  looks the same on both sides of the click. */
const PATH_CARD =
  'w-full cursor-pointer text-left bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-4 transition-transform hover:scale-[1.01]';

const ALBUM_PREVIEWS = [
  { title: 'Pinkerton', cover: '/albums/pinkerton.jpg', rot: '-rotate-12 -mr-3 sm:-mr-4', z: 'z-0' },
  { title: 'Green Album', cover: '/albums/green.jpg', rot: '-rotate-6 -mr-3 sm:-mr-4', z: 'z-10' },
  { title: 'The Blue Album', cover: '/albums/blue.jpg', rot: 'rotate-0', z: 'z-20 scale-105' },
  { title: 'Red Album', cover: '/albums/red.jpg', rot: 'rotate-6 -ml-3 sm:-ml-4', z: 'z-10' },
  { title: 'White Album', cover: '/albums/white.jpg', rot: 'rotate-12 -ml-3 sm:-ml-4', z: 'z-0' },
];

export default function Step0Splash() {
  const { navigateTo, userId, loadingUser } = useWeezer();

  /** Guest entry — the same orientation hop the old guest
   *  button used — optionally carrying a path intent for
   *  Step1Triage through the sessionStorage stash the
   *  ?path= campaign link already uses. No intent means the
   *  normal front door, and any stale stash is cleared so
   *  the in-flow picker makes the call. */
  const startGuest = (intent?: 'all' | 'casual') => {
    try {
      if (intent) {
        window.sessionStorage.setItem('weezer-path-intent', intent);
      } else {
        window.sessionStorage.removeItem('weezer-path-intent');
      }
    } catch {
      /* storage unavailable — the flow degrades to the picker */
    }
    navigateTo('orientation');
  };

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

      {/* CALL TO ACTION — directly under the subhead, guest-first
          (Nov 26, 2026): ranking is the primary action and needs
          no account; account creation lives on the login step,
          not the hero. Auth-aware (Nov 7, 2026): while auth is
          unsettled the block holds (same shape, nothing
          tappable); a signed-in user cold-opening onto the
          splash gets ONE honest action — continue to their
          dashboard, no sign-in offers; a signed-out visitor
          gets the guest set. */}
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
        ) : userId ? (
          <button
            onClick={() => navigateTo('dashboard')}
            className={SPLASH_BTN_PRIMARY}
          >
            Continue Ranking
          </button>
        ) : (
          <>
            <button
              onClick={() => startGuest()}
              className={SPLASH_BTN_PRIMARY}
            >
              Start Ranking
            </button>

            <p className="text-[11px] font-bold text-[#3D4A63]">
              No account required.
            </p>

            <p className="text-[11px] font-bold text-[#3D4A63] pt-1">
              Already have an account?{' '}
              <button
                onClick={() => navigateTo('login', 'login')}
                className="text-[#0072CE] hover:underline cursor-pointer font-black"
              >
                Sign In
              </button>
            </p>
          </>
        )}
      </div>

      {/* OVERLAPPING ALBUM ARTWORK FAN VISUAL — covers shrunk by
          a third (Nov 26, 2026) so the CTA sits higher. */}
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

      {/* PARTICIPATION PATHS — signed-out visitors only (a
          signed-in fan already has a path and progress). Card
          copy is the SortPathPicker's own; the All 218 and
          casual cards preset that path through the intent
          stash, Album by album leaves the choice to the
          in-flow picker. */}
      {!loadingUser && !userId && (
        <div className="max-w-md mx-auto space-y-3">
          <h2 className="text-base font-black text-[#0C1220]">
            Start small or go big. The choice is yours.
          </h2>

          <button onClick={() => startGuest('all')} className={PATH_CARD}>
            <div className="flex items-start gap-3.5">
              <span className="text-3xl leading-none">🤘</span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-[#0C1220]">All {FULL_SONG_POOL.length}</div>
                <p className="text-sm font-bold leading-snug text-[#3D4A63]">
                  The whole catalog. B-sides, deep cuts, all of it.
                </p>
              </div>
            </div>
          </button>

          <button onClick={() => startGuest()} className={PATH_CARD}>
            <div className="flex items-start gap-3.5">
              <span className="text-3xl leading-none">💿</span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-[#0C1220]">
                  Album by album
                </div>
                <p className="text-sm font-bold leading-snug text-[#3D4A63]">
                  Pick an album, rank its songs. Add more whenever
                  you&apos;re ready.
                </p>
              </div>
            </div>
          </button>

          <button onClick={() => startGuest('casual')} className={PATH_CARD}>
            <div className="flex items-start gap-3.5">
              <span className="text-3xl leading-none">🎧</span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-[#0C1220]">
                  I&apos;m a casual
                </div>
                <p className="text-sm font-bold leading-snug text-[#3D4A63]">
                  Just Blue, Pinkerton, and the hits.
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

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
