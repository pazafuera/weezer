'use client';

import { displayFont } from './components/shareables/fonts';

/**
 * Route-level error boundary. Without this, a render error white-screens
 * the app and nothing is recorded anywhere. The error is logged with its
 * digest (visible in Vercel's function/edge logs) and the user gets a
 * friendly recovery path instead of a dead page.
 *
 * The raw error message is NOT shown (Nov 5, the pre-launch revisit
 * this comment used to defer): in production it is minified React
 * internals — testers hit it twice as a wall of gibberish. The digest
 * code stays: it is the one detail that helps track a report down.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="min-h-screen bg-[#DCEEF8] text-slate-900 flex items-center justify-center px-4"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="max-w-md w-full bg-white border-[3px] border-[#0C1220] rounded-[18px] p-8 text-center shadow-[4px_4px_0_rgba(11,30,63,0.85)]">
        <p className="text-4xl mb-4">🎸</p>
        <h1
          className={`text-[28px] leading-tight tracking-wide text-[#0C1220] mb-2 ${displayFont.className}`}
        >
          The amp just buzzed out
        </h1>
        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
          Something went wrong on this page. Your rankings are saved as you
          go, so try again — if it keeps happening, note the code below.
        </p>
        {error?.digest && (
          <div className="text-left bg-white border-2 border-[#0C1220] rounded-xl px-4 py-3 mb-6 overflow-x-auto">
            <p className="text-[11px] font-bold text-slate-500">
              Error details aren&apos;t shown here.
            </p>
            <p className="text-[11px] font-bold text-slate-400 mt-1">
              Error code: {error.digest}
            </p>
          </div>
        )}
        <button
          onClick={reset}
          className="bg-[#0072CE] hover:bg-blue-600 text-white font-black rounded-2xl px-6 py-3 text-sm transition-all border-[2.5px] border-[#0C1220] shadow-[3px_3px_0_#0C1220] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220] cursor-pointer"
        >
          Try again
        </button>
        {/* If the crash is in the state itself, reset() re-renders
            the same data and loops forever — a full reload at the
            front door (smart entry) is the honest way out. */}
        <a
          href="/"
          className="block mt-4 text-sm font-black text-slate-500 hover:text-[#0072CE] underline underline-offset-4"
        >
          ← Back to the RankingWeezer home page
        </a>
      </div>
    </main>
  );
}
