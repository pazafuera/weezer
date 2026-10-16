'use client';

import { useWeezer } from '@/app/context/WeezerContext';
import { ShareablesGallery } from '@/app/components/shareables';
import type { Bucket, ShareSong } from '@/app/components/shareables/Top10Card';
import type { FriendLike } from '@/app/components/shareables/TasteCompatibilityCard';

type WeezerCtx = {
  masterList?: ShareSong[];
  triageMap?: Record<string, Bucket>;
  friendsList?: FriendLike[];
};

/**
 * Standalone /shareables route — deliberately a separate Next.js route (not
 * an AppStep) so it needs zero changes to the step machine, URL resolver,
 * or gating logic.
 *
 * ASSUMPTION: WeezerProvider wraps this route (it lives in app/layout.tsx).
 * If the page renders with no data, wrap it in the provider.
 */
export default function ShareablesPage() {
  const ctx = useWeezer() as unknown as WeezerCtx;
  const masterList = ctx.masterList ?? [];
  const triageMap = ctx.triageMap ?? {};
  const friends = ctx.friendsList ?? [];
  const ranked = masterList.filter((s) => triageMap[s.id]);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-400">
          My Weezer Sweater Thread
        </p>
        <h1 className="mt-2 text-4xl font-black">Shareables</h1>
        <p className="mt-2 text-lg text-slate-400">
          Downloadable cards of your rankings — made for sharing.
        </p>
        <div className="mt-8">
          <ShareablesGallery songs={ranked} triageMap={triageMap} friends={friends} />
        </div>
      </div>
    </main>
  );
}
