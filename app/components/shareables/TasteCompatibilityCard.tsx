'use client';

import { forwardRef, useState } from 'react';
import {
  SaveImageButton,
  ScrapbookVisual,
  Stamp,
  useShareableDownload,
} from './ShareCardShell';
import { handFont, markerFont } from './fonts';
import type { ShareSong } from './Top10Card';

/**
 * Defensive friend shape — the app's friend objects vary, so we probe
 * several possible ranking fields and degrade gracefully when absent.
 */
export type FriendLike = {
  id?: string;
  username?: string;
  display_name?: string;
  displayName?: string;
  masterList?: Array<{ id: string } | string>;
  rankings?: Array<{ id: string } | string>;
  master_list?: Array<{ id: string } | string>;
  topSongs?: Array<{ id: string } | string>;
  songs?: Array<{ id: string } | string>;
};

export function friendLabel(f: FriendLike): string {
  return f.display_name || f.displayName || f.username || 'Friend';
}

export function friendKey(f: FriendLike, i: number): string {
  return f.id || f.username || `friend-${i}`;
}

function friendSongIds(f: FriendLike): string[] {
  const arr =
    f.masterList ?? f.rankings ?? f.master_list ?? f.topSongs ?? f.songs ?? [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => (typeof s === 'string' ? s : s?.id))
    .filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function tierFor(score: number): { label: string; ink: string } {
  if (score >= 75) return { label: 'Taste Twins', ink: '#047857' };
  if (score >= 50) return { label: 'Road Trip Ready', ink: '#0072CE' };
  if (score >= 25) return { label: 'Healthy Disagreement', ink: '#d97706' };
  return { label: 'Fight in the Replies', ink: '#b3352b' };
}

export type TasteCompatibilityVisualProps = {
  /** Ranked songs only (already filtered to bucketed songs). */
  songs: ShareSong[];
  friends: FriendLike[];
  selectedKey: string;
  onSelectChange?: (key: string) => void;
  /** True only for the on-screen interactive copy (standalone card).
   *  Library copies render the picker as a tag so exports stay clean. */
  interactive?: boolean;
  subtitle?: string;
};

export const TasteCompatibilityCardVisual = forwardRef<
  HTMLDivElement,
  TasteCompatibilityVisualProps
>(function TasteCompatibilityCardVisual(
  { songs, friends, selectedKey, onSelectChange, interactive, subtitle },
  ref,
) {
  const myTopIds = songs.slice(0, 20).map((s) => s.id);
  const byId = new Map(songs.map((s) => [s.id, s]));
  const friend = friends.find((f, i) => friendKey(f, i) === selectedKey);
  const fIds = friend ? friendSongIds(friend).slice(0, 20) : [];
  const shared = fIds.filter((id) => myTopIds.includes(id));
  const score =
    myTopIds.length >= 5 && fIds.length >= 5
      ? Math.round((shared.length / myTopIds.length) * 100)
      : null;
  const tier = score !== null ? tierFor(score) : null;

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle}>
      <div className="absolute inset-x-[76px] bottom-[176px] top-[140px]">
        <p
          className={`text-[56px] leading-none tracking-wide text-slate-900 ${markerFont.className}`}
        >
          TASTE COMPATIBILITY
        </p>

        {friends.length === 0 ? (
          <p
            className={`pt-56 text-center text-[54px] text-slate-700 ${handFont.className}`}
          >
            Add friends to compare taste!
          </p>
        ) : (
          <>
            <p
              className={`mt-8 text-[34px] text-slate-600 ${handFont.className}`}
            >
              Compare with
            </p>
            {interactive ? (
              <select
                value={selectedKey}
                onChange={(e) => onSelectChange?.(e.target.value)}
                className="mt-1 w-full -rotate-[0.3deg] rounded-lg bg-white px-5 py-4 text-[34px] font-black text-slate-900 shadow-md"
              >
                <option value="">Choose a friend…</option>
                {friends.map((f, i) => (
                  <option key={friendKey(f, i)} value={friendKey(f, i)}>
                    {friendLabel(f)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1 -rotate-[0.3deg] rounded-lg bg-white px-5 py-3 shadow-md">
                <span className={`text-[42px] leading-none text-slate-800 ${handFont.className}`}>
                  {friend ? friendLabel(friend) : 'Choose a friend…'}
                </span>
              </div>
            )}

            {!friend ? (
              <p
                className={`pt-40 text-center text-[48px] text-slate-600 ${handFont.className}`}
              >
                Pick a friend to see your match!
              </p>
            ) : score === null || !tier ? (
              <p
                className={`pt-40 text-center text-[48px] text-slate-600 ${handFont.className}`}
              >
                {friendLabel(friend)} hasn&apos;t ranked enough songs yet.
              </p>
            ) : (
              <>
                <div className="mt-10 text-center">
                  <span
                    className={`text-[210px] leading-none ${markerFont.className}`}
                    style={{ color: tier.ink }}
                  >
                    {score}%
                  </span>
                  <p
                    className={`mt-2 text-[42px] text-slate-700 ${handFont.className}`}
                  >
                    taste match with {friendLabel(friend)}
                  </p>
                  <div className="mt-6">
                    <Stamp color={tier.ink} rotate={-2}>
                      {tier.label}
                    </Stamp>
                  </div>
                </div>

                {shared.length > 0 && (
                  <div className="mx-auto mt-12 max-w-[760px] -rotate-[0.4deg] bg-[#fffdf4] px-8 py-6 shadow-[0_16px_36px_rgba(60,45,10,0.28)]">
                    <p
                      className={`text-[38px] text-slate-700 ${handFont.className}`}
                    >
                      You both love:
                    </p>
                    <ul className="mt-3">
                      {shared.slice(0, 5).map((id) => {
                        const s = byId.get(id);
                        return (
                          <li
                            key={id}
                            className="flex items-center gap-3 border-b border-dashed border-slate-300 py-2.5 last:border-0"
                          >
                            <span
                              className={`h-4 w-4 shrink-0 rounded-full ${s?.albumColor || 'bg-slate-400'}`}
                            />
                            <span className="truncate text-[30px] font-black uppercase tracking-tight text-slate-900">
                              {s?.title ?? id}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ScrapbookVisual>
  );
});

export default function TasteCompatibilityCard({
  songs,
  friends,
  subtitle,
}: {
  songs: ShareSong[];
  friends: FriendLike[];
  subtitle?: string;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const { ref, busy, download } = useShareableDownload('weezer-taste-match.png');
  return (
    <div>
      <TasteCompatibilityCardVisual
        ref={ref}
        songs={songs}
        friends={friends}
        subtitle={subtitle}
        selectedKey={selectedKey}
        onSelectChange={setSelectedKey}
        interactive
      />
      <div className="mt-4">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
