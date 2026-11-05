'use client';

import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import {
  FlyingW,
  POSTER_BLUE,
  PosterDomain,
  VinylDisc,
  resolveAlbumId,
} from './ShareCardShell';
import { displayFont, handFont } from './fonts';

/** Why this doodle is defined locally instead of imported from
 *  ShareCardShell: the deployed-bundle fault proven on 2026-11-03
 *  (FanhoodCard, React #130) recurred on 2026-11-04 in the preview
 *  build of the shareables round — this card copied the Top 10 Songs
 *  card's layout including its shell-imported doodle, and the gallery
 *  crashed on both the Shareables page and the Sweater Thread for
 *  players with rankings. A module-local copy cannot be dropped by
 *  the bundler the way the shared export was. FanhoodCard and
 *  Top10Card carry the same local copy; the ShareCardShell export
 *  remains but no card imports it anymore. */
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
import type { ShareSong } from './Top10Card';

/** Minimal ranked-album shape — structural subset of the tier
 *  chart's RankedAlbum (the gallery passes tierCharts.rankedAlbums,
 *  already in rank order with shrinkage-adjusted scores upstream). */
export type ShareRankedAlbum = {
  id: string;
  album: string;
  rank: number;
};

/** The album's highest-ranked song: the FIRST song in the ranked
 *  list that belongs to the album (the ranked list is best-first, so
 *  the first match is the highest-ranked). Matching goes through the
 *  album-id bridge (the same resolveAlbumId Top10Card uses for its
 *  album tags) because the two sides name albums differently —
 *  rankedAlbums carries canonical display names ("Everything Will
 *  Be Alright in the End", "The Green Album") while songs carry the
 *  catalog's short forms ("EWBAITE", "Green Album"); an exact
 *  album-name match is kept as a fallback for entries whose id
 *  doesn't resolve. Returns the song and its 1-based rank, or null
 *  when the album has no ranked song. */
function topSongFor(
  entry: ShareRankedAlbum,
  songs: ShareSong[]
): { title: string; rank: number } | null {
  const idx = songs.findIndex((song) => {
    if (song.album === entry.album) return true;
    const songAlbumId = resolveAlbumId(song);
    return Boolean(songAlbumId) && songAlbumId === entry.id;
  });
  if (idx === -1) return null;
  return { title: songs[idx].title, rank: idx + 1 };
}

export const Top10AlbumsCardVisual = forwardRef<
  HTMLDivElement,
  { albums: ShareRankedAlbum[]; songs: ShareSong[]; subtitle?: string }
>(function Top10AlbumsCardVisual({ albums, songs }, ref) {
  const top = albums.slice(0, 10);

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
          the title set over it in chunky display type — same ink
          stroke + hard poster shadow as the songs card (Nov 5), so
          the white type stops washing out over the record */}
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
          Weezer Albums
        </p>
      </div>

      {/* the Top 10 Songs card's challenge bubble, kept verbatim —
          it speaks about rankings generally, not songs specifically
          (Nov 5: ink frame + hard shadow, as on the songs card) */}
      <div className="absolute right-[80px] top-[438px] z-20 rotate-2 rounded-2xl rounded-br-sm border-[3px] border-[#0C1220] bg-white px-5 py-2.5 shadow-[4px_4px_0_rgba(12,18,32,0.9)]">
        <span
          className={`whitespace-nowrap text-[33px] leading-none text-slate-800 ${handFont.className}`}
        >
          Undone by my rankings? Getchoo a list of your own.
        </span>
      </div>

      {/* the ranked list on a white paper panel, same geometry as
          the songs card: rank numeral + album name (never truncated),
          with the album's top song as the second line. Nov 5: the
          panel takes the card system's ink frame + hard shadow. */}
      <div className="absolute left-[96px] right-[96px] top-[500px] z-10 rounded-[20px] border-[3px] border-[#0C1220] bg-white px-[40px] pb-[18px] pt-[24px] shadow-[6px_6px_0_rgba(12,18,32,0.9)]">
        {top.map((entry, i) => {
          const topSong = topSongFor(entry, songs);
          return (
            <div
              key={entry.id || entry.album}
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
                  {entry.album}
                </span>
              </div>
              {topSong && (
                <span className="mt-[5px] text-[19px] font-bold leading-none text-[#3D4A63]">
                  Top song: {topSong.title} · #{topSong.rank}
                </span>
              )}
            </div>
          );
        })}
        {top.length === 0 && (
          <p
            className={`py-16 text-center text-[34px] text-slate-500 ${handFont.className}`}
          >
            Rank some songs and your top albums appear here.
          </p>
        )}
      </div>

      {/* project masthead + the card family's standard footer,
          identical to the Top 10 Songs card */}
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
