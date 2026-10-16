'use client';

import { forwardRef, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportNodeAsPng } from './exportImage';
import type { ExportMode } from './exportImage';

/**
 * Fixed 1024px-wide export visual, styled to match the tier card's export
 * frame exactly: #0f172a background, the "All My Favorite Songs" branding
 * header with the RankingWeezer.com CTA badge, and the "Generated via"
 * footer. Rendered WITHOUT buttons so the exported PNG is clean.
 */
export const ShareableVisual = forwardRef<
  HTMLDivElement,
  { title: string; subtitle?: string; children: ReactNode }
>(function ShareableVisual({ title, subtitle, children }, ref) {
  const titleLine = subtitle ? `${title} | ${subtitle}` : title;
  return (
    <div ref={ref} className="w-[1024px] bg-[#0f172a] p-8 text-white">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-6 mb-8">
        <div className="flex-1 pr-8">
          <h2 className="text-6xl font-black text-white tracking-tight leading-none mb-2">
            All My Favorite Songs
          </h2>
          <h3 className="text-2xl font-black text-slate-300 uppercase tracking-widest mb-4">
            The Weezer Song Ranking Project
          </h3>
          <p className="text-xl font-bold text-amber-400">{titleLine}</p>
        </div>
        <div className="text-left bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg shrink-0 w-[320px]">
          <p className="text-sm font-bold text-slate-300 leading-snug">
            Make your own Weezer Song rankings list at{' '}
            <span className="text-[#0072CE] font-black">RankingWeezer.com</span>
            {' and connect with @usernames to compare your tastes side-by-side.'}
          </p>
        </div>
      </div>
      {children}
      <div className="text-center pt-6 text-slate-500 font-bold text-sm tracking-widest uppercase">
        Generated via RankingWeezer.com
      </div>
    </div>
  );
});

/** Tier-card-style primary button for standalone cards. */
export function SaveImageButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
    >
      <span>{busy ? 'Generating Image...' : '📸 Save as Image'}</span>
    </button>
  );
}

/** Hook wiring a visual's ref to the PNG export. */
export function useShareableDownload(filename: string, mode: ExportMode = 'auto') {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportNodeAsPng(ref.current, filename, mode);
    } finally {
      setBusy(false);
    }
  };
  return { ref, busy, download };
}
