'use client';

import { forwardRef } from 'react';
import { ALBUMS_BY_ID } from '../../data/constants';
import {
  BrushStroke,
  DoodleStar,
  SaveImageButton,
  ScrapbookVisual,
  Stamp,
  useShareableDownload,
} from './ShareCardShell';
import { handFont, markerFont } from './fonts';

/** Minimal song shape — structural subset of the app's Song type. */
export type ShareSong = {
  id: string;
  title: string;
  album: string;
  /** Tailwind bg class from the song data, e.g. 'bg-[#0072CE]'. */
  albumColor: string;
  year: number;
  isBSide?: boolean;
  albumId?: string;
};

export type Bucket = 'banger' | 'slaps' | 'mid' | 'skip' | 'trash';

function albumTag(s: ShareSong): string {
  const name = (s.albumId && ALBUMS_BY_ID[s.albumId]?.name) || s.album || '';
  const short = name.replace(/^The\s+/i, '').toUpperCase();
  return s.year ? `${short} '${String(s.year).slice(2)}` : short;
}

type Annotation = {
  idx: number;
  kind: 'stamp-red' | 'stamp-blue' | 'classic' | 'too-low';
  text: string;
};

/** Rule-based marginalia: every user's card earns its own roasts. */
function computeAnnotations(top: ShareSong[]): Annotation[] {
  const out: Annotation[] = [];
  const used = new Set<number>();
  const counts = new Map<string, number>();
  for (const s of top) counts.set(s.album, (counts.get(s.album) ?? 0) + 1);
  let modalAlbum = '';
  let modalCount = 0;
  for (const [a, c] of counts) {
    if (c > modalCount) {
      modalAlbum = a;
      modalCount = c;
    }
  }

  const hotIdx = top.findIndex((s) => s.isBSide);
  if (hotIdx >= 0) {
    out.push({ idx: hotIdx, kind: 'stamp-red', text: 'Hot take?!' });
    used.add(hotIdx);
  }
  if (modalCount >= 4 && top[0] && !used.has(0)) {
    out.push({ idx: 0, kind: 'stamp-blue', text: 'Basic but best' });
    used.add(0);
  }
  let oldestIdx = -1;
  let oldestYear = Infinity;
  top.forEach((s, i) => {
    if (s.year && s.year < oldestYear) {
      oldestYear = s.year;
      oldestIdx = i;
    }
  });
  if (oldestIdx > 0 && oldestYear <= 1996 && !used.has(oldestIdx) && out.length < 3) {
    out.push({ idx: oldestIdx, kind: 'classic', text: 'a classic' });
    used.add(oldestIdx);
  }
  const lastIdx = top.length - 1;
  if (
    lastIdx >= 8 &&
    modalCount >= 4 &&
    top[lastIdx]?.album === modalAlbum &&
    !used.has(lastIdx) &&
    out.length < 3
  ) {
    out.push({ idx: lastIdx, kind: 'too-low', text: 'way too low!' });
    used.add(lastIdx);
  }
  return out.slice(0, 3);
}

function quipFor(top: ShareSong[]): string {
  const counts = new Map<string, number>();
  for (const s of top) counts.set(s.album, (counts.get(s.album) ?? 0) + 1);
  let modalAlbum = '';
  let modalCount = 0;
  for (const [a, c] of counts) {
    if (c > modalCount) {
      modalAlbum = a;
      modalCount = c;
    }
  }
  if (modalCount >= 5) {
    const short = modalAlbum.replace(/^The\s+/i, '');
    return `${modalCount} of ${top.length} from ${short}. Zero regrets.`;
  }
  if (counts.size >= 7) return 'All over the map. Respect.';
  return 'A person of taste. Obviously.';
}

const ROW_H = 66;

export const Top10CardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function Top10CardVisual({ songs, subtitle }, ref) {
  const top = songs.slice(0, 10);
  const albumCount = new Set(top.map((s) => s.album)).size;
  const annotations = computeAnnotations(top);

  return (
    <ScrapbookVisual ref={ref} subtitle={subtitle}>
      <div className="absolute inset-x-[76px] bottom-[176px] top-[128px]">
        {top.length === 0 ? (
          <p
            className={`pt-64 text-center text-[54px] text-slate-700 ${handFont.className}`}
          >
            Rank some songs to reveal your Top 10!
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2
                  className={`text-[80px] leading-none text-slate-900 ${markerFont.className}`}
                >
                  MY WEEZER
                </h2>
                <div className="relative mt-1 inline-block">
                  <BrushStroke
                    color="#fbbf24"
                    className="absolute -left-3 top-[62px] h-[74px] w-[470px]"
                  />
                  <span
                    className={`relative text-[164px] leading-none text-slate-900 ${markerFont.className}`}
                  >
                    TOP 10
                  </span>
                </div>
              </div>
              <div className="w-[318px] shrink-0 pt-3">
                <p
                  className={`rotate-2 text-[36px] leading-tight text-slate-700 ${handFont.className}`}
                >
                  {top.length} songs. {albumCount} albums.
                  <br />1 perfect list?
                </p>
                <div className="mt-4 flex rotate-1 items-start gap-3 rounded-2xl bg-white p-4 shadow-lg">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0072CE] text-[15px] font-black text-white">
                    =W=
                  </span>
                  <div>
                    <p className="text-[16px] font-bold uppercase tracking-wide text-slate-400">
                      Comment
                    </p>
                    <p className="text-[24px] font-black leading-tight text-slate-800">
                      Rate my taste (or roast it)!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* The list, on its paper card */}
            <div className="relative mt-5 -rotate-[0.4deg] bg-[#fffdf4] px-8 py-5 shadow-[0_16px_36px_rgba(60,45,10,0.28)]">
              {top.map((s, i) => (
                <div
                  key={s.id}
                  className="relative flex items-center gap-4 border-b border-dashed border-slate-300 last:border-0"
                  style={{ height: ROW_H }}
                >
                  <span
                    className={`w-[62px] shrink-0 text-[38px] leading-none text-slate-900 ${markerFont.className}`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full ${s.albumColor || 'bg-slate-400'}`}
                  />
                  <p className="min-w-0 flex-1 truncate text-[31px] font-black uppercase tracking-tight text-slate-900">
                    {s.title}
                  </p>
                  <span className="shrink-0 text-[21px] font-bold text-slate-500">
                    {albumTag(s)}
                  </span>
                </div>
              ))}

              {/* Marginalia overlays */}
              {annotations.map((a) => {
                const topPx = 20 + a.idx * ROW_H + 10;
                if (a.kind === 'stamp-red' || a.kind === 'stamp-blue') {
                  return (
                    <div
                      key={a.kind}
                      className="absolute"
                      style={{ top: topPx, right: 208 }}
                    >
                      <Stamp
                        color={a.kind === 'stamp-red' ? '#b3352b' : '#1d4ed8'}
                        rotate={a.kind === 'stamp-red' ? -7 : -4}
                      >
                        {a.text}
                      </Stamp>
                    </div>
                  );
                }
                return (
                  <div
                    key={a.kind}
                    className="absolute flex -rotate-3 items-center gap-1"
                    style={{ top: topPx + 2, right: 216 }}
                  >
                    {a.kind === 'classic' && <DoodleStar className="h-9 w-9" />}
                    <span
                      className={`text-[36px] leading-none ${
                        a.kind === 'classic' ? 'text-amber-700' : 'text-slate-800'
                      } ${handFont.className}`}
                    >
                      {a.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Margin quip */}
            <p
              className={`mt-4 -rotate-1 text-[36px] text-slate-700 ${handFont.className}`}
            >
              {quipFor(top)}
            </p>
          </>
        )}
      </div>
    </ScrapbookVisual>
  );
});

export default function Top10Card({
  songs,
  subtitle,
}: {
  songs: ShareSong[];
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('my-weezer-top-10.png');
  return (
    <div>
      <Top10CardVisual ref={ref} songs={songs} subtitle={subtitle} />
      <div className="mt-4">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
