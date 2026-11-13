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
 * Sections borrow the public profile page's (`/u/[username]`)
 * panel language and its bucket-breakdown derivation
 * (app/lib/profileStats). Above the full list — expandable
 * bucket groups — sits a simple horizontal scroller of the
 * fan's top albums, in the same shrinkage-adjusted order
 * the tier cards use. One semantic difference
 * from the profile page, at the owner's direction: only
 * Bangers and Slaps carry rank numbers here — Mid, Skip and
 * Trash were sorted into buckets but never ranked, so their
 * groups show no numbers. Songs marked "Don't Know It" were
 * never ranked either and sit in their own tail group.
 */

import React, { useMemo, useState } from 'react';
import {
  ALBUMS_BY_ID,
  ALBUM_NAME_TO_ID,
  BUCKET_CONFIG,
  FULL_SONG_POOL,
  type BucketType,
  type Song,
} from '../data/constants';
import {
  getProgressState,
  useWeezer,
  type AppStep,
  type TriageValue,
} from '../context/WeezerContext';
import { AlbumArtwork } from './SharedUI';
import { displayFont, handFont } from './shareables/fonts';
import {
  PROFILE_BUCKET_COLORS,
  PROFILE_BUCKET_ORDER,
  bucketCounts,
  listGroups,
} from '../lib/profileStats';

/** Bucket points for the album order — the same map the
 *  shareables tier data uses (StepShareables). */
const BUCKET_POINTS: Record<string, number> = {
  banger: 5,
  slaps: 4,
  mid: 3,
  skip: 2,
  trash: 1,
};

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

/** Downstream ranking (owner, Nov 12, 2026): the lower
 *  buckets a fan can opt into ranking, their Refine stage
 *  index, and the plural names the prompt below speaks. */
const LOWER_BUCKETS: readonly BucketType[] = ['mid', 'skip', 'trash'];
const LOWER_STAGE_IDX: Record<string, number> = { mid: 2, skip: 3, trash: 4 };
const LOWER_PLURAL: Record<string, string> = {
  mid: 'Mids',
  skip: 'Skips',
  trash: 'Trash',
};

export default function StepFinalRankings({
  masterList,
  triageMap,
  setStep,
}: StepFinalRankingsProps) {
  const [groupOverrides, setGroupOverrides] = useState<
    Record<string, boolean>
  >({});
  const {
    userProfile,
    lowerRankOptIns,
    setRefineStageIdx,
    setAutoStartMatchups,
    setLowerRankOptIn,
  } = useWeezer();
  const username = userProfile?.username?.trim();

  // One-touch share of the fan's public profile link: the
  // native share sheet where offered, else copy + confirm.
  const [linkCopied, setLinkCopied] = useState(false);
  const handleShareProfileLink = async () => {
    if (!username) return;
    const url = `https://rankingweezer.com/u/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      /* clipboard unavailable — nothing more to do */
    }
  };

  const data = useMemo(() => {
    const progress = getProgressState(triageMap, masterList);
    const complete = masterList.length >= FULL_SONG_POOL.length;
    const triage = triageMap as Record<string, BucketType>;
    // Album order — StepShareables' exact computation:
    // bucket-points means per album, shrunk toward the
    // fan's own overall mean (K=5), best first.
    const albumScores: Record<
      string,
      { id: string; name: string; total: number; count: number }
    > = {};
    let totalScore = 0;
    let totalCount = 0;
    FULL_SONG_POOL.forEach((song) => {
      const bucket = triageMap[song.id];
      if (!bucket) return;
      const score = BUCKET_POINTS[bucket];
      if (score === undefined) return;
      totalScore += score;
      totalCount += 1;
      const resolvedId =
        song.albumId || ALBUM_NAME_TO_ID[song.album] || 'unknown';
      if (!albumScores[resolvedId]) {
        albumScores[resolvedId] = {
          id: resolvedId,
          name: ALBUMS_BY_ID[resolvedId]?.name || song.album,
          total: 0,
          count: 0,
        };
      }
      albumScores[resolvedId].total += score;
      albumScores[resolvedId].count += 1;
    });
    const priorMean = totalCount > 0 ? totalScore / totalCount : 3;
    const SHRINKAGE_K = 5;
    const albums = Object.values(albumScores)
      .map((entry) => {
        const rawMean = entry.total / entry.count;
        const adjusted =
          (entry.count / (entry.count + SHRINKAGE_K)) * rawMean +
          (SHRINKAGE_K / (entry.count + SHRINKAGE_K)) * priorMean;
        return { id: entry.id, name: entry.name, adjusted };
      })
      .sort((x, y) => y.adjusted - x.adjusted);
    return {
      progress,
      complete,
      albums,
      counts: bucketCounts(masterList, triage),
      bucketed: masterList.length,
      groups: listGroups(masterList, triage),
      unknowns: FULL_SONG_POOL.filter((s) => triageMap[s.id] === 'unknown'),
    };
  }, [masterList, triageMap]);

  const { progress, complete, albums, counts, bucketed, groups, unknowns } =
    data;
  // Lower buckets with songs in them that this fan has not
  // opted into ranking — the prompt below offers the first
  // one's Refine stage.
  const unrankedLowers = LOWER_BUCKETS.filter(
    (b) => counts[b] > 0 && !lowerRankOptIns.includes(b),
  );
  const lowerNames = unrankedLowers.map((b) => LOWER_PLURAL[b]);
  const lowerPhrase =
    lowerNames.length > 1
      ? `${lowerNames.slice(0, -1).join(', ')} and ${lowerNames[lowerNames.length - 1]}`
      : lowerNames[0];
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
          {username ? (
            <div
              className={`${displayFont.className} mb-2 text-[26px] tracking-[0.5px] text-[#FFC72C]`}
              style={{ textShadow: headlineShadow }}
            >
              @{username}
            </div>
          ) : null}
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

          {username && bucketed > 0 && (
            <button
              type="button"
              onClick={handleShareProfileLink}
              className="mt-4 text-[13px] font-black text-white underline decoration-[#FFC72C] decoration-2 underline-offset-4 transition hover:text-[#FFC72C]"
            >
              {linkCopied ? '✓ Link copied!' : 'Share your profile link'}
            </button>
          )}
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
          {/* Bucket breakdown — the profile page's panel. */}
          <section className={`${PANEL} p-5 sm:p-6`}>
            <div className="mb-[14px]">
              <span className={EYEBROW}>The Breakdown</span>
              <h3
                className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}
              >
                How They Shake Out
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

          {/* Downstream ranking prompt (owner, Nov 12, 2026):
              the list page is where a fan looks at their
              lower buckets, so it carries the same offer
              the Refine stages make — quietly, once, and
              only for buckets not yet opted into. */}
          {complete && unrankedLowers.length > 0 && (
            <section className={`${PANEL} p-5 sm:p-6`}>
              <h3 className={`${displayFont.className} text-xl text-[#0C1220]`}>
                You&rsquo;re ranking like a legit fan!
              </h3>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-[#3D4A63]">
                Your {lowerPhrase} are still just sorted. Do you want to keep ranking?
              </p>
              <button
                type="button"
                onClick={() => {
                  // Order matters (owner bug report, Nov 12,
                  // 2026): navigateTo resets the Refine stage
                  // to 0 on every fresh entry, so the stage is
                  // set AFTER the navigation — the same
                  // after-navigateTo pattern the Sweater
                  // Thread's edit-intent uses for the matchup
                  // flag in page.tsx. Setting it first landed
                  // everyone on Rank Your Bangers.
                  setStep('rank_buckets');
                  setRefineStageIdx(LOWER_STAGE_IDX[unrankedLowers[0]]);
                  setAutoStartMatchups(false);
                  // The button promises ranking, so the stage's
                  // Rank toggle is flipped on for the landing.
                  setLowerRankOptIn(unrankedLowers[0], true);
                }}
                className="mt-3.5 rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:brightness-105 active:translate-y-[1px]"
              >
                Rank my {LOWER_PLURAL[unrankedLowers[0]]}
              </button>
            </section>
          )}

          {/* Top albums — a simple horizontal scroller in
              the fan's album order, above the song listings. */}
          {albums.length > 0 && (
            <section>
              <span className={EYEBROW}>Top Albums</span>
              <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2.5 pb-1 pt-2">
                {albums.map((album, i) => (
                  <div
                    key={album.id}
                    className="w-[104px] shrink-0 snap-start"
                  >
                    <div className="relative">
                      <AlbumArtwork
                        albumId={album.id}
                        className="h-[104px] w-[104px] rounded-[12px] border-[2.5px] border-[#0C1220] object-cover"
                      />
                      <span
                        className={`${displayFont.className} absolute -left-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[#0C1220] bg-[#FFC72C] px-1 text-[13px] text-[#0C1220]`}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-extrabold leading-tight text-[#0C1220]">
                      {album.name}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* The full list — the profile page's expandable
              groups, with rank numbers only where songs were
              actually ranked (Bangers and Slaps). */}
          {groups.length > 0 && (
            <section className={`${PANEL} p-5 sm:p-6`}>
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
                      className={`${gi === 0 ? '' : 'mt-[14px] '}flex w-full cursor-pointer items-baseline gap-2 rounded-[10px] border-[2.5px] border-[#0C1220] px-3 py-[9px] text-left`}
                      aria-expanded={isOpen}
                    >
                      <span
                        className={`${displayFont.className} text-[16.5px] tracking-[0.4px] text-[#0C1220]`}
                      >
                        {group.key === 'banger' ? 'BANGERS' : group.label}
                      </span>
                      <span className="text-[24px] font-black leading-[0.6] text-[#0C1220]">
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
          </div>
        </>
      )}
    </div>
  );
}
