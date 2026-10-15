'use client';

import React, { useState } from 'react';
import { BucketType, BUCKET_CONFIG, FULL_SONG_POOL } from '../data/constants';
import { countBucketedSongs } from '../context/WeezerContext';
import { FlyingWIcon, AudioPreviewButton } from './SharedUI';

export default function Step1Triage({
  triageMap,
  handleSetBucket,
  handleFinishTriage,
}: {
  triageMap: Record<string, BucketType>;
  handleSetBucket: (id: string, bucket: BucketType) => void;
  handleFinishTriage: () => void;
}) {
  const [hideSorted, setHideSorted] = useState(false);

  const albumsGrouped = Array.from(new Set(FULL_SONG_POOL.map((s) => s.album)));
  const sortedCount = Object.keys(triageMap).length;
  const progressPercent = Math.round((sortedCount / FULL_SONG_POOL.length) * 100);
  const isGutCheckComplete = sortedCount === FULL_SONG_POOL.length;
  // Secondary partial-triage path: moving forward is allowed as soon as at
  // least one song has an explicit, valid triage bucket.
  const bucketedCount = countBucketedSongs(triageMap);
  const hasPartialTriage = bucketedCount >= 1;

  const scrollToAlbum = (albumName: string) => {
    const el = document.getElementById(`album-${albumName.replace(/\s+/g, '-').toLowerCase()}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* STICKY PROGRESS & ALBUM QUICK-JUMP BAR (EXPANDED FOR DESKTOP) */}
      <div className="sticky top-[56px] lg:top-[64px] z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 py-3 px-4 shadow-xs -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 mb-6 space-y-3">
        <div className="max-w-5xl lg:max-w-6xl mx-auto space-y-2">
          {/* PROGRESS METRICS & HIDE SORTED TOGGLE */}
          <div className="flex justify-between items-center text-xs font-black text-slate-700">
            <span className="uppercase tracking-wider">
              Progress: <strong className="text-[#0072CE] font-mono text-sm">{sortedCount}</strong> / {FULL_SONG_POOL.length}
            </span>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-extrabold text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={hideSorted}
                  onChange={(e) => setHideSorted(e.target.checked)}
                  className="rounded border-slate-300 text-[#0072CE] focus:ring-[#0072CE] w-3.5 h-3.5 cursor-pointer"
                />
                <span>Hide Sorted ({sortedCount})</span>
              </label>
              <span className="text-[#0072CE] font-mono text-sm font-black">{progressPercent}%</span>
            </div>
          </div>

          {/* PROGRESS BAR */}
          <div className="relative w-full h-3.5 my-2 z-0">
            <div className="absolute inset-0 bg-[#E0F2FE] rounded-full border border-blue-200 z-10" />
            <div
              className="absolute top-0 left-0 h-full bg-[#7DD3FC] rounded-full transition-all duration-300 z-20"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-30 text-[#0072CE] w-8 h-5 ml-[-16px]"
              style={{ left: `${Math.min(98, Math.max(2, progressPercent))}%` }}
            >
              <FlyingWIcon className="w-full h-full drop-shadow-sm" />
            </div>
          </div>

          {/* ALBUM QUICK-JUMP PILLS */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5 text-[10px] font-black text-slate-600">
            {albumsGrouped.map((album) => {
              const albumSongs = FULL_SONG_POOL.filter((s) => s.album === album);
              const sortedInAlbum = albumSongs.filter((s) => triageMap[s.id]).length;
              const isAlbumDone = sortedInAlbum === albumSongs.length;

              return (
                <button
                  key={album}
                  onClick={() => scrollToAlbum(album)}
                  className={`px-2.5 py-1 rounded-lg border shrink-0 transition-all cursor-pointer ${
                    isAlbumDone
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : sortedInAlbum > 0
                      ? 'bg-blue-50 border-blue-200 text-[#0072CE]'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {album} ({sortedInAlbum}/{albumSongs.length})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* HEADER */}
      <div className="text-center space-y-2 px-4 mb-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tighter">
          The <span className="text-[#0072CE]">Gut Check</span>
        </h1>
        <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-snug">
          Sort every song into a tier. Trust your first instinct, don&apos;t overthink it.
        </p>
      </div>

      {/* ALBUM GROUPS */}
      <div className="space-y-8">
        {albumsGrouped.map((albumName) => {
          const songsInAlbum = FULL_SONG_POOL.filter((s) => s.album === albumName);
          const visibleSongs = hideSorted
            ? songsInAlbum.filter((s) => !triageMap[s.id])
            : songsInAlbum;
          const firstSong = songsInAlbum[0];

          if (visibleSongs.length === 0 && hideSorted) return null;

          return (
            <div
              key={albumName}
              id={`album-${albumName.replace(/\s+/g, '-').toLowerCase()}`}
              className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-xs scroll-mt-36"
            >
              {/* ALBUM BANNER */}
              <div className={`${firstSong.albumColor} p-4 text-white text-center border-b border-slate-300`}>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">
                  {firstSong.isBSide ? 'Special Collection' : `Album (${firstSong.year})`}
                </span>
                <h2 className="text-xl font-black tracking-tight">{albumName}</h2>
              </div>

              {/* SONG ROWS WITH HORIZONTAL BUCKET ROW ON DESKTOP */}
              <div className="divide-y divide-slate-300">
                {visibleSongs.map((song, index) => {
                  const activeBucket = triageMap[song.id];
                  const isEven = index % 2 === 0;

                  return (
                    <div
                      key={song.id}
                      className={`p-3 sm:p-4 lg:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-6 transition-colors ${
                        isEven ? 'bg-slate-50/70' : 'bg-white'
                      } hover:bg-blue-50/50`}
                    >
                      {/* LEFT SIDE: PREVIEW BUTTON & TITLE */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 py-0.5">
                        <AudioPreviewButton title={song.title} />
                        <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-950 tracking-tight leading-tight break-words">
                          {song.title}
                        </h3>
                      </div>

                      {/* RIGHT SIDE: BUCKET BUTTONS IN A HORIZONTAL ROW ON DESKTOP */}
                      <div className="grid grid-cols-5 sm:flex sm:flex-row gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto items-center">
                        {(['banger', 'slaps', 'mid', 'skip', 'trash'] as BucketType[]).map((bucket) => {
                          const isSelected = activeBucket === bucket;
                          const cfg = BUCKET_CONFIG[bucket];
                          const displayLabel = bucket === 'slaps' ? 'Slaps' : cfg.label;

                          return (
                            <button
                              key={bucket}
                              onClick={() => handleSetBucket(song.id, bucket)}
                              className={`py-2 px-1.5 sm:py-2.5 sm:px-3 lg:px-4 rounded-xl text-xs sm:text-sm font-black border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-400 text-slate-950 font-black border-sky-500 shadow-md scale-[1.02] z-10'
                                  : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-800'
                              }`}
                              title={displayLabel}
                            >
                              <span className="text-sm sm:text-base leading-none">{cfg.emoji}</span>
                              <span className="truncate text-[10px] sm:text-xs lg:text-sm tracking-tight">
                                {displayLabel}
                              </span>
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2">
        {isGutCheckComplete ? (
          <button
            onClick={handleFinishTriage}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition transform hover:scale-105 cursor-pointer border-2 border-amber-200 flex items-center gap-2.5 whitespace-nowrap"
          >
            <FlyingWIcon className="w-6 h-4 text-slate-950" />
            <span>Next Step: Refine Buckets</span>
          </button>
        ) : (
          <button
            disabled
            className="bg-slate-800/95 text-slate-400 font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-full border border-slate-700 cursor-not-allowed shadow-xl backdrop-blur-md whitespace-nowrap"
          >
            🔒 Categorize All Songs ({sortedCount}/{FULL_SONG_POOL.length})
          </button>
        )}
        {hasPartialTriage && !isGutCheckComplete && (
          <button
            onClick={handleFinishTriage}
            className="text-[11px] font-semibold text-slate-300/90 hover:text-white underline underline-offset-2 decoration-slate-500 bg-slate-950/60 rounded-full px-3 py-1 backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Continue with {bucketedCount} of {FULL_SONG_POOL.length} bucketed →
          </button>
        )}
      </div>
    </div>
  );
}