'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportNodeAsPng } from './exportImage';
import type { ExportMode } from './exportImage';
import { Top10CardVisual } from './Top10Card';
import type { Bucket, ShareSong } from './Top10Card';
import { TribeBadgeCardVisual } from './TribeBadgeCard';
import { EraDnaCardVisual } from './EraDnaCard';
import { TasteCompatibilityCardVisual } from './TasteCompatibilityCard';
import type { FriendLike } from './TasteCompatibilityCard';

/**
 * One asset in the library: a scaled preview, View / Save / Share actions,
 * a full-size modal view, and a hidden full-size export copy.
 *
 * Exports ALWAYS render from the hidden off-screen copy (the TierListChart
 * pattern) — never from the CSS-scaled preview — so PNGs come out at the
 * card's natural 1024px size, fully framed.
 *
 * `children` is a render prop: (interactive) => visual. Static copies
 * (preview + export) get interactive=false; the modal copy gets true so
 * interactive cards (friend picker) work there. Any state a card needs
 * lives in the wrapping item component so all copies stay in sync.
 */
function LibraryItem({
  title,
  description,
  filename,
  children,
}: {
  title: string;
  description: string;
  filename: string;
  children: (interactive: boolean) => ReactNode;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const runExport = async (mode: ExportMode) => {
    if (busy) return;
    setBusy(true);
    try {
      await exportNodeAsPng(exportRef.current, filename, mode);
    } finally {
      setBusy(false);
    }
  };

  const actionButtons = (
    <>
      <button
        onClick={() => runExport('save')}
        disabled={busy}
        className="flex-1 bg-[#0072CE] hover:bg-blue-600 text-white font-black text-xs py-2.5 px-3 rounded-xl transition cursor-pointer disabled:opacity-50"
      >
        {busy ? 'Working…' : '📸 Save'}
      </button>
      <button
        onClick={() => runExport('share')}
        disabled={busy}
        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-2.5 px-3 rounded-xl transition cursor-pointer disabled:opacity-50"
      >
        Share
      </button>
    </>
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
      {/* Scaled preview (visual only — exports never use this node) */}
      <div className="relative h-[240px] overflow-hidden rounded-2xl bg-slate-100 border border-slate-200">
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{ width: 1024, transform: 'scale(0.32)', transformOrigin: 'top left' }}
        >
          {children(false)}
        </div>
      </div>

      <div>
        <h3 className="font-black text-lg text-slate-950 leading-tight">{title}</h3>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">{description}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setViewOpen(true)}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs py-2.5 px-3 rounded-xl transition cursor-pointer"
        >
          View
        </button>
        {actionButtons}
      </div>

      {/* Hidden full-size export copy (TierListChart pattern) */}
      <div
        className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={exportRef}>{children(false)}</div>
      </div>

      {/* Full-size view modal */}
      {viewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4"
          onClick={() => setViewOpen(false)}
        >
          <div
            className="my-8 w-full max-w-5xl rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black text-slate-950">{title}</h3>
              <button
                onClick={() => setViewOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-black cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl">{children(true)}</div>
            <div className="mt-3 flex gap-2">{actionButtons}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compatibility item holds the friend selection so preview, modal, and
 *  export copies all render the same match. */
function CompatibilityLibraryItem({
  songs,
  friends,
  subtitle,
}: {
  songs: ShareSong[];
  friends: FriendLike[];
  subtitle?: string;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  return (
    <LibraryItem
      title="Taste Compatibility"
      description="Your taste match score vs. a friend."
      filename="weezer-taste-match.png"
    >
      {(interactive) => (
        <TasteCompatibilityCardVisual
          songs={songs}
          friends={friends}
          subtitle={subtitle}
          selectedKey={selectedKey}
          onSelectChange={interactive ? setSelectedKey : undefined}
          interactive={interactive}
        />
      )}
    </LibraryItem>
  );
}

export default function ShareablesGallery({
  songs,
  triageMap,
  friends,
  subtitle,
}: {
  /** Ranked songs only (already filtered to bucketed songs). */
  songs: ShareSong[];
  triageMap: Record<string, Bucket>;
  friends: FriendLike[];
  subtitle?: string;
}) {
  if (songs.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-10 text-center shadow-xs">
        <p className="text-xl font-black text-slate-950">No shareables yet</p>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          Bucket and rank some songs first — your cards will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LibraryItem
        title="Top 10 Songs"
        description="Your ranked top 10 as a shareable graphic."
        filename="my-weezer-top-10.png"
      >
        {() => <Top10CardVisual songs={songs} subtitle={subtitle} />}
      </LibraryItem>
      <LibraryItem
        title="Fan Tribe Badge"
        description="Which Weezer tribe do you belong to?"
        filename="my-weezer-tribe.png"
      >
        {() => (
          <TribeBadgeCardVisual songs={songs} triageMap={triageMap} subtitle={subtitle} />
        )}
      </LibraryItem>
      <LibraryItem
        title="Era DNA"
        description="Where your taste lives across Weezer history."
        filename="my-weezer-era-dna.png"
      >
        {() => <EraDnaCardVisual songs={songs} subtitle={subtitle} />}
      </LibraryItem>
      <CompatibilityLibraryItem songs={songs} friends={friends} subtitle={subtitle} />
    </div>
  );
}
