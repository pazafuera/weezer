'use client';

import React, { useRef, useState, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { ALBUM_NAME_TO_ID } from '../data/constants';
import { AlbumArtwork } from './SharedUI';

interface RankedSong {
  id: string;
  title: string;
  album: string;
  rank: number;
}

// NEW INTERFACE: Accepts explicit album rankings from the parent
interface RankedAlbum {
  album: string;
  rank: number;
}

interface TierListChartProps {
  title: string;
  subtitle: string;
  rankedSongs: RankedSong[];
  rankedAlbums: RankedAlbum[]; // NEW PROP
  username?: string;
}

// OFFICIAL WEEZER ALBUM COLOR IDENTITIES
const ALBUM_COLORS: Record<string, { bg: string; text: string }> = {
  'The Blue Album': { bg: 'bg-[#0072CE]', text: 'text-white' },
  'Pinkerton': { bg: 'bg-[#1a1a1a]', text: 'text-pink-300' },
  'Green Album': { bg: 'bg-emerald-500', text: 'text-emerald-950' },
  'Maladroit': { bg: 'bg-amber-900', text: 'text-amber-100' },
  'Make Believe': { bg: 'bg-zinc-800', text: 'text-zinc-100' },
  'Red Album': { bg: 'bg-red-600', text: 'text-white' },
  'Raditude': { bg: 'bg-yellow-400', text: 'text-yellow-950' },
  'Hurley': { bg: 'bg-[#5c3a21]', text: 'text-orange-100' },
  'Death to False Metal': { bg: 'bg-[#005fA3]', text: 'text-amber-300' },
  'EWBAITE': { bg: 'bg-amber-600', text: 'text-amber-50' },
  'Everything Will Be Alright in the End': { bg: 'bg-amber-600', text: 'text-amber-50' },
  'White Album': { bg: 'bg-slate-100', text: 'text-slate-600' },
  'Pacific Daydream': { bg: 'bg-fuchsia-500', text: 'text-white' },
  'Teal Album': { bg: 'bg-teal-400', text: 'text-teal-950' },
  'Black Album': { bg: 'bg-black', text: 'text-slate-300' },
  'OK Human': { bg: 'bg-sky-300', text: 'text-sky-950' },
  'Van Weezer': { bg: 'bg-purple-600', text: 'text-purple-100' },
  'SZNZ: Spring': { bg: 'bg-lime-400', text: 'text-lime-950' },
  'SZNZ: Summer': { bg: 'bg-amber-400', text: 'text-amber-950' },
  'SZNZ: Autumn': { bg: 'bg-orange-600', text: 'text-white' },
  'SZNZ: Winter': { bg: 'bg-cyan-200', text: 'text-cyan-950' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-800', text: 'text-slate-100' };

// 206 Songs Distribution Cutoffs
const SONG_TIERS = [
  { label: 'S', color: 'bg-[#FF7F7F]', text: 'text-red-950', max: 10 },
  { label: 'A', color: 'bg-[#FFBF7F]', text: 'text-orange-950', max: 35 },
  { label: 'B', color: 'bg-[#FFFF7F]', text: 'text-yellow-950', max: 80 },
  { label: 'C', color: 'bg-[#7FFF7F]', text: 'text-green-950', max: 130 },
  { label: 'D', color: 'bg-[#7FBFFF]', text: 'text-blue-950', max: 175 },
  { label: 'F', color: 'bg-[#BF7FFF]', text: 'text-purple-950', max: 206 },
];

// Album Ranking Cutoffs
const ALBUM_TIERS = [
  { label: 'S', color: 'bg-[#FF7F7F]', text: 'text-red-950', max: 2 },
  { label: 'A', color: 'bg-[#FFBF7F]', text: 'text-orange-950', max: 5 },
  { label: 'B', color: 'bg-[#FFFF7F]', text: 'text-yellow-950', max: 9 },
  { label: 'C', color: 'bg-[#7FFF7F]', text: 'text-green-950', max: 13 },
  { label: 'D', color: 'bg-[#7FBFFF]', text: 'text-blue-950', max: 16 },
  { label: 'F', color: 'bg-[#BF7FFF]', text: 'text-purple-950', max: 99 },
];

export default function TierListChart({ title, subtitle, rankedSongs, rankedAlbums, username }: TierListChartProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'songs' | 'albums'>('songs');

  const currentTiers = viewMode === 'songs' ? SONG_TIERS : ALBUM_TIERS;

  // Process items using the parent's explicit rankings!
  const processedTiers = useMemo(() => {
    return currentTiers.map((tier, index) => {
      const prevMax = index === 0 ? 0 : currentTiers[index - 1].max;
      let items = [];

      if (viewMode === 'songs') {
        items = rankedSongs
          .filter((s) => s.rank > prevMax && s.rank <= tier.max)
          .map((s) => ({ id: s.id, name: s.title, album: s.album, rank: s.rank }));
      } else {
        items = rankedAlbums
          .filter((a) => a.rank > prevMax && a.rank <= tier.max)
          .map((a) => ({ id: a.album, name: a.album, album: a.album, rank: a.rank }));
      }
      return { ...tier, items };
    });
  }, [currentTiers, rankedSongs, rankedAlbums, viewMode]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        await toPng(exportRef.current!, { quality: 0.1, pixelRatio: 1 });
        
        const dataUrl = await toPng(exportRef.current!, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: '#0f172a',
        });
        
        const filename = `${username ? `${username}-` : ''}weezer-${viewMode}-tiers.png`;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isMobile && navigator.share) {
          try {
            const fetchRes = await fetch(dataUrl);
            const blob = await fetchRes.blob();
            const file = new File([blob], filename, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'My Weezer Tier List',
              });
              setIsExporting(false);
              return; 
            }
          } catch (shareErr) {
            console.error('Native sharing failed or was canceled', shareErr);
          }
        }

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

      } catch (err) {
        console.error('Failed to export tier list', err);
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  const renderTierGrid = (isExportMode: boolean) => (
    <div className={`bg-black p-0.5 sm:p-1 flex flex-col gap-0.5 sm:gap-1 w-full rounded-xl overflow-hidden ${isExportMode ? '' : 'border border-slate-800'}`}>
      {processedTiers.map((tier) => (
        <div 
          key={tier.label} 
          className="flex bg-black gap-0.5 sm:gap-1 min-h-[80px] w-full"
        >
          {/* TIER BADGE */}
          <div className={`w-14 sm:w-20 shrink-0 flex items-center justify-center ${tier.color}`}>
            <span className={`text-2xl sm:text-4xl font-black ${tier.text}`}>
              {tier.label}
            </span>
          </div>

          {/* SCROLLING CONTAINER */}
          <div className="flex-1 min-w-0 bg-slate-900 w-full h-full relative">
            <div 
              className={`w-full h-full ${
                isExportMode 
                  ? 'flex flex-wrap gap-1 p-1 content-start' 
                  : 'flex overflow-x-auto flex-nowrap gap-0.5 sm:gap-1 p-0.5 sm:p-1 overscroll-x-contain custom-tier-scrollbar'
              }`}
            >
              {tier.items.length === 0 ? (
                <div className="flex items-center px-4">
                  <span className="text-xs font-bold text-slate-700 italic">No items</span>
                </div>
              ) : (
                tier.items.map((item) => {
                  const resolvedId = ALBUM_NAME_TO_ID[item.album] || 'unknown';
                  const theme = ALBUM_COLORS[item.album] || DEFAULT_COLOR;

                  // ALBUMS VIEW (Uses actual Album Artwork)
                  if (viewMode === 'albums') {
                    return (
                      <div
                        key={item.id}
                        className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 p-1 flex items-center justify-center ${
                          isExportMode ? '' : 'hover:scale-[1.02] transition-transform cursor-default'
                        }`}
                        title={`#${item.rank} ${item.name}`}
                      >
                        <div className="w-full h-full relative rounded-md overflow-hidden border border-slate-700 shadow-sm bg-slate-800">
                          <AlbumArtwork albumId={resolvedId} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-tl-md backdrop-blur-sm">
                            #{item.rank}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // SONGS VIEW (Uses colored text blocks)
                  return (
                    <div
                      key={item.id}
                      className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center p-1 text-center select-none ${theme.bg} ${theme.text} ${
                        isExportMode ? '' : 'hover:scale-[1.02] transition-transform cursor-default'
                      }`}
                      title={`#${item.rank} ${item.name} (${item.album})`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight line-clamp-4 text-balance uppercase">
                        {item.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 w-full overflow-hidden">
      
      {/* INJECT CUSTOM SCROLLBAR CSS FOR DESKTOP MOUSE USERS */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-tier-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #334155 transparent;
        }
        .custom-tier-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-tier-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-tier-scrollbar::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
      `}} />

      {/* TOGGLE SWITCH */}
      <div className="flex justify-center">
        <div className="bg-slate-200/90 p-1 rounded-2xl inline-flex shadow-inner">
          <button
            onClick={() => setViewMode('songs')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              viewMode === 'songs'
                ? 'bg-white text-[#0072CE] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Top Songs
          </button>
          <button
            onClick={() => setViewMode('albums')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              viewMode === 'albums'
                ? 'bg-white text-[#0072CE] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Albums
          </button>
        </div>
      </div>

      {/* WEB UI VISIBLE CHART */}
      <div className="bg-slate-900 rounded-2xl p-3 sm:p-5 shadow-xl border border-slate-800 space-y-4 w-full overflow-hidden">
        {/* HEADER */}
        <div className="text-center mb-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
            {subtitle} {username && `| @${username}`}
          </p>
        </div>

        {/* Renders horizontal scroll version safely! */}
        {renderTierGrid(false)}
      </div>

      {/* HIDDEN EXPORT CHART (Pre-rendered explicitly for Image Capture) */}
      <div className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none">
        <div ref={exportRef} className="w-[1024px] bg-[#0f172a] p-8">
          
          {/* BRANDING HEADER FOR EXPORT */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-6 mb-8">
            <div className="flex-1 pr-8">
              <h2 className="text-6xl font-black text-white tracking-tight leading-none mb-2">
                All My Favorite Songs
              </h2>
              <h3 className="text-2xl font-black text-slate-300 uppercase tracking-widest mb-4">
                The Weezer Song Ranking Project
              </h3>
              <p className="text-xl font-bold text-amber-400">
                {username 
                  ? `@${username}'s Personalized Weezer Song Tiers`
                  : "The Weezer Fan Community's Weezer Song Tiers"}
              </p>
            </div>
            
            {/* CALL TO ACTION BADGE */}
            <div className="text-left bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg shrink-0 w-[320px]">
              <p className="text-sm font-bold text-slate-300 leading-snug">
                Make your own Weezer Song rankings list at <span className="text-[#0072CE] font-black">RankingWeezer.com</span> and connect with @usernames to compare your tastes side-by-side.
              </p>
            </div>
          </div>
          
          {/* Renders full wrap desktop version */}
          {renderTierGrid(true)}
          
          {/* SUBTLE FOOTER */}
          <div className="text-center pt-6 text-slate-500 font-bold text-sm tracking-widest uppercase">
            Generated via RankingWeezer.com
          </div>
        </div>
      </div>

      {/* SAVE / SHARE BUTTON */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full bg-[#0072CE] hover:bg-blue-600 active:scale-98 text-white font-black py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        <span>{isExporting ? 'Generating Image...' : '📸 Save Tier List as Image'}</span>
      </button>
    </div>
  );
}