'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Song, BucketType, FULL_SONG_POOL, ALBUMS_BY_ID, ALBUM_NAME_TO_ID } from '../data/constants';
import { FlyingWIcon, AlbumArtwork } from './SharedUI';
import GenerationalTasteGrid from './GenerationalTasteGrid';
import { useWeezer } from '../context/WeezerContext';

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
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === i ? 'w-4 bg-[#0072CE]' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FanStats({
  userMasterList,
  setStep,
}: {
  userMasterList?: Song[];
  setStep?: (s: 'master' | 'triage' | 'rank_buckets' | 'wrapped' | 'fan_stats') => void;
}) {
  const { communityMasterLists = [], communityTriageMaps = [], refreshCommunityData } = useWeezer();
  const [expandedTribe, setExpandedTribe] = useState<string | null>(null);

  // If context hasn't loaded data yet when user jumps straight to Fan Stats, trigger background fetch
  useEffect(() => {
    if (communityTriageMaps.length === 0 && refreshCommunityData) {
      refreshCommunityData();
    }
  }, [communityTriageMaps.length, refreshCommunityData]);

  const communityStats = useMemo(() => {
    if (communityTriageMaps.length === 0) return null;
    const totalFans = communityTriageMaps.length;
    const points: Record<BucketType, number> = { banger: 5, slaps: 4, mid: 3, skip: 2, trash: 1 };

    const songL1: Record<string, { total: number; count: number; buckets: Record<BucketType, number>; scores: number[] }> = {};
    const albumL1: Record<string, { name: string; total: number; count: number; scores: number[] }> = {};
    
    let blueTotalWeight = 0;
    let pinkTotalWeight = 0;
    let tribeCounts = { purists: 0, cult: 0, modernists: 0, haters: 0, chaos: 0 };
    
    const classicistMaps: Record<string, BucketType>[] = [];
    const modernistMaps: Record<string, BucketType>[] = [];

    FULL_SONG_POOL.forEach(s => {
      songL1[s.id] = { total: 0, count: 0, buckets: { banger: 0, slaps: 0, mid: 0, skip: 0, trash: 0 }, scores: [] };
    });

    communityTriageMaps.forEach(map => {
      let blueSum = 0, blueCount = 0;
      let pinkSum = 0, pinkCount = 0;
      let classicSum = 0, classicCount = 0;
      let modernSum = 0, modernCount = 0;
      let userTotal = 0, userCount = 0;

      FULL_SONG_POOL.forEach(s => {
        const bucket = map[s.id];
        if (!bucket) return;
        
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
      const weight = Math.pow(Math.abs(delta), 1.5); 
      if (delta > 0) blueTotalWeight += weight;
      else if (delta < 0) pinkTotalWeight += weight;

      const classicMean = classicCount > 0 ? classicSum / classicCount : 0;
      const modernMean = modernCount > 0 ? modernSum / modernCount : 0;
      if (classicMean > modernMean + 1.0) classicistMaps.push(map);
      else if (modernMean > classicMean) modernistMaps.push(map);

      const userMean = userCount > 0 ? userTotal / userCount : 3;
      if (userMean < 2.2) tribeCounts.haters++;
      else if (modernMean > 3.8 && delta < 1 && delta > -1) tribeCounts.modernists++;
      else if (delta > 0.3) tribeCounts.purists++;
      else if (delta < -0.3) tribeCounts.cult++;
      else tribeCounts.chaos++;
    });

    const totalWarWeight = blueTotalWeight + pinkTotalWeight;
    const bluePct = totalWarWeight > 0 ? Math.round((blueTotalWeight / totalWarWeight) * 100) : 50;
    const pinkPct = 100 - bluePct;

    const tTotal = Object.values(tribeCounts).reduce((a, b) => a + b, 0) || 1;
    const tribes = [
      { name: "Blue Album Purists", pct: Math.round((tribeCounts.purists / tTotal) * 100), sacred: "Buddy Holly", heresy: "Beverly Hills", stroke: "#0072CE", desc: "Favor the clean, power-pop perfection of the 1994 debut above all else." },
      { name: "Pinkerton Cult", pct: Math.round((tribeCounts.cult / tTotal) * 100), sacred: "El Scorcho", heresy: "Island in the Sun", stroke: "#334155", desc: "Deep devotion to the raw, abrasive, and emotional 1996 sophomore record." },
      { name: "Modern Defenders", pct: Math.round((tribeCounts.modernists / tTotal) * 100), sacred: "California Kids", heresy: "Hash Pipe", stroke: "#10b981", desc: "Champions of post-2010 releases like White, OK Human, and SZNZ." },
      { name: "Harsh Critics", pct: Math.round((tribeCounts.haters / tTotal) * 100), sacred: "Say It Ain't So", heresy: "Most of the catalog", stroke: "#f43f5e", desc: "Extremely difficult to please, handing out 'Trash' and 'Skip' ratings liberally." },
      { name: "Chaos Agents", pct: Math.round((tribeCounts.chaos / tTotal) * 100), sacred: "Pork and Beans", heresy: "Consensus", stroke: "#8b5cf6", desc: "Wildly unpredictable tastes that actively defy the overall fan consensus." },
    ].sort((a, b) => b.pct - a.pct);

    const globalPriorMean = Object.values(songL1).reduce((acc, s) => acc + s.total, 0) / Math.max(1, Object.values(songL1).reduce((acc, s) => acc + s.count, 0));
    const SHRINKAGE_K = 5;
    const albumLeaderboard = Object.entries(albumL1).map(([id, data]) => {
      const rawMean = data.total / data.count;
      const score = ((data.count / (data.count + SHRINKAGE_K)) * rawMean) + ((SHRINKAGE_K / (data.count + SHRINKAGE_K)) * globalPriorMean);
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
      
      const polarization = 4 * pBanger * pTrash; 
      const controversy = sd * (1 + 0.5 * polarization);

      let type = "Universally Disliked";
      let typeLabel = "UNIVERSALLY DISLIKED";
      let typeColor = "text-slate-500 bg-slate-100";
      
      if ((pBanger + pSlaps) > 0.65 && pTrash < 0.1) {
        type = "Universally Loved"; typeLabel = "UNIVERSALLY LOVED"; typeColor = "text-amber-900 bg-amber-400";
      } else if (pBanger > 0.2 && pTrash > 0.2 && pMid < 0.25) {
        type = "Deeply Divided"; typeLabel = "DEEPLY DIVIDED"; typeColor = "text-white bg-rose-500";
      } else if (pBanger < 0.2 && (pSlaps + pMid) > 0.55 && pTrash < 0.15) {
        type = "Safe Bets"; typeLabel = "SAFE BETS"; typeColor = "text-blue-900 bg-blue-300";
      } else if (pBanger > 0.05 && pBanger < 0.25 && (pSkip + pTrash) > 0.4) {
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
        if (sm.count > totalFans * 0.1) {
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
        const cScores = classicistMaps.map(m => points[m[s.id]] || 0).filter(v => v > 0);
        const mScores = modernistMaps.map(m => points[m[s.id]] || 0).filter(v => v > 0);
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

    communityMasterLists.forEach(list => {
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
      const reach = l2.count / Math.max(1, communityMasterLists.length);
      const avgPct = l2.count > 0 ? l2.percentiles.reduce((a,b) => a+b, 0) / l2.count : 100;
      return { ...l1, reach, avgPct, song: FULL_SONG_POOL.find(s => s.id === l1.id)! };
    }).filter(m => m.song && m.count > totalFans * 0.1);

    // FAN AWARDS: Filter logic prevents duplicates
    const mostLoved = combinedMetrics.sort((a, b) => b.mean - a.mean)[0];
    const mostDivisive = combinedMetrics.filter(m => m.id !== mostLoved?.id).sort((a, b) => b.controversy - a.controversy)[0];
    const hiddenGem = combinedMetrics.filter(m => m.reach <= 0.6 && m.id !== mostLoved?.id && m.id !== mostDivisive?.id).sort((a, b) => a.avgPct - b.avgPct)[0] || combinedMetrics.filter(m => m.id !== mostLoved?.id && m.id !== mostDivisive?.id).sort((a, b) => a.reach - b.reach)[0]; 
    const mostRejected = combinedMetrics.filter(m => m.id !== mostLoved?.id && m.id !== mostDivisive?.id && m.id !== hiddenGem?.id).sort((a, b) => b.pTrash - a.pTrash)[0];
    
    const topConsensus = combinedMetrics.sort((a, b) => ((100 - b.avgPct) * b.reach) - ((100 - a.avgPct) * a.reach)).slice(0, 10);

    let tasteTwin = null;
    if (topConsensus.length > 0) {
      const targetSong = topConsensus[0].song;
      const lovers = communityTriageMaps.filter(m => m[targetSong.id] === 'banger' || m[targetSong.id] === 'slaps');
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
      { id: 'loved', title: "Universally Loved", desc: "High Banger/Slaps, virtually zero Trash. The undisputed favorites.", color: "text-amber-600", badgeBg: "bg-amber-400/10 border-amber-400/30", songs: lovedSongs },
      { id: 'divisive', title: "Deeply Divided", desc: "High Banger AND high Trash. Love it or hate it.", color: "text-rose-600", badgeBg: "bg-rose-500/10 border-rose-500/30", songs: dividedSongs },
      { id: 'cult', title: "Hidden Gems", desc: "Intense praise from a small faction.", color: "text-indigo-600", badgeBg: "bg-indigo-500/10 border-indigo-500/30", songs: cultSongs },
      { id: 'sleeper', title: "Safe Bets", desc: "Heavy concentration in Mid and Slaps. Consistently decent.", color: "text-blue-600", badgeBg: "bg-blue-500/10 border-blue-500/30", songs: safeSongs },
      { id: 'hated', title: "Universally Disliked", desc: "Overwhelmingly skipped or trashed.", color: "text-slate-600", badgeBg: "bg-slate-500/10 border-slate-500/30", songs: dislikedSongs }
    ].filter(cat => cat.songs.length > 0);

    return { 
      totalFans, bluePct, pinkPct, tribes, 
      mostLoved, mostDivisive, hiddenGem, mostRejected,
      anatomyCategories, topConsensus, albumLeaderboard, loneBangers, 
      genClassicistSong, genModernistSong, tasteTwin
    };
  }, [communityMasterLists, communityTriageMaps]);

  // Show a soft inline loader ONLY if data hasn't finished its first initial fetch yet
  if (!communityStats || communityStats.totalFans === 0) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-500">Aggregating Global Fan Data...</p>
      </div>
    );
  }

  return (
    <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* SECTION 1: HERO & MAIN GRIDS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 pt-2">
        {/* TOP NAVIGATION */}
        <div className="flex items-center justify-between">
          {setStep && (
            <button onClick={() => setStep('wrapped')} className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer">
              ← Back to Wrapped
            </button>
          )}
        </div>

        {/* HERO */}
        <div className="text-center mb-6">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-slate-950 tracking-tighter leading-none mb-3">
            The State of <br /><span className="text-[#0072CE]">Weezer</span>
          </h1>
          <p className="text-base font-bold text-slate-600 max-w-sm mx-auto leading-relaxed">
            206 songs. Thousands of opinions. The definitive consensus.
          </p>
        </div>

        {/* ROW 1: THE DIVIDE & FAN AWARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* THE DIVIDE (1/3 Width on Desktop) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center relative overflow-hidden h-full flex flex-col justify-center">
            <div className="absolute top-0 left-0 w-1/2 h-full bg-[#0072CE]/5" />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-800/5" />
            
            <div className="relative z-10 mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">The Divide</span>
              <h2 className="text-3xl font-black text-slate-950 tracking-tight leading-tight">Blue vs. Pinkerton</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto text-balance">Based on every rating across the entire fanbase.</p>
            </div>

            <div className="relative z-10 flex items-center justify-center">
              <div className="flex-1 text-center pr-2">
                <div className="text-5xl lg:text-6xl font-black text-[#0072CE] tracking-tighter">{communityStats.bluePct}%</div>
                <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest mt-1 text-slate-500">Blue</h4>
              </div>
              <div className="shrink-0 text-slate-300 font-black italic text-2xl px-4">VS</div>
              <div className="flex-1 text-center pl-2">
                <div className="text-5xl lg:text-6xl font-black text-slate-800 tracking-tighter">{communityStats.pinkPct}%</div>
                <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-widest mt-1 text-slate-500">Pinkerton</h4>
              </div>
            </div>
          </div>

          {/* FAN AWARDS (2/3 Width on Desktop) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden h-full flex flex-col justify-center">
            <div className="text-center sm:text-left mb-6 relative z-10">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">Fan Awards</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 block mb-1">Most Universally Loved</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{communityStats.mostLoved?.song?.title}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">Highest ratio of positive ratings with the lowest disagreement.</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-rose-500 block mb-1">Most Divisive</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{communityStats.mostDivisive?.song?.title}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">The sharpest divide between 'Banger' and 'Trash' votes.</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-400 block mb-1">The Hidden Gem</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{communityStats.hiddenGem?.song?.title}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">Included on fewer explicit lists, but ranked exceptionally high when it appears.</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Most Disliked</span>
                  <h3 className="text-xl lg:text-2xl font-black text-white text-balance leading-tight">{communityStats.mostRejected?.song?.title}</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-3 leading-snug">
                  {communityStats.mostRejected?.pTrash ? Math.round(communityStats.mostRejected.pTrash * 100) : 0}% of the entire fanbase put this in Trash.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: GLOBAL TOP 10 CANON & ALBUM RANKINGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          
          {/* GLOBAL TOP 10 CANON */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm h-full flex flex-col">
            <div className="text-center sm:text-left mb-6 border-b border-slate-100 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Consensus</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight">Global Top 10</h2>
            </div>
            
            <div className="space-y-4 flex-1">
              {communityStats.topConsensus.map((item, idx) => {
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
              })}
            </div>
          </div>

          {/* ALBUM RANKINGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl h-full flex flex-col">
            <div className="text-center sm:text-left mb-6 border-b border-slate-800 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">Catalog Power</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-1">Top Albums</h2>
              <p className="text-[10px] font-bold text-slate-400">Weighted by positive sentiment and rankings</p>
            </div>
            
            <div className="space-y-3 flex-1">
              {communityStats.albumLeaderboard.map((item, idx) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: FULL-BLEED ANATOMY OF A JAM (Negative horizontal margins expand to screen edges) */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 pt-10 pb-8 mt-10 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-8">
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">Anatomy of a Jam</h2>
          <p className="text-base font-medium text-slate-500 mt-2 max-w-xl mx-auto text-balance">
            Every song has a specific demographic shape. We classified the catalog into distinct ranking patterns.
          </p>
        </div>

        <div className="space-y-6">
          {communityStats.anatomyCategories.map((category) => (
            <div key={category.id} className={`w-full ${category.badgeBg} border-y py-6 my-2 shadow-xs`}>
              
              {/* FULL BLEED BANNER HEADER (Centered inside max-width constraints) */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left mb-4">
                <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${category.color} leading-tight`}>
                  {category.title}
                </h3>
                <p className={`text-xs font-bold opacity-80 mt-0.5 ${category.color}`}>
                  {category.desc}
                </p>
              </div>

              {/* CAROUSEL */}
              <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
                <HorizontalCarousel itemCount={category.songs.length}>
                  {category.songs.map((m, songIdx) => {
                    const resolvedId = m.song.albumId || ALBUM_NAME_TO_ID[m.song.album] || "unknown";
                    return (
                      <div key={`${m.id}-${songIdx}`} className="w-[260px] sm:w-[320px] shrink-0 snap-center bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between m-1">
                        <div>
                          <div className="flex items-start gap-3 min-w-0 mb-3">
                            <AlbumArtwork albumId={resolvedId} className="w-12 h-12 rounded-lg shadow-sm border border-slate-100 shrink-0 object-cover" />
                            <div className="min-w-0 flex-1 pt-1">
                              <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight text-balance">{m.song.title}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-1">
                          <DistributionBars pBanger={m.pBanger} pSlaps={m.pSlaps} pMid={m.pMid} pSkip={m.pSkip} pTrash={m.pTrash} />
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

      {/* SECTION 3: TRIBES & MICRO-INSIGHTS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 mt-10">
        
        {/* FULL WIDTH GENERATIONAL BREAKDOWN */}
        <GenerationalTasteGrid />

        {/* ROW 3: FAN TRIBES & MICRO-INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-4">
          
          {/* FAN TRIBES */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 h-full">
            <div className="text-center sm:text-left mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Voting Behavior</span>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Fan Tribes</h2>
              <p className="text-xs font-medium text-slate-500 mt-2">Where users fall based on their voting patterns.</p>
            </div>

            <div className="space-y-3">
              {communityStats.tribes.map((tribe, i) => (
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
                    <span className="text-xl font-black text-[#0072CE] leading-none shrink-0">{tribe.pct}%</span>
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
            {communityStats.loneBangers.length > 0 && (
              <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                <div className="text-center sm:text-left mb-5">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                    Better Than The Album
                  </h2>
                  <p className="text-xs text-slate-500 text-balance">The highest-rated songs carrying the lowest-rated albums.</p>
                </div>

                <HorizontalCarousel itemCount={communityStats.loneBangers.length}>
                  {communityStats.loneBangers.map((item) => (
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

            {/* TASTE TWINS */}
            {communityStats.tasteTwin && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
                <div className="text-center sm:text-left mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">Correlation</span>
                  <h2 className="text-2xl font-black text-white tracking-tight leading-tight">Taste Twins</h2>
                  <p className="text-xs text-slate-400 mt-2 text-balance">
                    Fans who love the global #1 track almost always love this deep cut.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3">
                  <div className="bg-indigo-500/20 p-4 rounded-xl text-center w-full sm:flex-1 border border-indigo-500/30">
                    <span className="text-sm font-bold text-white text-balance">{communityStats.tasteTwin.target.title}</span>
                  </div>
                  <div className="flex sm:flex-col items-center justify-center shrink-0">
                    <div className="w-4 h-0.5 sm:w-0.5 sm:h-3 bg-amber-400/50" />
                    <div className="text-amber-400 font-black px-3 py-1 border border-amber-400/30 rounded-full bg-amber-400/10 text-[10px] shrink-0 my-1 sm:my-0 sm:mx-1">
                      {communityStats.tasteTwin.pct}% Match
                    </div>
                    <div className="w-4 h-0.5 sm:w-0.5 sm:h-3 bg-amber-400/50" />
                  </div>
                  <div className="bg-blue-500/20 p-4 rounded-xl text-center w-full sm:flex-1 border border-blue-500/30">
                    <span className="text-sm font-bold text-white text-balance">{communityStats.tasteTwin.twin.title}</span>
                  </div>
                </div>
              </div>
            )}

            {/* OLD SCHOOL VS NEW SCHOOL (Generational Divide) */}
            {communityStats.genClassicistSong && communityStats.genModernistSong && (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex-1">
                <div className="text-center sm:text-left mb-5">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Old vs. New</h2>
                  <p className="text-xs text-slate-500 mt-2 text-balance">The tracks pre-2000 purists and modern defenders disagree on most.</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">Old School Choice</span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight text-balance mb-3">"{communityStats.genClassicistSong.song.title}"</h3>
                    <div className="flex items-center gap-3 text-center">
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">90s Purists</span>
                        <span className="text-lg font-black text-[#0072CE]">{communityStats.genClassicistSong.cMean.toFixed(1)}</span>
                      </div>
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Modernists</span>
                        <span className="text-lg font-black text-slate-400">{communityStats.genClassicistSong.mMean.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block mb-1">New School Choice</span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight text-balance mb-3">"{communityStats.genModernistSong.song.title}"</h3>
                    <div className="flex items-center gap-3 text-center">
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Modernists</span>
                        <span className="text-lg font-black text-emerald-500">{communityStats.genModernistSong.mMean.toFixed(1)}</span>
                      </div>
                      <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">90s Purists</span>
                        <span className="text-lg font-black text-slate-400">{communityStats.genModernistSong.cMean.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}