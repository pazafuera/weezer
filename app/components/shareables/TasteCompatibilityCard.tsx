'use client';

import { forwardRef, useState } from 'react';
import {
  FactsBurst,
  FlyingW,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';
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
  { songs, friends, selectedKey, onSelectChange, interactive },
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
  const tierLabel = tier ? tier.label.toUpperCase() : '';
  // The tier label sits in the white burst's wide left section —
  // auto-sized (Lilita averages ~0.55em advance) so the longest
  // label, HEALTHY DISAGREEMENT, still fits it.
  const tierSize = tier
    ? Math.max(30, Math.min(54, Math.floor(880 / tierLabel.length)))
    : 0;

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{ backgroundColor: POSTER_BLUE }}
    >
      <PosterDomain />

      <h2
        className={`absolute inset-x-0 top-[92px] text-center text-[84px] leading-none text-white ${displayFont.className}`}
      >
        TASTE COMPATIBILITY
      </h2>

      {friends.length === 0 ? (
        <p
          className={`absolute inset-x-[80px] top-[560px] text-center text-[54px] font-bold leading-tight ${handFont.className}`}
        >
          Add friends to compare taste!
        </p>
      ) : (
        <>
          <div className="absolute left-[64px] right-[64px] top-[216px]">
            <p
              className={`text-center text-[38px] font-bold leading-none ${handFont.className}`}
            >
              Compare with
            </p>
            {interactive ? (
              <div className="mx-auto mt-[12px] w-[700px] rounded-xl bg-white px-2 shadow-md">
                <select
                  value={selectedKey}
                  onChange={(e) => onSelectChange?.(e.target.value)}
                  className="w-full cursor-pointer bg-transparent px-4 py-4 text-[32px] font-black text-slate-900 outline-none"
                >
                  <option value="">Choose a friend…</option>
                  {friends.map((f, i) => (
                    <option key={friendKey(f, i)} value={friendKey(f, i)}>
                      {friendLabel(f)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mx-auto mt-[12px] w-[700px] rounded-xl bg-white px-5 py-3 text-center shadow-md">
                <span
                  className={`text-[42px] leading-none text-slate-800 ${handFont.className}`}
                >
                  {friend ? friendLabel(friend) : 'Choose a friend…'}
                </span>
              </div>
            )}
          </div>

          {!friend ? (
            <p
              className={`absolute inset-x-[80px] top-[560px] text-center text-[54px] font-bold leading-tight ${handFont.className}`}
            >
              Pick a friend to see your match!
            </p>
          ) : score === null || !tier ? (
            <p
              className={`absolute inset-x-[80px] top-[560px] text-center text-[54px] font-bold leading-tight ${handFont.className}`}
            >
              {friendLabel(friend)} hasn&apos;t ranked enough songs yet.
            </p>
          ) : (
            <>
              <div className="absolute inset-x-0 top-[356px] text-center">
                <span
                  className={`text-[176px] leading-none text-white ${displayFont.className}`}
                >
                  {score}%
                </span>
                <p
                  className={`mt-[6px] text-[46px] font-bold leading-tight ${handFont.className}`}
                >
                  taste match with {friendLabel(friend)}
                </p>
                <div className="mt-[22px] flex justify-center">
                  <FactsBurst className="h-[108px] w-[760px] -rotate-2">
                    <span
                      className={`w-[64%] text-center leading-none text-black ${displayFont.className}`}
                      style={{ fontSize: tierSize }}
                    >
                      {tierLabel}
                    </span>
                  </FactsBurst>
                </div>
              </div>

              {shared.length > 0 && (
                <div className="absolute left-[110px] right-[110px] top-[748px] bg-white px-[36px] py-[26px] shadow-[0_24px_48px_rgba(2,60,90,0.35)]">
                  <p
                    className={`text-[38px] leading-none text-slate-700 ${handFont.className}`}
                  >
                    You both love:
                  </p>
                  <ul className="mt-2">
                    {shared.slice(0, 5).map((id) => {
                      const s = byId.get(id);
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-3 border-b border-dashed border-slate-300 py-[11px] last:border-0"
                        >
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full ${s?.albumColor || 'bg-slate-400'}`}
                          />
                          <span className="truncate text-[29px] font-black uppercase tracking-tight text-slate-900">
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

      {/* project masthead + the card's existing CTA, restyled */}
      <div className="absolute inset-x-12 bottom-[92px] flex items-center justify-center gap-[14px]">
        <FlyingW className="h-[26px] w-[48px] text-white" />
        <span className="text-[22px] font-black uppercase tracking-[0.22em] text-white/95">
          All My Favorite Songs · The Weezer Song Ranking Project
        </span>
      </div>
      <p
        className={`absolute inset-x-12 bottom-[30px] text-center text-[44px] font-bold leading-none text-white ${handFont.className}`}
      >
        JOIN THE DEBATE AT RANKINGWEEZER.COM
      </p>
    </div>
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
        <SaveImageButton
          onClick={download}
          busy={busy}
          disabled={selectedKey === ''}
        />
      </div>
    </div>
  );
}
