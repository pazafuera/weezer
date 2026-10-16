'use client';

import { forwardRef, useState } from 'react';
import { SaveImageButton, ShareableVisual, useShareableDownload } from './ShareCardShell';
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

export type TasteCompatibilityVisualProps = {
  /** Ranked songs only (already filtered to bucketed songs). */
  songs: ShareSong[];
  friends: FriendLike[];
  selectedKey: string;
  onSelectChange?: (key: string) => void;
  /** True only for the on-screen interactive copy (library modal). Static
   *  copies (preview + PNG export) render the picker as a label so exports
   *  stay clean. */
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

  return (
    <ShareableVisual ref={ref} title="Taste Compatibility" subtitle={subtitle}>
      {friends.length === 0 ? (
        <p className="py-16 text-center text-2xl font-bold text-slate-400">
          Add friends to compare taste.
        </p>
      ) : (
        <div>
          <label className="mb-2 block text-lg font-bold text-slate-400">
            Compare with
          </label>
          {interactive ? (
            <select
              value={selectedKey}
              onChange={(e) => onSelectChange?.(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-xl font-bold text-white"
            >
              <option value="">Choose a friend…</option>
              {friends.map((f, i) => (
                <option key={friendKey(f, i)} value={friendKey(f, i)}>
                  {friendLabel(f)}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-xl font-bold text-white">
              {friend ? friendLabel(friend) : 'Choose a friend…'}
            </div>
          )}
          {!friend ? (
            <p className="py-10 text-center text-xl font-bold text-slate-500">
              Pick a friend to see your match score.
            </p>
          ) : score === null ? (
            <p className="py-10 text-center text-xl font-bold text-slate-500">
              {friendLabel(friend)} hasn&apos;t ranked enough songs yet.
            </p>
          ) : (
            <div className="mt-8 text-center">
              <p className="text-8xl font-black text-white">{score}%</p>
              <p className="mt-2 text-2xl font-bold text-slate-300">
                taste match with {friendLabel(friend)}
              </p>
              {shared.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="mb-2 text-lg font-black text-slate-400">You both love:</p>
                  <ul className="flex flex-col gap-2">
                    {shared.slice(0, 5).map((id) => (
                      <li
                        key={id}
                        className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xl font-bold text-white"
                      >
                        {byId.get(id)?.title ?? id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ShareableVisual>
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
