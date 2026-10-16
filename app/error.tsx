'use client';

/**
 * Route-level error boundary. Without this, a render error white-screens
 * the app and nothing is recorded anywhere. The error is logged with its
 * digest (visible in Vercel's function/edge logs) and the user gets a
 * friendly recovery path instead of a dead page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
        <p className="text-4xl mb-4">🎸</p>
        <h1 className="text-2xl font-black tracking-tight mb-2">
          The amp just buzzed out
        </h1>
        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
          Something went wrong on this page. Your rankings are saved as you
          go, so try again — if it keeps happening, note the code below.
        </p>
        {error?.digest && (
          <p className="text-[11px] font-bold text-slate-400 mb-6">
            Error code: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="bg-[#0072CE] hover:bg-blue-600 text-white font-black rounded-2xl px-6 py-3 text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
