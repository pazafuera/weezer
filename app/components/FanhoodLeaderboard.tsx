'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabase';
import { useWeezer } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';
import ShellClaimCard from './ShellClaimCard';
import { LORE_GAMES } from '../data/loreGame';
import type { LoreGameId } from '../data/loreGame';
import {
  filterLeaderboardFriends,
  parseLeaderboardRows,
  rankLeaderboard,
  TOTAL_GAMES,
} from '../lib/leaderboard';
import {
  fanhoodDisplay,
  fanhoodGamesPlayed,
  useFanhood,
} from '../lib/fanhood';
import type { LeaderboardEntry, LeaderboardScope } from '../lib/leaderboard';

/**
 * The leaderboard: worldwide and friends standings for the
 * five games, with a per-game filter. Rows come from
 * get_fanhood_leaderboard() (migration pending — Mark runs it
 * separately); until the function answers, the board shows its
 * honest empty state rather than hiding or faking rows.
 *
 * Usernames link to the public fan pages, the way the site's other
 * fan surfaces link them. The friends board is the worldwide list
 * filtered against the existing friendships data (friendCards) —
 * visitors who are signed out get the worldwide board and a
 * sign-in nudge for friends.
 */
const SHOW_SCOPE_FILTER = false;

export default function FanhoodLeaderboard({
  onBack,
  embedded = false,
  providedEntries,
  providedLoadFailed = false,
}: {
  onBack: () => void;
  /** Embedded on the game page itself (owner, Nov 9, 2026):
   *  no page chrome of its own — no title row, no back button,
   *  no page padding; the game page frames it. The standalone
   *  board view (menu row, dashboard) keeps the full chrome. */
  embedded?: boolean;
  /** When the host (the game page) already fetched the board
   *  — it needs the per-round highs for the round cards — the
   *  rows arrive as props and this component skips its own
   *  fetch. Undefined = fetch it yourself, as before. */
  providedEntries?: LeaderboardEntry[] | null;
  providedLoadFailed?: boolean;
}) {
  const router = useRouter();
  const { userId, friendCards, userProfile, navigateTo } = useWeezer();
  // The viewer's own standing, stated as a labeled line above
  // the board (Nov 6, 2026 — it replaces the slim header's
  // unlabeled pill, which stepped aside for this view and
  // duplicated the viewer's own row anyway). Same derivation
  // the pill used; "final" once every round is in.
  const fanhood = useFanhood();
  const ownDisplay = fanhoodDisplay(fanhood);
  const ownFinal = fanhoodGamesPlayed(fanhood) >= LORE_GAMES.length;
  const [fetchedEntries, setEntries] = useState<LeaderboardEntry[] | null>(
    null
  );
  const [fetchedLoadFailed, setLoadFailed] = useState(false);
  const entries =
    providedEntries !== undefined ? providedEntries : fetchedEntries;
  const loadFailed =
    providedEntries !== undefined ? providedLoadFailed : fetchedLoadFailed;
  const [tab, setTab] = useState<'worldwide' | 'friends'>('worldwide');
  const [scope, setScope] = useState<LeaderboardScope>('all');

  useEffect(() => {
    if (providedEntries !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          'get_fanhood_leaderboard'
        );
        if (cancelled) return;
        if (error) {
          setLoadFailed(true);
          setEntries([]);
          return;
        }
        setEntries(parseLeaderboardRows(data));
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
          setEntries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providedEntries]);

  const ownUsername = userProfile?.username ?? null;
  const friendUsernames = useMemo(() => {
    const names = (friendCards ?? [])
      .map((c: { username?: string }) => c.username)
      .filter((n: string | undefined): n is string => !!n);
    return ownUsername ? [...names, ownUsername] : names;
  }, [friendCards, ownUsername]);

  const visible = useMemo(() => {
    if (!entries) return [];
    const scoped =
      tab === 'friends' && userId
        ? filterLeaderboardFriends(entries, friendUsernames)
        : entries;
    return rankLeaderboard(scoped, scope);
  }, [entries, tab, userId, friendUsernames, scope]);

  const scopeIndex =
    scope === 'all' ? -1 : LORE_GAMES.findIndex((g) => g.id === scope);

  const emptyMessage = (): string => {
    if (loadFailed) {
      return 'Finished rounds will appear here as soon as the community table updates.';
    }
    if (tab === 'friends') {
      return 'None of your friends have finished a round yet — the board fills in as they play.';
    }
    if (scopeIndex >= 0) {
      return `Nobody has finished Round ${scopeIndex + 1} yet.`;
    }
    return 'No finished rounds yet — the first name on this board is still up for grabs.';
  };

  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : 'mx-auto w-full max-w-2xl space-y-4 px-4 pb-10 sm:px-6'
      }
    >
      {!embedded && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="${displayFont.className} text-lg sm:text-xl text-[#0C1220]">
            Leaderboard
          </h2>
          <button
            onClick={onBack}
            className="shrink-0 text-xs font-black text-[#0072CE] hover:underline cursor-pointer"
          >
            ← Back to the rounds
          </button>
        </div>
      )}

      {ownDisplay && (
        <p className="whitespace-nowrap text-[11px] font-bold text-[#3D4A63] min-[420px]:text-xs sm:text-[13px]">
          {ownFinal ? 'Your final standing' : 'Your standing'} —{' '}
          {ownDisplay.stop} · {ownDisplay.depth.toLocaleString()} points
        </p>
      )}

      <ShellClaimCard />

      {/* Worldwide / Friends tabs */}
      <div className="flex gap-2">
        {(
          [
            { id: 'worldwide', label: 'Worldwide' },
            { id: 'friends', label: 'Friends' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-black transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-[#0C1220] border-[2.5px] border-[#0C1220] text-white'
                : 'bg-white border-[2.5px] border-[#0C1220] text-[#0C1220] hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'friends' && !userId ? (
        <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-5 space-y-3">
          <p className="text-sm font-medium text-[#3D4A63] leading-relaxed">
            Sign in to see your friends&apos; board — the worldwide board
            above is open to everyone.
          </p>
          <button
            onClick={() => navigateTo('login')}
            className="w-full sm:w-auto bg-[#0072CE] hover:bg-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
          >
            Sign in →
          </button>
        </div>
      ) : (
        <>
          {/* Per-game filter — HIDDEN for now (owner, Nov 9,
              2026): with a handful of players the six pills are
              all cost, no signal. The scope state and ranking
              stay wired; flip SHOW_SCOPE_FILTER to bring the
              row back when the board is busy enough to need
              slicing. */}
          {SHOW_SCOPE_FILTER && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setScope('all')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                scope === 'all'
                  ? 'bg-[#0072CE] border-2 border-[#0C1220] text-white'
                  : 'bg-white border-2 border-[#0C1220] text-[#0C1220] hover:bg-slate-50'
              }`}
            >
              All rounds
            </button>
            {LORE_GAMES.map((game, i) => (
              <button
                key={game.id}
                onClick={() => setScope(game.id as LoreGameId)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                  scope === game.id
                    ? 'bg-[#0072CE] border-2 border-[#0C1220] text-white'
                    : 'bg-white border-2 border-[#0C1220] text-[#0C1220] hover:bg-slate-50'
                }`}
              >
                Round {i + 1}
              </button>
            ))}
          </div>
          )}

          {entries === null ? (
            <p className="text-sm font-bold text-[#3D4A63]">
              Loading the board…
            </p>
          ) : visible.length === 0 ? (
            <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-5">
              <p className="text-sm font-medium text-[#3D4A63] leading-relaxed">
                {emptyMessage()}
              </p>
            </div>
          ) : (
            <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] divide-y-2 divide-[#0C1220] overflow-hidden">
              {visible.map((entry, i) => {
                const isYou = ownUsername !== null && entry.username === ownUsername;
                const gameScore =
                  scope === 'all' ? undefined : entry.gameScores[scope];
                return (
                  <div
                    key={entry.username}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      isYou ? 'bg-[#E0F2FE]' : ''
                    }`}
                  >
                    <span className="w-7 shrink-0 text-sm font-black text-[#3D4A63]">
                      {i + 1}
                    </span>
                    <button
                      onClick={() => router.push(`/u/${entry.username}`)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="block truncate text-sm font-black text-[#0C1220] hover:text-[#0072CE]">
                        @{entry.username}
                        {isYou ? ' · you' : ''}
                      </span>
                      <span className="block text-xs font-bold text-[#3D4A63]">
                        {scope === 'all'
                          ? `${entry.gamesPlayed} of ${TOTAL_GAMES} games`
                          : `${entry.totalDepth.toLocaleString()} total`}
                      </span>
                    </button>
                    <span className="shrink-0 text-sm font-black text-[#0072CE]">
                      {(scope === 'all'
                        ? entry.totalDepth
                        : (gameScore ?? 0)
                      ).toLocaleString()}{' '}
                      points
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs font-bold leading-relaxed text-[#3D4A63]">
            Finished games only, scores locked in for good. Fans who
            finished all five rank first, by total.
          </p>
        </>
      )}
    </div>
  );
}
