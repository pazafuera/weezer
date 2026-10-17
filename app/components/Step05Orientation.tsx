'use client';

import React, { useEffect } from 'react';
import { useWeezer } from '../context/WeezerContext';

// The overall process (owner direction, Oct 17): orient on the
// journey — sort, refine, Thread. The buckets themselves are
// taught in the deck tutorial, not here (owner, Oct 17).
const PROCESS_STEPS: { title: string; desc: string }[] = [
  {
    title: 'Sort',
    desc: 'Go through the songs and bucket the ones you know. Never heard it? Just move on — you can come back to it.',
  },
  {
    title: 'Refine',
    desc: 'Your top picks face off head-to-head until your full 1–206 ranking is set.',
  },
  {
    title: 'Your Sweater Thread',
    desc: 'Get your personalized results: your Top 10, your fan tribe, your Era DNA.',
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
    // document: content flows inside it with safe-area-aware bottom
    // padding so the CTAs can always be scrolled clear of Safari's
    // bottom toolbar. Scoped to orientation only — the shared shell
    // and every other step are untouched.
    <div className="h-full overflow-y-auto space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto px-4">
      {/* BACK BUTTON */}
      <div className="pt-4 flex items-center justify-start">
        <button
          onClick={() => navigateTo('splash')}
          className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          ← Back to Splash
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

      {/* PRO TIP */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 w-full text-amber-950">
        <p className="text-s font-bold leading-snug">
          💡 <span className="font-black">Pro Tip:</span> Go with your gut! You'll fine-tune exact rankings later.
        </p>
      </div>

      {/* CONTINUATION CTAS */}
      <div className="pt-2 space-y-2.5">
        <button
          onClick={() => navigateTo('triage')}
          className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-[0.99] text-white font-black text-base sm:text-lg py-4 rounded-2xl shadow-[0_10px_25px_rgba(0,114,206,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>I'm Ready — Start Triage</span>
          <span className="transform group-hover:translate-x-1 transition-transform">
            ⚡️
          </span>
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