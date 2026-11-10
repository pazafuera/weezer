'use client';

/**
 * The leaderboard name-claim card (game front door, Nov 9,
 * 2026). Renders only at the glory moments — the game results
 * screen and the leaderboard — and only for a guest with a
 * finished round on this device. The claim sequence mirrors
 * the onboarding modal's: clean the name, check it with the
 * is_username_available RPC, then establish the account and
 * upsert the profile. Here the account is an anonymous
 * "shell" (no email, no password); the context's boot picks
 * the session up and the fanhood reconcile puts the device
 * record — scores included — onto the board under the name.
 *
 * planShellClaim decides the card's state (see shellClaim.ts):
 * full accounts never see it; a shell sees its confirmation;
 * a device that already claimed sees why it can't claim
 * again (one claim per device, owner ruling Nov 9, 2026).
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useWeezer } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';
import { fanhoodGamesPlayed, useFanhood } from '../lib/fanhood';
import {
  cleanShellUsername,
  planShellClaim,
  readShellClaim,
  writeShellClaim,
  type ShellClaim,
} from '../lib/shellClaim';
import {
  parseLeaderboardRows,
  rankLeaderboard,
  type LeaderboardEntry,
} from '../lib/leaderboard';

const CARD_CLASS =
  'bg-white border-[3px] border-[#0C1220] rounded-[18px] p-5 shadow-[4px_4px_0_#0C1220] space-y-3';

export default function ShellClaimCard() {
  const { userId, isShell, userProfile } = useWeezer();
  const record = useFanhood();
  const [stored] = useState<ShellClaim | null>(() => readShellClaim());
  const [claimedName, setClaimedName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The claimed state's board window (owner, Nov 9, 2026):
  // don't just say you're on the board — show the exact
  // spot, highlighted, with the two scores above and below.
  // Fetched when this card is a shell's confirmation; one
  // retry covers the beat while a fresh claim's row syncs.
  const [boardRows, setBoardRows] = useState<LeaderboardEntry[] | null>(
    null
  );
  const shellNameForBoard =
    claimedName ?? userProfile?.username ?? stored?.username ?? null;
  const wantsBoard =
    (isShell || claimedName !== null) && shellNameForBoard !== null;
  useEffect(() => {
    if (!wantsBoard) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async (isRetry: boolean) => {
      try {
        const { data, error } = await supabase.rpc(
          'get_fanhood_leaderboard'
        );
        if (cancelled || error) return;
        const rows = rankLeaderboard(parseLeaderboardRows(data), 'all');
        setBoardRows(rows);
        const found = rows.some(
          (r) => r.username === shellNameForBoard
        );
        if (!found && !isRetry) {
          retry = setTimeout(() => load(true), 2500);
        }
      } catch {
        /* the plain confirmation renders instead */
      }
    };
    load(false);
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [wantsBoard, shellNameForBoard]);

  const plan = planShellClaim({ userId, isShell, stored });
  const hasFinishedGame = fanhoodGamesPlayed(record) > 0;

  if (plan === 'signed-in') return null;

  const shellName = claimedName ?? userProfile?.username ?? stored?.username;
  if ((plan === 'is-shell' || claimedName) && shellName) {
    const shown = shellName;
    const ownIdx = boardRows
      ? boardRows.findIndex((r) => r.username === shown)
      : -1;
    const windowRows =
      ownIdx >= 0 && boardRows
        ? boardRows.slice(Math.max(0, ownIdx - 2), ownIdx + 3)
        : null;
    return (
      <div className={CARD_CLASS}>
        <h3 className={`${displayFont.className} text-[19px] leading-tight text-[#0C1220]`}>
          {ownIdx >= 0
            ? `You're #${ownIdx + 1} on the board`
            : `You're on the board as @${shown}`}
        </h3>
        {windowRows && (
          <div className="overflow-hidden rounded-[14px] border-[2.5px] border-[#0C1220]">
            {windowRows.map((row) => {
              const rank =
                boardRows!.findIndex((r) => r.username === row.username) +
                1;
              const isYou = row.username === shown;
              return (
                <div
                  key={row.username}
                  className={`flex items-center justify-between px-3 py-2 text-[13px] ${
                    isYou
                      ? 'bg-[#FFE066] font-black text-[#0C1220]'
                      : 'bg-white font-bold text-[#3D4A63]'
                  } ${rank > 1 ? 'border-t-2 border-[#0C1220]/10' : ''}`}
                >
                  <span>
                    #{rank} @{row.username}
                    {isYou ? ' — you' : ''}
                  </span>
                  <span>{row.totalDepth.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-sm font-black text-[#0C1220]">
          Add an email so you don&rsquo;t lose it.
        </p>
      </div>
    );
  }

  if (plan === 'claimed-on-device') {
    return (
      <div className={CARD_CLASS}>
        <h3 className={`${displayFont.className} text-[19px] leading-tight text-[#0C1220]`}>
          This device already claimed @{stored?.username}
        </h3>
        <p className="text-xs sm:text-sm font-medium text-[#3D4A63] leading-relaxed">
          One name per device for the board. Your games on this
          device still count toward that name&rsquo;s standing.
        </p>
      </div>
    );
  }

  // can-claim: the form appears only once a round is finished —
  // the claim is earned at the glory moment, not at the door.
  if (!hasFinishedGame) return null;

  const submit = async () => {
    setError(null);
    const cleaned = cleanShellUsername(name);
    if (!cleaned.ok) {
      setError(cleaned.reason);
      return;
    }
    setBusy(true);
    try {
      const { data: isAvailable } = await supabase.rpc(
        'is_username_available',
        { p_username: cleaned.username }
      );
      if (isAvailable === false) {
        setError('That name is taken. Pick another.');
        return;
      }
      const { data: authData, error: authErr } =
        await supabase.auth.signInAnonymously();
      if (authErr) throw authErr;
      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error('No session came back.');
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: newUserId,
        username: cleaned.username,
        display_name: cleaned.username,
        updated_at: new Date().toISOString(),
      });
      if (profileErr) throw profileErr;
      writeShellClaim({ userId: newUserId, username: cleaned.username });
      setClaimedName(cleaned.username);
    } catch {
      setError('The claim didn\u2019t go through — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD_CLASS}>
      <h3 className={`${displayFont.className} text-[19px] leading-tight text-[#0C1220]`}>
        Get on the leaderboard
      </h3>
      <p className="text-xs sm:text-sm font-medium text-[#3D4A63] leading-relaxed">
        Pick a name — no email, no password.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name on the board"
          maxLength={24}
          autoComplete="off"
          className="flex-1 rounded-[14px] border-[2.5px] border-[#0C1220] px-4 py-3 text-sm font-bold text-[#0C1220] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0072CE]"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="shrink-0 font-black text-xs sm:text-sm px-5 py-3 rounded-[14px] border-[3px] border-[#0C1220] bg-[#0072CE] text-white shadow-[4px_4px_0_#0C1220] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220] cursor-pointer disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Claim username and save my score'}
        </button>
      </div>
      {error && (
        <p className="text-xs font-bold text-rose-600">{error}</p>
      )}
    </div>
  );
}
