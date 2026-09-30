'use client';
import React from 'react';
import { BucketType, BUCKET_CONFIG, FULL_SONG_POOL } from '../data/constants';
import { FlyingWIcon, AudioPreviewButton } from './SharedUI';

export default function Step1Triage({
  triageMap,
  handleSetBucket,
  handleFinishTriage
}: {
  triageMap: Record<string, BucketType>;
  handleSetBucket: (id: string, bucket: BucketType) => void;
  handleFinishTriage: () => void;
}) {
  const albumsGrouped = Array.from(new Set(FULL_SONG_POOL.map(s => s.album)));
  const triagedCount = Object.keys(triageMap).length;
  const progressPercent = Math.round((triagedCount / FULL_SONG_POOL.length) * 100);
  const isTriageComplete = triagedCount === FULL_SONG_POOL.length;

  return (
    <div className="space-y-6 pb-20">
      {/* STICKY PROGRESS BAR */}
      <div className="sticky top-[61px] z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 py-3 px-4 shadow-xs -mx-4 -mt-6 mb-6">
        <div className="max-w-3xl mx-auto space-y-1.5">
          <div className="flex justify-between items-center text-xs font-black text-slate-700">
            <span className="uppercase tracking-wider">
              Progress: <strong className="text-[#0072CE] font-mono text-sm">{triagedCount}</strong> / {FULL_SONG_POOL.length}
            </span>
            <span className="text-[#0072CE] font-mono text-sm font-black">{progressPercent}%</span>
          </div>
          
          {/* BULLETPROOF PROGRESS BAR LAYERING */}
          <div className="relative w-full h-3.5 my-3 z-0">
            {/* Layer 1: The Background Track (z-10) */}
            <div className="absolute inset-0 bg-[#E0F2FE] rounded-full border border-blue-200 z-10" />
            
            {/* Layer 2: The Colored Fill (z-20) */}
            <div 
              className="absolute top-0 left-0 h-full bg-[#7DD3FC] rounded-full transition-all duration-300 z-20" 
              style={{ width: `${progressPercent}%` }} 
            />
            
            {/* Layer 3: The Flying W (z-30) */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-30 text-[#0072CE] w-8 h-5 ml-[-16px]" 
              style={{ left: `${Math.min(98, Math.max(2, progressPercent))}%` }}
            >
              <FlyingWIcon className="w-full h-full drop-shadow-sm" />
            </div>
          </div>

        </div>
      </div>

      {/* SUCCINCT HEADER */}
      <div className="text-center space-y-2 px-4 mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tighter">
          The <span className="text-[#0072CE]">Gut Check</span>
        </h1>
        <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-snug">
          Sort every song into a bucket. Trust your first instinct, don't overthink it.
        </p>
      </div>

      <div className="space-y-8">
        {albumsGrouped.map((albumName) => {
          const songsInAlbum = FULL_SONG_POOL.filter(s => s.album === albumName);
          const firstSong = songsInAlbum[0];

          return (
            <div key={albumName} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className={`${firstSong.albumColor} p-4 text-white text-center border-b border-slate-100`}>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">
                  {firstSong.isBSide ? 'Special Collection' : `Album (${firstSong.year})`}
                </span>
                <h2 className="text-xl font-black tracking-tight">{albumName}</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {songsInAlbum.map((song) => {
                  const activeBucket = triageMap[song.id];

                  return (
                    <div
                      key={song.id}
                      className="p-3 sm:p-5 flex items-stretch justify-between gap-4 transition-colors bg-white hover:bg-slate-50/50"
                    >
                      {/* LEFT SIDE: MASSIVE TITLE & SAMPLE */}
                      <div className="flex flex-col items-start justify-center flex-1 min-w-0 py-1">
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tighter leading-none mb-3 break-words whitespace-normal">
                          {song.title}
                        </h3>
                        <AudioPreviewButton title={song.title} />
                      </div>

                      {/* RIGHT SIDE: WIDER CONTAINER SO "LOWKEY SLAPS" DOESN'T TRUNCATE */}
                      <div className="flex flex-col gap-1.5 shrink-0 w-[145px] sm:w-[155px]">
                        {(['banger', 'slaps', 'mid', 'skip', 'trash'] as BucketType[]).map((bucket) => {
                          const isSelected = activeBucket === bucket;
                          const cfg = BUCKET_CONFIG[bucket];

                          return (
                            <button
                              key={bucket}
                              onClick={() => handleSetBucket(song.id, bucket)}
                              className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-black border transition-all flex items-center justify-start gap-2 ${
                                isSelected
                                  ? 'bg-slate-950 text-white font-black border-slate-900 shadow-md scale-[1.02] z-10'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              <span className="text-base leading-none">{cfg.emoji}</span>
                              <span className="truncate">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        {isTriageComplete ? (
          <button onClick={handleFinishTriage} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap">
            <FlyingWIcon className="w-6 h-4 text-slate-950" />
            <span>Next Step: Refine</span>
          </button>
        ) : (
          <button disabled className="bg-slate-800/95 text-slate-400 font-extrabold text-xs px-6 py-3.5 rounded-full border border-slate-700 cursor-not-allowed shadow-xl backdrop-blur-md whitespace-nowrap">
            🔒 Categorize All Songs ({triagedCount}/{FULL_SONG_POOL.length})
          </button>
        )}
      </div>
    </div>
  );
}