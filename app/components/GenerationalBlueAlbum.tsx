'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { FULL_SONG_POOL, ALBUMS_BY_ID, ALBUM_NAME_TO_ID, Song } from '../data/constants';

type Generation = 'boomer' | 'genx' | 'millennial' | 'genz';

interface GenStats {
  name: string;
  years: string;
  sampleSize: number;
  topSong: string | null;
  topAlbum: string | null;
}

export default function GenerationalBlueAlbum() {
  const [hoveredGen, setHoveredGen] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [genData, setGenData] = useState<Record<Generation, GenStats>>({
    boomer: { name: 'Boomers', years: 'Pre-1965', sampleSize: 0, topSong: null, topAlbum: null },
    genx: { name: 'Gen X', years: '1965–1980', sampleSize: 0, topSong: null, topAlbum: null },
    millennial: { name: 'Millennials', years: '1981–1996', sampleSize: 0, topSong: null, topAlbum: null },
    genz: { name: 'Gen Z', years: '1997+', sampleSize: 0, topSong: null, topAlbum: null },
  });

  useEffect(() => {
    fetchAndCalculateDemographics();
  }, []);

  const fetchAndCalculateDemographics = async () => {
    setLoading(true);
    try {
      // Fetch profiles with birth years
      const { data: profiles } = await supabase.from('profiles').select('id, birth_year').not('birth_year', 'is', null);
      // Fetch all rankings
      const { data: rankings } = await supabase.from('weezer_rankings').select('user_id, master_list');

      if (!profiles || !rankings) return;

      // Group users by generation
      const cohorts: Record<Generation, string[]> = { boomer: [], genx: [], millennial: [], genz: [] };
      
      profiles.forEach(p => {
        if (!p.birth_year) return;
        if (p.birth_year < 1965) cohorts.boomer.push(p.id);
        else if (p.birth_year <= 1980) cohorts.genx.push(p.id);
        else if (p.birth_year <= 1996) cohorts.millennial.push(p.id);
        else cohorts.genz.push(p.id);
      });

      const rankingMap = new Map(rankings.map(r => [r.user_id, r.master_list]));

      const processGeneration = (userIds: string[]): GenStats => {
        if (userIds.length === 0) return { name: '', years: '', sampleSize: 0, topSong: null, topAlbum: null };

        const songPositions: Record<string, number[]> = {};
        const albumPoints: Record<string, number> = {};

        let validLists = 0;

        userIds.forEach(uid => {
          const list = rankingMap.get(uid);
          if (list && Array.isArray(list) && list.length > 0) {
            validLists++;
            list.forEach((song: Song, idx: number) => {
              if (!songPositions[song.id]) songPositions[song.id] = [];
              songPositions[song.id].push(idx + 1);

              // Simple album weight: points for being in the top 20
              if (idx < 20) {
                const resolvedId = (song as any).albumId || ALBUM_NAME_TO_ID[song.album] || 'unknown';
                albumPoints[resolvedId] = (albumPoints[resolvedId] || 0) + (20 - idx);
              }
            });
          }
        });

        if (validLists === 0) return { name: '', years: '', sampleSize: 0, topSong: null, topAlbum: null };

        // Find #1 Song
        let bestSongId = null;
        let bestAvg = 999;
        Object.entries(songPositions).forEach(([id, positions]) => {
          // Require at least a fraction of the cohort to have ranked it to avoid outliers
          if (positions.length > validLists * 0.1) {
            const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
            if (avg < bestAvg) { bestAvg = avg; bestSongId = id; }
          }
        });

        const topSongTitle = bestSongId ? FULL_SONG_POOL.find(s => s.id === bestSongId)?.title || null : null;

        // Find #1 Album
        let bestAlbumId = null;
        let maxPts = 0;
        Object.entries(albumPoints).forEach(([id, pts]) => {
          if (pts > maxPts) { maxPts = pts; bestAlbumId = id; }
        });

        const topAlbumTitle = bestAlbumId ? ALBUMS_BY_ID[bestAlbumId]?.name || bestAlbumId : null;

        return { name: '', years: '', sampleSize: validLists, topSong: topSongTitle, topAlbum: topAlbumTitle };
      };

      setGenData({
        boomer: { ...genData.boomer, ...processGeneration(cohorts.boomer) },
        genx: { ...genData.genx, ...processGeneration(cohorts.genx) },
        millennial: { ...genData.millennial, ...processGeneration(cohorts.millennial) },
        genz: { ...genData.genz, ...processGeneration(cohorts.genz) },
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const figures: { id: Generation; label: string; offset: string; path: string; viewBox: string }[] = [
    {
      id: 'genx', // Brian / Left
      label: 'Gen X',
      offset: 'mb-0 h-[80%]',
      viewBox: '0 0 100 250',
      path: 'M25,250 C25,180 15,130 15,100 C15,80 30,70 30,50 C30,30 40,20 50,20 C60,20 70,30 70,50 C70,70 85,80 85,100 C85,130 75,180 75,250 Z',
    },
    {
      id: 'genz', // Rivers / Center-Left (Slightly shorter)
      label: 'Gen Z',
      offset: 'mb-0 h-[75%]',
      viewBox: '0 0 100 250',
      path: 'M20,250 C20,190 10,140 10,110 C10,90 28,80 28,60 C28,40 38,30 50,30 C62,30 72,40 72,60 C72,80 90,90 90,110 C90,140 80,190 80,250 Z',
    },
    {
      id: 'millennial', // Matt / Center-Right (Tallest)
      label: 'Millennials',
      offset: 'mb-0 h-[85%]',
      viewBox: '0 0 100 250',
      path: 'M22,250 C22,170 12,120 12,90 C12,70 32,60 32,40 C32,20 42,10 50,10 C58,10 68,20 68,40 C68,60 88,70 88,90 C88,120 78,170 78,250 Z',
    },
    {
      id: 'boomer', // Pat / Right
      label: 'Boomers',
      offset: 'mb-0 h-[78%]',
      viewBox: '0 0 100 250',
      path: 'M18,250 C18,185 8,135 8,105 C8,85 26,75 26,55 C26,35 36,25 50,25 C64,25 74,35 74,55 C74,75 92,85 92,105 C92,135 82,185 82,250 Z',
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden mt-8">
      <div className="text-center mb-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">Generational Tastes</span>
        <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">The Generations Album</h3>
        <p className="text-xs font-bold text-slate-500 mt-2">Hover over a silhouette to see their definitive top tracks.</p>
      </div>

      {/* THE BLUE ALBUM CANVAS */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] bg-[#0072CE] rounded-2xl overflow-hidden shadow-inner flex items-end justify-evenly px-4 sm:px-12 group/canvas">
        
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 bg-[#0072CE]/80 backdrop-blur-sm flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Fake "Weezer" Logo Top Right */}
        <div className="absolute top-4 right-6 sm:top-8 sm:right-10 text-right z-10 select-none">
          <h2 className="text-black font-sans font-normal tracking-tighter text-3xl sm:text-5xl lowercase">weezer</h2>
        </div>

        {/* FIGURES */}
        {figures.map((fig) => {
          const isHovered = hoveredGen === fig.id;
          const isFaded = hoveredGen !== null && !isHovered;
          const stats = genData[fig.id];

          return (
            <div
              key={fig.id}
              className={`relative ${fig.offset} w-1/4 max-w-[120px] flex justify-center transition-all duration-300 ${isFaded ? 'opacity-30' : 'opacity-100'}`}
              onMouseEnter={() => setHoveredGen(fig.id)}
              onMouseLeave={() => setHoveredGen(null)}
              onClick={() => setHoveredGen(isHovered ? null : fig.id)} // Touch support
            >
              {/* SILHOUETTE SVG */}
              <svg viewBox={fig.viewBox} className="w-full h-full text-[#111111] fill-current drop-shadow-2xl transition-transform duration-300 hover:scale-[1.02] cursor-pointer">
                <path d={fig.path} />
              </svg>

              {/* TOOLTIP / STATS POPUP */}
              <div 
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 sm:w-56 bg-slate-950 text-white p-4 rounded-2xl shadow-2xl transition-all duration-300 pointer-events-none z-30 ${isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
              >
                <div className="text-center border-b border-slate-800 pb-2 mb-2">
                  <h4 className="text-lg font-black text-amber-400 leading-none">{genData[fig.id].name}</h4>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{genData[fig.id].years}</span>
                </div>
                
                {stats.sampleSize > 0 ? (
                  <div className="space-y-3 text-left">
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-500 block">🥇 #1 Song</span>
                      <span className="text-sm font-bold text-white truncate block">{stats.topSong || 'TBD'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase text-slate-500 block">💿 #1 Album</span>
                      <span className="text-sm font-bold text-white truncate block">{stats.topAlbum || 'TBD'}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 text-center">
                      <span className="text-[9px] font-bold text-slate-400">Based on {stats.sampleSize} fans</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <span className="text-xs font-bold text-slate-500">Not enough data yet.</span>
                  </div>
                )}

                {/* Triangle Pointer */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-950" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}