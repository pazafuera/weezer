'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DownloadPngButton } from './ShareCardShell';
import { exportNodeAsPng } from './exportImage';
import { Top10CardVisual } from './Top10Card';
import type { Bucket, ShareSong } from './Top10Card';
import { TribeBadgeCardVisual } from './TribeBadgeCard';
import { EraDnaCardVisual } from './EraDnaCard';
import { TasteCompatibilityCardVisual } from './TasteCompatibilityCard';
import type { FriendLike } from './TasteCompatibilityCard';

function GalleryItem({
  title,
  description,
  filename,
  visual,
}: {
  title: string;
  description: string;
  filename: string;
  visual: ReactNode;
}) {
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
  return (
    <div className="rounded-2xl bg-slate-900/60 p-5">
      <div className="overflow-hidden rounded-xl" style={{ height: 250 }}>
        <div
          ref={ref}
          style={{ width: 1024, transform: 'scale(0.32)', transformOrigin: 'top left' }}
        >
          {visual}
        </div>
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-100">{title}</h3>
      <p className="mt-1 text-slate-400">{description}</p>
      <div className="mt-3">
        <DownloadPngButton onClick={download} label={busy ? 'Rendering…' : 'Download PNG'} />
      </div>
    </div>
  );
}

export default function ShareablesGallery({
  songs,
  triageMap,
  friends,
}: {
  /** Ranked songs only (already filtered to bucketed songs). */
  songs: ShareSong[];
  triageMap: Record<string, Bucket>;
  friends: FriendLike[];
}) {
  if (songs.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/60 p-10 text-center">
        <p className="text-2xl font-bold text-slate-200">No shareables yet</p>
        <p className="mt-2 text-lg text-slate-400">
          Bucket and rank some songs first — your cards will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <GalleryItem
        title="Top 10 Songs"
        description="Your ranked top 10 as a shareable graphic."
        filename="my-weezer-top-10.png"
        visual={<Top10CardVisual songs={songs} />}
      />
      <GalleryItem
        title="Fan Tribe Badge"
        description="Which Weezer tribe do you belong to?"
        filename="my-weezer-tribe.png"
        visual={<TribeBadgeCardVisual songs={songs} triageMap={triageMap} />}
      />
      <GalleryItem
        title="Era DNA"
        description="Where your taste lives across Weezer history."
        filename="my-weezer-era-dna.png"
        visual={<EraDnaCardVisual songs={songs} />}
      />
      <GalleryItem
        title="Taste Compatibility"
        description="Your taste match score vs. a friend."
        filename="weezer-taste-match.png"
        visual={
          <TasteCompatibilityCardVisual masterList={songs} triageMap={triageMap} friends={friends} />
        }
      />
    </div>
  );
}
