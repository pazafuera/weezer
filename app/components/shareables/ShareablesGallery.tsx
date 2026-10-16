'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportNodeAsPng } from './exportImage';
import { Top10CardVisual } from './Top10Card';
import type { Bucket, ShareSong } from './Top10Card';
import { TribeBadgeCardVisual } from './TribeBadgeCard';
import { EraDnaCardVisual } from './EraDnaCard';
import { TasteCompatibilityCardVisual, friendKey, friendLabel } from './TasteCompatibilityCard';
import type { FriendLike } from './TasteCompatibilityCard';

/**
 * One asset in the library: a scaled preview, an optional control row
 * (e.g. the compatibility card's friend picker), and a single Download
 * button — the tier card's one-button pattern (native share sheet on
 * mobile, file download on desktop).
 *
 * Exports ALWAYS render from a hidden full-size off-screen copy (the
 * TierListChart pattern) — never from the CSS-scaled preview — so PNGs
 * come out at the card's natural 1024px size, fully framed.
 *
 * `children` renders the card's visual; any state a card needs lives in
 * the wrapping item component so preview and export copies stay in sync.
 */
function LibraryItem({
  title,
  description,
  filename,
  controls,
  children,
}: {
  title: string;
  description: string;
  filename: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportNodeAsPng(exportRef.current, filename, 'auto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
      {/* Scaled preview (visual only — exports never use this node) */}
      <div className="relative h-[240px] overflow-hidden rounded-2xl bg-slate-100 border border-slate-200">
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{ width: 1024, transform: 'scale(0.32)', transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>

      <div>
        <h3 className="font-black text-lg text-slate-950 leading-tight">{title}</h3>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">{description}</p>
      </div>

      {controls}

      <button
        onClick={download}
        disabled={busy}
        className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black text-xs py-3 px-3 rounded-xl transition cursor-pointer disabled:opacity-50"
      >
        {busy ? 'Generating Image...' : '📸 Download'}
      </button>

      {/* Hidden full-size export copy (TierListChart pattern) */}
      <div
        className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={exportRef}>{children}</div>
      </div>
    </div>
  );
}

/** Compatibility item holds the friend selection so the preview and the
 *  export copy render the same match. The picker sits under the preview
 *  at natural size. */
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
  const controls = (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        Compare with
      </label>
      <select
        value={selectedKey}
        onChange={(e) => setSelectedKey(e.target.value)}
        className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900"
      >
        <option value="">Choose a friend…</option>
        {friends.map((f, i) => (
          <option key={friendKey(f, i)} value={friendKey(f, i)}>
            {friendLabel(f)}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <LibraryItem
      title="Taste Compatibility"
      description="Your taste match score vs. a friend."
      filename="weezer-taste-match.png"
      controls={controls}
    >
      <TasteCompatibilityCardVisual
        songs={songs}
        friends={friends}
        subtitle={subtitle}
        selectedKey={selectedKey}
      />
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
        <Top10CardVisual songs={songs} subtitle={subtitle} />
      </LibraryItem>
      <LibraryItem
        title="Fan Tribe Badge"
        description="Which Weezer tribe do you belong to?"
        filename="my-weezer-tribe.png"
      >
        <TribeBadgeCardVisual songs={songs} triageMap={triageMap} subtitle={subtitle} />
      </LibraryItem>
      <LibraryItem
        title="Era DNA"
        description="Where your taste lives across Weezer history."
        filename="my-weezer-era-dna.png"
      >
        <EraDnaCardVisual songs={songs} subtitle={subtitle} />
      </LibraryItem>
      <CompatibilityLibraryItem songs={songs} friends={friends} subtitle={subtitle} />
    </div>
  );
}
