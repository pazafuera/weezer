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
  const { navigateTo } = useWeezer();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

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
      <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-8">
      {/* BACK BUTTON */}
      <div className="pt-4 flex items-center justify-start">
        <button
          onClick={() => navigateTo('splash')}
          className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          ← Back
        </button>
      </div>

      {/* GUEST HEADER */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter">
          The Rules of <span className="text-[#0072CE]">Engagement.</span>
        </h1>
        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest max-w-md mx-auto">
          You're ready to get ranking.
        </p>
      </div>

      {/* HOW THIS WORKS — the process first, buckets second */}
      <div className="space-y-3 pt-2">
        <h2 className="text-base sm:text-xl font-black text-slate-950 tracking-tight text-center">
          How this works
        </h2>
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          {PROCESS_STEPS.map((step, idx) => (
            <div
              key={step.title}
              className={`flex items-start gap-3.5 ${idx > 0 ? 'pt-4 border-t border-slate-100' : ''}`}
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
          onClick={() => navigateTo('triage')}
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