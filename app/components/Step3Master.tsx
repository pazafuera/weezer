'use client';
import React from 'react';
import { BucketType, Song, BUCKET_CONFIG } from '../data/constants';
import { AudioPreviewButton, FlyingWIcon } from './SharedUI';
import { getRankedSongs } from '@/utils/rankingUtils';

export default function Step3Master({
  masterList, 
  triageMap, 
  moveMasterSong, 
  setStep,
  onBack
}: {
  masterList: Song[]; 
  triageMap: Record<string, BucketType>; 
  moveMasterSong: (idx: number, dir: 'up'|'down') => void; 
  setStep: (s: 'wrapped') => void;
  onBack: () => void;
}) {
  const triggerHaptic = (duration = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) try { navigator.vibrate(duration); } catch (e) {}
  };

  // Final Review only lists explicitly ranked songs. A song missing from the
  // triage map is unranked — never infer a bucket (especially Trash) for it.
  const rankedSongs = getRankedSongs(masterList, triageMap);

  // Find the index of the very last rankable song (so we can disable the down arrow on it)
  const lastRankableIndex = rankedSongs.map(s => triageMap[s.id]).findLastIndex(b => b === 'banger' || b === 'slaps');

  return (
    <div className="space-y-6 pb-24">
      
      {/* LOCAL BACK NAVIGATION */}
      <div className="px-4 pt-2">
        <button 
          onClick={() => { triggerHaptic(15); onBack(); }}
          className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          ← Back to Refinement
        </button>
      </div>

      {/* SHARP, SUCCINCT HEADER */}
      <div className="text-center space-y-2 px-4 mb-8">
        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border bg-blue-100 text-[#0072CE] border-blue-200">
          Step 3 of 3
        </span>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">
          Final Review
        </h1>
        <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-tight">
          Make any final tweaks to your top rankings. If a song is in the wrong bucket, go back to fix it!
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-xs">
        <div className="space-y-1.5">
          {rankedSongs.map((song, idx) => {
            const bucket = triageMap[song.id];
            const isRankable = bucket === 'banger' || bucket === 'slaps';
            const cfg = BUCKET_CONFIG[bucket];
            
            return (
              <div key={song.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between gap-3 hover:border-blue-300 transition-colors">
                
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* ONLY SHOW RANK NUMBERS FOR TOP TWO BUCKETS */}
                  {isRankable ? (
                    <span className="w-7 h-7 bg-[#0072CE] text-white font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 shadow-2xs">
                      #{idx + 1}
                    </span>
                  ) : (
                    <span className="w-7 h-7 bg-slate-200 text-slate-400 font-black text-[11px] rounded-lg flex items-center justify-center shrink-0 shadow-2xs opacity-50">
                      -
                    </span>
                  )}
                  
                  <div className="min-w-0 text-left flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">{song.title}</h3>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${cfg.badgeBg} w-fit leading-none flex items-center gap-1`}>
                        <span className="text-[10px]">{cfg.emoji}</span> <span>{cfg.label}</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 block truncate">{song.album} ({song.year})</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                <AudioPreviewButton title={song.title} />
                  
                  {/* ONLY SHOW UP/DOWN ARROWS FOR TOP TWO BUCKETS */}
                  {isRankable && (
                    <div className="flex items-center gap-1 ml-1">
                      <button 
                        onClick={() => { triggerHaptic(10); moveMasterSong(idx, 'up'); }} 
                        disabled={idx === 0} 
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-800 font-black text-sm flex items-center justify-center border border-slate-300 cursor-pointer shadow-2xs transition-colors"
                      >
                        ↑
                      </button>
                      <button 
                        onClick={() => { triggerHaptic(10); moveMasterSong(idx, 'down'); }} 
                        disabled={idx >= lastRankableIndex} 
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-800 font-black text-sm flex items-center justify-center border border-slate-300 cursor-pointer shadow-2xs transition-colors"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <button 
          onClick={() => { triggerHaptic(20); setStep('wrapped'); }} 
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
        >
          <FlyingWIcon className="w-6 h-4 text-slate-950" />
          <span>Generate Weezer Wrapped →</span>
        </button>
      </div>

    </div>
  );
}
