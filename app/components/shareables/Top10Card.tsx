'use client';

import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import { ALBUMS_BY_ID } from '../../data/constants';
import {
  FlyingW,
  POSTER_BLUE,
  PosterDomain,
  SaveImageButton,
  VinylDisc,
  resolveAlbumId,
  useShareableDownload,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';

/** Why this doodle is defined locally instead of imported from
 *  ShareCardShell: the deployed-bundle fault proven on 2026-11-03
 *  (FanhoodCard, React #130) recurred on 2026-11-04 in the preview
 *  build of the shareables round — the gallery crashed on both the
 *  Shareables page and the Sweater Thread for players with rankings.
 *  A module-local copy cannot be dropped by the bundler the way the
 *  shared export was. FanhoodCard carries the same local copy; the
 *  ShareCardShell export remains but no card imports it anymore. */
function MusicNotesDoodle({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 320 300"
      className={className}
      style={style}
      fill="#000"
      aria-hidden="true"
    >
      {/* beamed pair */}
      <rect x="82" y="118" width="8" height="126" />
      <rect x="172" y="94" width="8" height="126" />
      <polygon points="82,118 180,94 180,126 82,150" />
      <ellipse cx="58" cy="252" rx="27" ry="19" transform="rotate(-18 58 252)" />
      <ellipse cx="148" cy="228" rx="27" ry="19" transform="rotate(-18 148 228)" />
      {/* single flagged eighth note */}
      <rect x="271" y="64" width="8" height="104" />
      <path d="M271 64 C 302 76, 310 104, 298 134 C 304 102, 294 84, 271 74 Z" />
      <ellipse cx="250" cy="176" rx="24" ry="17" transform="rotate(-18 250 176)" />
    </svg>
  );
}

/** Triage values: the app's BucketType plus the 'unknown'
 *  ("Don't Know It") mark, so the context's triage map can be passed
 *  straight in. Card logic only ever matches the five real buckets. */
export type Bucket = 'banger' | 'slaps' | 'mid' | 'skip' | 'trash' | 'unknown';

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

/** Compact album tag for the right edge of a list row, e.g. "Blue".
 *  Resolves the canonical album via the app's name bridge. No year,
 *  no truncation — the tag is short by construction. */
function albumTag(song: ShareSong): string {
  const id = resolveAlbumId(song);
  const canonical = (id && ALBUMS_BY_ID[id]?.name) || song.album;
  const short = canonical
    .replace(/^The\s+/i, '')
    .replace(/\s+Album$/i, '')
    .split(' ')
    .slice(0, 2)
    .join(' ');
  return short.toUpperCase();
}

export const Top10CardVisual = forwardRef<
  HTMLDivElement,
  { songs: ShareSong[]; subtitle?: string }
>(function Top10CardVisual({ songs }, ref) {
  const top = songs.slice(0, 10);

  return (
    <div
      ref={ref}
      className="relative h-[1350px] w-[1080px] overflow-hidden text-white"
      style={{ backgroundColor: POSTER_BLUE }}
    >
      <PosterDomain />

      {/* hand-drawn music notes, as in Abby's mock */}
      <MusicNotesDoodle className="absolute left-[16px] top-[16px] z-20 w-[240px] -rotate-6" />
      <MusicNotesDoodle className="absolute right-[10px] top-[1030px] z-20 w-[230px] rotate-[14deg]" />

      {/* vinyl-record header: a big black disc with a gray label,
          the title set over it in chunky display type. Nov 5: the
          white type washed out over the record's grooves, so it
          carries an ink stroke + hard poster shadow now — it reads
          against the black disc AND the blue label ring. */}
      <VinylDisc
        labelColor="#d4d8db"
        className="absolute left-1/2 top-[-120px] h-[700px] w-[700px] -translate-x-1/2 shadow-[0_24px_60px_rgba(2,60,90,0.35)]"
      />
      <div className="absolute inset-x-0 top-[104px] z-10 text-center">
        <h2
          className={`whitespace-nowrap text-[160px] leading-none text-white ${displayFont.className}`}
          style={{
            WebkitTextStroke: '3px #0C1220',
            textShadow: '5px 5px 0 rgba(12,18,32,0.9)',
          }}
        >
          MY TOP 10
        </h2>
        <p
          className={`mt-[2px] whitespace-nowrap text-[66px] font-bold leading-none text-white ${handFont.className}`}
          style={{
            WebkitTextStroke: '2px #0C1220',
            textShadow: '4px 4px 0 rgba(12,18,32,0.9)',
          }}
        >
          Weezer Songs
        </p>
      </div>

      {/* the shipped challenge bubble, kept verbatim, restyled as a
          white speech bubble over the disc's lower edge (Nov 5: ink
          frame + hard shadow, the card system's panel treatment) */}
      <div className="absolute right-[80px] top-[438px] z-20 rotate-2 rounded-2xl rounded-br-sm border-[3px] border-[#0C1220] bg-white px-5 py-2.5 shadow-[4px_4px_0_rgba(12,18,32,0.9)]">
        <span
          className={`whitespace-nowrap text-[33px] leading-none text-slate-800 ${handFont.className}`}
        >
          Undone by my rankings? Getchoo a list of your own.
        </span>
      </div>

      {/* the ranked list on a white paper panel, centered title over
          album tag, as in Abby's mock; rank numbers stay — the
          ranking is the content. Nov 5: the panel takes the card
          system's ink frame + hard shadow. */}
      <div className="absolute left-[96px] right-[96px] top-[500px] z-10 rounded-[20px] border-[3px] border-[#0C1220] bg-white px-[40px] pb-[18px] pt-[24px] shadow-[6px_6px_0_rgba(12,18,32,0.9)]">
        {top.map((song, i) => (
          <div
            key={song.id}
            className="flex h-[66px] flex-col items-center justify-center"
          >
            <div className="flex items-baseline justify-center gap-[14px]">
              <span
                className={`text-[30px] leading-none ${displayFont.className}`}
                style={{ color: POSTER_BLUE }}
              >
                {i + 1}
              </span>
              <span className="text-[29px] font-extrabold uppercase leading-none tracking-tight text-slate-900">
                {song.title}
              </span>
              {song.isBSide && (
                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-[17px] font-black uppercase tracking-wider text-violet-700">
                  B-Side
                </span>
              )}
            </div>
            <span className="mt-[5px] text-[19px] font-bold uppercase leading-none tracking-[0.14em] text-[#3D4A63]">
              {albumTag(song)}
            </span>
          </div>
        ))}
        {top.length === 0 && (
          <p
            className={`py-16 text-center text-[34px] text-slate-500 ${handFont.className}`}
          >
            Rank some songs and your Top 10 appears here.
          </p>
        )}
      </div>

      {/* project masthead + the card's existing CTA, restyled */}
      <div className="absolute inset-x-12 bottom-[92px] z-10 flex items-center justify-center gap-[14px]">
        <FlyingW className="h-[26px] w-[48px] text-white" />
        <span className="text-[22px] font-black uppercase tracking-[0.22em] text-white/95">
          All My Favorite Songs · The Weezer Song Ranking Project
        </span>
      </div>
      <p
        className={`absolute inset-x-12 bottom-[30px] z-10 text-center text-[44px] font-bold leading-none text-white ${handFont.className}`}
      >
        JOIN THE DEBATE AT RANKINGWEEZER.COM
      </p>
    </div>
  );
});

/** Standalone Top 10 card with its own built-in download button. */
export function Top10Card({
  songs,
  subtitle,
}: {
  songs: ShareSong[];
  subtitle?: string;
}) {
  const { ref, busy, download } = useShareableDownload('weezer-top-10');
  return (
    <div>
      <div className="flex justify-center overflow-hidden rounded-3xl bg-[#dff1f8]">
        <div style={{ transform: 'scale(0.32)', transformOrigin: 'top center', height: 432, width: 1080 * 0.32 }}>
          <Top10CardVisual ref={ref} songs={songs} subtitle={subtitle} />
        </div>
      </div>
      <div className="mt-3">
        <SaveImageButton onClick={download} busy={busy} />
      </div>
    </div>
  );
}
