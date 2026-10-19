'use client';

import React, { useEffect } from 'react';
import { useWeezer } from '../context/WeezerContext';

// The overall process (owner direction, Oct 17): orient on the
// journey — sort, refine, Thread. The buckets themselves are
// taught in the deck tutorial, not here (owner, Oct 17).
const PROCESS_STEPS: { title: string; desc: string }[] = [
  {
    title: 'Song Sorting',
    desc: 'Pre-sort all canon Weezer songs into groups, from Banger to Trash',
  },
  {
    title: 'Refine',
    desc: 'Rank order your top picks to dial in what kind of Weezer fan you really are',
  },
  {
    title: 'Sweater Thread',
    desc: 'Your personal results unraveled, where you can compare with friends and other fans',
  },
];

export default function Step05Orientation() {
  const {
    navigateTo,
    closeOrientation,
    accountCreated,
    setAccountCreated,
    userProfile,
  } = useWeezer();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // The "account created" flag belongs to THIS arrival only: clear
  // it when the page unmounts, whichever way the user leaves —
  // "Start Sorting", Back, the menu. (The Start button also clears
  // it explicitly, below.)
  useEffect(() => {
    return () => setAccountCreated(false);
  }, [setAccountCreated]);

  return (
    // SCROLL REGION (iOS fix, Oct 17): this page is ~1,900px of plain
    // document flow inside AppShell's min-h-screen flex column, whose
    // flex-1 <main> sizes the step area from the viewport. On iOS
    // Safari the page's overflow never became scrollable page area —
    // the page painted past the fold but would not scroll, leaving
    // both CTAs unreachable (owner report). Giving this root its own
    // full-height scroll region makes scrolling independent of the
    // document. Scoped to orientation only — the shared shell and
    // every other step are untouched.
    // CTA BAR (owner, Oct 17): the Start button must be visible
    // without scrolling, so the root is now a flex column — the copy
    // scrolls in the flex-1 region above, and the CTA bar is pinned
    // below it, outside the scroll flow. The bar is always on screen
    // (on load and mid-scroll), carries the safe-area bottom inset
    // itself, and can never cover content: the scroll region's own
    // bottom padding is all the end clearance it needs.
    <div className="h-full flex flex-col max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
      {/* ACCOUNT-CREATED BANNER — a fresh sign-up lands here (from
          the login page) instead of the old signup_success step;
          the flag rides in context and clears on any exit. */}
      {accountCreated && (
        <div className="pt-3 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <span className="w-8 h-8 shrink-0 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-sm shadow-sm">
            ✓
          </span>
          <p className="text-sm font-bold text-emerald-900 leading-snug">
            Account created
            {userProfile?.username ? `, @${userProfile.username}` : ''} —
            your progress is saved.
          </p>
        </div>
      )}

      {/* BACK BUTTON — returns to the step the user came from
          (closeOrientation), not a hardcoded home: a user who opened
          How It Works from the dashboard goes back to the dashboard.
          Falls back to splash on a cold arrival (first run, deep
          link), which is where first-run users came from anyway. */}
      <div className="pt-2 flex items-center justify-start">
        <button
          onClick={closeOrientation}
          className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          ← Back
        </button>
      </div>

      {/* HEADER — the title now carries the whole explanation
          (owner: "How the Project Works", one line, no subtitle;
          the old "How this works" sub-heading went with it — it
          only repeated the title). */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-5xl font-black text-slate-950 tracking-tighter whitespace-nowrap">
          How the Project Works
        </h1>
      </div>

      {/* THE PROCESS — sort, refine, Thread. The buckets
          themselves are taught in the deck tutorial, not here. */}
      <div>
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-sm space-y-3">
          {PROCESS_STEPS.map((step, idx) => (
            <div
              key={step.title}
              className={`flex items-start gap-3.5 ${idx > 0 ? 'pt-3 border-t border-slate-100' : ''}`}
            >
              <div className="w-11 h-11 rounded-2xl border bg-blue-100 text-[#0072CE] border-blue-300 flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
                {idx + 1}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight leading-tight">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed mt-0.5">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The bucket buttons are no longer taught here — the
          deck tutorial teaches each bucket at the real tiles
          (owner, Oct 17). BucketGuide still lives in the app
          for the "?" help sheet's bucket definitions. */}
      </div>

      {/* CTA BAR — pinned under the scroll region (see the root
          comment): always visible, never scrolled to. */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-white/90 backdrop-blur-md border-t border-slate-200/90 space-y-2.5">
        <button
          onClick={() => {
            setAccountCreated(false);
            navigateTo('triage');
          }}
          className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-[0.99] text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-[0_10px_25px_rgba(0,114,206,0.3)] transition-all cursor-pointer flex items-center justify-center"
        >
          Start Sorting
        </button>

        <button
          onClick={() => navigateTo('login', 'signup')}
          className="w-full bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 px-6 rounded-2xl transition-all cursor-pointer text-xs border border-slate-200 text-center"
        >
          Create an Account First
        </button>
      </div>
    </div>
  );
}