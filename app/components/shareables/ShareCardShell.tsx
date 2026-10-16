'use client';

import { forwardRef, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportNodeAsPng } from './exportImage';

export type ShareableVisualProps = {
  title: string;
  subtitle?: string;
};

/**
 * Fixed 1024px-wide export visual. Rendered WITHOUT the download button so
 * the exported PNG is clean. The gallery renders this directly (scaled).
 */
export const ShareableVisual = forwardRef<
  HTMLDivElement,
  ShareableVisualProps & { children: ReactNode }
>(function ShareableVisual({ title, subtitle, children }, ref) {
  return (
    <div
      ref={ref}
      className="w-[1024px] overflow-hidden rounded-3xl bg-[#0b0b12] px-12 py-10 text-slate-100"
    >
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-400">
          RankingWeezer.com
        </p>
        <h2 className="mt-2 text-5xl font-black uppercase tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-2 text-xl text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
      <div className="mt-10 flex items-center justify-between border-t border-slate-800 pt-6">
        <p className="text-lg font-bold text-slate-400">
          Make your own ranking at <span className="text-amber-400">RankingWeezer.com</span>
        </p>
        <p className="text-lg text-slate-500">My Weezer Sweater Thread</p>
      </div>
    </div>
  );
});

export function DownloadPngButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-amber-400 px-6 py-2.5 font-bold text-black transition hover:bg-amber-300"
    >
      {label ?? 'Download PNG'}
    </button>
  );
}

/** Hook wiring a visual's ref to the PNG export. */
export function useShareableDownload(filename: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportNodeAsPng(ref.current, filename);
    } finally {
      setBusy(false);
    }
  };
  return { ref, busy, download };
}
