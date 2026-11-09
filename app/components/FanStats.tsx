'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Song, BucketType, FULL_SONG_POOL, ALBUMS_BY_ID, ALBUM_NAME_TO_ID } from '../data/constants';
import { FlyingWIcon, AlbumArtwork } from './SharedUI';
// Temporarily disabled (pre-launch security): see GenerationalTasteGrid usage below.
// import GenerationalTasteGrid from './GenerationalTasteGrid';
import { useWeezer, isRealBucket } from '../context/WeezerContext';
import type { TriageValue } from '../context/WeezerContext';
import TierListChart from './TierListChart';
import { displayFont } from './shareables/fonts';
import {
  ALBUM_SHRINKAGE_K,
  CONTROVERSY_POLARIZATION_WEIGHT,
  LONE_BANGER_MIN_FAN_SHARE,
  METHODOLOGY_PLAIN_RULES,
  METHODOLOGY_VERSION,
  MIN_DISPLAY_SAMPLE,
  MIN_DIVISIVE_RATINGS,
  MIN_DIVISIVE_REACH,
  MIN_QUALIFYING_RATINGS,
  POLARIZATION_FACTOR,
  SONG_TYPE,
  classifyFanTribe,
  debateWeight,
  isQualifiedSubmission,
  leansClassicist,
} from '../lib/fanStatsMethodology';
import WeezerverseMap from './WeezerverseMap';
import WeezerverseFilterBar, {
  countryName,
  stateName,
} from './WeezerverseFilterBar';
import {
  EMPTY_SELECTION,
  ageBandLabel,
  computeCommunityStats,
  computeSliceStats,
  fetchCommunitySlice,
  fetchFanPresence,
  isFilterActive,
  type FanPresence,
  type SlicePayload,
  type SliceSelection,
  type SliceStats,
} from '../lib/communitySlice';

// Weezerverse Phase 1 (spec section 3): when a filtered slice is
// suppressed, each re-cut section keeps its heading and swaps its
// body for this note. Wording is the spec's drafts — the
// none_qualified variant names the filtered place.
const SuppressedBody = ({
  reason,
  place,
}: {
  reason?: string;
  place?: string;
}) => (
  <div className="rounded-2xl border-2 border-dashed border-[#0C1220]/25 bg-white/70 px-4 py-6 text-center">
    <p className="text-sm font-semibold leading-relaxed text-[#3D4A63]">
      {reason === 'none_qualified'
        ? `Fans from ${place || 'here'} have started ranking, but nobody there has rated enough songs to count yet.`
        : "Not enough fans here yet. Fewer than 5 fans match this filter, so we don't show numbers for it — check back as the community grows."}
    </p>
  </div>
);

// While a slice fetch is in flight, re-cut sections show this
// instead of the global numbers — a filtered view never flashes
// unfiltered data under a filter.
const SliceLoadingBody = () => (
  <div className="rounded-2xl border-2 border-dashed border-[#0C1220]/25 bg-white/70 px-4 py-6 text-center">
    <p className="text-sm font-semibold leading-relaxed text-[#3D4A63]">
      Counting the fans in this slice…
    </p>
  </div>
);

// Reusable 5-Bar Distribution Component
const DistributionBars = ({ pBanger, pSlaps, pMid, pSkip, pTrash }: { pBanger: number, pSlaps: number, pMid: number, pSkip: number, pTrash: number }) => (
  <div className="space-y-1.5 mt-3">
    <div className="flex items-center text-[10px] font-black uppercase"><span className="w-12 text-slate-500 shrink-0">Banger</span><div className="flex-1 h-2.5 bg-slate-800 rounded-full mx-2 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${pBanger * 100}%` }} /></div><span className="w-8 text-right text-slate-400 shrink-0">{Math.round(pBanger * 100)}%</span></div>
    <div className="flex items-center text-[10px] font-black uppercase"><span className="w-12 text-slate-500 shrink-0">Slaps</span><div className="flex-1 h-2.5 bg-slate-800 rounded-full mx-2 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${pSlaps * 100}%` }} /></div><span className="w-8 text-right text-slate-400 shrink-0">{Math.round(pSlaps * 100)}%</span></div>
    <div className="flex items-center text-[10px] font-black uppercase"><span className="w-12 text-slate-500 shrink-0">Mid</span><div className="flex-1 h-2.5 bg-slate-800 rounded-full mx-2 overflow-hidden"><div className="h-full bg-blue-400" style={{ width: `${pMid * 100}%` }} /></div><span className="w-8 text-right text-slate-400 shrink-0">{Math.round(pMid * 100)}%</span></div>
    <div className="flex items-center text-[10px] font-black uppercase"><span className="w-12 text-slate-500 shrink-0">Skip</span><div className="flex-1 h-2.5 bg-slate-800 rounded-full mx-2 overflow-hidden"><div className="h-full bg-purple-400" style={{ width: `${pSkip * 100}%` }} /></div><span className="w-8 text-right text-slate-400 shrink-0">{Math.round(pSkip * 100)}%</span></div>
    <div className="flex items-center text-[10px] font-black uppercase"><span className="w-12 text-slate-500 shrink-0">Trash</span><div className="flex-1 h-2.5 bg-slate-800 rounded-full mx-2 overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${pTrash * 100}%` }} /></div><span className="w-8 text-right text-slate-400 shrink-0">{Math.round(pTrash * 100)}%</span></div>
  </div>
);

// Horizontal Carousel Wrapper with Dot Navigation
const HorizontalCarousel = ({ children, itemCount }: { children: React.ReactNode, itemCount: number }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setActiveIndex(Math.round(scrollLeft / clientWidth));
  };

  // The dots are controls (UAT P-14): tapping one scrolls its
  // item into place — the same clientWidth step handleScroll
  // reads the active index from. They used to be plain divs
  // styled exactly like tappable dots that did nothing.
  const goToItem = (i: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: i * scrollRef.current.clientWidth,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory py-2 px-2 sm:px-4 scrollbar-none"
      >
        {children}
      </div>
      {itemCount > 1 && (
        <div className="flex justify-center gap-1.5 mt-2 mb-2">
          {Array.from({ length: itemCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToItem(i)}
              aria-label={`Go to item ${i + 1} of ${itemCount}`}
              aria-current={activeIndex === i ? 'true' : undefined}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072CE]"
            >
              <span className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === i ? 'w-4 bg-[#0072CE]' : 'w-1.5 bg-slate-300'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Placeholder treatment for stat blocks whose community sample is still
// too thin for real numbers (data loaded, but below the display minimums
// in fanStatsMethodology). Values render as "—" with zero-width bars —
// never invented numbers presented as real data.
const PlaceholderBadge = () => (
  <span className="inline-block text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5">
    Placeholder
  </span>
);

const PlaceholderNote = () => (
  <p className="text-[11px] font-bold text-[#3D4A63] leading-relaxed mt-2">
    Placeholder — only a handful of fans so far. Real numbers land as more fans rank.
  </p>
);

// The companion line for a block that is empty for a NON-thin
// reason (UAT P-14): the sample can be healthy and still have
// nothing that qualifies — no album carried by one song, no
// pair of generational cohorts, no #1 with a co-loved deep
// cut. Those blocks used to vanish outright; they now take the
// same badge + note placeholder treatment, with a line that
// stays true at any sample size.
const EmptyBlockNote = () => (
  <p className="text-[11px] font-bold text-[#3D4A63] leading-relaxed mt-2">
    Nothing qualifies for this one yet — it fills in as more fans rank.
  </p>
);

export default function FanStats({
  userMasterList,
}: {
  userMasterList?: Song[];
}) {
  const { communityMasterLists = [], communityTriageMaps = [], refreshCommunityData, closeFanStats, communityLoaded, communityError, loadingCommunity, communityStatsPayload, communitySource, navigateTo } = useWeezer();
  const [expandedTribe, setExpandedTribe] = useState<string | null>(null);

  // --- Weezerverse Phase 1: presence, filter selection, slice -----
  // GRACEFUL DEGRADATION: presence stays null until the RPC answers.
  // If get_fan_presence is missing (migration not yet run) or fails,
  // presence remains null forever and the map + filter bar simply
  // never render — the page below is byte-for-byte the pre-Phase-1
  // page. A slice fetch failure AFTER a selection reverts the
  // selection to All fans and hides the bar the same way.
  const [presence, setPresence] = useState<FanPresence | null>(null);
  const [selection, setSelection] = useState<SliceSelection>(EMPTY_SELECTION);
  const [slicePayload, setSlicePayload] = useState<SlicePayload | null>(null);
  const [sliceStats, setSliceStats] = useState<SliceStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFanPresence().then((res) => {
      if (!cancelled && res.status === 'ok') setPresence(res.presence);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFilterActive(selection)) {
      setSlicePayload(null);
      setSliceStats(null);
      return;
    }
    let cancelled = false;
    fetchCommunitySlice(selection).then((res) => {
      if (cancelled) return;
      if (res.status === 'unavailable') {
        // The slice RPC vanished or failed mid-session: fall back
        // to the unfiltered page, exactly as if the feature were
        // not there.
        setPresence(null);
        setSelection(EMPTY_SELECTION);
        setSlicePayload(null);
        setSliceStats(null);
        return;
      }
      setSlicePayload(res.payload);
      setSliceStats(
        res.payload.suppressed ? null : computeSliceStats(res.payload),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  // If context hasn't loaded data yet when user jumps straight to Fan Stats, trigger background fetch.
  // refreshCommunityData is a stable, in-flight-deduped callback
  // (context), so this fires once per mount — including the
  // return-after-a-failure mount, which is the quiet retry; the
  // error block's Try again button covers the explicit one. An
  // aggregates payload already held counts as loaded (the rows
  // stay empty in that mode by design).
  useEffect(() => {
    if (communityTriageMaps.length === 0 && !communityStatsPayload && refreshCommunityData) {
      refreshCommunityData();
    }
  }, [communityTriageMaps.length, communityStatsPayload, refreshCommunityData]);

  const communityStats = useMemo(() => {
    if (communityTriageMaps.length === 0) return null;
    // Statistical honesty: only qualified submissions count toward
    // community stats — at least MIN_QUALIFYING_RATINGS explicit, valid
    // ratings (methodology module). Master lists qualify on their own
    // explicit length for the consensus metrics.
    const qualifiedMaps = communityTriageMaps.filter((m) =>
      isQualifiedSubmission(m)
    );
    const qualifiedLists = communityMasterLists.filter(
      (l) => l.length >= MIN_QUALIFYING_RATINGS
    );
    const totalFans = qualifiedMaps.length;
    const submissionsReceived = communityTriageMaps.length;
    const points: Record<BucketType, number> = { banger: 5, slaps: 4, mid: 3, skip: 2, trash: 1 };

    const songL1: Record<string, { total: number; count: number; buckets: Record<BucketType, number>; scores: number[] }> = {};
    const albumL1: Record<string, { name: string; total: number; count: number; scores: number[] }> = {};
    
    let blueTotalWeight = 0;
    let pinkTotalWeight = 0;
    let tribeCounts = { purists: 0, cult: 0, modernists: 0, haters: 0, chaos: 0 };
    
    const classicistMaps: Record<string, TriageValue>[] = [];
    const modernistMaps: Record<string, TriageValue>[] = [];

    FULL_SONG_POOL.forEach(s => {
      songL1[s.id] = { total: 0, count: 0, buckets: { banger: 0, slaps: 0, mid: 0, skip: 0, trash: 0 }, scores: [] };
    });

    qualifiedMaps.forEach(map => {
      let blueSum = 0, blueCount = 0;
      let pinkSum = 0, pinkCount = 0;
      let classicSum = 0, classicCount = 0;
      let modernSum = 0, modernCount = 0;
      let userTotal = 0, userCount = 0;

      FULL_SONG_POOL.forEach(s => {
        const bucket = map[s.id];
        if (!bucket || bucket === 'unknown') return;

        const score = points[bucket];
        songL1[s.id].total += score;
        songL1[s.id].count += 1;
        songL1[s.id].scores.push(score);
        songL1[s.id].buckets[bucket]++;

        const resolvedId = s.albumId || ALBUM_NAME_TO_ID[s.album] || "unknown";
        if (!albumL1[resolvedId]) albumL1[resolvedId] = { name: ALBUMS_BY_ID[resolvedId]?.name || s.album, total: 0, count: 0, scores: [] };
        albumL1[resolvedId].total += score;
        albumL1[resolvedId].count += 1;
        albumL1[resolvedId].scores.push(score);

        userTotal += score;
        userCount++;
        if (s.album === 'The Blue Album') { blueSum += score; blueCount++; }
        if (s.album === 'Pinkerton') { pinkSum += score; pinkCount++; }
        if (s.year <= 1999) { classicSum += score; classicCount++; }
        if (s.year >= 2010) { modernSum += score; modernCount++; }
      });

      const blueMean = blueCount > 0 ? blueSum / blueCount : 0;
      const pinkMean = pinkCount > 0 ? pinkSum / pinkCount : 0;
      const delta = blueMean - pinkMean;
      const weight = debateWeight(delta);
      if (delta > 0) blueTotalWeight += weight;
      else if (delta < 0) pinkTotalWeight += weight;

      const classicMean = classicCount > 0 ? classicSum / classicCount : 0;
      const modernMean = modernCount > 0 ? modernSum / modernCount : 0;
      if (leansClassicist(classicMean, modernMean)) classicistMaps.push(map);
      else if (modernMean > classicMean) modernistMaps.push(map);

      const userMean = userCount > 0 ? userTotal / userCount : 3;
      tribeCounts[
        classifyFanTribe({ userMean, modernMean, bluePinkertonDelta: delta })
      ]++;
    });

    const totalWarWeight = blueTotalWeight + pinkTotalWeight;
    const bluePct = totalWarWeight > 0 ? Math.round((blueTotalWeight / totalWarWeight) * 100) : 0;
    const pinkPct = 100 - bluePct;

    const tTotal = Object.values(tribeCounts).reduce((a, b) => a + b, 0) || 1;
    const tribes = [
      { name: "Blue Album Purists", pct: Math.round((tribeCounts.purists / tTotal) * 100), count: tribeCounts.purists, sacred: "Buddy Holly", heresy: "Beverly Hills", stroke: "#0072CE", desc: "Favor the clean, power-pop perfection of the 1994 debut above all else." },
      { name: "Pinkerton Cult", pct: Math.round((tribeCounts.cult / tTotal) * 100), count: tribeCounts.cult, sacred: "El Scorcho", heresy: "Island in the Sun", stroke: "#334155", desc: "Deep devotion to the raw, abrasive, and emotional 1996 sophomore record." },
      { name: "Modern Defenders", pct: Math.round((tribeCounts.modernists / tTotal) * 100), count: tribeCounts.modernists, sacred: "California Kids", heresy: "Hash Pipe", stroke: "#10b981", desc: "Champions of post-2010 releases like White, OK Human, and SZNZ." },
      { name: "Harsh Critics", pct: Math.round((tribeCounts.haters / tTotal) * 100), count: tribeCounts.haters, sacred: "Say It Ain't So", heresy: "Most of the catalog", stroke: "#f43f5e", desc: "Extremely difficult to please, handing out 'Trash' and 'Skip' ratings liberally." },
      { name: "Chaos Agents", pct: Math.round((tribeCounts.chaos / tTotal) * 100), count: tribeCounts.chaos, sacred: "Pork and Beans", heresy: "Consensus", stroke: "#8b5cf6", desc: "Wildly unpredictable tastes that actively defy the overall fan consensus." },
    ].sort((a, b) => b.pct - a.pct);

    const globalPriorMean = Object.values(songL1).reduce((acc, s) => acc + s.total, 0) / Math.max(1, Object.values(songL1).reduce((acc, s) => acc + s.count, 0));
    const albumLeaderboard = Object.entries(albumL1).map(([id, data]) => {
      const rawMean = data.total / data.count;
      const score = ((data.count / (data.count + ALBUM_SHRINKAGE_K)) * rawMean) + ((ALBUM_SHRINKAGE_K / (data.count + ALBUM_SHRINKAGE_K)) * globalPriorMean);
      return { id, album: data.name, score, rawMean, count: data.count };
    }).sort((a, b) => b.score - a.score);

    const l1Metrics = Object.entries(songL1).map(([id, data]) => {
      if (data.count === 0) return { id, mean: 0, sd: 0, controversy: 0, pBanger: 0, pSlaps: 0, pMid: 0, pSkip: 0, pTrash: 0, type: "Unknown", typeLabel: "", typeColor: "" };
      
      const mean = data.total / data.count;
      const variance = data.scores.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / data.count;
      const sd = Math.sqrt(variance);
      
      const pBanger = data.buckets.banger / data.count;
      const pSlaps = data.buckets.slaps / data.count;
      const pMid = data.buckets.mid / data.count;
      const pSkip = data.buckets.skip / data.count;
      const pTrash = data.buckets.trash / data.count;
      
      const polarization = POLARIZATION_FACTOR * pBanger * pTrash;
      const controversy = sd * (1 + CONTROVERSY_POLARIZATION_WEIGHT * polarization);

      let type = "Universally Disliked";
      let typeLabel = "UNIVERSALLY DISLIKED";
      let typeColor = "text-slate-500 bg-slate-100";
      
      if ((pBanger + pSlaps) > SONG_TYPE.lovedPositiveShare && pTrash < SONG_TYPE.lovedMaxTrashShare) {
        type = "Universally Loved"; typeLabel = "UNIVERSALLY LOVED"; typeColor = "text-amber-900 bg-amber-400";
      } else if (pBanger > SONG_TYPE.dividedMinBangerShare && pTrash > SONG_TYPE.dividedMinTrashShare && pMid < SONG_TYPE.dividedMaxMidShare) {
        type = "Deeply Divided"; typeLabel = "DEEPLY DIVIDED"; typeColor = "text-white bg-rose-500";
      } else if (pBanger < SONG_TYPE.safeMaxBangerShare && (pSlaps + pMid) > SONG_TYPE.safePositiveShare && pTrash < SONG_TYPE.safeMaxTrashShare) {
        type = "Safe Bets"; typeLabel = "SAFE BETS"; typeColor = "text-blue-900 bg-blue-300";
      } else if (pBanger > SONG_TYPE.gemMinBangerShare && pBanger < SONG_TYPE.gemMaxBangerShare && (pSkip + pTrash) > SONG_TYPE.gemMinNegativeShare) {
        type = "Hidden Gems"; typeLabel = "HIDDEN GEMS"; typeColor = "text-indigo-900 bg-indigo-300";
      }

      return { id, mean, sd, controversy, pBanger, pSlaps, pMid, pSkip, pTrash, count: data.count, type, typeLabel, typeColor };
    });

    const bottom4Albums = albumLeaderboard.slice(-4);
    const loneBangers = bottom4Albums.map(a => {
      const albumSongs = l1Metrics.filter(m => {
        const s = FULL_SONG_POOL.find(sp => sp.id === m.id);
        return s && (s.albumId || ALBUM_NAME_TO_ID[s.album] || "unknown") === a.id;
      });

      let bestSongMetric = null;
      let maxLift = -999;
      albumSongs.forEach(sm => {
        if (sm.count > totalFans * LONE_BANGER_MIN_FAN_SHARE) {
          const lift = sm.mean - a.rawMean;
          if (lift > maxLift) { maxLift = lift; bestSongMetric = sm; }
        }
      });

      return {
        id: a.id, album: a.album, song: FULL_SONG_POOL.find(s => s.id === bestSongMetric?.id),
        lift: maxLift, songMean: bestSongMetric?.mean || 0, albumMean: a.rawMean
      };
    }).filter(i => i.song).sort((a, b) => b.lift - a.lift);

    let genClassicistSong = null;
    let genModernistSong = null;
    if (classicistMaps.length > 0 && modernistMaps.length > 0) {
      let maxProClassicDelta = -999;
      let maxProModernDelta = -999;

      FULL_SONG_POOL.forEach(s => {
        const cScores = classicistMaps
          .map((m) => {
            const v = m[s.id];
            return isRealBucket(v) ? points[v] : 0;
          })
          .filter(v => v > 0);
        const mScores = modernistMaps
          .map((m) => {
            const v = m[s.id];
            return isRealBucket(v) ? points[v] : 0;
          })
          .filter(v => v > 0);
        if (cScores.length > 5 && mScores.length > 5) {
          const cMean = cScores.reduce((a,b)=>a+b,0) / cScores.length;
          const mMean = mScores.reduce((a,b)=>a+b,0) / mScores.length;
          const delta = cMean - mMean;

          if (delta > maxProClassicDelta) { maxProClassicDelta = delta; genClassicistSong = { song: s, cMean, mMean, delta }; }
          if (-delta > maxProModernDelta) { maxProModernDelta = -delta; genModernistSong = { song: s, cMean, mMean, delta: -delta }; }
        }
      });
    }

    const songL2: Record<string, { percentiles: number[]; count: number }> = {};
    FULL_SONG_POOL.forEach(s => songL2[s.id] = { percentiles: [], count: 0 });

    qualifiedLists.forEach(list => {
      if (list.length < 2) return;
      list.forEach((song, idx) => {
        const pct = ((idx + 0.5) / list.length) * 100; 
        if (songL2[song.id]) {
          songL2[song.id].percentiles.push(pct);
          songL2[song.id].count++;
        }
      });
    });

    const combinedMetrics = l1Metrics.map(l1 => {
      const l2 = songL2[l1.id];
      const reach = l2.count / Math.max(1, qualifiedLists.length);
      const avgPct = l2.count > 0 ? l2.percentiles.reduce((a,b) => a+b, 0) / l2.count : 100;
      return { ...l1, reach, avgPct, song: FULL_SONG_POOL.find(s => s.id === l1.id)! };
    }).filter(m => m.song && m.count > totalFans * 0.1);

    // FAN AWARDS: Filter logic prevents duplicates
    const mostLoved = combinedMetrics.sort((a, b) => b.mean - a.mean)[0];
    // Divisiveness needs a real sample and real disagreement: enough
    // qualified ratings, enough reach, and non-zero variance — a song
    // everyone agrees on is never "divisive" (methodology module).
    const divisiveTop = combinedMetrics
      .filter(
        (m) =>
          m.id !== mostLoved?.id &&
          m.count >= MIN_DIVISIVE_RATINGS &&
          m.count > totalFans * MIN_DIVISIVE_REACH &&
          m.sd > 0 &&
          m.controversy > 0
      )
      .sort((a, b) => b.controversy - a.controversy)
      .slice(0, 5);
    const mostDivisive = divisiveTop[0];
    const hiddenGem = combinedMetrics.filter(m => m.reach <= 0.6 && m.id !== mostLoved?.id && m.id !== mostDivisive?.id).sort((a, b) => a.avgPct - b.avgPct)[0] || combinedMetrics.filter(m => m.id !== mostLoved?.id && m.id !== mostDivisive?.id).sort((a, b) => a.reach - b.reach)[0]; 
    const mostRejected = combinedMetrics.filter(m => m.id !== mostLoved?.id && m.id !== mostDivisive?.id && m.id !== hiddenGem?.id).sort((a, b) => b.pTrash - a.pTrash)[0];
    
    const topConsensus = combinedMetrics.sort((a, b) => ((100 - b.avgPct) * b.reach) - ((100 - a.avgPct) * a.reach)).slice(0, 10);

    // DYNAMIC GLOBAL RANKING ARRAY FOR TIER LIST CHART
    // Sort all songs by their global average score to rank 1 through N
    const globalTierListRankings = combinedMetrics
      .sort((a, b) => b.mean - a.mean)
      .map((item, idx) => ({
        id: item.song.id,
        title: item.song.title,
        album: item.song.album,
        rank: idx + 1
      }));

    let tasteTwin = null;
    if (topConsensus.length > 0) {
      const targetSong = topConsensus[0].song;
      const lovers = qualifiedMaps.filter(m => m[targetSong.id] === 'banger' || m[targetSong.id] === 'slaps');
      const coCounts: Record<string, number> = {};
      lovers.forEach(m => {
        Object.entries(m).forEach(([id, bucket]) => {
          if (id !== targetSong.id && (bucket === 'banger' || bucket === 'slaps')) coCounts[id] = (coCounts[id] || 0) + 1;
        });
      });
      const sortedCo = Object.entries(coCounts).map(([id, count]) => ({ song: FULL_SONG_POOL.find(s => s.id === id), pct: count / lovers.length }))
        .filter(c => c.song && c.song.album !== targetSong.album).sort((a, b) => b.pct - a.pct);
      if (sortedCo.length > 0) tasteTwin = { target: targetSong, twin: sortedCo[0].song!, pct: Math.round(sortedCo[0].pct * 100) };
    }

    const lovedSongs = combinedMetrics.filter(m => m.type === "Universally Loved").sort((a, b) => b.mean - a.mean).slice(0, 10);
    const dividedSongs = combinedMetrics.filter(m => m.type === "Deeply Divided").sort((a, b) => b.controversy - a.controversy).slice(0, 10);
    const safeSongs = combinedMetrics.filter(m => m.type === "Safe Bets").sort((a, b) => b.pMid - a.pMid).slice(0, 10);
    const cultSongs = combinedMetrics.filter(m => m.type === "Hidden Gems").sort((a, b) => b.pBanger - a.pBanger).slice(0, 10);
    const dislikedSongs = combinedMetrics.filter(m => m.type === "Universally Disliked").sort((a, b) => b.pTrash - a.pTrash).slice(0, 10);

    const anatomyCategories = [
      { id: 'loved', title: "Universally Loved", desc: "High Banger/Slaps, virtually zero Trash. The undisputed favorites.", accent: "#f59e0b", songs: lovedSongs },
      { id: 'divisive', title: "Deeply Divided", desc: "High Banger AND high Trash. Love it or hate it.", accent: "#f43f5e", songs: dividedSongs },
      { id: 'cult', title: "Hidden Gems", desc: "Intense praise from a small faction.", accent: "#6366f1", songs: cultSongs },
      { id: 'sleeper', title: "Safe Bets", desc: "Heavy concentration in Mid and Slaps. Consistently decent.", accent: "#3b82f6", songs: safeSongs },
      { id: 'hated', title: "Universally Disliked", desc: "Overwhelmingly skipped or trashed.", accent: "#64748b", songs: dislikedSongs }
    ].filter(cat => cat.songs.length > 0);

    return {
      totalFans, submissionsReceived,
      enoughForPercentages: totalFans >= MIN_DISPLAY_SAMPLE,
      hasDebateData: totalWarWeight > 0,
      bluePct, pinkPct, tribes,
      mostLoved, mostDivisive, divisiveTop, hiddenGem, mostRejected,
      anatomyCategories, topConsensus, albumLeaderboard, loneBangers, 
      genClassicistSong, genModernistSong, tasteTwin,
      globalTierListRankings // Passing down the Tier List array
    };
  }, [communityMasterLists, communityTriageMaps]);

  // The aggregates path (Build 5): when the context's fetch
  // settled on get_community_stats(), the page's global stats
  // come from the payload — computed by the slice machinery
  // (communitySlice.ts: computeCommunityStats), which is
  // field-compatible with the rows object by construction.
  // baseStats is the one global object the sections read: the
  // aggregates object when the aggregates own the display, the
  // rows object otherwise (including every session before the
  // owner runs the aggregates migration).
  const aggregatesStats = useMemo(
    () =>
      communitySource === 'aggregates' &&
      communityStatsPayload &&
      // An all-zero payload is a genuinely empty community —
      // the same "No fan data yet" state empty rows produce,
      // not a page of zeroed sections.
      !(
        communityStatsPayload.qualifiedSubmissions === 0 &&
        communityStatsPayload.songs.length === 0
      )
        ? computeCommunityStats(communityStatsPayload)
        : null,
    [communitySource, communityStatsPayload]
  );
  const baseStats = (aggregatesStats ?? communityStats) as unknown as
    Exclude<typeof communityStats, null>;

  // Show a soft inline loader ONLY while the first fetch hasn't landed
  // yet (baseStats is null until submission data arrives, from either
  // source). Loaded but thin data — maps arrived, few or zero qualified
  // fans — no longer blanks the whole page: the blocks below render
  // their normal shells with placeholder values, a PLACEHOLDER badge,
  // and a disclaimer.
  if (!baseStats) {
    return (
      <div className="-mx-4 -my-4 bg-[#DCEEF8] pb-32 animate-in fade-in duration-500 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8" style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
          {/* The Back renders in EVERY state of this step — the
              loading branch used to return before it, so a stuck
              load left the header and menu as the only exits. */}
          <div className="flex items-center justify-between">
            <button onClick={() => closeFanStats()} className="text-xs font-black text-[#3D4A63] hover:text-[#0C1220] transition-colors flex items-center gap-1 cursor-pointer">
              ← Back
            </button>
          </div>
          {loadingCommunity || !communityLoaded ? (
            /* A fetch is running (or hasn't settled yet): the
               spinner wins over every settled state, so a return
               visit mid-refetch never flashes the empty or error
               state over data on its way (refetch hardening). */
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-[#3D4A63]">Aggregating Fan Data...</p>
            </div>
          ) : communityError ? (
            /* The fetch FAILED: say so, honestly — this state
               used to be indistinguishable from a genuinely
               empty community — and offer the retry. */
            <div className="py-20 text-center space-y-3">
              <p className={`${displayFont.className} text-[24px] leading-tight tracking-wide text-[#0C1220]`}>Couldn&rsquo;t load fan data</p>
              <p className="text-sm font-semibold text-[#3D4A63] max-w-sm mx-auto leading-snug">
                Something went wrong fetching the community
                rankings. Your own rankings are fine — this is
                just the fan data.
              </p>
              <button
                onClick={() => refreshCommunityData()}
                className="bg-[#0072CE] hover:bg-blue-600 text-white text-sm font-black px-5 py-2.5 rounded-full transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            /* The fetch settled and there is genuinely nothing:
               say so, instead of spinning "Aggregating…" forever
               (the pre-launch / RPC-failure reality until now). */
            <div className="py-20 text-center space-y-3">
              <p className={`${displayFont.className} text-[24px] leading-tight tracking-wide text-[#0C1220]`}>No fan data yet</p>
              <p className="text-sm font-semibold text-[#3D4A63] max-w-sm mx-auto leading-snug">
                Weezerverse fills in as fans finish and share
                their rankings. Check back once some rankings are in.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // The one seam the re-cut sections read through: the global
  // object untouched, or the slice's stats while a filter is on.
  // SliceStats is field-compatible by construction (see
  // communitySlice.ts); the cast bridges the page's richer inferred
  // type. Taste Twins and Old vs. New deliberately keep reading
  // the global object (baseStats) directly — they stay global
  // (spec decision 7) and are labeled as such while a filter is
  // on. In aggregates mode baseStats IS the aggregates object,
  // whose tasteTwin/gen fields are null — those sections render
  // their null states there (the payload holds nothing per-fan).
  const filterActive = isFilterActive(selection);
  // A payload only counts for the CURRENT selection — its slice
  // echo must match, so changing a filter reads as "loading" until
  // the new slice lands, never as the previous slice's numbers.
  const payloadForSelection =
    !!slicePayload &&
    slicePayload.slice.country === selection.country &&
    slicePayload.slice.band === (selection.band ?? null) &&
    (slicePayload.slice.state ?? null) ===
      (selection.country === 'US' ? selection.state : null);
  const statsSuppressed =
    filterActive && payloadForSelection && slicePayload.suppressed;
  const sliceLoading = filterActive && !payloadForSelection;
  const slicePending = filterActive && (!payloadForSelection || statsSuppressed);
  const activeStats = (
    filterActive && payloadForSelection && sliceStats
      ? sliceStats
      : baseStats
  ) as unknown as Exclude<typeof communityStats, null>;
  const globalThinSample = !baseStats.enoughForPercentages;
  const placeParts = [
    selection.state ? stateName(selection.state) : null,
    selection.country ? countryName(selection.country) : null,
    selection.band ? ageBandLabel(selection.band) : null,
  ].filter((p): p is string => !!p);
  const placePhrase =
    selection.state && selection.country === 'US'
      ? `${stateName(selection.state)}, United States`
      : placeParts[0] || '';
  const sliceLineParts = [
    selection.country ? countryName(selection.country) : null,
    selection.state ? stateName(selection.state) : null,
    selection.band ? ageBandLabel(selection.band) : null,
  ].filter((p): p is string => !!p);
  // The none_qualified line names a place — only geography counts
  // as a place; a band-only filter falls back to "here".
  const suppressedPlace =
    selection.country || selection.state ? placePhrase : undefined;
  const suppressedNote = statsSuppressed ? (
    <SuppressedBody reason={slicePayload?.reason} place={suppressedPlace} />
  ) : (
    <SliceLoadingBody />
  );

  const thinSample = !activeStats.enoughForPercentages;
  const showDivide =
    activeStats.enoughForPercentages && activeStats.hasDebateData;

  return (
    <div className="-mx-4 -my-4 bg-[#DCEEF8] pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8" style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}>
      
      {/* SECTION 1: HERO & MAIN GRIDS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pt-4 sm:pt-6 lg:pt-8">
        {/* TOP NAVIGATION */}
        <div className="flex items-center justify-between">
          <button onClick={() => closeFanStats()} className="text-xs font-black text-[#3D4A63] hover:text-[#0C1220] transition-colors flex items-center gap-1 cursor-pointer">
            ← Back
          </button>
        </div>

        {/* TOP BANNER — an invitation, not a disclaimer (owner
            reframe, Nov 8, 2026): the project is young and the
            stats below are still gathering fans, so the top of the
            page says exactly that, in bold, and asks the reader to
            do the two things that grow the numbers — rank and
            share. It renders the same in filtered and unfiltered
            views. The seeded-test-fan fact itself now lives only
            in the methodology section below, where the fine print
            belongs. */}
        <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] px-5 py-4 text-center">
          <p className="text-base sm:text-lg font-black text-[#0C1220] leading-snug">
            This project just started, and the numbers are still growing.
          </p>
          <p className="text-sm font-semibold text-[#3D4A63] leading-relaxed mt-1">
            The numbers get truer with every ranking. Add yours, then
            share it — that&apos;s how this grows.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => navigateTo('triage')}
              className="bg-[#FFC72C] hover:bg-[#FFD34D] text-[#0C1220] font-black text-xs px-4 py-2 rounded-full cursor-pointer transition-colors"
            >
              Rank your songs
            </button>
            <button
              onClick={() => navigateTo('shareables')}
              className="bg-white hover:bg-slate-100 text-[#0C1220] border-2 border-[#0C1220] font-black text-xs px-4 py-2 rounded-full cursor-pointer transition-colors"
            >
              Share your cards
            </button>
          </div>
        </div>

        {/* HERO */}
        <div className="text-center mb-6">
          <h1 className={`${displayFont.className} whitespace-nowrap text-5xl sm:text-6xl md:text-7xl tracking-wide text-[#0C1220] leading-[1.02] mb-3`}>
            Weezerverse
          </h1>
          <p className="text-base font-semibold text-[#3D4A63] max-w-sm mx-auto leading-relaxed">
            Here&apos;s how the fans ranked all 206 songs — and where they&apos;re ranking from.
          </p>
        </div>

        {/* WORLD MAP, THEN THE FILTER BAND — directly under the
            hero. The map's card stands alone (map + caption, nothing
            else); the filters live in their own ink band beneath it
            and say what they do, so nobody reads them as map
            controls (owner direction, Nov 6, 2026). Rendered ONLY
            when get_fan_presence answered: while the migration is
            unrun (or the RPC fails) this whole section is absent
            and the page is exactly the pre-Phase-1 page. */}
        {presence && (
          <div className="bg-white rounded-[18px] border-[3px] border-[#0C1220] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-4 sm:p-6">
            <WeezerverseMap presence={presence} />
            <p className="text-center text-xs font-bold text-[#3D4A63] mt-3">
              Fans have ranked from all over.
            </p>
          </div>
        )}

        {presence && (
          <div className="bg-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(12,18,32,0.35)] p-4 sm:p-6">
            <p className="mb-4 text-center text-sm font-semibold leading-relaxed text-[#b9c6dc]">
              <span className="font-black text-white">Filter the stats</span>
              {' by place or age.'}
            </p>
            <WeezerverseFilterBar
              presence={presence}
              selection={selection}
              onChange={setSelection}
            />
            {filterActive && (
              <p className="mt-3 text-center text-xs font-black uppercase tracking-wide text-[#FFD23F]">
                {payloadForSelection &&
                !slicePayload.suppressed &&
                typeof slicePayload.cohortSize === 'number'
                  ? `Showing ${slicePayload.cohortSize} fans · ${sliceLineParts.join(' · ')}`
                  : sliceLineParts.join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* ROW 1: THE DIVIDE & FAN AWARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* THE DIVIDE (1/3 Width on Desktop) */}
          <div className="flex flex-col h-full">
          <div className="bg-white rounded-[18px] p-6 shadow-[4px_4px_0_rgba(11,30,63,0.85)] border-[3px] border-[#0C1220] text-center relative overflow-hidden flex-1 flex flex-col justify-center">
            <div className="absolute top-0 left-0 w-1/2 h-full bg-[#0072CE]/5" />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-800/5" />
            
            <div className="relative z-10 mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">The Divide</span>
              <h2 className={`${displayFont.className} text-3xl tracking-wide text-[#0C1220] leading-tight`}>Blue vs. Pinkerton</h2>
              <p className="text-xs font-semibold text-[#3D4A63] mt-2 max-w-xs mx-auto text-balance">From the fans who've ranked so far.</p>
            </div>

            {slicePending ? (
            <div className="relative z-10">{suppressedNote}</div>
            ) : showDivide ? (
            <div className="relative z-10 flex items-center justify-center">
              <div className="flex-1 text-center pr-2">
                <div className="text-5xl lg:text-6xl font-black text-[#0072CE] tracking-tighter">{activeStats.bluePct}%</div>
                <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest mt-1 text-slate-500">Blue</h4>
              </div>
              <div className="shrink-0 text-slate-300 font-black italic text-2xl px-4">VS</div>
              <div className="flex-1 text-center pl-2">
                <div className="text-5xl lg:text-6xl font-black text-slate-800 tracking-tighter">{activeStats.pinkPct}%</div>
                <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest mt-1 text-slate-500">Pinkerton</h4>
              </div>
            </div>
            ) : (
            <>
              <div className="relative z-10 flex items-center justify-center">
                <div className="flex-1 text-center pr-2">
                  <div className="text-5xl lg:text-6xl font-black text-[#0072CE] tracking-tighter">—%</div>
                  <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest mt-1 text-slate-500">Blue</h4>
                </div>
                <div className="shrink-0 text-slate-300 font-black italic text-2xl px-4">VS</div>
                <div className="flex-1 text-center pl-2">
                  <div className="text-5xl lg:text-6xl font-black text-slate-800 tracking-tighter">—%</div>
                  <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest mt-1 text-slate-500">Pinkerton</h4>
                </div>
              </div>
              <div className="relative z-10 mt-4">
                <PlaceholderBadge />
              </div>
            </>
            )}
          </div>
          {!slicePending && !showDivide && <PlaceholderNote />}
          </div>

          {/* FAN AWARDS (2/3 Width on Desktop) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden h-full flex flex-col justify-center">
            <div className="text-center sm:text-left mb-6 relative z-10">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">Fan Awards</h2>
            </div>

            {slicePending ? (
              <div className="relative z-10">{suppressedNote}</div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 block mb-1">Most Universally Loved</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{activeStats.mostLoved?.song?.title ?? '—'}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">The song fans agree on most — nearly everybody loves it.</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50">
                <span className="text-[10px] font-black uppercase text-rose-500 block mb-1">Most Divisive — Top 5</span>
                {activeStats.divisiveTop.length > 0 ? (
                  <ul className="mt-1">
                    {activeStats.divisiveTop.map((m, i) => (
                      <li key={m.id} className={`flex gap-2 py-2.5 ${i > 0 ? 'border-t border-slate-700/50' : ''}`}>
                        <span className="text-sm font-black text-white leading-tight shrink-0">{i + 1}.</span>
                        <div className="min-w-0">
                          <span className="block text-sm font-black text-white leading-tight">{m.song.title}</span>
                          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{Math.round(m.pBanger * 100)}% Banger · {Math.round(m.pTrash * 100)}% Trash</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <ul className="mt-2 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <li key={i} className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-black text-slate-500 leading-tight truncate">—</span>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">—% Banger · —% Trash</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      <PlaceholderBadge />
                    </div>
                    <PlaceholderNote />
                  </>
                )}
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">The sharpest divide between &apos;Banger&apos; and &apos;Trash&apos; votes.</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-400 block mb-1">The Hidden Gem</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{activeStats.hiddenGem?.song?.title ?? '—'}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">Fewer fans rank it, but the ones who do rank it high.</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Most Disliked</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{activeStats.mostRejected?.song?.title ?? '—'}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">
                  {activeStats.enoughForPercentages && activeStats.mostRejected?.pTrash
                    ? `${Math.round(activeStats.mostRejected.pTrash * 100)}% of fans put this in Trash.`
                    : 'More fans put this in Trash than any other song.'}
                </p>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* ROW 2: GLOBAL TOP 10 CANON & ALBUM RANKINGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          
          {/* GLOBAL TOP 10 CANON */}
          <div className="flex flex-col h-full">
          <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] flex-1 flex flex-col">
            <div className="text-center sm:text-left mb-6 border-b border-slate-100 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Consensus</span>
              <h2 className={`${displayFont.className} text-3xl sm:text-4xl tracking-wide text-[#0C1220] leading-tight`}>Community Top 10</h2>
              <p className="text-[11px] font-bold text-[#3D4A63] mt-1.5">{slicePending ? 'Filtered rankings of 10 or more songs' : `Based on ${activeStats.totalFans} fan rankings of 10 or more songs`}</p>
            </div>
            
            <div className="space-y-4 flex-1">
              {slicePending ? (
                suppressedNote
              ) : activeStats.topConsensus.length > 0 ? (
                activeStats.topConsensus.map((item, idx) => {
                 const resolvedId = item.song.albumId || ALBUM_NAME_TO_ID[item.song.album] || "unknown";
                 return (
                  <div key={item.song.id} className="flex items-center gap-4 group">
                    <span className={`text-2xl sm:text-3xl font-black w-8 text-center tracking-tighter shrink-0 ${idx === 0 ? 'text-amber-400' : 'text-slate-300 group-hover:text-[#0072CE] transition-colors'}`}>
                      {idx + 1}
                    </span>
                    <AlbumArtwork albumId={resolvedId} className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg shadow-sm object-cover border border-slate-200 shrink-0 group-hover:scale-105 transition-transform" />
                    <div className="min-w-0 flex-1 border-b border-slate-50 pb-3 pt-1">
                      <h4 className="text-lg sm:text-xl font-extrabold text-slate-900 pr-2 text-balance leading-tight mb-1">{item.song.title}</h4>
                    </div>
                  </div>
                );
                })
              ) : (
                <>
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="text-2xl sm:text-3xl font-black w-8 text-center tracking-tighter shrink-0 text-slate-200">
                        {idx + 1}
                      </span>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
                      <div className="min-w-0 flex-1 border-b border-slate-50 pb-3 pt-1">
                        <h4 className="text-lg sm:text-xl font-extrabold text-slate-300 pr-2 leading-tight mb-1">—</h4>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1">
                    <PlaceholderBadge />
                  </div>
                </>
              )}
            </div>
          </div>
          {!slicePending && activeStats.topConsensus.length === 0 && <PlaceholderNote />}
          </div>

          {/* ALBUM RANKINGS */}
          <div className="flex flex-col h-full">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex-1 flex flex-col">
            <div className="text-center sm:text-left mb-6 border-b border-slate-800 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">Catalog Power</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-1">Top Albums</h2>
              <p className="text-[10px] font-bold text-slate-400">Ranked by how fans rated each album</p>
            </div>
            
            <div className="space-y-3 flex-1">
              {slicePending ? (
                suppressedNote
              ) : activeStats.albumLeaderboard.length > 0 ? (
                activeStats.albumLeaderboard.map((item, idx) => (
                <div key={item.album} className="bg-slate-800 border border-slate-700 p-3 sm:p-4 rounded-xl flex justify-between items-center hover:border-[#0072CE]/50 transition-colors shadow-inner group">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`text-lg sm:text-xl font-black w-6 text-center shrink-0 ${idx === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{idx + 1}</span>
                    <AlbumArtwork albumId={item.id} className="w-10 h-10 sm:w-12 sm:h-12 rounded shadow-md object-cover border border-slate-700 shrink-0 group-hover:scale-105 transition-transform" />
                    <span className="text-sm sm:text-base font-bold text-white text-balance leading-tight">{item.album}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <span className="text-[10px] font-black text-white bg-[#0072CE] px-2.5 py-1 rounded border border-[#005fA3]">
                      {item.score.toFixed(2)}
                    </span>
                  </div>
                </div>
                ))
              ) : (
                <>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="bg-slate-800 border border-slate-700 p-3 sm:p-4 rounded-xl flex justify-between items-center">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-lg sm:text-xl font-black w-6 text-center shrink-0 text-slate-600">{idx + 1}</span>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-slate-700/60 border border-slate-700 shrink-0" />
                        <span className="text-sm sm:text-base font-bold text-slate-500 leading-tight">—</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-3">
                        <span className="text-[10px] font-black text-slate-400 bg-slate-700 px-2.5 py-1 rounded border border-slate-600">
                          —
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1">
                    <PlaceholderBadge />
                  </div>
                </>
              )}
            </div>
          </div>
          {!slicePending && activeStats.albumLeaderboard.length === 0 && <PlaceholderNote />}
          </div>
        </div>

        {/* TIER LIST VISUALIZATION SECTION */}
        <div className="pt-8 sm:pt-10">
          {slicePending ? (
            <div className="bg-white rounded-[18px] border-[3px] border-[#0C1220] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 sm:p-8">
              <div className="text-center sm:text-left mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Community Consensus</span>
                <h2 className={`${displayFont.className} text-3xl sm:text-4xl tracking-wide text-[#0C1220] leading-tight`}>Weezerverse Tiers</h2>
              </div>
              {suppressedNote}
            </div>
          ) : (
          <TierListChart 
            title="Weezerverse Tiers" 
            subtitle="Community Consensus"
            rankedSongs={activeStats.globalTierListRankings} 
            
            // WE NOW PASS THE EXACT ID TO FIX THE ARTWORK HERE TOO
            rankedAlbums={activeStats.albumLeaderboard.map((a, idx) => ({
              id: a.id || ALBUM_NAME_TO_ID[a.album] || 'unknown',
              album: a.album,
              rank: idx + 1,
              score: a.rawMean
            }))}
          />
          )}
        </div>

      </div>

      {/* SECTION 2: ANATOMY OF A JAM (categories in one framed paper card) */}
      <div className="pt-10 pb-8 mt-10 border-t-[3px] border-[#0C1220]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-8">
          <h2 className={`${displayFont.className} text-4xl sm:text-5xl tracking-wide text-[#0C1220] leading-tight`}>Anatomy of a Jam</h2>
          <p className="text-base font-medium text-[#3D4A63] mt-2 max-w-xl mx-auto text-balance">
            Every song gets its own reaction from fans. Here's the catalog, grouped by the patterns fans fall into.
          </p>
        </div>

        <div className="space-y-6">
          {/* Every category filtered out (no song classifies yet)
              used to leave this section as a header over empty
              space (UAT P-14) — say so, with the page's badge +
              note treatment. */}
          {slicePending && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {suppressedNote}
            </div>
          )}
          {!slicePending && activeStats.anatomyCategories.length === 0 && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <PlaceholderBadge />
              {thinSample ? <PlaceholderNote /> : <EmptyBlockNote />}
            </div>
          )}
          {/* All categories in ONE framed paper card (poster
              treatment, Nov 4, 2026) — the tinted full-bleed bands
              and the white gaps between them are gone; categories
              are separated by the system's 3px ink divider, and
              each category's color survives only as a chip beside
              its title. */}
          {!slicePending && activeStats.anatomyCategories.length > 0 && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white rounded-[18px] border-[3px] border-[#0C1220] shadow-[4px_4px_0_rgba(11,30,63,0.85)]">
                {activeStats.anatomyCategories.map((category, categoryIdx) => (
                  <div key={category.id} className={`px-4 py-6 sm:px-6 lg:px-8 ${categoryIdx > 0 ? 'border-t-[3px] border-[#0C1220]' : ''}`}>

                    {/* CATEGORY HEADER — the title pops on a tape
                        strip in the category's OWN accent color
                        (owner, Nov 5), at a noticeably larger size.
                        The old color-square chip is gone: it said
                        the same color twice once the tape arrived.
                        Ink text on every tape (the poster system's
                        tape language); the thinnest contrast is
                        indigo/slate at ~4.1–4.3:1, fine at this
                        display size. */}
                    <div className="text-center sm:text-left mb-4">
                      <h3 className={`${displayFont.className} flex items-center justify-center sm:justify-start text-3xl sm:text-4xl tracking-wide text-[#0C1220] leading-tight`}>
                        <span className="-rotate-1 px-3 py-1 shadow-[2px_2px_0_rgba(12,18,32,0.35)]" style={{ backgroundColor: category.accent }}>
                          {category.title}
                        </span>
                      </h3>
                      <p className="text-xs font-bold text-[#3D4A63] mt-1">
                        {category.desc}
                      </p>
                    </div>

                    {/* CAROUSEL */}
                    <div>
                      <HorizontalCarousel itemCount={category.songs.length}>
                  {category.songs.map((m, songIdx) => {
                    const resolvedId = m.song.albumId || ALBUM_NAME_TO_ID[m.song.album] || "unknown";
                    return (
                      <div key={`m.id-{songIdx}`} className="w-[260px] sm:w-[320px] shrink-0 snap-center bg-white border-2 border-[#0C1220] p-5 rounded-[18px] shadow-[2px_2px_0_rgba(11,30,63,0.85)] flex flex-col justify-between m-1">
                        <div>
                          <div className="flex items-start gap-3 min-w-0 mb-3">
                            <AlbumArtwork albumId={resolvedId} className="w-12 h-12 rounded-lg shadow-sm border border-slate-100 shrink-0 object-cover" />
                            <div className="min-w-0 flex-1 pt-1">
                              <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight text-balance">{m.song.title}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-1">
                          <DistributionBars pBanger={m.pBanger} pSlaps={m.pSlaps} pMid={m.pMid} pSkip={m.pTrash} pTrash={m.pTrash} />
                        </div>
                      </div>
                    );
                  })}
                      </HorizontalCarousel>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: TRIBES & MICRO-INSIGHTS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 mt-10">
        
        {/* FULL WIDTH GENERATIONAL BREAKDOWN */}
        {/* TEMPORARILY DISABLED (pre-launch security): GenerationalTasteGrid
            downloads every user's birth year + ranking to the browser.
            Re-enable after server-side aggregation lands. */}
        {/* <GenerationalTasteGrid /> */}

        {/* ROW 3: FAN TRIBES & MICRO-INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-4">
          
          {/* FAN TRIBES */}
          <div className="bg-white rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] border-[3px] border-[#0C1220] h-full">
            <div className="text-center sm:text-left mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">How Fans Rank</span>
              <h2 className={`${displayFont.className} text-3xl tracking-wide text-[#0C1220] leading-tight`}>Fan Tribes</h2>
              <p className="text-xs font-semibold text-[#3D4A63] mt-2">Where fans land, based on how they rank songs.</p>
              {!slicePending && !activeStats.enoughForPercentages && (
                <p className="text-[11px] font-bold text-[#3D4A63] mt-1">
                  Percentages show once {MIN_DISPLAY_SAMPLE} fans have ranked enough to count — counts for now ({activeStats.totalFans} so far).
                </p>
              )}
            </div>

            <div className="space-y-3">
              {slicePending ? (
                suppressedNote
              ) : activeStats.tribes.map((tribe, i) => (
                <div key={i} className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-100 transition-all">
                  
                  {/* ADJUSTED FLEX CONTAINER FOR NO-WRAP TRUNCATION */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] sm:text-base font-black text-slate-900 truncate" title={tribe.name}>{tribe.name}</h3>
                        <button 
                          onClick={() => setExpandedTribe(expandedTribe === tribe.name ? null : tribe.name)}
                          className="text-slate-400 hover:text-[#0072CE] transition-colors bg-slate-200 hover:bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-serif italic font-bold shrink-0"
                          aria-label="More Info"
                        >
                          {expandedTribe === tribe.name ? '−' : 'i'}
                        </button>
                      </div>
                      {expandedTribe === tribe.name && (
                        <p className="text-xs font-semibold text-slate-500 mt-1.5 max-w-[280px] leading-snug">{tribe.desc}</p>
                      )}
                    </div>
                    {/* SMALLER PERCENTAGE FONT */}
                    <span className="text-xl font-black text-[#0072CE] leading-none shrink-0">{activeStats.enoughForPercentages ? `${tribe.pct}%` : `${tribe.count} fans`}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                    <div>
                      <span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest block mb-0.5">Most Loved</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700 text-balance leading-tight">{tribe.sacred}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest block mb-0.5">Most Rejected</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700 text-balance leading-tight">{tribe.heresy}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MICRO-INSIGHTS TOWER */}
          <div className="flex flex-col gap-6 lg:gap-8 h-full">
            
            {/* BETTER THAN THE ALBUM */}
            {slicePending && (
              <div className="bg-slate-50 rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] border-[3px] border-[#0C1220]">
                <div className="text-center sm:text-left mb-5">
                  <h2 className={`${displayFont.className} text-2xl tracking-wide text-[#0C1220] leading-tight mb-2`}>
                    Better Than The Album
                  </h2>
                  <p className="text-xs font-semibold text-[#3D4A63] text-balance">The highest-rated songs carrying the lowest-rated albums.</p>
                </div>
                {suppressedNote}
              </div>
            )}
            {!slicePending && activeStats.loneBangers.length > 0 && (
              <div className="bg-slate-50 rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] border-[3px] border-[#0C1220]">
                <div className="text-center sm:text-left mb-5">
                  <h2 className={`${displayFont.className} text-2xl tracking-wide text-[#0C1220] leading-tight mb-2`}>
                    Better Than The Album
                  </h2>
                  <p className="text-xs font-semibold text-[#3D4A63] text-balance">The highest-rated songs carrying the lowest-rated albums.</p>
                </div>

                <HorizontalCarousel itemCount={activeStats.loneBangers.length}>
                  {activeStats.loneBangers.map((item) => (
                    <div key={item.album} className="w-[260px] sm:w-[280px] shrink-0 snap-center bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-md flex flex-col justify-between mx-1">
                      <div className="flex items-start gap-4 mb-5">
                        <AlbumArtwork albumId={item.id} className="w-12 h-12 rounded-xl shadow-sm object-cover border border-slate-100 shrink-0" />
                        <div className="min-w-0 flex-1 pt-1">
                          <h3 className="text-lg font-black text-slate-900 text-balance leading-tight mb-1">{item.song?.title}</h3>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.album}</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="text-center">
                          <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Album Avg</span>
                          <span className="text-lg font-black text-slate-500">{item.albumMean.toFixed(1)}</span>
                        </div>
                        <div className="text-slate-300 font-black">→</div>
                        <div className="text-center">
                          <span className="text-[9px] font-black uppercase text-[#0072CE] block mb-0.5">Song Avg</span>
                          <span className="text-xl font-black text-[#0072CE]">{item.songMean.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </HorizontalCarousel>
              </div>
            )}
            {!slicePending && activeStats.loneBangers.length === 0 && (
              <div className="bg-slate-50 rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] border-[3px] border-[#0C1220]">
                <div className="text-center sm:text-left mb-5">
                  <h2 className={`${displayFont.className} text-2xl tracking-wide text-[#0C1220] leading-tight mb-2`}>
                    Better Than The Album
                  </h2>
                  <p className="text-xs font-semibold text-[#3D4A63] text-balance">The highest-rated songs carrying the lowest-rated albums.</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 shrink-0" />
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="text-lg font-black text-slate-300 leading-tight mb-1">—</h3>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">—</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="text-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Album Avg</span>
                      <span className="text-lg font-black text-slate-300">—</span>
                    </div>
                    <div className="text-slate-300 font-black">→</div>
                    <div className="text-center">
                      <span className="text-[9px] font-black uppercase text-[#0072CE] block mb-0.5">Song Avg</span>
                      <span className="text-xl font-black text-slate-300">—</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <PlaceholderBadge />
                </div>
                {thinSample ? <PlaceholderNote /> : <EmptyBlockNote />}
              </div>
            )}

            {/* TASTE TWINS */}
            {baseStats.tasteTwin && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
                <div className="text-center sm:text-left mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">Goes Together</span>
                  <h2 className="text-2xl font-black text-white tracking-tight leading-tight">Taste Twins</h2>
                  <p className="text-xs text-slate-400 mt-2 text-balance">
                    Fans who love the community's #1 song almost always love this one too.
                  </p>
                  {filterActive && (<p className="text-[11px] font-bold text-amber-400/90 mt-1">All fans — this section stays global while a filter is on.</p>)}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3">
                  <div className="bg-indigo-500/20 p-4 rounded-xl text-center w-full sm:flex-1 border border-indigo-500/30">
                    <span className="text-sm font-bold text-white text-balance">{baseStats.tasteTwin.target.title}</span>
                  </div>
                  <div className="flex sm:flex-col items-center justify-center shrink-0">
                    <div className="w-4 h-0.5 sm:w-0.5 sm:h-3 bg-amber-400/50" />
                    <div className="text-amber-400 font-black px-3 py-1 border border-amber-400/30 rounded-full bg-amber-400/10 text-[10px] shrink-0 my-1 sm:my-0 sm:mx-1">
                      {baseStats.tasteTwin.pct}% Match
                    </div>
                    <div className="w-4 h-0.5 sm:w-0.5 sm:h-3 bg-amber-400/50" />
                  </div>
                  <div className="bg-blue-500/20 p-4 rounded-xl text-center w-full sm:flex-1 border border-blue-500/30">
                    <span className="text-sm font-bold text-white text-balance">{baseStats.tasteTwin.twin.title}</span>
                  </div>
                </div>
              </div>
            )}
            {!baseStats.tasteTwin && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
                <div className="text-center sm:text-left mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">Goes Together</span>
                  <h2 className="text-2xl font-black text-white tracking-tight leading-tight">Taste Twins</h2>
                  <p className="text-xs text-slate-400 mt-2 text-balance">
                    Fans who love the community's #1 song almost always love this one too.
                  </p>
                  {filterActive && (<p className="text-[11px] font-bold text-amber-400/90 mt-1">All fans — this section stays global while a filter is on.</p>)}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3">
                  <div className="bg-indigo-500/20 p-4 rounded-xl text-center w-full sm:flex-1 border border-indigo-500/30">
                    <span className="text-sm font-bold text-slate-400">—</span>
                  </div>
                  <div className="flex sm:flex-col items-center justify-center shrink-0">
                    <div className="w-4 h-0.5 sm:w-0.5 sm:h-3 bg-amber-400/50" />
                    <div className="text-amber-400/70 font-black px-3 py-1 border border-amber-400/30 rounded-full bg-amber-400/10 text-[10px] shrink-0 my-1 sm:my-0 sm:mx-1">
                      —
                    </div>
                    <div className="w-4 h-0.5 sm:w-0.5 sm:h-3 bg-amber-400/50" />
                  </div>
                  <div className="bg-blue-500/20 p-4 rounded-xl text-center w-full sm:flex-1 border border-blue-500/30">
                    <span className="text-sm font-bold text-slate-400">—</span>
                  </div>
                </div>

                <div className="mt-5">
                  <PlaceholderBadge />
                </div>
                {globalThinSample ? <PlaceholderNote /> : <EmptyBlockNote />}
              </div>
            )}

            {/* OLD SCHOOL VS NEW SCHOOL (Generational Divide) */}
            {baseStats.genClassicistSong && baseStats.genModernistSong && (
              <div className="bg-slate-50 border-[3px] border-[#0C1220] rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] flex-1">
                <div className="text-center sm:text-left mb-5">
                  <h2 className={`${displayFont.className} text-2xl tracking-wide text-[#0C1220] leading-tight`}>Old vs. New</h2>
                  <p className="text-xs font-semibold text-[#3D4A63] mt-2 text-balance">The tracks pre-2000 purists and modern defenders disagree on most.</p>
                  {filterActive && (<p className="text-[11px] font-bold text-[#3D4A63] mt-1">All fans — this section stays global while a filter is on.</p>)}
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">Old School Choice</span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight text-balance mb-3">"{baseStats.genClassicistSong.song.title}"</h3>
                    <div className="flex items-center gap-3 text-center">
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">90s Purists</span>
                        <span className="text-lg font-black text-[#0072CE]">{baseStats.genClassicistSong.cMean.toFixed(1)}</span>
                      </div>
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Modernists</span>
                        <span className="text-lg font-black text-slate-400">{baseStats.genClassicistSong.mMean.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block mb-1">New School Choice</span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight text-balance mb-3">"{baseStats.genModernistSong.song.title}"</h3>
                    <div className="flex items-center gap-3 text-center">
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Modernists</span>
                        <span className="text-lg font-black text-emerald-500">{baseStats.genModernistSong.mMean.toFixed(1)}</span>
                      </div>
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">90s Purists</span>
                        <span className="text-lg font-black text-slate-400">{baseStats.genModernistSong.cMean.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!(baseStats.genClassicistSong && baseStats.genModernistSong) && (
              <div className="bg-slate-50 border-[3px] border-[#0C1220] rounded-[18px] p-6 sm:p-8 shadow-[4px_4px_0_rgba(11,30,63,0.85)] flex-1">
                <div className="text-center sm:text-left mb-5">
                  <h2 className={`${displayFont.className} text-2xl tracking-wide text-[#0C1220] leading-tight`}>Old vs. New</h2>
                  <p className="text-xs font-semibold text-[#3D4A63] mt-2 text-balance">The tracks pre-2000 purists and modern defenders disagree on most.</p>
                  {filterActive && (<p className="text-[11px] font-bold text-[#3D4A63] mt-1">All fans — this section stays global while a filter is on.</p>)}
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">Old School Choice</span>
                    <h3 className="text-lg font-black text-slate-300 leading-tight text-balance mb-3">—</h3>
                    <div className="flex items-center gap-3 text-center">
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">90s Purists</span>
                        <span className="text-lg font-black text-slate-300">—</span>
                      </div>
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Modernists</span>
                        <span className="text-lg font-black text-slate-300">—</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block mb-1">New School Choice</span>
                    <h3 className="text-lg font-black text-slate-300 leading-tight text-balance mb-3">—</h3>
                    <div className="flex items-center gap-3 text-center">
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Modernists</span>
                        <span className="text-lg font-black text-slate-300">—</span>
                      </div>
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">90s Purists</span>
                        <span className="text-lg font-black text-slate-300">—</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <PlaceholderBadge />
                </div>
                {globalThinSample ? <PlaceholderNote /> : <EmptyBlockNote />}
              </div>
            )}

          </div>
        </div>
        <details className="mt-10 rounded-[18px] border-[3px] border-[#0C1220] bg-white p-5 shadow-[4px_4px_0_rgba(11,30,63,0.85)]">
          <summary className="cursor-pointer text-sm font-black uppercase tracking-wider text-[#0C1220]">
            How this is calculated
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium text-slate-500">
            {METHODOLOGY_PLAIN_RULES.map((rule) => (
              <li key={rule.slice(0, 24)}>{rule}</li>
            ))}
            <li>While the community is small, the sample includes seeded test fans (testfan_*), who are excluded from search, friends, and public pages.</li>
          </ul>
          <p className="mt-3 text-xs font-bold text-slate-400">
            Methodology v{METHODOLOGY_VERSION} — tribes and labels are for fun.
          </p>
        </details>

      </div>
    </div>
  );
}


