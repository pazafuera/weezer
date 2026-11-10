'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useWeezer } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';
import {
  EVENT_STATS_ROWS,
  isOwnerUser,
  parseEventStatsPayload,
  type EventStatsPayload,
} from '../lib/owner';

/**
 * Site stats — the owner's page, and only the owner's
 * (Nov 7, 2026: "build the admin page just for my account").
 *
 * Two-layer gate, and this file is the WEAK layer on purpose:
 * the drawer row and this page render only for the owner's
 * account, and anyone else who lands on the step is bounced to
 * the dashboard before anything renders. The real gate is the
 * server: app_events has no client select, and
 * get_event_stats() returns data only to the owner's auth id —
 * null for everyone else. If this page ever received null from
 * the RPC (the server saying no), it bounces the same way.
 *
 * Ship-safe before the owner's paste (the Build 5 pattern):
 * until he runs 20261107_event_stats_rpc.sql, the RPC does not
 * exist and the call fails with PostgREST's function-not-found
 * (PGRST202) — that state renders as "aren't switched on yet",
 * never as zeros. A payload of real zeros (the function live,
 * no events yet) validates and renders as zeros. Any other
 * failure is a plain load error with a retry.
 */

/** Share-card keys → the names the gallery uses for them. */
const CARD_LABELS: Record<string, string> = {
  top_10_songs: 'Top 10 Songs',
  top_10_albums: 'Top 10 Albums',
  tier_list_albums: 'Tier List — Albums',
  tier_list_songs: 'Tier List — Songs',
  era_dna: 'Era DNA',
  tribe: 'Fan Tribe',
  fanhood: 'Back to the Shack',
  thread: 'Sweater Thread',
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'error' }
  | { kind: 'ready'; payload: EventStatsPayload };

/** The Weezerverse pool readout (owner, Nov 9, 2026): the
 *  community aggregates behind get_community_stats() — the same
 *  numbers the Weezerverse page renders from, refreshed hourly
 *  by pg_cron. The pool still contains the 160 seeded test fans
 *  from the Oct 2026 Phase 2 seed (they're labeled as sample
 *  data on the page itself), so the real-fan line is the pool
 *  minus the seed. If the seed is ever removed, this constant
 *  and the line's wording change together. */
const SEEDED_TEST_FANS = 160;

type PoolState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; pooled: number; refreshedAt: string };

function parsePoolPayload(data: unknown): PoolState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.qualifiedSubmissions !== 'number' ||
    typeof d.refreshedAt !== 'string'
  ) {
    return null;
  }
  return {
    kind: 'ready',
    pooled: d.qualifiedSubmissions,
    refreshedAt: d.refreshedAt,
  };
}

/** The aggregates' refreshedAt arrives as a Postgres timestamp
 *  ("2026-11-07 19:46:09.623576+00"); normalize it into the ISO
 *  shape every browser's Date parses, then render it in the
 *  owner's timezone. */
function formatRefreshedAt(raw: string): string {
  const iso = raw
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return raw;
  return when.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const CARD_CLASS =
  'bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]';

function completionLine(
  label: string,
  started: number,
  completed: number
): string {
  const pct = Math.round((completed / started) * 100);
  return `${label}: ${completed} of ${started} (${pct}%)`;
}

export default function SiteStats() {
  const { userId, navigateTo } = useWeezer();
  const isOwner = isOwnerUser(userId);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [pool, setPool] = useState<PoolState>({ kind: 'loading' });
  const [poolAttempt, setPoolAttempt] = useState(0);

  // navigateTo is a fresh function on every context render, so
  // it must never sit in an effect's dependency array (the
  // Build 4 fetch-storm lesson). Effects call it through this
  // ref instead; the fetch effect keys on isOwner + attempt
  // only, so unrelated context renders never refetch.
  const navigateToRef = useRef(navigateTo);
  navigateToRef.current = navigateTo;

  // The bounce: a non-owner sees nothing, ever. (The page only
  // mounts after boot settles, so userId is the settled answer,
  // not a mid-boot guess.)
  useEffect(() => {
    if (!isOwner) {
      navigateToRef.current('dashboard');
    }
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const { data, error } = await supabase.rpc('get_event_stats');
      if (cancelled) return;
      if (error) {
        // PGRST202 = the function isn't in the schema cache:
        // the owner hasn't run the migration yet. Any other
        // error is a load failure, said plainly.
        setState({ kind: error.code === 'PGRST202' ? 'off' : 'error' });
        return;
      }
      if (data === null) {
        // The RPC ran and the server gate said no. Should not
        // happen for the owner (the client and server checks
        // name the same account) — if it ever does, the answer
        // is the same bounce a non-owner gets.
        navigateToRef.current('dashboard');
        return;
      }
      const payload = parseEventStatsPayload(data);
      setState(payload ? { kind: 'ready', payload } : { kind: 'error' });
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, attempt]);

  // The pool readout is independent of the event stats: its own
  // fetch, its own states, so one failing never hides the other.
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    setPool({ kind: 'loading' });
    (async () => {
      const { data, error } = await supabase.rpc('get_community_stats');
      if (cancelled) return;
      if (error) {
        setPool({ kind: 'error' });
        return;
      }
      const parsed = parsePoolPayload(data);
      setPool(parsed ?? { kind: 'error' });
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, poolAttempt]);

  if (!isOwner) return null;

  const payload = state.kind === 'ready' ? state.payload : null;
  const sortStarted = payload?.byEvent['sort_started']?.allTime ?? 0;
  const gameStarted = payload?.byEvent['game_started']?.allTime ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1
          className={`${displayFont.className} text-[clamp(26px,5vw,34px)] leading-none tracking-wide text-[#0C1220]`}
        >
          Site stats
        </h1>
        <p className="mt-1 text-[14.5px] font-semibold leading-snug text-[#3D4A63]">
          Just for you — nobody else can see this page.
        </p>
      </div>

      {state.kind === 'loading' && (
        <div className={CARD_CLASS}>
          <p className="text-sm font-semibold text-[#3D4A63]">
            Counting…
          </p>
        </div>
      )}

      {state.kind === 'off' && (
        <div className={`${CARD_CLASS} space-y-3`}>
          <p className="text-sm font-bold text-[#0C1220]">
            Stats aren&apos;t switched on yet.
          </p>
          <p className="text-xs font-medium text-[#3D4A63] leading-relaxed">
            The site is already recording visits, sorts, shares, and
            games. This page lights up once the stats function is
            added in Supabase.
          </p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="bg-[#0C1220] hover:bg-slate-700 border-[2.5px] border-[#0C1220] text-white font-black py-2.5 px-4 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Check again
          </button>
        </div>
      )}

      {state.kind === 'error' && (
        <div className={`${CARD_CLASS} space-y-3`}>
          <p className="text-sm font-bold text-[#0C1220]">
            Couldn&apos;t load the numbers.
          </p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="bg-[#0C1220] hover:bg-slate-700 border-[2.5px] border-[#0C1220] text-white font-black py-2.5 px-4 rounded-xl transition-colors text-xs cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {payload && (
        <>
          <div className={CARD_CLASS}>
            <div className="grid grid-cols-[1fr_repeat(3,64px)] items-baseline gap-x-2 border-b border-slate-200 pb-2">
              <span />
              <span className="text-right text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
                Today
              </span>
              <span className="text-right text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
                7 days
              </span>
              <span className="text-right text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
                All time
              </span>
            </div>
            {EVENT_STATS_ROWS.map((row) => {
              const counts = payload.byEvent[row.name];
              return (
                <div
                  key={row.name}
                  className="grid grid-cols-[1fr_repeat(3,64px)] items-baseline gap-x-2 border-b border-slate-100 py-2 last:border-b-0"
                >
                  <span className="text-sm font-bold text-[#0C1220]">
                    {row.label}
                  </span>
                  <span className="text-right text-sm font-semibold text-[#3D4A63]">
                    {counts.today}
                  </span>
                  <span className="text-right text-sm font-semibold text-[#3D4A63]">
                    {counts.last7Days}
                  </span>
                  <span className="text-right text-sm font-black text-[#0C1220]">
                    {counts.allTime}
                  </span>
                </div>
              );
            })}
            {(sortStarted > 0 || gameStarted > 0) && (
              <div className="space-y-1 pt-3">
                {sortStarted > 0 && (
                  <p className="text-xs font-bold text-[#0C1220]">
                    {completionLine(
                      'Sorts finished',
                      sortStarted,
                      payload.byEvent['sort_completed'].allTime
                    )}
                  </p>
                )}
                {gameStarted > 0 && (
                  <p className="text-xs font-bold text-[#0C1220]">
                    {completionLine(
                      'Games finished',
                      gameStarted,
                      payload.byEvent['game_completed'].allTime
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className={`${CARD_CLASS} space-y-2`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] block">
              Shares by card
            </span>
            {payload.sharesByCard.length === 0 ? (
              <p className="text-sm font-semibold text-[#3D4A63]">
                No shares yet.
              </p>
            ) : (
              payload.sharesByCard.map((entry) => (
                <div
                  key={entry.card}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-sm font-bold text-[#0C1220]">
                    {CARD_LABELS[entry.card] ?? entry.card}
                  </span>
                  <span className="text-sm font-black text-[#0C1220]">
                    {entry.count}
                  </span>
                </div>
              ))
            )}
          </div>

          <p className="text-[11px] font-medium text-[#3D4A63]">
            As of{' '}
            {new Date(payload.generatedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            . Days run on Pacific time.
          </p>
        </>
      )}

      <div className={CARD_CLASS}>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] block">
          Weezerverse pool
        </span>
        {pool.kind === 'loading' && (
          <p className="pt-2 text-sm font-semibold text-[#3D4A63]">
            Counting the pool…
          </p>
        )}
        {pool.kind === 'error' && (
          <div className="space-y-3 pt-2">
            <p className="text-sm font-bold text-[#0C1220]">
              Couldn&apos;t load the pool count.
            </p>
            <button
              onClick={() => setPoolAttempt((n) => n + 1)}
              className="bg-[#0C1220] hover:bg-slate-700 border-[2.5px] border-[#0C1220] text-white font-black py-2.5 px-4 rounded-xl transition-colors text-xs cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
        {pool.kind === 'ready' && (
          <div className="pt-1">
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2">
              <span className="text-sm font-bold text-[#0C1220]">
                Fans ranked (real)
              </span>
              <span className="text-sm font-black text-[#0C1220]">
                {Math.max(0, pool.pooled - SEEDED_TEST_FANS)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2">
              <span className="text-sm font-bold text-[#0C1220]">
                Pooled rankings
              </span>
              <span className="text-sm font-black text-[#0C1220]">
                {pool.pooled}
              </span>
            </div>
            <p className="pt-2 text-[11px] font-medium leading-relaxed text-[#3D4A63]">
              The pool includes the {SEEDED_TEST_FANS} seeded test
              fans. Refreshed {formatRefreshedAt(pool.refreshedAt)}{' '}
              — it updates hourly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
