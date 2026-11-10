'use client';

/**
 * StepFinalRankings — the read-only final rankings page
 * (owner, Nov 9, 2026; rebuilt the same night in the fan
 * profile page's aesthetic at the owner's direction).
 *
 * Links to a fan's final rankings used to land on Final
 * Review — the editing surface, drag handles and all. This
 * page is the opposite: a showcase, no sorting, no dragging,
 * with the two prompts that belong at the end of the
 * project — show off your list, and unravel your Sweater
 * Thread. Editing still lives in Final Review ('master');
 * a quiet link at the bottom opens it.
 *
 * Sections mirror the public profile page (`/u/[username]`)
 * and run on the same derivations (app/lib/profileStats +
 * computeTribe), so the two pages can never disagree: tribe
 * band, Top 10, era bars, bucket breakdown, then the full
 * list in expandable bucket groups. One semantic difference
 * from the profile page, at the owner's direction: only
 * Bangers and Slaps carry rank numbers here — Mid, Skip and
 * Trash were sorted into buckets but never ranked, so their
 * groups show no numbers. Songs marked "Don't Know It" were
 * never ranked either and sit in their own tail group.
 */

import React, { useMemo, useState } from 'react';
import {
  ALBUM_NAME_TO_ID,
  BUCKET_CONFIG,
  FULL_SONG_POOL,
  type BucketType,
  type Song,
} from '../data/constants';
import {
  getProgressState,
  type AppStep,
  type TriageValue,
} from '../context/WeezerContext';
import { AlbumArtwork } from './SharedUI';
import { displayFont, handFont } from './shareables/fonts';
import { computeTribe, TRIBE_INK } from './shareables/TribeBadgeCard';
import {
  PROFILE_BUCKET_COLORS,
  PROFILE_BUCKET_ORDER,
  bucketCounts,
  eraShares,
  listGroups,
  topEraTop10Note,
  topTierSongs,
} from '../lib/profileStats';

interface StepFinalRankingsProps {
  masterList: Song[];
  triageMap: Record<string, TriageValue>;
  setStep: (step: AppStep) => void;
}

const POSTER_BLUE = '#039AD1';
const INK = '#0C1220';
const PANEL =
  'rounded-[18px] border-[3px] border-[#0C1220] bg-white shadow-[4px_4px_0_rgba(11,30,63,0.85)]';
const EYEBROW =
  'block text-[10px] font-black uppercase tracking-[2.2px] text-[#0072CE]';

const headlineShadow =
  '3px 3px 0 #0C1220, -1.5px -1.5px 0 #0C1220, 1.5px -1.5px 0 #0C1220, -1.5px 1.5px 0 #0C1220, 1.5px 1.5px 0 #0C1220, -1.5px 0 0 #0C1220, 1.5px 0 0 #0C1220, 0 -1.5px 0 #0C1220, 0 1.5px 0 #0C1220';

const RANKED_GROUPS: ReadonlySet<string> = new Set(['banger', 'slaps']);

export default function StepFinalRankings({
  masterList,
  triageMap,
  setStep,
}: StepFinalRankingsProps) {
  const [groupOverrides, setGroupOverrides] = useState<
    Record<string, boolean>
  >({});

  const data = useMemo(() => {
    const progress = getProgressState(triageMap, masterList);
    const complete = masterList.length >= FULL_SONG_POOL.length;
    const triage = triageMap as Record<string, BucketType>;
    const topTier = topTierSongs(masterList, triage);
    const top10 = topTier.slice(0, 10);
    const shares = eraShares(topTier);
    return {
      progress,
      complete,
      topTier,
      top10,
      shares,
      eraNote: topEraTop10Note(top10, shares),
      tribe: computeTribe(masterList, triage),
      counts: bucketCounts(masterList, triage),
      bucketed: masterList.length,
      groups: listGroups(masterList, triage),
      unknowns: FULL_SONG_POOL.filter((s) => triageMap[s.id] === 'unknown'),
    };
  }, [masterList, triageMap]);

  const {
    progress,
    complete,
    top10,
    shares,
    eraNote,
    tribe,
    counts,
    bucketed,
    groups,
    unknowns,
  } = data;
  const pct =
    FULL_SONG_POOL.length > 0
      ? Math.round((bucketed / FULL_SONG_POOL.length) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      {/* Header — the owner's headline, centered in the card. */}
      <section
        className="relative overflow-hidden rounded-[18px] border-[3px] p-6 text-white shadow-[5px_5px_0_rgba(11,30,63,0.9)] sm:p-8"
        style={{ backgroundColor: POSTER_BLUE, borderColor: INK }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.95) 1.6px, transparent 1.7px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative text-center">
          <h1
            className={`${displayFont.className} text-[34px] leading-[1.05] text-white [text-wrap:balance] sm:text-[42px]`}
            style={{ textShadow: headlineShadow }}
          >
            {complete ? 'All Your Favorite Songs' : 'Not done yet.'}
          </h1>
          {complete ? (
            <p className="mt-2.5 text-sm font-bold text-white/90">
              Here&rsquo;s how you ranked all the songs.
            </p>
          ) : (
            <div className="mx-auto mt-4 max-w-md">
              <div className="h-[10px] overflow-hidden rounded-full border-2 border-[#0C1220] bg-white/30">
                <div
                  className="h-full bg-[#FFC72C]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-white/85">
                {bucketed} ranked so far
              </p>
            </div>
          )}

          {bucketed > 0 &&
            (complete ? (
              <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep('shareables')}
                  className="rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:brightness-105 active:translate-y-[1px]"
                >
                  Show off your list
                </button>
                <button
                  type="button"
                  onClick={() => setStep('wrapped')}
                  className="rounded-full border-[3px] border-[#0C1220] bg-white px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:bg-sky-50 active:translate-y-[1px]"
                >
                  Unravel Your Sweater Thread
                </button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep('triage')}
                  className="rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:brightness-105 active:translate-y-[1px]"
                >
                  Keep sorting
                </button>
                {progress.isWrappedUnlocked && (
                  <button
                    type="button"
                    onClick={() => setStep('wrapped')}
                    className="rounded-full border-[3px] border-[#0C1220] bg-white px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:bg-sky-50 active:translate-y-[1px]"
                  >
                    Unravel Your Sweater Thread
                  </button>
                )}
              </div>
            ))}
        </div>
      </section>

      {bucketed === 0 ? (
        <section className={`${PANEL} p-8 text-center`}>
          <h2
            className={`${displayFont.className} text-2xl text-[#0C1220]`}
          >
            Nothing ranked yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold text-[#3D4A63]">
            Sort some songs and your list builds itself here.
          </p>
          <button
            type="button"
            onClick={() => setStep('triage')}
            className="mt-5 rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:brightness-105 active:translate-y-[1px]"
          >
            Start sorting
          </button>
        </section>
      ) : (
        <>
          {/* Tribe band — the profile page's, verbatim. */}
          {tribe && (
            <section className={`${PANEL} p-5 sm:p-6`}>
              <span className={EYEBROW}>Fandom Archetype</span>
              <div
                className={`${displayFont.className} mt-2 text-[31px] leading-[1.05] text-[#0C1220]`}
              >
                {tribe.displayName}
              </div>
              <div
                className="my-[10px] h-[7px] rounded-[4px]"
                style={{
                  backgroundColor: TRIBE_INK[tribe.name] || INK,
                }}
              />
              <p className="text-[14.5px] font-bold leading-[1.45] text-[#0C1220]">
                {tribe.fact}
              </p>
              <p
                className={`${handFont.className} mt-[2px] text-[22px] font-bold leading-tight text-[#3D4A63]`}
              >
                {tribe.diagnosis}
              </p>
            </section>
          )}

          {/* Top 10 — the profile page's row style. */}
          {top10.length > 0 && (
            <section className={`${PANEL} p-5 sm:p-6`}>
              <div className="mb-[14px] text-center">
                <span className={EYEBROW}>The Canons</span>
                <h3
                  className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}
                >
                  Your Top 10
                </h3>
              </div>
              <div className="mx-auto max-w-md">
                {top10.map((song, i) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-[11px] border-b-[1.5px] border-dashed border-[#0C1220]/20 py-[7px] last:border-b-0"
                  >
                    <span
                      className={`${displayFont.className} w-[26px] shrink-0 text-right text-[19px] text-[#0072CE]`}
                    >
                      {i + 1}
                    </span>
                    <AlbumArtwork
                      albumId={song.albumId || ALBUM_NAME_TO_ID[song.album]}
                      className="h-11 w-11 shrink-0 rounded-[11px] border-2 border-[#0C1220] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-extrabold leading-[1.25] text-[#0C1220]">
                        {song.title}
                      </h4>
                      <p className="mt-[1px] text-[10px] font-bold uppercase tracking-[1.2px] text-[#3D4A63]">
                        {song.album} · {song.year}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Era bars — the profile page's panel. */}
          {data.topTier.length > 0 && shares.length > 0 && (
            <section className={`${PANEL} p-5 sm:p-6`}>
              <div className="mb-[14px]">
                <span className={EYEBROW}>Weezer Era</span>
                <h3
                  className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}
                >
                  Where Your Top Songs Live
                </h3>
              </div>
              <div>
                {shares.map((era) => (
                  <div
                    key={era.key}
                    className="mb-[11px] flex items-center gap-[10px] last:mb-0"
                  >
                    <div className="w-[118px] shrink-0">
                      <div
                        className={`${displayFont.className} text-[15.5px] leading-[1.1] text-[#0C1220]`}
                      >
                        {era.name}
                      </div>
                      <div className="text-[9.5px] font-extrabold tracking-[1.4px] text-[#3D4A63]">
                        {era.label}
                      </div>
                    </div>
                    <div className="h-5 flex-1">
                      <div
                        className="h-5 rounded-[6px] border-[2.5px] border-[#0C1220]"
                        style={{
                          width: `${shares[0].pct > 0 ? Math.round((era.pct / shares[0].pct) * 100) : 0}%`,
                          backgroundColor: era.color,
                        }}
                      />
                    </div>
                    <div
                      className={`${displayFont.className} w-10 shrink-0 text-base text-[#0C1220]`}
                    >
                      {era.pct}%
                    </div>
                  </div>
                ))}
              </div>
              {eraNote && (
                <p
                  className={`${handFont.className} mt-[6px] text-xl font-bold leading-tight text-[#3D4A63]`}
                >
                  {eraNote.countWord} of your Top 10 are{' '}
                  {eraNote.eraAdjective} songs.
                </p>
              )}
            </section>
          )}

          {/* Bucket breakdown — the profile page's panel. */}
          <section className={`${PANEL} p-5 sm:p-6`}>
            <div className="mb-[14px]">
              <span className={EYEBROW}>The Breakdown</span>
              <h3
                className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}
              >
                How the {bucketed} Shake Out
              </h3>
            </div>
            <div className="flex h-[26px] overflow-hidden rounded-lg border-[3px] border-[#0C1220]">
              {PROFILE_BUCKET_ORDER.map((b) =>
                counts[b] > 0 ? (
                  <div
                    key={b}
                    style={{
                      width: `${(counts[b] / bucketed) * 100}%`,
                      minWidth: 4,
                      backgroundColor: PROFILE_BUCKET_COLORS[b],
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-3 flex flex-col gap-[6px]">
              {PROFILE_BUCKET_ORDER.map((b) =>
                counts[b] > 0 ? (
                  <div
                    key={b}
                    className="flex items-center gap-2 text-[13px] font-extrabold text-[#0C1220]"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-[4px] border-2 border-[#0C1220]"
                      style={{ backgroundColor: PROFILE_BUCKET_COLORS[b] }}
                    />
                    {BUCKET_CONFIG[b].label}
                    <span
                      className={`${displayFont.className} ml-auto text-[15px]`}
                    >
                      {counts[b]}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
            {complete && counts.skip === 1 && (
              <p
                className={`${handFont.className} mt-[10px] text-xl font-bold leading-tight text-[#3D4A63]`}
              >
                One single Skip in the whole catalog.
              </p>
            )}
          </section>

          {/* The full list — the profile page's expandable
              groups, with rank numbers only where songs were
              actually ranked (Bangers and Slaps). */}
          {groups.length > 0 && (
            <section className={`${PANEL} p-5 sm:p-6`}>
              <div className="mb-[6px]">
                <span className={EYEBROW}>The Full List</span>
                <h3
                  className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}
                >
                  Every Song, in Your Order
                </h3>
              </div>
              {groups.map((group, gi) => {
                const isOpen = groupOverrides[group.key] ?? gi < 2;
                const ranked = RANKED_GROUPS.has(group.key);
                const firstRank = group.songs[0].rank;
                const lastRank = group.songs[group.songs.length - 1].rank;
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() =>
                        setGroupOverrides((prev) => ({
                          ...prev,
                          [group.key]: !isOpen,
                        }))
                      }
                      className="mt-[14px] flex w-full cursor-pointer items-baseline gap-2 rounded-[10px] border-[2.5px] border-[#0C1220] px-3 py-[9px] text-left"
                      aria-expanded={isOpen}
                    >
                      <span
                        className={`${displayFont.className} text-[16.5px] tracking-[0.4px] text-[#0C1220]`}
                      >
                        {group.label}
                      </span>
                      <span className="text-xs text-[#3D4A63]">
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="ml-auto text-[10.5px] font-black tracking-[1px] text-[#3D4A63]">
                        {ranked
                          ? `#${firstRank}–${lastRank} · ${group.songs.length} SONGS`
                          : `${group.songs.length} SONGS`}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-[6px]">
                        {group.songs.map(({ song, rank }) => (
                          <div
                            key={song.id}
                            className="flex items-baseline gap-[9px] border-b border-[#0C1220]/10 px-[2px] py-[3.5px]"
                          >
                            {ranked && (
                              <span className="w-6 shrink-0 text-right text-[11px] font-extrabold text-[#3D4A63]">
                                {rank}
                              </span>
                            )}
                            <span className="text-[12.5px] font-bold leading-[1.3] text-[#0C1220]">
                              {song.title}
                            </span>
                            <span className="ml-auto shrink-0 pl-2 text-right text-[10px] font-bold text-[#3D4A63]">
                              {song.album}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {unknowns.length > 0 && (
                <div>
                  <div className="mt-[14px] flex w-full items-baseline gap-2 rounded-[10px] border-[2.5px] border-dashed border-[#0C1220]/50 px-3 py-[9px]">
                    <span
                      className={`${displayFont.className} text-[16.5px] tracking-[0.4px] text-[#3D4A63]`}
                    >
                      DON&rsquo;T KNOW IT
                    </span>
                    <span className="ml-auto text-[10.5px] font-black tracking-[1px] text-[#3D4A63]">
                      {unknowns.length} SONGS
                    </span>
                  </div>
                  <div className="mt-[6px]">
                    {unknowns.map((song) => (
                      <div
                        key={song.id}
                        className="flex items-baseline gap-[9px] border-b border-[#0C1220]/10 px-[2px] py-[3.5px]"
                      >
                        <span className="text-[12.5px] font-bold leading-[1.3] text-[#3D4A63]">
                          {song.title}
                        </span>
                        <span className="ml-auto shrink-0 pl-2 text-right text-[10px] font-bold text-[#3D4A63]">
                          {song.album}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 px-[2px] text-[11px] font-semibold text-[#3D4A63]">
                    You haven&rsquo;t ranked these. Sort them any time and
                    they&rsquo;ll join the list.
                  </p>
                </div>
              )}
            </section>
          )}

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setStep('master')}
              className="text-xs font-black text-[#3D4A63] underline decoration-[#3D4A63]/40 underline-offset-4 transition hover:text-[#0C1220]"
            >
              Need to change something? Open Final Review →
            </button>
            <div className="mt-5 text-[9px] font-black uppercase tracking-[1.6px] text-[#3D4A63]">
              All My Favorite Songs · The Weezer Song Ranking Project
            </div>
            <div
              className={`${handFont.className} mt-[3px] text-[21px] font-bold leading-none text-[#3D4A63]`}
            >
              Join the debate at rankingweezer.com
            </div>
          </div>
        </>
      )}
    </div>
  );
}
