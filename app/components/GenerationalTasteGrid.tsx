'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { FULL_SONG_POOL, ALBUMS_BY_ID, ALBUM_NAME_TO_ID, Song } from '../data/constants';
import { AlbumArtwork } from './SharedUI';

type Generation = 'boomer' | 'genx' | 'millennial' | 'genz' | 'genalpha';

interface GenStats {
  id: Generation;
  name: string;
  years: string;
  color: string;
  sampleSize: number;
  topSong: string | null;
  topSongAlbumId: string | null;
  topAlbum: string | null;
  topAlbumId: string | null;
  hotTakeSong: string | null;
  classicEraPct: number; // % of top rankings in 90s
}

export default function GenerationalTasteGrid() {
  const [loading, setLoading] = useState(true);
  const [genData, setGenData] = useState<GenStats[]>([
    { id: 'boomer', name: 'Boomers', years: 'Pre-1965', color: 'bg-slate-900 border-slate-800 text-white', sampleSize: 0, topSong: null, topSongAlbumId: null, topAlbum: null, topAlbumId: null, hotTakeSong: null, classicEraPct: 0 },
    { id: 'genx', name: 'Gen X', years: '1965–1980', color: 'bg-slate-900 border-slate-800 text-white', sampleSize: 0, topSong: null, topSongAlbumId: null, topAlbum: null, topAlbumId: null, hotTakeSong: null, classicEraPct: 0 },
    { id: 'millennial', name: 'Millennials', years: '1981–1996', color: 'bg-slate-900 border-slate-800 text-white', sampleSize: 0, topSong: null, topSongAlbumId: null, topAlbum: null, topAlbumId: null, hotTakeSong: null, classicEraPct: 0 },
    { id: 'genz', name: 'Gen Z', years: '1997–2012', color: 'bg-slate-900 border-slate-800 text-white', sampleSize: 0, topSong: null, topSongAlbumId: null, topAlbum: null, topAlbumId: null, hotTakeSong: null, classicEraPct: 0 },
    { id: 'genalpha', name: 'Gen Alpha', years: '2013+', color: 'bg-slate-900 border-slate-800 text-white', sampleSize: 0, topSong: null, topSongAlbumId: null, topAlbum: null, topAlbumId: null, hotTakeSong: null, classicEraPct: 0 },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetchAndCalculateDemographics();
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setActiveIndex(Math.round(scrollLeft / (clientWidth * 0.8)));
  };

  const fetchAndCalculateDemographics = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, birth_year').not('birth_year', 'is', null);
      const { data: rankings } = await supabase.from('weezer_rankings').select('user_id, master_list');

      if (!profiles || !rankings) return;

      const cohorts: Record<Generation, string[]> = { boomer: [], genx: [], millennial: [], genz: [], genalpha: [] };
      
      profiles.forEach(p => {
        if (!p.birth_year) return;
        if (p.birth_year < 1965) cohorts.boomer.push(p.id);
        else if (p.birth_year <= 1980) cohorts.genx.push(p.id);
        else if (p.birth_year <= 1996) cohorts.millennial.push(p.id);
        else if (p.birth_year <= 2012) cohorts.genz.push(p.id);
        else cohorts.genalpha.push(p.id);
      });

      const rankingMap = new Map(rankings.map(r => [r.user_id, r.master_list]));

      // Calculate global averages for Hot Take detection
      const globalSongPositions: Record<string, number[]> = {};
      rankings.forEach(r => {
        if (Array.isArray(r.master_list)) {
          r.master_list.forEach((song: Song, idx: number) => {
            if (!globalSongPositions[song.id]) globalSongPositions[song.id] = [];
            globalSongPositions[song.id].push(idx + 1);
          });
        }
      });

      const globalAvgMap = new Map<string, number>();
      Object.entries(globalSongPositions).forEach(([id, pos]) => {
        globalAvgMap.set(id, pos.reduce((a, b) => a + b, 0) / pos.length);
      });

      const processGeneration = (userIds: string[]): Partial<GenStats> => {
        if (userIds.length === 0) return { sampleSize: 0 };

        const songPositions: Record<string, number[]> = {};
        const albumPoints: Record<string, number> = {};
        let classicSongCount = 0;
        let totalTop20Count = 0;

        let validLists = 0;

        userIds.forEach(uid => {
          const list = rankingMap.get(uid);
          if (list && Array.isArray(list) && list.length > 0) {
            validLists++;
            list.forEach((song: Song, idx: number) => {
              if (!songPositions[song.id]) songPositions[song.id] = [];
              songPositions[song.id].push(idx + 1);

              if (idx < 20) {
                totalTop20Count++;
                if (song.year && song.year <= 1999) classicSongCount++;

                const resolvedId = (song as any).albumId || ALBUM_NAME_TO_ID[song.album] || 'unknown';
                albumPoints[resolvedId] = (albumPoints[resolvedId] || 0) + (20 - idx);
              }
            });
          }
        });

        if (validLists === 0) return { sampleSize: 0 };

        // 1. Find #1 Song
        let bestSongId = null;
        let bestAvg = 999;
        Object.entries(songPositions).forEach(([id, positions]) => {
          if (positions.length >= Math.max(1, validLists * 0.1)) {
            const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
            if (avg < bestAvg) { bestAvg = avg; bestSongId = id; }
          }
        });

        const topSongObj = bestSongId ? FULL_SONG_POOL.find(s => s.id === bestSongId) : null;
        
        // 2. Find #1 Album
        let bestAlbumId = null;
        let maxPts = 0;
        Object.entries(albumPoints).forEach(([id, pts]) => {
          if (pts > maxPts) { maxPts = pts; bestAlbumId = id; }
        });

        // 3. Find Hot Take Song (Highest positive rank boost vs global average)
        let hotTakeSongId = null;
        let maxDelta = -999;
        Object.entries(songPositions).forEach(([id, positions]) => {
          if (positions.length >= Math.max(1, validLists * 0.1)) {
            const cohortAvg = positions.reduce((a, b) => a + b, 0) / positions.length;
            const globalAvg = globalAvgMap.get(id) || 100;
            const delta = globalAvg - cohortAvg; // Higher delta = cohort ranked it much higher (lower number)
            if (delta > maxDelta) { maxDelta = delta; hotTakeSongId = id; }
          }
        });

        const hotTakeObj = hotTakeSongId ? FULL_SONG_POOL.find(s => s.id === hotTakeSongId) : null;
        const classicEraPct = totalTop20Count > 0 ? Math.round((classicSongCount / totalTop20Count) * 100) : 0;

        return { 
          sampleSize: validLists, 
          topSong: topSongObj?.title || null, 
          topSongAlbumId: topSongObj ? (topSongObj as any).albumId || ALBUM_NAME_TO_ID[topSongObj.album] : null,
          topAlbum: bestAlbumId ? ALBUMS_BY_ID[bestAlbumId]?.name : null,
          topAlbumId: bestAlbumId,
          hotTakeSong: hotTakeObj?.title || null,
          classicEraPct
        };
      };

      setGenData(prev => prev.map(gen => ({
        ...gen,
        ...processGeneration(cohorts[gen.id])
      })));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // HIDE GENERATIONS WITH 0 SUBMISSIONS
  const activeGenerations = genData.filter(g => g.sampleSize > 0);
  const totalActiveFans = activeGenerations.reduce((sum, gen) => sum + gen.sampleSize, 0);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
        <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span className="text-xs font-bold text-slate-400">Loading Generational Insights...</span>
      </div>
    );
  }

  if (activeGenerations.length === 0) {
    return null; // Don't render component if no users have set their birth year yet
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="text-center sm:text-left mb-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">Demographics</span>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">Generational Breakdown</h2>
        <p className="text-xs font-bold text-slate-500 mt-1">Comparing preferences across age cohorts.</p>
      </div>

      {/* HORIZONTAL SLIDING CAROUSEL */}
      <div className="relative w-full">
        <div 
          ref={scrollRef} 
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory py-2 scrollbar-none"
        >
          {activeGenerations.map((gen) => {
            const pct = totalActiveFans > 0 ? Math.round((gen.sampleSize / totalActiveFans) * 100) : 0;
            
            return (
              <div 
                key={gen.id} 
                className={`w-[280px] sm:w-[320px] shrink-0 snap-center rounded-3xl border ${gen.color} shadow-lg p-5 flex flex-col justify-between`}
              >
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-baseline border-b border-slate-800 pb-3 mb-4">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">{gen.name}</h3>
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">{gen.years}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-300 bg-slate-800 px-2 py-1 rounded-full whitespace-nowrap">
                      {pct}% of Base
                    </span>
                  </div>

                  {/* Main Favorites */}
                  <div className="space-y-4">
                    {/* #1 Song */}
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 block mb-1">🥇 Favorite Song</span>
                      <div className="flex items-center gap-3">
                        {gen.topSongAlbumId && (
                          <AlbumArtwork albumId={gen.topSongAlbumId} className="w-10 h-10 rounded-lg shadow-sm object-cover shrink-0" />
                        )}
                        <span className="text-sm font-bold text-white truncate">{gen.topSong || 'N/A'}</span>
                      </div>
                    </div>

                    {/* #1 Album */}
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-1">💿 Favorite Album</span>
                      <div className="flex items-center gap-3">
                        {gen.topAlbumId && (
                          <AlbumArtwork albumId={gen.topAlbumId} className="w-10 h-10 rounded-lg shadow-sm object-cover shrink-0" />
                        )}
                        <span className="text-sm font-bold text-white truncate">{gen.topAlbum || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Signature Hot Take */}
                    {gen.hotTakeSong && (
                      <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 block mb-1">🔥 Cohort Hot Take</span>
                        <p className="text-xs font-bold text-slate-200 truncate">"{gen.hotTakeSong}"</p>
                        <span className="text-[8px] font-semibold text-slate-400 mt-0.5 block">Ranked higher than global consensus</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Era Preference Bar */}
                <div className="mt-5 pt-3 border-t border-slate-800">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 mb-1">
                    <span>90s Era Lean</span>
                    <span className="text-white">{gen.classicEraPct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0072CE] rounded-full transition-all duration-500" style={{ width: `${gen.classicEraPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carousel Dots Navigation */}
        {activeGenerations.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {activeGenerations.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === i ? 'w-4 bg-[#0072CE]' : 'w-1.5 bg-slate-300'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}