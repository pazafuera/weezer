'use client';

import React, { useEffect, useMemo } from 'react';
import { useWeezer, isRealBucket } from '../context/WeezerContext';
import { ALBUMS_BY_ID, ALBUM_NAME_TO_ID, FULL_SONG_POOL } from '../data/constants';
import { ShareablesGallery } from './shareables';
import { displayFont } from './shareables/fonts';

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
 * The tier lists live here as two gallery cards (Songs and Albums,
 * each pinned to its mode; the gallery builds the charts). Their
 * inputs are derived from the same context data Step4Wrapped used:
 * songs carry their triage bucket through so explicitly bucketed
 * songs land in their bucket's tier, and album ranks use the same
 * shrinkage-adjusted bucket-score average as the Wrapped stats
 * (K = 5 toward the global mean).
 */
/** Anchor keys the gallery's full variant stamps on its items
 *  (data-shareable). A dashboard share tile hands one over via
 *  sessionStorage ('weezer-shareables-jump'); anything else in
 *  storage is not a jump and is ignored. */
const SHAREABLE_JUMP_KEYS = [
  'top10',
  'tier-songs',
  'tier-albums',
  'tribe',
  'era-dna',
  'taste-match',
  'game',
];

export default function StepShareables() {
  const { masterList, triageMap, friendCards, userProfile, navigateTo } = useWeezer();

  // Dashboard share-tile jump: consume the handed-over anchor key
  // ONCE on mount (removed as it's read, so an ordinary later
  // visit lands at the top) and scroll the matching library item
  // into view. Items render from context data that's already
  // here, but the fanhood card can settle in a beat late (its
  // record reconciles on mount), so retry on a short ladder —
  // first success wins and later attempts stand down.
  useEffect(() => {
    let key: string | null = null;
    try {
      key = window.sessionStorage.getItem('weezer-shareables-jump');
      if (key) window.sessionStorage.removeItem('weezer-shareables-jump');
    } catch {
      key = null;
    }
    if (!key || !SHAREABLE_JUMP_KEYS.includes(key)) return;
    const jumpKey = key;
    let done = false;
    const attempt = () => {
      if (done) return;
      const el = document.querySelector(`[data-shareable="${jumpKey}"]`);
      if (el) {
        done = true;
        el.scrollIntoView({ block: 'start' });
      }
    };
    const raf = requestAnimationFrame(attempt);
    const t1 = setTimeout(attempt, 150);
    const t2 = setTimeout(attempt, 450);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  // Only real buckets feed the cards — an 'unknown' mark is not a rating.
  const ranked = masterList.filter((s) => isRealBucket(triageMap[s.id]));
  const subtitle = userProfile?.username ? `@${userProfile.username}` : undefined;

  const tierRankings = useMemo(
    () =>
      masterList.map((song, idx) => {
        const bucket = triageMap[song.id];
        return {
          id: song.id,
          title: song.title,
          album: song.album,
          rank: idx + 1,
          // TierListChart's bucket is BucketType-only; unknowns (which
          // can't be in the master list anyway) map to undefined.
          bucket: isRealBucket(bucket) ? bucket : undefined,
        };
      }),
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

  // Tier data for the gallery's two tier cards ("Tier List — Songs"
  // and "Tier List — Albums"). The gallery builds its own fixed-mode
  // charts from this; the old single "Fan Club Tiers" section with
  // its Songs/Albums toggle no longer exists on this page.
  const tierCharts =
    ranked.length > 0
      ? {
          title: 'All My Favorite Songs: The Weezer Song Ranking Project',
          subtitle: `${displayName}'s Personal Tier List`,
          username: userProfile?.username,
          rankedSongs: tierRankings,
          rankedAlbums,
        }
      : undefined;

  return (
    /* The dashboard's page backdrop, same bleed treatment as
       StepGarage2's root: negative margins match AppShell's main
       padding at each breakpoint and the inner wrapper restores
       the inset. */
    <div
      className="-mx-4 -my-4 bg-[#DCEEF8] sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-24 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        {/* No in-page exit pill: the "← Dashboard" pill that
            sat here was removed app-wide at the owner's call
            (Oct 19) — the app menu is the way to the dashboard. */}
        <div>
          <h1
            className={`${displayFont.className} text-[clamp(26px,5vw,34px)] leading-none tracking-wide text-[#0C1220]`}
          >
            Shareables
          </h1>
          <p className="mt-1 text-[14.5px] font-semibold leading-snug text-[#3D4A63]">
            Your asset library — view, save, and share your cards
          </p>
        </div>

        <ShareablesGallery
          songs={ranked}
          triageMap={triageMap}
          friends={friendCards ?? []}
          subtitle={subtitle}
          tierCharts={tierCharts}
          onStartSorting={() => navigateTo('triage')}
          onFindFriends={() => navigateTo('friends')}
        />
      </div>
    </div>
  );
}
