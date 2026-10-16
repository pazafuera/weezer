'use client';

import React, { useMemo } from 'react';
import { useWeezer } from '../context/WeezerContext';
import { ALBUMS_BY_ID, ALBUM_NAME_TO_ID, FULL_SONG_POOL } from '../data/constants';
import TierListChart from './TierListChart';
import { ShareablesGallery } from './shareables';

const BUCKET_POINTS: Record<string, number> = {
  banger: 5,
  slaps: 4,
  mid: 3,
  skip: 2,
  trash: 1,
};

/**
 * The Shareables asset library as a first-class app step (dashboard card,
 * menu item, and the end of the Sweater Thread all lead here / embed it).
 *
 * The Fan Club Tiers chart lives here now (moved out of the Sweater
 * Thread). Its inputs are derived from the same context data Step4Wrapped
 * used: songs carry their triage bucket through so explicitly bucketed
 * songs land in their bucket's tier, and album ranks use the same
 * shrinkage-adjusted bucket-score average as the Wrapped stats
 * (K = 5 toward the global mean).
 */
export default function StepShareables() {
  const { masterList, triageMap, friendsList, userProfile } = useWeezer();
  const ranked = masterList.filter((s) => triageMap[s.id]);
  const subtitle = userProfile?.username ? `@${userProfile.username}` : undefined;

  const tierRankings = useMemo(
    () =>
      masterList.map((song, idx) => ({
        id: song.id,
        title: song.title,
        album: song.album,
        rank: idx + 1,
        bucket: triageMap[song.id],
      })),
    [masterList, triageMap]
  );

  const rankedAlbums = useMemo(() => {
    const albumScores: Record<
      string,
      { id: string; name: string; total: number; count: number }
    > = {};
    let totalScore = 0;
    let totalCount = 0;
    FULL_SONG_POOL.forEach((s) => {
      const bucket = triageMap[s.id];
      if (!bucket) return;
      const score = BUCKET_POINTS[bucket];
      if (score === undefined) return;
      totalScore += score;
      totalCount++;
      const resolvedId = s.albumId || ALBUM_NAME_TO_ID[s.album] || 'unknown';
      if (!albumScores[resolvedId]) {
        albumScores[resolvedId] = {
          id: resolvedId,
          name: ALBUMS_BY_ID[resolvedId]?.name || s.album,
          total: 0,
          count: 0,
        };
      }
      albumScores[resolvedId].total += score;
      albumScores[resolvedId].count += 1;
    });
    const priorMean = totalCount > 0 ? totalScore / totalCount : 3;
    const SHRINKAGE_K = 5;
    return Object.values(albumScores)
      .map((a) => {
        const rawMean = a.total / a.count;
        const adjusted =
          (a.count / (a.count + SHRINKAGE_K)) * rawMean +
          (SHRINKAGE_K / (a.count + SHRINKAGE_K)) * priorMean;
        return { id: a.id, album: a.name, rank: 0, score: adjusted };
      })
      .sort((x, y) => y.score - x.score)
      .map((a, idx) => ({ id: a.id, album: a.album, rank: idx + 1 }));
  }, [triageMap]);

  const displayName = useMemo(() => {
    if (!userProfile?.displayName) return 'A Fan';
    const parts = userProfile.displayName.trim().split(' ');
    if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return parts[0];
  }, [userProfile]);

  const tierSection =
    ranked.length > 0 ? (
      <div className="mt-6 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="font-black text-lg text-slate-950 leading-tight">
            Fan Club Tiers
          </h3>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            Your full tier list — songs or albums. Moved here from the
            Sweater Thread.
          </p>
        </div>
        <TierListChart
          title="All My Favorite Songs: The Weezer Song Ranking Project"
          subtitle={`${displayName}'s Personal Tier List`}
          username={userProfile?.username}
          rankedSongs={tierRankings}
          rankedAlbums={rankedAlbums}
        />
      </div>
    ) : null;

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="pt-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Shareables
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Your asset library — view, save, and share your cards
          </p>
        </div>

        <ShareablesGallery
          songs={ranked}
          triageMap={triageMap}
          friends={friendsList ?? []}
          subtitle={subtitle}
          tierSection={tierSection}
        />
      </div>
    </div>
  );
}
