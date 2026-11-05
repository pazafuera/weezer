'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlyingWIcon } from './SharedUI';
import { displayFont } from './shareables/fonts';
import {
  WELCOME_SESSION_KEY,
  WELCOME_LAST_SHOWN_KEY,
  isWelcomeEligible,
  parseWelcomeLastShown,
} from '../lib/welcomeGate';

/**
 * The welcome interstitial (Nov 4, 2026): a spinning vinyl
 * record with the Flying W on its label, over "Wrestling with
 * Jimmy…". It replaces the old full-screen "Busy wrestling with
 * Jimmy..." spinner gate — and unlike that gate, it is NOT an
 * every-open tax. Driven by page.tsx with the boot's loadingUser
 * flag; it decides everything else itself:
 *
 * - ELIGIBLE (welcomeGate: not yet shown this session, and
 *   never shown or last shown >= 8h ago): the overlay covers
 *   the boot from the first frame, both storage marks are set
 *   at display time, and it stays until loading settles — with
 *   a ~2.6s minimum (Mark's playtest note, Nov 4, 2026: the
 *   first cut's ~900ms "needs to run a few more seconds to
 *   have the full effect") — then fades.
 * - The look is the share-card poster system (Mark, same
 *   note: "more fun treatment — the yellow highlighted text,
 *   headline with shadow"): flat #039AD1 + halftone dots, a
 *   rotated yellow tape strip, and the phrase as a Lilita One
 *   headline with a hard offset shadow.
 * - NOT eligible: the overlay stays out of the way (the shell
 *   + skeleton carry the boot). If the boot is STILL loading
 *   after ~1500ms, the overlay appears purely as a loading
 *   indicator — no minimum hold, gone the moment loading
 *   settles, and it does not set the welcome marks (a slow
 *   boot is not a welcome showing).
 * - Storage failures fail CLOSED: no welcome, app boots as
 *   normal (the slow-boot indicator still works — it needs no
 *   storage).
 * - Once the first boot settles, the component retires for
 *   the life of the page: never on step changes, history pops,
 *   or the loading flips that auth changes cause later.
 */

const MIN_WELCOME_MS = 2600;
const SLOW_BOOT_MS = 1500;
const FADE_MS = 350;

type Phase = 'hidden' | 'shown' | 'fading' | 'gone';

export default function WelcomeInterstitial({
  loading,
}: {
  loading: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const phaseRef = useRef<Phase>('hidden');
  const eligibleRef = useRef(false);
  const shownAtRef = useRef(0);
  const retiredRef = useRef(false);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const applyPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  // The gate decision — layout effect so an eligible welcome is
  // up before the first paint settles, with no skeleton flash
  // ahead of it.
  useLayoutEffect(() => {
    let eligible = false;
    try {
      const sessionShown =
        window.sessionStorage.getItem(WELCOME_SESSION_KEY) !== null;
      const lastShownAt = parseWelcomeLastShown(
        window.localStorage.getItem(WELCOME_LAST_SHOWN_KEY)
      );
      eligible = isWelcomeEligible({ sessionShown, lastShownAt }, Date.now());
    } catch {
      // Storage unavailable (private mode, disabled storage):
      // fail closed — no welcome.
      eligible = false;
    }
    eligibleRef.current = eligible;

    if (eligible) {
      // The welcome is actually being displayed: set both marks
      // now (best-effort — a storage write failure must not break
      // the boot, only the bookkeeping).
      try {
        window.sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
      } catch {
        /* best effort */
      }
      try {
        window.localStorage.setItem(
          WELCOME_LAST_SHOWN_KEY,
          String(Date.now())
        );
      } catch {
        /* best effort */
      }
      shownAtRef.current = Date.now();
      applyPhase('shown');
      return;
    }

    // Not eligible: stand by as a pure loading indicator. The
    // timer is checked against the live loading flag and the
    // retired latch, so a boot that settles in time never shows
    // anything.
    const timer = window.setTimeout(() => {
      if (!retiredRef.current && loadingRef.current) {
        shownAtRef.current = Date.now();
        applyPhase('shown');
      }
    }, SLOW_BOOT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading settled: retire (permanently) and, if shown, fade —
  // after the welcome minimum for an eligible showing, at once
  // for a slow-boot indicator showing.
  useEffect(() => {
    if (loading) return;
    if (retiredRef.current) return;
    retiredRef.current = true;
    if (phaseRef.current !== 'shown') return;
    const minimum = eligibleRef.current ? MIN_WELCOME_MS : 0;
    const wait = Math.max(0, minimum - (Date.now() - shownAtRef.current));
    const fadeTimer = window.setTimeout(() => {
      applyPhase('fading');
      window.setTimeout(() => applyPhase('gone'), FADE_MS);
    }, wait);
    return () => window.clearTimeout(fadeTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (phase === 'hidden' || phase === 'gone') return null;

  return (
    <div
      aria-hidden={phase === 'fading'}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#039AD1] transition-opacity duration-300 ${
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Halftone dots — the poster texture, same recipe as the
          dashboard hero's overlay. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.22) 1.5px, transparent 1.6px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="relative flex flex-col items-center px-6">
        {/* The yellow tape strip — the poster's eyebrow label. */}
        <div className="-rotate-2 bg-[#FFD84D] px-4 py-1.5 shadow-md">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-950 sm:text-sm">
            All My Favorite Songs
          </span>
        </div>
        {/* The record: black disc, concentric grooves (repeating
            radial gradient), brand-blue center label carrying the
            white Flying W, spindle hole. It spins via the
            .welcome-record-spin keyframes (globals.css), which
            respect prefers-reduced-motion. */}
        <div
          className="welcome-record-spin relative mt-8 h-40 w-40 rounded-full shadow-2xl sm:h-48 sm:w-48"
          style={{
            background:
              'repeating-radial-gradient(circle at center, #0b0b0c 0px, #1a1a1c 2px, #0b0b0c 4px)',
          }}
        >
          <div className="absolute inset-0 rounded-full border border-black/50" />
          <div className="absolute left-1/2 top-1/2 flex h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0072CE] shadow-inner">
            <FlyingWIcon className="h-auto w-3/5 text-white" />
          </div>
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#039AD1]" />
        </div>
        {/* The headline — display font, hard offset shadow, the
            poster treatment from the share cards. */}
        <p
          className={`${displayFont.className} mt-8 text-center text-4xl leading-[1.05] tracking-wide text-white sm:text-5xl`}
          style={{ textShadow: '0.06em 0.06em 0 rgba(1, 66, 102, 0.55)' }}
        >
          Wrestling with Jimmy…
        </p>
      </div>
    </div>
  );
}
