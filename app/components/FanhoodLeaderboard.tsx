'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabase';
import { useWeezer } from '../context/WeezerContext';
import { LORE_GAMES } from '../data/loreGame';
import type { LoreGameId } from '../data/loreGame';
import {
  filterLeaderboardFriends,
  parseLeaderboardRows,
  rankLeaderboard,
  TOTAL_GAMES,
} from '../lib/leaderboard';
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
export default function FanhoodLeaderboard({
  onBack,
}: {
  onBack: () => void;
}) {
  const router = useRouter();
  const { userId, friendCards, userProfile, navigateTo } = useWeezer();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<'worldwide' | 'friends'>('worldwide');
  const [scope, setScope] = useState<LeaderboardScope>('all');

  useEffect(() => {
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
  }, []);

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

  const scopeGame =
    scope === 'all' ? null : LORE_GAMES.find((g) => g.id === scope);

  const emptyMessage = (): string => {
    if (loadFailed) {
      return 'Finished games will appear here as soon as the community table updates.';
    }
    if (tab === 'friends') {
      return 'None of your friends have finished a game yet — the board fills in as they play.';
    }
    if (scopeGame) {
      return `Nobody has finished ${scopeGame.name} yet.`;
    }
    return 'No finished games yet — the first name on this board is still up for grabs.';
  };

  return (
    <div className="w-full space-y-4 px-4 sm:px-6 pb-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
          Leaderboard
        </h2>
        <button
          onClick={onBack}
          className="shrink-0 text-xs font-black text-[#0072CE] hover:underline cursor-pointer"
        >
          ← Back to the games
        </button>
      </div>

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
                ? 'bg-slate-950 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'friends' && !userId ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
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
          {/* Per-game filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setScope('all')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                scope === 'all'
                  ? 'bg-[#0072CE] text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              All games
            </button>
            {LORE_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => setScope(game.id as LoreGameId)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black transition-all cursor-pointer ${
                  scope === game.id
                    ? 'bg-[#0072CE] text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {game.name}
              </button>
            ))}
          </div>

          {entries === null ? (
            <p className="text-sm font-bold text-slate-400">
              Loading the board…
            </p>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
              <p className="text-sm font-medium text-slate-500 leading-relaxed">
                {emptyMessage()}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs divide-y divide-slate-100 overflow-hidden">
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
                    <span className="w-7 shrink-0 text-sm font-black text-slate-400">
                      {i + 1}
                    </span>
                    <button
                      onClick={() => router.push(`/u/${entry.username}`)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="block truncate text-sm font-black text-slate-900 hover:text-[#0072CE]">
                        @{entry.username}
                        {isYou ? ' · you' : ''}
                      </span>
                      <span className="block text-xs font-bold text-slate-400">
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

          <p className="text-xs font-bold leading-relaxed text-slate-400">
            Finished games only, scores locked in for good. Fans who
            finished all five rank first, by total.
          </p>
        </>
      )}
    </div>
  );
}
