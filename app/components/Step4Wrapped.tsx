'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import {
  useWeezer,
  isRealBucket,
  countBucketedSongs,
} from '../context/WeezerContext';
import type { TriageValue } from '../context/WeezerContext';
import {
  Song,
  BucketType,
  FULL_SONG_POOL,
  ALBUMS_BY_ID,
  ALBUM_NAME_TO_ID,
} from '../data/constants';
import { FlyingWIcon, AlbumArtwork } from './SharedUI';
import { encodeShareData } from '@/utils/shareHelper';
import { ShareablesGallery } from './shareables';
import {
  ARCHETYPE_MODEL_VERSION,
  ARCHETYPE_VIBES,
  normalizeUserVector,
  scoreArchetypes,
} from '../lib/archetypes';
import { isLoreUnlocked, youreAtPhrase } from '../data/loreGame';
import { fanhoodDisplay, useFanhood } from '../lib/fanhood';

// Bucket scores for the Fan Club Tiers album derivation below
// (mirrors StepShareables).
const TIER_BUCKET_POINTS: Record<string, number> = {
  banger: 5,
  slaps: 4,
  mid: 3,
  skip: 2,
  trash: 1,
};

// STATISTICAL HELPER: Kendall's Tau (Rank Agreement)
function calculateKendallTau(
  userRankMap: Map<string, number>,
  communityRankMap: Map<string, number>
): { tau: number; sampleSize: number } {
  const comparableIds = Array.from(userRankMap.keys()).filter((id) =>
    communityRankMap.has(id)
  );

  const n = comparableIds.length;
  if (n < 2) return { tau: 0, sampleSize: n };

  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const userI = userRankMap.get(comparableIds[i])!;
      const userJ = userRankMap.get(comparableIds[j])!;
      const communityI = communityRankMap.get(comparableIds[i])!;
      const communityJ = communityRankMap.get(comparableIds[j])!;

      const userOrder = userI < userJ ? -1 : 1;
      const communityOrder = communityI < communityJ ? -1 : 1;

      if (userOrder === communityOrder) concordant++;
      else discordant++;
    }
  }

  const totalComparablePairs = concordant + discordant;

  return {
    tau:
      totalComparablePairs > 0
        ? (concordant - discordant) / totalComparablePairs
        : 0,
    sampleSize: n,
  };
}

type RankComparison = {
  song: Song;
  userRank: number;
  communityRank: number;
  userPercentile: number;
  communityPercentile: number;
  difference: number;
  absoluteDifference: number;
};

type RankClash = {
  song: Song;
  uRank: number;
  cRank: number;
  difference: number;
  cPercentile: number;
} | null;

/**
 * THE single derivation of the Betrayal / Hidden Gem clash cards.
 * Both cards come from here and nowhere else, fed by the one
 * rankedComparisons memo — every render of the Sweater Thread agrees
 * because there is exactly one source. (An earlier "inconsistency"
 * report traced to the community consensus itself arriving
 * asynchronously and changing between snapshots, not to a second
 * derivation — none exists in the codebase.)
 */
function deriveRankClashes(comparisons: RankComparison[]): {
  biggestBetrayal: RankClash;
  hiddenGem: RankClash;
} {
  let biggestBetrayal: RankClash = null;
  let hiddenGem: RankClash = null;

  if (comparisons.length > 0) {
    const betrayalCandidates = comparisons
      .filter((c) => c.difference > 0)
      .sort((a, b) => b.difference - a.difference);

    if (betrayalCandidates[0]) {
      const candidate = betrayalCandidates[0];
      biggestBetrayal = {
        song: candidate.song,
        uRank: candidate.userRank,
        cRank: candidate.communityRank,
        difference: candidate.difference,
        cPercentile: Math.round(candidate.communityPercentile * 100),
      };
    }

    const hiddenGemCandidates = comparisons
      .filter(
        (c) =>
          c.userRank <= 20 &&
          c.difference < 0 &&
          !c.song.title.includes('Beverly Hills') &&
          !c.song.title.includes('Island in the Sun')
      )
      .sort((a, b) => a.difference - b.difference);

    if (hiddenGemCandidates[0]) {
      const candidate = hiddenGemCandidates[0];
      hiddenGem = {
        song: candidate.song,
        uRank: candidate.userRank,
        cRank: candidate.communityRank,
        difference: candidate.difference,
        cPercentile: Math.round(candidate.communityPercentile * 100),
      };
    }
  }

  return { biggestBetrayal, hiddenGem };
}

/**
 * THE FANHOOD STOP — how far back you've gotten, woven into the
 * Thread. Once a fanhood is established (a finished game of Back
 * to the Shack — app/lib/fanhood.ts), the stop shows it: the stop
 * your total has reached, the points, and the rarest answer.
 * Before that, the stop is the invitation: the Thread is where a
 * fan reads who they are, so it's where the game asks to be played
 * (respecting the game's own unlock gate on the way in).
 */
function FanhoodStop({
  triageMap,
}: {
  triageMap: Record<string, TriageValue>;
}) {
  const { navigateTo } = useWeezer();
  const fanhood = useFanhood();
  const display = fanhoodDisplay(fanhood);
  const unlocked = isLoreUnlocked(triageMap);

  if (display) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-300 block mb-3">
          Can You Get Back to the Shack?
        </p>
        <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {youreAtPhrase(display.stop)}
        </h3>
        <p className="mt-2 text-sm font-black text-[#7dd3fc] uppercase tracking-widest">
          {display.depth.toLocaleString()} points
        </p>
        {display.deepest && (
          <p className="mt-4 text-sm font-semibold text-slate-300 leading-relaxed">
            Your rarest answer was {display.deepest.answer} —{' '}
            {display.deepest.depth.toLocaleString()} points.
            <span className="block mt-1 text-xs font-bold text-slate-500">
              {display.deepest.promptLabel}
            </span>
          </p>
        )}
        <button
          onClick={() => navigateTo('lore')}
          className="mt-6 bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm px-6 py-3 rounded-full transition-colors cursor-pointer"
        >
          Keep playing →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-3">
        Can You Get Back to the Shack?
      </p>
      <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
        You haven&apos;t started back yet
      </h3>
      <p className="mt-3 text-sm font-semibold text-slate-500 leading-relaxed max-w-lg mx-auto">
        Five games, seven prompts each, twenty-five seconds a prompt.
        The rarer your answers, the further back you go.
      </p>
      {unlocked ? (
        <button
          onClick={() => navigateTo('lore')}
          className="mt-6 bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm px-6 py-3 rounded-full transition-colors cursor-pointer"
        >
          Play the game →
        </button>
      ) : (
        <>
          <p className="mt-3 text-xs font-bold text-slate-400">
            The game unlocks once you&apos;ve sorted the Blue Album and
            Pinkerton.
          </p>
          <button
            onClick={() => navigateTo('triage')}
            className="mt-5 bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm px-6 py-3 rounded-full transition-colors cursor-pointer"
          >
            Keep sorting →
          </button>
        </>
      )}
    </div>
  );
}

export default function Step4Wrapped({
  masterList,
  triageMap,
  setStep,
  globalConsensus: propGlobalConsensus = [],
}: {
  masterList: Song[];
  triageMap: Record<string, TriageValue>;
  setStep: (
    s: 'master' | 'triage' | 'rank_buckets' | 'wrapped' | 'fan_stats' | 'friends'
  ) => void;
  globalConsensus?: string[];
}) {
  const { userProfile, friendCards } = useWeezer();

  // RATED count for the thin-Thread note below: real buckets only —
  // a "Don't Know It" mark is not a rating and doesn't feed the Thread.
  const ratedCount = countBucketedSongs(triageMap);
  const [activeArchIndex, setActiveArchIndex] = useState(0);
  const [activeEraIndex, setActiveEraIndex] = useState(0);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Fallback DB fetch if globalConsensus isn't passed from parent
  const [fetchedConsensus, setFetchedConsensus] = useState<string[]>([]);
  const [isFetchingDB, setIsFetchingDB] = useState(
    propGlobalConsensus.length === 0
  );

  const archScrollRef = useRef<HTMLDivElement>(null);
  const eraScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propGlobalConsensus.length > 0) {
      setIsFetchingDB(false);
      return;
    }

    const fetchCommunityConsensus = async () => {
      try {
        // Pre-launch security: anonymized aggregate via the
        // get_community_rankings() SECURITY DEFINER function instead of
        // selecting other users' rows directly (blocked by RLS).
        const { data } = await supabase.rpc('get_community_rankings');
        if (data && data.length > 0) {
          const positions: Record<string, number[]> = {};
          FULL_SONG_POOL.forEach((s) => (positions[s.id] = []));

          data.forEach((row: { master_list: Song[] | null }) => {
            if (row.master_list && row.master_list.length > 0) {
              row.master_list.forEach((song: Song, idx: number) => {
                if (positions[song.id]) positions[song.id].push(idx + 1);
              });
            }
          });

          const minRequiredRankings = data.length > 1 ? 1 : 0;

          const ranks = FULL_SONG_POOL.map((s) => {
            const pos = positions[s.id];
            if (!pos || pos.length <= minRequiredRankings) return null;
            const avg = pos.reduce((a, b) => a + b, 0) / pos.length;
            return { id: s.id, avg };
          })
            .filter((r): r is { id: string; avg: number } => r !== null)
            .sort((a, b) => a.avg - b.avg);

          setFetchedConsensus(ranks.map((r) => r.id));
        }
      } catch (err) {
        console.error('Error fetching global consensus fallback:', err);
      } finally {
        setIsFetchingDB(false);
      }
    };

    fetchCommunityConsensus();
  }, [propGlobalConsensus]);

  const activeGlobalConsensus =
    propGlobalConsensus.length > 0 ? propGlobalConsensus : fetchedConsensus;

  // EXPLICITLY RANKED SONGS
  const explicitlyRankedSongs = useMemo(() => {
    return masterList.filter((s) => {
      const bucket = triageMap[s.id];
      return bucket === 'banger' || bucket === 'slaps';
    });
  }, [masterList, triageMap]);

  const top10 = useMemo(
    () => explicitlyRankedSongs.slice(0, 10),
    [explicitlyRankedSongs]
  );

  // EXTRACT FIRST NAME + LAST INITIAL
  const getFormattedName = () => {
    if (!userProfile?.displayName) return 'A Fan';
    const parts = userProfile.displayName.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  };

  const displayNameStr = getFormattedName();

  // FAN CLUB TIERS — derived exactly as StepShareables derives them
  // (same inputs: songs carry their triage bucket through so explicitly
  // bucketed songs land in their bucket's tier; album ranks use the
  // shrinkage-adjusted bucket-score average, K = 5 toward the global
  // mean). The Thread's thumbnail gallery shows the data as TWO items
  // — "Tier List — Songs" and "Tier List — Albums" — each a fixed-mode
  // chart the gallery builds from the tierCharts object below.
  // Only real buckets feed the cards — an 'unknown' mark is not a rating.
  const rankedSongs = masterList.filter((s) => isRealBucket(triageMap[s.id]));

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

  const tierRankedAlbums = useMemo(() => {
    const albumScores: Record<
      string,
      { id: string; name: string; total: number; count: number }
    > = {};
    let totalScore = 0;
    let totalCount = 0;
    FULL_SONG_POOL.forEach((s) => {
      const bucket = triageMap[s.id];
      if (!bucket) return;
      const score = TIER_BUCKET_POINTS[bucket];
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

  const tierCharts =
    rankedSongs.length > 0
      ? {
          title: 'All My Favorite Songs: The Weezer Song Ranking Project',
          subtitle: `${displayNameStr}'s Personal Tier List`,
          username: userProfile?.username,
          rankedSongs: tierRankings,
          rankedAlbums: tierRankedAlbums,
        }
      : undefined;

  // EXPLICIT RANK MAPS
  const userRankMap = useMemo(() => {
    const map = new Map<string, number>();
    explicitlyRankedSongs.forEach((song, index) => {
      map.set(song.id, index + 1);
    });
    return map;
  }, [explicitlyRankedSongs]);

  const communityRankMap = useMemo(() => {
    const map = new Map<string, number>();
    activeGlobalConsensus.forEach((songId, index) => {
      map.set(songId, index + 1);
    });
    return map;
  }, [activeGlobalConsensus]);

  // USER ↔ COMMUNITY COMPARISON SET
  const rankedComparisons = useMemo(() => {
    const userCount = explicitlyRankedSongs.length;
    const communityCount = activeGlobalConsensus.length;

    if (userCount < 1 || communityCount < 1) return [];

    const comparisons: {
      song: Song;
      userRank: number;
      communityRank: number;
      userPercentile: number;
      communityPercentile: number;
      difference: number;
      absoluteDifference: number;
    }[] = [];

    explicitlyRankedSongs.forEach((song) => {
      const userRank = userRankMap.get(song.id);
      const communityRank = communityRankMap.get(song.id);

      if (userRank === undefined || communityRank === undefined) return;

      const userPercentile =
        userCount > 1 ? (userRank - 1) / (userCount - 1) : 0;

      const communityPercentile =
        communityCount > 1 ? (communityRank - 1) / (communityCount - 1) : 0;

      const difference = userPercentile - communityPercentile;

      comparisons.push({
        song,
        userRank,
        communityRank,
        userPercentile,
        communityPercentile,
        difference,
        absoluteDifference: Math.abs(difference),
      });
    });

    return comparisons;
  }, [
    explicitlyRankedSongs,
    userRankMap,
    communityRankMap,
    activeGlobalConsensus.length,
  ]);

  const stats = useMemo(() => {
    const points: Record<BucketType, number> = {
      banger: 5,
      slaps: 4,
      mid: 3,
      skip: 2,
      trash: 1,
    };

    let totalTriageScore = 0;
    let totalValidSongs = 0;
    let trashCount = 0;

    let classicSum = 0,
      classicCount = 0;
    let modernSum = 0,
      modernCount = 0;

    let centeredReleaseYearSum = 0;
    let totalCenteredWeight = 0;

    const albumScores: Record<
      string,
      {
        id: string;
        name: string;
        total: number;
        count: number;
        color: string;
        scores: number[];
      }
    > = {};

    FULL_SONG_POOL.forEach((s) => {
      const bucket = triageMap[s.id];
      // 'unknown' ("Don't Know It") is not a rating: skip it before the
      // points lookup, where it would read undefined and poison every
      // total in this memo with NaN.
      if (!bucket || bucket === 'unknown') return;

      const score = points[bucket];
      totalTriageScore += score;
      totalValidSongs++;

      if (bucket === 'trash') trashCount++;

      if (s.year <= 1999) {
        classicSum += score;
        classicCount++;
      }

      if (s.year >= 2014) {
        modernSum += score;
        modernCount++;
      }

      const centeredWeight = Math.max(0, score - 3);

      if (centeredWeight > 0) {
        centeredReleaseYearSum += s.year * centeredWeight;
        totalCenteredWeight += centeredWeight;
      }

      const resolvedId = s.albumId || ALBUM_NAME_TO_ID[s.album] || 'unknown';

      if (!albumScores[resolvedId]) {
        const albumMeta = ALBUMS_BY_ID[resolvedId];

        albumScores[resolvedId] = {
          id: resolvedId,
          name: albumMeta ? albumMeta.name : s.album,
          total: 0,
          count: 0,
          color: s.albumColor || 'bg-slate-500',
          scores: [],
        };
      }

      albumScores[resolvedId].total += score;
      albumScores[resolvedId].count += 1;
      albumScores[resolvedId].scores.push(score);
    });

    const globalPriorMean =
      totalValidSongs > 0 ? totalTriageScore / totalValidSongs : 3;

    const haterPercent = totalValidSongs > 0 ? trashCount / totalValidSongs : 0;

    const globalPositivity = (globalPriorMean - 1) / 4;

    const classicAverage = classicCount ? classicSum / classicCount : 0;

    const modernAverage = modernCount ? modernSum / modernCount : 0;

    const SHRINKAGE_K = 5;

    const rankedAlbums = Object.entries(albumScores)
      .map(([albumId, data]) => {
        const rawMean = data.total / data.count;

        const adjustedScore =
          (data.count / (data.count + SHRINKAGE_K)) * rawMean +
          (SHRINKAGE_K / (data.count + SHRINKAGE_K)) * globalPriorMean;

        const variance =
          data.scores.reduce(
            (acc, val) => acc + Math.pow(val - rawMean, 2),
            0
          ) / data.count;

        return {
          id: albumId,
          name: data.name,
          score: adjustedScore,
          rawScore: rawMean,
          color: data.color,
          count: data.count,
          stdDev: Math.sqrt(variance),
        };
      })
      .sort((a, b) => b.score - a.score);

    const mostConsistentAlbum =
      rankedAlbums
        .filter((a) => a.count >= 8 && a.rawScore >= 3.8)
        .sort((a, b) => a.stdDev - b.stdDev)[0] || null;

    const currentYear = new Date().getFullYear();

    const sentimentWeightedYear =
      totalCenteredWeight > 0
        ? centeredReleaseYearSum / totalCenteredWeight
        : currentYear;

    const listeningAge = Math.round(14 + (currentYear - sentimentWeightedYear));

    // USER ↔ COMMUNITY CLASHES — single derivation (deriveRankClashes)
    const { biggestBetrayal, hiddenGem } = deriveRankClashes(rankedComparisons);

    // EXPLICIT RANKING ANALYTICS
    const allEras = [
      {
        id: 'classic',
        name: 'The Classic Era',
        subtitle: 'Blue, Pinkerton & B-Sides',
        min: 1994,
        max: 1999,
        mid: 1996,
        years: '1994–1999',
        color: 'bg-[#0072CE]',
        text: 'text-white',
      },
      {
        id: 'reunion',
        name: 'The Reunion Era',
        subtitle: 'Green, Maladroit, Make Believe',
        min: 2000,
        max: 2007,
        mid: 2003,
        years: '2000–2007',
        color: 'bg-emerald-600',
        text: 'text-white',
      },
      {
        id: 'wildwest',
        name: 'The Wild West',
        subtitle: 'Red, Raditude, Hurley',
        min: 2008,
        max: 2013,
        mid: 2010,
        years: '2008–2013',
        color: 'bg-red-600',
        text: 'text-white',
      },
      {
        id: 'renaissance',
        name: 'The Renaissance',
        subtitle: 'EWBAITE, White, Pacific Daydream',
        min: 2014,
        max: 2019,
        mid: 2016,
        years: '2014–2019',
        color: 'bg-orange-500',
        text: 'text-white',
      },
      {
        id: 'modern',
        name: 'The Modern Era',
        subtitle: 'OK Human, Van Weezer, SZNZ',
        min: 2020,
        max: 2023,
        mid: 2021,
        years: '2020–2023',
        color: 'bg-purple-600',
        text: 'text-white',
      },
      {
        id: 'gold',
        name: 'The Gold Era',
        subtitle: 'The Gold Album & Beyond',
        min: 2024,
        max: 2030,
        mid: 2026,
        years: '2024–Present',
        color: 'bg-amber-400',
        text: 'text-amber-950',
      },
    ];

    const eraWeights: Record<string, number> = {
      classic: 0,
      reunion: 0,
      wildwest: 0,
      renaissance: 0,
      modern: 0,
      gold: 0,
    };

    let totalRankWeight = 0;
    let rankedDeepCutCount = 0;

    const temporalBins = {
      '90s': 0,
      '00s': 0,
      '10s': 0,
      '20s': 0,
    };

    explicitlyRankedSongs.forEach((s, idx) => {
      const weight = 1 / Math.sqrt(idx + 1);

      totalRankWeight += weight;

      const era = allEras.find((e) => s.year >= e.min && s.year <= e.max);

      if (era) eraWeights[era.id] += weight;

      if (
        s.isBSide ||
        (s.year > 1996 &&
          ![
            'Hash Pipe',
            'Beverly Hills',
            'Island in the Sun',
            'Pork and Beans',
          ].includes(s.title))
      ) {
        rankedDeepCutCount++;
      }

      if (s.year <= 1999) temporalBins['90s']++;
      else if (s.year <= 2009) temporalBins['00s']++;
      else if (s.year <= 2019) temporalBins['10s']++;
      else temporalBins['20s']++;
    });

    const deepCutRatio =
      explicitlyRankedSongs.length > 0
        ? rankedDeepCutCount / explicitlyRankedSongs.length
        : 0;

    const sortedEras = allEras
      .map((e) => ({
        ...e,
        matchScore:
          totalRankWeight > 0
            ? Math.round((eraWeights[e.id] / totalRankWeight) * 100)
            : 0,
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    // KENDALL'S TAU & INDEPENDENCE INDEX
    const { tau, sampleSize: rankComparisonSampleSize } = calculateKendallTau(
      userRankMap,
      communityRankMap
    );

    const hotTakeScore =
      rankComparisonSampleSize >= 2 ? Math.round(((1 - tau) / 2) * 100) : 50;

    const averageRankDifference =
      rankedComparisons.length > 0
        ? rankedComparisons.reduce((sum, c) => sum + c.absoluteDifference, 0) /
          rankedComparisons.length
        : 0;

    const independenceIndex =
      rankedComparisons.length >= 2
        ? Math.min(99, Math.max(1, Math.round(1 + averageRankDifference * 98)))
        : null;

    // THE CORE FOUR
    const coreFour: {
      label: string;
      song: Song;
      desc: string;
    }[] = [];

    if (top10[0]) {
      coreFour.push({
        label: 'The Anchor',
        song: top10[0],
        desc: 'Your undisputed favorite.',
      });
    }

    const topDeepCut = explicitlyRankedSongs.find(
      (s) =>
        s.isBSide ||
        (s.year > 1996 &&
          ![
            'Hash Pipe',
            'Beverly Hills',
            'Island in the Sun',
            'Pork and Beans',
          ].includes(s.title))
    );

    if (topDeepCut && !coreFour.some((c) => c.song.id === topDeepCut.id)) {
      coreFour.push({
        label: 'The Deep Cut',
        song: topDeepCut,
        desc: 'Your highest-rated rarity.',
      });
    }

    if (hiddenGem && !coreFour.some((c) => c.song.id === hiddenGem!.song.id)) {
      coreFour.push({
        label: 'The Defender',
        song: hiddenGem.song,
        desc: 'Your controversial darling.',
      });
    }

    const topEraSong = explicitlyRankedSongs.find(
      (s) =>
        !coreFour.some((c) => c.song.id === s.id) &&
        s.year >= sortedEras[0].min &&
        s.year <= sortedEras[0].max
    );

    if (topEraSong) {
      coreFour.push({
        label: 'The Era Definer',
        song: topEraSong,
        desc: `Peak ${sortedEras[0].name}.`,
      });
    }

    explicitlyRankedSongs.forEach((s) => {
      if (coreFour.length < 4 && !coreFour.some((c) => c.song.id === s.id)) {
        coreFour.push({
          label: 'The Essential',
          song: s,
          desc: 'A pillar of your catalog.',
        });
      }
    });

    // THE GREAT DEBATE
    const blueAlbum = rankedAlbums.find((a) => a.id === 'blue');
    const pinkAlbum = rankedAlbums.find((a) => a.id === 'pinkerton');

    const blueScore = blueAlbum ? blueAlbum.score : 0;
    const pinkScore = pinkAlbum ? pinkAlbum.score : 0;

    const diff = pinkScore - blueScore;

    const tugOfWarPct = Math.min(100, Math.max(0, 50 + diff * 25));

    let persona = "The '94–'96 Dualist";

    if (diff < -0.15) persona = 'Blue Album Purist';
    else if (diff > 0.15) persona = 'Pinkerton Cultist';

    let debateDescriptor: React.ReactNode = '';

    if (diff <= -1.5)
      debateDescriptor = (
        <>
          You look <strong>JUST</strong> like Buddy Holly.
        </>
      );
    else if (diff <= -0.8)
      debateDescriptor = "You're taking your board to work. Peak 1994.";
    else if (diff <= -0.3)
      debateDescriptor = 'You definitely have a poster of KISS on your wall.';
    else if (diff < -0.05)
      debateDescriptor = 'You look a little bit like Buddy Holly.';
    else if (diff <= 0.05)
      debateDescriptor =
        'You want to destroy your sweater while falling in love all over again.';
    else if (diff < 0.3)
      debateDescriptor =
        "It's been only a day or two since you were out on the floor.";
    else if (diff < 0.8)
      debateDescriptor =
        'You are writing a letter to a fan in Japan right now.';
    else if (diff < 1.5)
      debateDescriptor = "You see a lot in little ol' 3-chord me.";
    else debateDescriptor = "You don't wanna be an old man anymore.";

    // ARCHETYPES — frozen model v1.0 lives in app/lib/archetypes.ts.
    // Do not retune here; a model change ships as a new version there.
    const userVector = normalizeUserVector({
      classicAverage,
      modernAverage,
      deepCutRatio,
      globalPositivity,
      hotTakeScore,
    });

    const scoredArchetypes = scoreArchetypes(userVector);

    const primaryArchetype = scoredArchetypes[0]?.id || 'scientist';

    let finalGif = ARCHETYPE_VIBES[primaryArchetype] || ARCHETYPE_VIBES['scientist'];
    const topSongTitle = top10[0]?.title || '';

    if (topSongTitle === 'Island in the Sun') {
      finalGif = '/img/vibes/island-in-the-sun.webp';
    } else if (topSongTitle === 'Keep Fishin' || sortedEras[0]?.id === 'reunion') {
      finalGif = '/img/vibes/keep-fishin.gif';
    } else if (sortedEras[0]?.id === 'gold' || modernAverage > 4.3) {
      finalGif = '/img/vibes/gold.webp';
    }

    // TASTE DNA
    const timelineVal =
      classicAverage + modernAverage > 0
        ? Math.round((modernAverage / (classicAverage + modernAverage)) * 100)
        : 50;

    const sonicVibeVal = Math.round(
      (blueScore / (blueScore + pinkScore || 1)) * 100
    );

    const dnaScores = [
      {
        label: 'Timeline',
        left: "Classic '90s",
        right: 'Modern',
        value: timelineVal,
        color: 'bg-[#0072CE]',
        desc: 'How your average ratings split between classic-era and modern-era songs.',
      },
      {
        label: 'Sonic Vibe',
        left: 'Abrasive / Raw',
        right: 'Polished Pop',
        value: sonicVibeVal,
        color: 'bg-purple-500',
        desc: "How your ratings split between the Blue Album's polish and Pinkerton's rawness.",
      },
      {
        label: 'Track Depth',
        left: 'Singles',
        right: 'Deep Cuts',
        value: Math.round(deepCutRatio * 100),
        color: 'bg-amber-500',
        desc: 'How much of what you ranked is B-sides and deep cuts rather than the big singles.',
      },
      {
        label: 'Fandom Strictness',
        left: 'Lover',
        right: 'Critic',
        value: Math.round(haterPercent * 100),
        color: 'bg-slate-700',
        desc: 'The share of the songs you rated that you put in Trash.',
      },
    ];

    // THE ROAST — kind, data-driven, and only when it's true. "Known"
    // means real buckets only (totalValidSongs already excludes
    // 'unknown' marks). Casual fans get a shareable identity here,
    // not a failure state; deep catalog knowledge gets no roast.
    const knownCount = totalValidSongs;
    const knownBluePinkCount =
      (blueAlbum?.count ?? 0) + (pinkAlbum?.count ?? 0);
    let roastLine: string | null = null;
    if (
      knownCount > 0 &&
      knownBluePinkCount / knownCount >= 0.7 &&
      knownCount / FULL_SONG_POOL.length < 0.85
    ) {
      roastLine =
        'Your Weezer knowledge starts in 1994 and ends in 1996. The other albums are just rumors to you.';
    } else if (
      knownCount > 0 &&
      knownCount / FULL_SONG_POOL.length < 0.4
    ) {
      roastLine =
        "You've got the hits down cold. The deep cuts are still out there — they've waited 20 years, they can wait a little longer.";
    }

    return {
      rankedAlbums,
      roastLine,
      allEras,
      sortedEras,
      listeningAge,
      blueScore,
      pinkScore,
      diff,
      tugOfWarPct,
      persona,
      debateDescriptor,
      hotTakeScore,
      independenceIndex,
      biggestBetrayal,
      hiddenGem,
      mostConsistentAlbum,
      scoredArchetypes,
      dnaScores,
      finalGif,
      explicitCount: explicitlyRankedSongs.length,
      rankComparisonSampleSize,
      coreFour,
      temporalBins,
    };
  }, [
    explicitlyRankedSongs,
    triageMap,
    top10,
    userRankMap,
    communityRankMap,
    activeGlobalConsensus.length,
    rankedComparisons,
  ]);

  // AGE DELTA COMMENTARY
  const ageComment = useMemo(() => {
    const birthYear = userProfile?.birthYear;
    if (!birthYear) return null;

    const currentYear = new Date().getFullYear();
    const actualAge = currentYear - birthYear;
    const delta = stats.listeningAge - actualAge;

    if (delta <= -8) {
      return `Aging in reverse! You're ${actualAge}, but your ears are happily stuck in your youthful age of ${stats.listeningAge}.`;
    } else if (delta < -2) {
      return `Slightly younger musical spirit! At ${actualAge}, your playlist carries the energy of a ${stats.listeningAge}-year-old.`;
    } else if (Math.abs(delta) <= 2) {
      return `Spot on! At ${actualAge}, your musical clock matches your birth certificate almost perfectly.`;
    } else if (delta <= 8) {
      return `A fine vintage! At ${actualAge}, you carry the refined taste of a ${stats.listeningAge}-year-old music scholar.`;
    } else {
      return `An old soul (or exceptionally well-raised!). You're ${actualAge}, but your ears belong to a ${stats.listeningAge}-year-old veteran.`;
    }
  }, [userProfile?.birthYear, stats.listeningAge]);

  const handleArchScroll = () => {
    if (!archScrollRef.current) return;
    const firstChild = archScrollRef.current.children[0];
    if (!firstChild) return;
    const index = Math.round(
      archScrollRef.current.scrollLeft / (firstChild as HTMLElement).clientWidth
    );
    setActiveArchIndex(
      Math.max(0, Math.min(stats.scoredArchetypes.length, index))
    );
  };

  const handleEraScroll = () => {
    if (!eraScrollRef.current) return;
    const firstChild = eraScrollRef.current.children[0];
    if (!firstChild) return;
    const index = Math.round(
      eraScrollRef.current.scrollLeft / (firstChild as HTMLElement).clientWidth
    );
    setActiveEraIndex(Math.max(0, Math.min(stats.sortedEras.length, index)));
  };

  const scrollToArch = (index: number) => {
    if (!archScrollRef.current) return;
    const firstChild = archScrollRef.current.children[0];
    if (!firstChild) return;
    const offset = index * (firstChild as HTMLElement).clientWidth;
    archScrollRef.current.scrollTo({ left: offset, behavior: 'smooth' });
  };

  const scrollToEra = (index: number) => {
    if (!eraScrollRef.current) return;
    const firstChild = eraScrollRef.current.children[0];
    if (!firstChild) return;
    const offset = index * (firstChild as HTMLElement).clientWidth;
    eraScrollRef.current.scrollTo({ left: offset, behavior: 'smooth' });
  };

  if (isFetchingDB) {
    return (
      <div className="py-24 text-center space-y-3 bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-500">
          Unraveling the Sweater Thread...
        </p>
      </div>
    );
  }

  const displayedAlbums = showAllAlbums
    ? stats.rankedAlbums
    : stats.rankedAlbums.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-6 sm:py-8 lg:py-12 px-3 sm:px-6 relative overflow-hidden selection:bg-[#0072CE] selection:text-white">
      {/* AMBIENT BACKGROUND GLOW */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
        <div className="absolute -top-40 -left-40 w-[700px] h-[600px] bg-blue-100 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[600px] bg-amber-100 rounded-full blur-[160px]" />
      </div>

      {/* UNWRAPPED STRUCTURAL MAIN CONTAINER */}
      <main className="relative z-10 w-full max-w-7xl mx-auto space-y-8 sm:space-y-12">
        {/* TOP NAVIGATION */}
        <div className="flex items-center justify-between px-2 pt-2">
          <button
            onClick={() => setStep('master')}
            className="text-xs font-black text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            ← Edit Final Rankings
          </button>

          <button
            onClick={() => setStep('fan_stats')}
            className="text-xs font-black text-[#0072CE] hover:text-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
          >
            Fan Stats →
          </button>
        </div>

        {/* HEADER */}
        <div className="text-center px-4">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tighter mb-2">
            The Sweater <span className="text-[#0072CE]">Thread</span>
          </h1>

          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap truncate">
            Your Weezer Taste, Unraveled.
          </p>
        </div>

        {/* THIN-THREAD NOTE — when the Thread is compiled from fewer
            than 25 rated songs, the page says so up top, before the
            cards: a Thread on a handful of ratings is a sketch, and
            it sharpens as more songs get sorted. Plain, not
            apologetic. At 25+ rated the note does not render. */}
        {ratedCount < 25 && (
          <div className="max-w-2xl mx-auto w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-center shadow-xs">
            <p className="text-sm font-semibold text-slate-600 leading-relaxed">
              This Thread is built on the {ratedCount} song
              {ratedCount === 1 ? '' : 's'} you&apos;ve rated so far. It
              sharpens as you sort more.{' '}
              <button
                onClick={() => setStep('triage')}
                className="font-black text-[#0072CE] hover:underline cursor-pointer"
              >
                Keep sorting →
              </button>
            </p>
          </div>
        )}

        {/* 1. HERO ROW: ANTHEM + VIBE ENCAPSULATED */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* ANTHEM CARD */}
          <div className="lg:col-span-7 bg-gradient-to-b from-[#0072CE] via-[#005fA3] to-slate-900 rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-[#0072CE]/30 relative overflow-hidden flex flex-col justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block mb-4">
              Your Anthem
            </span>

            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-tight mb-3 drop-shadow-lg">
              "{top10[0]?.title || 'Undecided'}"
            </h2>

            {top10[0] && (
              <p className="text-sm font-bold text-blue-200 uppercase tracking-widest">
                {ALBUMS_BY_ID[
                  top10[0].albumId || ALBUM_NAME_TO_ID[top10[0].album]
                ]?.name || top10[0].album}{' '}
                ({top10[0].year})
              </p>
            )}
          </div>

          {/* VIBE ENCAPSULATED CARD */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-center flex flex-col justify-center overflow-hidden">
            <h3 className="text-2xl font-black text-white tracking-tight mb-4">
              Your Vibe, Encapsulated
            </h3>

            <div className="w-full aspect-video rounded-2xl overflow-hidden border-4 border-slate-800 shadow-inner bg-slate-900 flex-1">
              <img
                src={stats.finalGif}
                alt="Weezer Vibe"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 2. ARCHETYPES CAROUSEL */}
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight truncate">
                Fandom Archetype
              </h3>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                For fun — archetype model v{ARCHETYPE_MODEL_VERSION}
              </p>
            </div>

            {/* Desktop Carousel Arrows */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => scrollToArch(Math.max(0, activeArchIndex - 1))}
                disabled={activeArchIndex === 0}
                className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-slate-200 shadow-xs"
              >
                ←
              </button>
              <button
                onClick={() =>
                  scrollToArch(
                    Math.min(stats.scoredArchetypes.length, activeArchIndex + 1)
                  )
                }
                disabled={activeArchIndex === stats.scoredArchetypes.length}
                className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-slate-200 shadow-xs"
              >
                →
              </button>
            </div>
          </div>

          <div
            ref={archScrollRef}
            onScroll={handleArchScroll}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-2 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-stretch"
          >
            {stats.scoredArchetypes.map((arch, idx) => (
              <React.Fragment key={arch.id}>
                <div
                  className={`w-[88vw] sm:w-[380px] lg:w-[420px] shrink-0 snap-center rounded-3xl p-6 sm:p-8 text-center border-2 transition-all relative overflow-hidden flex flex-col justify-center ${
                    idx === 0
                      ? 'bg-slate-900 text-white border-[#0072CE] shadow-xl'
                      : 'bg-white border-slate-200 text-slate-900 shadow-xs opacity-90'
                  }`}
                >
                  {idx === 0 ? (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-widest z-10 whitespace-nowrap">
                      Your Match
                    </div>
                  ) : (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-100 text-slate-700 text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest shadow-2xs z-10 whitespace-nowrap border border-slate-200">
                      {Math.round(arch.score)}% Similarity
                    </div>
                  )}

                  <div
                    className={`text-6xl ${
                      idx === 0 ? 'mb-6 mt-8' : 'mb-4 mt-8'
                    } drop-shadow-sm`}
                  >
                    {arch.emoji}
                  </div>

                  <h3
                    className={`text-2xl font-black mb-3 tracking-tight truncate ${
                      idx === 0 ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {arch.name}
                  </h3>

                  <p className={`text-sm font-bold leading-relaxed px-2 ${
                    idx === 0 ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {arch.desc}
                  </p>
                </div>

                {idx === 0 && (
                  <div
                    onClick={() => scrollToArch(1)}
                    className="w-[30vw] sm:w-[140px] shrink-0 snap-center rounded-3xl flex flex-col items-center justify-center border-2 border-slate-200 bg-white text-slate-600 cursor-pointer hover:bg-slate-100 transition-all shadow-2xs"
                  >
                    <span className="text-3xl mb-3">👀</span>
                    <span className="text-xs font-black uppercase tracking-widest text-center leading-snug">
                      Explore
                      <br />
                      Other
                      <br />
                      Matches
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 mb-4">
            {Array.from({
              length: stats.scoredArchetypes.length + 1,
            }).map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToArch(i)}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  activeArchIndex === i
                    ? 'w-8 bg-[#0072CE]'
                    : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* THE CORE FOUR */}
        {stats.coreFour.length === 4 && (
          <div className="bg-white text-slate-950 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-2xl sm:text-3xl font-black text-center text-slate-950 mb-3 tracking-tight truncate">
              The Core Four
            </h3>

            <p className="text-xs font-bold text-center text-slate-500 mb-8 max-w-sm mx-auto">
              If your Weezer fandom was a Mount Rushmore, these are the four
              distinct tracks carving out your identity.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.coreFour.map((item, i) => {
                const resolvedId =
                  item.song.albumId ||
                  ALBUM_NAME_TO_ID[item.song.album] ||
                  'unknown';

                return (
                  <div key={i} className="flex flex-col text-center group">
                    <div className="w-full aspect-square rounded-xl shadow-md overflow-hidden mb-3 border border-slate-200 relative bg-slate-800 group-hover:scale-105 transition-transform duration-300">
                      <AlbumArtwork
                        albumId={resolvedId}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />

                      <div className="absolute bottom-2 left-2 right-2 text-left">
                        <span className="text-[9px] font-black uppercase text-amber-400 block tracking-wider drop-shadow-md">
                          {item.label}
                        </span>

                        <h4 className="text-sm font-black text-white drop-shadow-md leading-tight">
                          {item.song.title}
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-slate-500 leading-snug px-1">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. TASTE DNA & 4. THE GREAT DEBATE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* TASTE DNA */}
          <div className="bg-white text-slate-950 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-center mb-8">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2 truncate">
                  Taste DNA
                </h3>

                <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">
                  The underlying traits and biases driving your rankings. Tap to
                  reveal definitions.
                </p>
              </div>

              <div className="space-y-6 max-w-md mx-auto pt-2">
                {stats.dnaScores.map((score) => (
                  <div key={score.label} className="relative">
                    <div
                      className="flex flex-col cursor-pointer group"
                      onClick={() =>
                        setActiveTooltip(
                          activeTooltip === score.label ? null : score.label
                        )
                      }
                    >
                      <div className="text-center mb-2">
                        <span className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-widest inline-flex items-center gap-1.5 group-hover:text-[#0072CE] transition-colors">
                          {score.label}

                          <svg
                            className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0072CE]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </span>
                      </div>

                      <div className="relative w-full h-1.5 bg-slate-200 rounded-full my-1">
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full shadow-md border-[3px] border-white transition-all duration-1000 z-10 ${score.color}`}
                          style={{
                            left: `calc(${score.value}% - 10px)`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between mt-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {score.left}
                        </span>

                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {score.right}
                        </span>
                      </div>
                    </div>

                    {activeTooltip === score.label && (
                      <div className="bg-slate-900 text-white text-[10px] font-bold p-3 rounded-xl mt-3 shadow-lg animate-in fade-in slide-in-from-top-2 relative z-20 text-center">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                        {score.desc}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* THE GREAT DEBATE */}
          <div className="bg-white text-slate-950 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-center text-slate-950 mb-3 tracking-tight truncate">
                The Great Debate
              </h3>

              <p className="text-xs font-bold text-center text-slate-500 mb-10 max-w-xs mx-auto">
                The ultimate dividing line. Do you prefer the tight pop hooks of
                Blue, or the abrasive confessional of Pinkerton?
              </p>

              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black text-[#0072CE] uppercase tracking-widest w-1/4 text-center">
                  Blue
                </h4>

                <h4 className="text-xs font-black text-[#8C6239] uppercase tracking-widest w-1/4 text-center">
                  Pinkerton
                </h4>
              </div>

              <div className="relative h-6 bg-slate-100 rounded-full mb-8 border border-slate-200 flex items-center mt-2 mx-4">
                <div className="absolute left-1/2 top-[-10px] bottom-[-10px] w-[3px] bg-slate-300 z-0 -translate-x-1/2 rounded-full" />

                <div className="absolute left-0 w-6 h-6 bg-[#0072CE] rounded-full z-10 -translate-x-3 shadow-md border-2 border-white" />

                <div className="absolute right-0 w-6 h-6 bg-[#8C6239] rounded-full z-10 translate-x-3 shadow-md border-2 border-white" />

                {stats.tugOfWarPct < 50 && (
                  <div
                    className="absolute h-full bg-[#0072CE] z-0 transition-all duration-1000"
                    style={{
                      left: `${stats.tugOfWarPct}%`,
                      right: '50%',
                      borderTopLeftRadius: '9999px',
                      borderBottomLeftRadius: '9999px',
                    }}
                  />
                )}

                {stats.tugOfWarPct > 50 && (
                  <div
                    className="absolute h-full bg-[#8C6239] z-0 transition-all duration-1000"
                    style={{
                      left: '50%',
                      right: `${100 - stats.tugOfWarPct}%`,
                      borderTopRightRadius: '9999px',
                      borderBottomRightRadius: '9999px',
                    }}
                  />
                )}

                <div
                  className="absolute w-6 h-6 bg-white border-[4px] shadow-lg rounded-full transition-all duration-1000 -translate-x-1/2 z-20 flex items-center justify-center"
                  style={{
                    left: `${stats.tugOfWarPct}%`,
                    borderColor: stats.tugOfWarPct < 50 ? '#0072CE' : '#8C6239',
                  }}
                />
              </div>
            </div>

            <div className="text-center text-sm font-black text-slate-700 uppercase tracking-widest bg-slate-50 py-4 px-2 rounded-xl border border-slate-200 shadow-2xs">
              {stats.debateDescriptor}
            </div>
          </div>
        </div>

        {/* 5. ERAS CAROUSEL */}
        <div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight truncate">
                Weezer Era
              </h3>

              {/* Desktop Carousel Arrows */}
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => scrollToEra(Math.max(0, activeEraIndex - 1))}
                  disabled={activeEraIndex === 0}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-slate-200 shadow-xs"
                >
                  ←
                </button>
                <button
                  onClick={() =>
                    scrollToEra(
                      Math.min(stats.sortedEras.length, activeEraIndex + 1)
                    )
                  }
                  disabled={activeEraIndex === stats.sortedEras.length}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-slate-200 shadow-xs"
                >
                  →
                </button>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-500 mb-6 px-2">
              Your favorite-song era, based on your ranked tracks.
            </p>

            <div
              ref={eraScrollRef}
              onScroll={handleEraScroll}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-2 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-stretch"
            >
              {stats.sortedEras.map((era, idx) => (
                <React.Fragment key={era.id}>
                  <div
                    className={`w-[85vw] sm:w-[360px] lg:w-[400px] shrink-0 snap-center rounded-3xl p-6 sm:p-8 transition-all relative overflow-hidden flex flex-col justify-between shadow-md ${
                      era.color
                    } ${idx !== 0 && 'opacity-90'}`}
                  >
                    {idx === 0 ? (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-widest shadow-sm whitespace-nowrap">
                        Your Era
                      </div>
                    ) : (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/20 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest shadow-sm whitespace-nowrap">
                        {era.matchScore}% Match
                      </div>
                    )}

                    <div className="text-center mt-8 mb-8">
                      <h3
                        className={`text-3xl font-black mb-2 tracking-tight truncate ${era.text}`}
                      >
                        {era.name}
                      </h3>

                      <p className={`text-sm font-bold opacity-90 ${era.text}`}>
                        {era.subtitle}
                      </p>
                    </div>

                    <div className="mt-auto">
                      <span
                        className={`text-[9px] font-black uppercase tracking-[0.2em] block mb-3 text-center opacity-80 ${era.text}`}
                      >
                        {era.years}
                      </span>

                      <div className="flex h-2 w-full gap-0.5 rounded-full overflow-hidden opacity-90">
                        {stats.allEras.map((blockEra) => (
                          <div
                            key={blockEra.id}
                            className={`flex-1 h-full ${
                              blockEra.id === era.id ? 'bg-white' : 'bg-black/20'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {idx === 0 && (
                    <div
                      onClick={() => scrollToEra(1)}
                      className="w-[30vw] sm:w-[140px] shrink-0 snap-center rounded-3xl flex flex-col items-center justify-center border-2 border-slate-200 bg-white text-slate-600 cursor-pointer hover:bg-slate-100 transition-all shadow-2xs"
                    >
                      <span className="text-3xl mb-3">🎸</span>

                      <span className="text-xs font-black uppercase tracking-widest text-center leading-snug">
                        Explore
                        <br />
                        Other
                        <br />
                        Eras
                      </span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 mt-2 mb-4">
              {Array.from({
                length: stats.sortedEras.length + 1,
              }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToEra(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    activeEraIndex === i
                      ? 'w-8 bg-[#0072CE]'
                      : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* TEMPORAL LOYALTY, INDEPENDENCE INDEX, LISTENING AGE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* TEMPORAL LOYALTY CURVE */}
          <div className="bg-white text-slate-950 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-center mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1">
                  Temporal Loyalty
                </span>

                <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
                  Nostalgia vs. Discovery
                </h3>

                <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">
                  The volume of songs in your ranked list by decade.
                </p>
              </div>

              <div className="flex items-end justify-between gap-2 h-32 mt-8 mb-2 px-2 border-b-2 border-slate-200 pb-2">
                {Object.entries(stats.temporalBins).map(([label, count]) => {
                  const maxVal = Math.max(...Object.values(stats.temporalBins), 1);
                  const heightPct = (count / maxVal) * 100;

                  return (
                    <div
                      key={label}
                      className="flex-1 flex flex-col items-center justify-end gap-2 h-full"
                    >
                      <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden transition-all duration-500 flex items-end justify-center flex-1">
                        <div
                          className="w-full bg-emerald-500 rounded-t-lg transition-all duration-1000 ease-out"
                          style={{
                            height: `${heightPct}%`,
                          }}
                        />
                      </div>

                      <span className="text-xs font-black text-slate-400 tracking-wider shrink-0">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* INDEPENDENCE INDEX */}
          <div className="bg-white text-slate-950 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-center text-slate-900 mb-2 tracking-tight truncate">
                Independence Index
              </h3>

              <p className="text-xs font-bold text-center text-slate-500 leading-relaxed mb-8">
                How differently you order the songs you ranked compared to the
                community consensus order. Higher means your order departs
                more from the crowd&apos;s.
              </p>

              {stats.independenceIndex !== null ? (
                <>
                  <div className="relative w-full h-1.5 bg-slate-200 rounded-full mb-4 mt-2">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-[#0072CE] border-[3px] border-white rounded-full shadow-[0_0_10px_rgba(0,114,206,0.3)] transition-all duration-1000 z-10"
                      style={{
                        left: `calc(${stats.independenceIndex}% - 10px)`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400 mt-2">
                    <span>Groupie</span>
                    <span>Independent</span>
                  </div>

                  {stats.rankComparisonSampleSize > 0 && (
                    <p className="text-[9px] font-bold text-slate-400 text-center mt-6">
                      Based on {stats.rankComparisonSampleSize} songs you and the
                      community both explicitly ranked.
                    </p>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                  <p className="text-xs font-bold text-slate-500">
                    Need at least 2 shared ranked songs with the community to
                    compute Independence Index.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. LISTENING AGE & CONSISTENCY INDEX */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* LISTENING AGE */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-800 rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden flex flex-col items-center justify-center">
            <h3 className="text-3xl sm:text-4xl font-black text-white mb-6 tracking-tight text-center">
              Listening Age
            </h3>

            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300 block mb-6 text-center leading-relaxed">
              You listen to Weezer as if you are
            </span>

            <div className="inline-flex flex-col items-center justify-center w-32 h-32 bg-white rounded-full shadow-[0_0_40px_rgba(255,255,255,0.2)] mb-6">
              <span className="text-5xl font-black text-slate-900 tracking-tighter -mt-1">
                {stats.listeningAge}
              </span>

              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Years Old
              </span>
            </div>

            <p className="text-[11px] font-bold text-indigo-300/90 text-center max-w-sm leading-relaxed mb-6 -mt-2">
              A playful estimate: we weight the release years of the songs
              you rated by how much you loved them, then translate that era
              into an age. It describes the vintage of your taste — not you.
            </p>

            {ageComment && (
              <div className="bg-indigo-950/80 border border-indigo-700/60 rounded-2xl p-4 max-w-sm text-center">
                <p className="text-xs font-bold text-indigo-200 leading-relaxed">
                  💡 {ageComment}
                </p>
              </div>
            )}
          </div>

          {/* THE CONSISTENCY INDEX */}
          {stats.mostConsistentAlbum ? (
            <div className="bg-indigo-950 border border-indigo-900 rounded-3xl p-6 sm:p-8 shadow-xl text-center overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-3">
                  The Consistency Index
                </span>

                <h3 className="text-xl sm:text-3xl font-black text-white mb-4 tracking-tight leading-snug">
                  You Don&apos;t Just Love the Hits — You Love the Album.
                </h3>

                <p className="text-sm font-bold text-indigo-300 mb-8 max-w-sm mx-auto">
                  Based on your raw bucket scores, this album had the highest
                  average rating with the lowest variance. You rated almost every
                  track a Banger or Slap.
                </p>
              </div>

              <div className="bg-indigo-900 rounded-2xl p-4 flex items-center justify-center gap-4 border border-indigo-800 shadow-inner max-w-md mx-auto w-full">
                <AlbumArtwork
                  albumId={stats.mostConsistentAlbum.id}
                  className="w-16 h-16 rounded-md shadow-md object-cover"
                />

                <div className="text-left">
                  <h4 className="text-lg font-black text-white">
                    {stats.mostConsistentAlbum.name}
                  </h4>

                  <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    {stats.mostConsistentAlbum.count} Tracks Rated
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* THE ROAST (only renders when a roast condition is true) */}
        {stats.roastLine && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-2">
              The Roast
            </span>
            <p className="text-lg sm:text-xl font-black text-slate-900 leading-snug max-w-xl mx-auto">
              {stats.roastLine}
            </p>
          </div>
        )}

        {/* 8. RANK CLASHES */}
        {(stats.biggestBetrayal || stats.hiddenGem) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {stats.biggestBetrayal ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-center text-white mb-1 tracking-tight">
                    The Betrayal
                  </h3>

                  <p className="text-xs font-bold text-center text-slate-400 mb-6">
                    You ranked a fan favorite way lower.
                  </p>

                  <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner flex flex-col items-center text-center">
                    <span className="text-xl font-black text-white mb-4 px-2">
                      {stats.biggestBetrayal.song.title}
                    </span>

                    <div className="flex items-center w-full justify-around">
                      <div className="flex flex-col items-center w-2/5">
                        <span className="text-[9px] font-black uppercase text-slate-500 mb-1">
                          Community Rank
                        </span>

                        <span className="text-xl sm:text-2xl font-black text-slate-400">
                          #{stats.biggestBetrayal.cRank}
                        </span>
                      </div>

                      <div className="text-slate-600 font-black text-xl">→</div>

                      <div className="flex flex-col items-center w-2/5">
                        <span className="text-[9px] font-black uppercase text-amber-400 mb-1">
                          Your Rank
                        </span>

                        <span className="text-2xl sm:text-3xl font-black text-amber-400">
                          #{stats.biggestBetrayal.uRank}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {stats.hiddenGem ? (
              <div className="bg-[#0072CE] border border-blue-500 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-center text-white mb-1 tracking-tight">
                    The Hidden Gem
                  </h3>

                  <p className="text-xs font-bold text-center text-blue-100 mb-6">
                    You love what the crowd overlooks.
                  </p>

                  <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-lg flex flex-col items-center text-center">
                    <span className="text-xl font-black text-slate-900 mb-4 px-2">
                      {stats.hiddenGem.song.title}
                    </span>

                    <div className="flex items-center w-full justify-around">
                      <div className="flex flex-col items-center w-2/5">
                        <span className="text-[9px] font-black uppercase text-slate-400 mb-1">
                          Community Rank
                        </span>

                        <span className="text-xl sm:text-2xl font-black text-slate-400">
                          #{stats.hiddenGem.cRank}
                        </span>
                      </div>

                      <div className="text-[#0072CE] font-black text-xl">→</div>

                      <div className="flex flex-col items-center w-2/5">
                        <span className="text-[9px] font-black uppercase text-[#0072CE] mb-1">
                          Your Rank
                        </span>

                        <span className="text-3xl sm:text-4xl font-black text-[#0072CE]">
                          #{stats.hiddenGem.uRank}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 9. TOP 10 SETLIST & 11. ALBUM POWER RANKINGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* TOP 10 SETLIST */}
          <div className="bg-white text-slate-950 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="mb-6 border-b border-slate-100 pb-4 text-center">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 truncate">
                Top 10 Tracks
              </h3>
            </div>

            <div className="space-y-3">
              {top10.length === 0 && (
                <p className="text-center text-sm font-bold text-slate-400">
                  No songs ranked yet.
                </p>
              )}

              {top10.map((song, i) => (
                <div key={song.id} className="flex items-center gap-3">
                  <span className="text-lg font-black text-slate-300 w-5 text-right shrink-0">
                    {i + 1}.
                  </span>

                  <div className="min-w-0 flex-1 border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">
                      {song.title}
                    </h4>

                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                      {ALBUMS_BY_ID[song.albumId || ALBUM_NAME_TO_ID[song.album]]
                        ?.name || song.album}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ALBUM POWER RANKINGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="mb-6 border-b border-slate-800 pb-4 flex flex-col items-center text-center">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 truncate">
                Top Albums
              </h3>

              <p className="text-xs font-bold text-slate-400 truncate mb-4">
                Album sentiment, adjusted for catalog size.
              </p>

              <button
                onClick={() => setShowAllAlbums(!showAllAlbums)}
                className="text-[10px] font-black uppercase text-[#0072CE] bg-blue-950 hover:bg-blue-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {showAllAlbums ? 'Show Less' : 'Show All'}
              </button>
            </div>

            <div className="space-y-5">
              {displayedAlbums.map((album, i) => (
                <div key={album.name} className="flex items-center gap-4">
                  <span
                    className={`text-xl font-black w-5 text-center shrink-0 ${
                      i === 0 ? 'text-amber-400' : 'text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </span>

                  <div className="w-12 h-12 bg-slate-800 rounded-md shrink-0 shadow-lg border border-slate-700 overflow-hidden relative flex items-center justify-center">
                    <AlbumArtwork
                      albumId={album.id}
                      className="absolute inset-0 w-full h-full object-cover z-10"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-end mb-1">
                      <h4 className="text-sm font-bold text-white truncate pr-2">
                        {album.name}
                      </h4>

                      <span className="text-[10px] font-black text-slate-400 shrink-0">
                        {album.score.toFixed(2)}
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          album.color || 'bg-slate-500'
                        }`}
                        style={{
                          width: `${(album.score / 5) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!showAllAlbums && stats.rankedAlbums.length > 5 && (
              <button
                onClick={() => setShowAllAlbums(true)}
                className="w-full mt-6 text-[10px] font-black uppercase text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Show Full Catalog ↓
              </button>
            )}
          </div>
        </div>

        {/* FANHOOD STOP — the depth game's verdict (or its
            invitation), sitting with the share module and the
            asset library it feeds. */}
        <FanhoodStop triageMap={triageMap} />

        {/* 12. SMART SHARE MODULE */}
        <div className="max-w-xl mx-auto">
          <SmartShareModule
            stats={stats}
            top10={top10}
            userProfile={userProfile}
          />
        </div>

        {/* SHAREABLES ASSET LIBRARY — rendered here, in the component
            that actually has masterList/triageMap/friendsList in scope.
            (It used to sit at the bottom of SmartShareModule, where those
            names don't exist — that was the "masterList is not defined"
            crash that took down the whole Sweater Thread.)
            Thumbnail variant: compact grid, each card (including the
            Fan Club Tiers chart) opens full-size in a modal. */}
        <div className="mt-10">
          <ShareablesGallery
            songs={rankedSongs}
            triageMap={triageMap}
            friends={friendCards ?? []}
            subtitle={userProfile?.username ? `@${userProfile.username}` : undefined}
            tierCharts={tierCharts}
            variant="thumbnails"
            onStartSorting={() => setStep('triage')}
            onFindFriends={() => setStep('friends')}
          />
        </div>
      </main>
    </div>
  );
}

function SmartShareModule({ stats, top10, userProfile }: any) {
  const [isSharing, setIsSharing] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Escape dismisses the share fallback modal (which also gains a
  // backdrop click below — until now its only exit was a small
  // unlabelled ✕).
  useEffect(() => {
    if (!showFallback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFallback(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFallback]);

  const shareData = {
    n: userProfile?.displayName || userProfile?.username || 'A Fan',
    t: top10[0]?.title || 'Undecided',
    a: stats.rankedAlbums[0]?.name || 'Unknown Album',
    v: stats.scoredArchetypes[0]?.name || 'Weezer Scientist',
  };

  const encodedData = encodeShareData(shareData);
  const publicShareUrl = `https://rankingweezer.com/share?data=${encodedData}`;
  const ogImageUrl = `/api/og?data=${encodedData}`;

  const shareText = `My Weezer Anthem is "${shareData.t}" and my Top Album is ${shareData.a}. Who has better taste?`;

  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 1)
    );
  };

  const handleShareClick = async () => {
    setIsSharing(true);

    try {
      const isMobile = isMobileDevice();

      if (isMobile && typeof navigator !== 'undefined' && navigator.share) {
        setIsSharing(false);
        await navigator.share({
          title: 'My Weezer Taste DNA',
          text: shareText,
          url: publicShareUrl,
        });
      } else {
        setIsSharing(false);
        setShowFallback(true);
      }
    } catch (err: any) {
      setIsSharing(false);
      if (err.name !== 'AbortError') {
        setShowFallback(true);
      }
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${publicShareUrl}`);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDownloadImage = async () => {
    try {
      const response = await fetch(ogImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'weezer-taste-dna.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  return (
    <div className="pt-2">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-2">
          Challenge Your Friends
        </span>
        <h3 className="text-3xl font-black text-white tracking-tight mb-4">
          Who Has Better Taste?
        </h3>
        <p className="text-sm font-bold text-slate-400 max-w-sm mx-auto mb-8">
          Instantly share your Weezer Taste DNA card to Instagram, Facebook, X, or text message.
        </p>

        <button
          onClick={handleShareClick}
          disabled={isSharing}
          className="w-full bg-[#0072CE] hover:bg-blue-500 active:scale-95 text-white font-black text-lg py-5 px-8 rounded-2xl shadow-[0_10px_30px_rgba(0,114,206,0.4)] transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-70 disabled:active:scale-100"
        >
          {isSharing ? (
            <>
              <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" />
              <span>Preparing Card...</span>
            </>
          ) : (
            <>
              <span className="text-2xl">📸</span>
              <span>SHARE MY RESULTS</span>
            </>
          )}
        </button>
      </div>

      {showFallback && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowFallback(false)}
        >
          <div
            className="bg-white text-slate-950 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-black text-slate-900 text-lg">Share Your Card</h4>
              <button
                onClick={() => setShowFallback(false)}
                aria-label="Close share options"
                className="text-slate-400 hover:text-slate-900 font-bold min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 mb-4 bg-slate-100 aspect-[1200/630]">
              <img src={ogImageUrl} alt="Your Preview" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDownloadImage}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💾</span> Save Image for Instagram/TikTok
              </button>

              <div className="flex gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                    publicShareUrl
                  )}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-black text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  Post to X
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    publicShareUrl
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  Facebook
                </a>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {copySuccess ? 'Copied!' : 'Copy Public Link'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


