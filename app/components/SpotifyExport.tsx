'use client';

/**
 * Spotify playlist export — the modal experience (owner
 * redesign, Nov 14, 2026; replaces the inline button/panel
 * shipped earlier the same day).
 *
 * Discovery: a feature card on My Rankings ("Your ranking,
 * as a playlist"). Everything else happens in ONE modal:
 * intro → (Spotify sign-in round-trip) → pick a list →
 * building progress → done, with errors inside the modal.
 *
 * The flow rule the owner set after his first run: never
 * lose the thread. Clicking Connect leaves a note
 * (localStorage `weezer-spotify-return`); when the OAuth
 * round-trip lands back on the site — dashboard included —
 * the modal reopens on its own at the pick-a-list step
 * with a "You're connected" confirmation. The root page
 * mounts <SpotifyReturnGate /> for exactly that; the card
 * instance on My Rankings never auto-opens.
 *
 * Env-gated like before: no client ID in the deployment,
 * no card, no modal, no gate.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  adoptPendingSpotifyTokens,
  createSpotifyPlaylist,
  disconnectSpotify,
  getSpotifyClientId,
  loadSpotifyConnection,
  startSpotifyConnect,
  type ExportSong,
  type SpotifyConnection,
} from '@/app/lib/spotify';
import { useWeezer } from '../context/WeezerContext';

const RETURN_KEY = 'weezer-spotify-return';

type Phase = 'loading' | 'hidden' | 'intro' | 'scope' | 'working' | 'done' | 'error';

const BUCKETS: { key: string; plural: string }[] = [
  { key: 'banger', plural: 'Bangers' },
  { key: 'slaps', plural: 'Slaps' },
  { key: 'mid', plural: 'Mids' },
  { key: 'skip', plural: 'Skips' },
  { key: 'trash', plural: 'Trash' },
];

const REAL = new Set(BUCKETS.map((b) => b.key));

interface ScopeOption {
  label: string;
  songs: ExportSong[];
}

type SongLike = { id: string; title: string; album: string };

/** Spotify's official icon glyph — their brand mark, unmodified,
 * single color via currentColor. Spotify's branding rules allow
 * the icon on exactly these affordances: actions that connect
 * to, create in, or open Spotify. */
function SpotifyGlyph({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function SpotifyFlow({
  masterList,
  triageMap,
  username,
  variant,
}: {
  masterList: SongLike[];
  triageMap: Record<string, string>;
  username: string;
  variant: 'card' | 'gate';
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [conn, setConn] = useState<SpotifyConnection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [selected, setSelected] = useState('Full ranking');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [doneInfo, setDoneInfo] = useState<{
    name: string;
    url: string;
    added: number;
    missing: string[];
  } | null>(null);

  const scopes = useMemo<ScopeOption[]>(() => {
    const byBucket = new Map<string, ExportSong[]>();
    const full: ExportSong[] = [];
    for (const song of masterList) {
      const bucket = triageMap[song.id];
      if (!bucket || !REAL.has(bucket)) continue;
      const entry = { id: song.id, title: song.title, album: song.album };
      full.push(entry);
      const list = byBucket.get(bucket) || [];
      list.push(entry);
      byBucket.set(bucket, list);
    }
    const options: ScopeOption[] = [{ label: 'Full ranking', songs: full }];
    for (const { key, plural } of BUCKETS) {
      const songs = byBucket.get(key) || [];
      if (songs.length > 0) options.push({ label: plural, songs });
    }
    return options;
  }, [masterList, triageMap]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await getSpotifyClientId();
      if (!clientId) {
        if (!cancelled) setPhase('hidden');
        return;
      }
      await adoptPendingSpotifyTokens();
      const connection = await loadSpotifyConnection();
      if (cancelled) return;

      let returning = false;
      try {
        returning = localStorage.getItem(RETURN_KEY) === '1';
        if (returning) localStorage.removeItem(RETURN_KEY);
      } catch {
        /* no-op */
      }

      if (connection) {
        setConn(connection);
        setPhase('scope');
      } else {
        setPhase('intro');
        try {
          if (new URLSearchParams(window.location.search).get('spotify') === 'error') {
            setErrorMsg("Spotify connect didn't go through — try again.");
          }
        } catch {
          /* no-op */
        }
      }

      // The return trip: reopen the modal wherever the fan
      // landed, at the right step, exactly once. The gate
      // owns this on non-rankings pages; the card instance
      // owns it when the fan is already on My Rankings.
      const shouldAutoOpen =
        returning || new URLSearchParams(window.location.search).get('spotify') === 'connected';
      if (shouldAutoOpen && (variant === 'gate' || returning)) {
        if (connection) setJustConnected(true);
        setModalOpen(true);
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('spotify')) {
            url.searchParams.delete('spotify');
            window.history.replaceState({}, '', url.toString());
          }
        } catch {
          /* no-op */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // variant is fixed per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'loading' || phase === 'hidden') return null;
  if (variant === 'gate' && !modalOpen) return null;

  const selectedScope = scopes.find((s) => s.label === selected) || scopes[0];
  const playlistName =
    selectedScope.label === 'Full ranking'
      ? 'My Weezer Ranking'
      : `My Weezer ${selectedScope.label}`;

  const handleConnect = () => {
    try {
      localStorage.setItem(RETURN_KEY, '1');
    } catch {
      /* no-op */
    }
    void startSpotifyConnect();
  };

  const handleDisconnect = async () => {
    await disconnectSpotify();
    setConn(null);
    setJustConnected(false);
    setPhase('intro');
  };

  const runExport = async () => {
    if (!conn || selectedScope.songs.length === 0) return;
    setPhase('working');
    setErrorMsg('');
    setProgress({ done: 0, total: selectedScope.songs.length });
    try {
      const description = `Ranked by @${username} on RankingWeezer — https://rankingweezer.com/u/${username}`;
      const result = await createSpotifyPlaylist(
        conn,
        playlistName,
        description,
        selectedScope.songs,
        (done, total) => setProgress({ done, total })
      );
      setDoneInfo({
        name: playlistName,
        url: result.playlistUrl,
        added: result.added,
        missing: result.missing,
      });
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong building the playlist.');
      setPhase('error');
    }
  };

  const closeModal = () => {
    if (phase === 'working') return;
    setModalOpen(false);
    setJustConnected(false);
    if (phase === 'done' || phase === 'error') {
      setPhase(conn ? 'scope' : 'intro');
      setDoneInfo(null);
      setErrorMsg('');
    }
  };

  const title =
    phase === 'intro'
      ? 'Your ranking, as a playlist.'
      : phase === 'scope'
        ? 'Pick your list.'
        : phase === 'working'
          ? 'Building your playlist…'
          : phase === 'done'
            ? "It's on Spotify."
            : "That didn't work.";

  return (
    <>
      {variant === 'card' && (
        <div className="mt-4 w-full max-w-md rounded-[28px] border border-slate-200 bg-white px-4 py-[18px] shadow-[0_14px_30px_rgba(12,18,32,0.08)]">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#1DB954]/15">
              <SpotifyGlyph className="h-[26px] w-[26px] text-[#1DB954]" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[15px] font-black leading-tight text-[#0C1220]">
                Your ranking, as a playlist
              </div>
              <div className="text-xs font-semibold leading-snug text-[#3D4A63]">
                Same songs, same order — ready to play in Spotify.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3.5 w-full cursor-pointer rounded-full bg-[#1DB954] px-6 py-[15px] text-sm font-black text-[#0C1220] shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition hover:brightness-105 active:scale-[0.98]"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <SpotifyGlyph />
              Make my playlist
            </span>
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0C1220]/60 sm:items-center sm:p-6">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-slate-200 bg-white px-6 py-[26px] shadow-[0_14px_30px_rgba(12,18,32,0.08)] sm:rounded-[28px]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-xl font-black tracking-tight text-[#0C1220]">{title}</h3>
              {phase !== 'working' && (
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-sm font-black text-[#0C1220]"
                >
                  ✕
                </button>
              )}
            </div>

            {phase === 'intro' && (
              <div>
                <p className="text-sm font-semibold leading-snug text-[#3D4A63]">
                  Turn your list into a Spotify playlist — same songs, same order, ready to play.
                </p>
                <div className="mt-4 space-y-1.5">
                  {scopes.map((option) => (
                    <div
                      key={option.label}
                      className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-black text-[#0C1220]"
                    >
                      <span>{option.label}</span>
                      <span className="text-[#3D4A63]">{option.songs.length} songs</span>
                    </div>
                  ))}
                </div>
                {errorMsg && (
                  <p className="mt-3 text-center text-xs font-bold text-rose-700">{errorMsg}</p>
                )}
                <button
                  type="button"
                  onClick={handleConnect}
                  className="mt-5 w-full cursor-pointer rounded-full bg-[#1DB954] px-6 py-[15px] text-sm font-black text-[#0C1220] shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition hover:brightness-105 active:scale-[0.98]"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <SpotifyGlyph />
                    Connect Spotify
                  </span>
                </button>
                <p className="mt-3 text-center text-[11px] font-bold text-[#3D4A63]">
                  Private playlist, created in your Spotify account. Delete it anytime.
                </p>
              </div>
            )}

            {phase === 'scope' && (
              <div>
                {justConnected && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-emerald-50 px-4 py-[11px] text-center text-[13px] font-black text-emerald-900">
                    You&apos;re connected ✓
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {scopes.map((option) => {
                    const isSelected = option.label === selectedScope.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setSelected(option.label)}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-[11px] text-[13px] font-black text-[#0C1220] transition ${
                          isSelected ? 'bg-[#FFC72C]' : 'bg-white hover:bg-sky-50'
                        }`}
                      >
                        <span>{option.label}</span>
                        <span>{option.songs.length} songs</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-xs font-bold text-[#3D4A63]">
                  Playlist name: “{playlistName}”
                </p>
                <button
                  type="button"
                  onClick={() => void runExport()}
                  className="mt-3 w-full cursor-pointer rounded-full bg-[#1DB954] px-6 py-[15px] text-sm font-black text-[#0C1220] shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition hover:brightness-105 active:scale-[0.98]"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <SpotifyGlyph />
                    Create playlist
                  </span>
                </button>
                <p className="mt-3 text-center text-[11px] font-bold text-[#3D4A63]">
                  Connected as {conn?.displayName || 'your Spotify account'} ·{' '}
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    className="cursor-pointer font-black text-[#0072CE] underline underline-offset-2"
                  >
                    Disconnect
                  </button>
                </p>
              </div>
            )}

            {phase === 'working' && (
              <div>
                <p className="text-center text-sm font-bold text-[#3D4A63]">
                  Finding your songs on Spotify… {progress.done}/{progress.total}
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  <div
                    className="h-full bg-[#1DB954] transition-all duration-300"
                    style={{
                      width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-center text-[11px] font-bold text-[#3D4A63]">
                  Then it lands in your Spotify as “{playlistName}”, in your order.
                </p>
              </div>
            )}

            {phase === 'done' && doneInfo && (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#1DB954] text-2xl font-black text-[#0C1220]">
                  ✓
                </div>
                <p className="text-sm font-semibold leading-snug text-[#3D4A63]">
                  “{doneInfo.name}” is live in your Spotify — {doneInfo.added} songs, in your order.
                </p>
                {doneInfo.missing.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-[#3D4A63]">
                    Not on Spotify: {doneInfo.missing.slice(0, 6).join(', ')}
                    {doneInfo.missing.length > 6 ? ` and ${doneInfo.missing.length - 6} more` : ''}.
                  </p>
                )}
                <a
                  href={doneInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block w-full rounded-full bg-[#1DB954] px-6 py-[15px] text-sm font-black text-[#0C1220] shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition hover:brightness-105"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <SpotifyGlyph />
                    Open in Spotify →
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setDoneInfo(null);
                    setPhase('scope');
                  }}
                  className="mt-3 cursor-pointer text-xs font-black text-[#0072CE] underline underline-offset-4"
                >
                  Make another
                </button>
              </div>
            )}

            {phase === 'error' && (
              <div className="text-center">
                <p className="text-sm font-semibold leading-snug text-rose-700">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => setPhase(conn ? 'scope' : 'intro')}
                  className="mt-4 w-full cursor-pointer rounded-full border border-slate-200 bg-white px-6 py-[14px] text-sm font-black text-[#0C1220] shadow-[0_14px_30px_rgba(12,18,32,0.08)] transition hover:bg-sky-50 active:scale-[0.98]"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function SpotifyExport({
  masterList,
  triageMap,
  username,
}: {
  masterList: SongLike[];
  triageMap: Record<string, string>;
  username: string;
}) {
  return (
    <SpotifyFlow masterList={masterList} triageMap={triageMap} username={username} variant="card" />
  );
}

/**
 * Mounted once on the root page: if the fan just came back
 * from Spotify sign-in, reopen the modal wherever they
 * landed. Renders nothing otherwise.
 */
export function SpotifyReturnGate() {
  const { userProfile, masterList, triageMap } = useWeezer();
  const username = userProfile?.username?.trim();
  if (!username) return null;
  return (
    <SpotifyFlow
      masterList={masterList as SongLike[]}
      triageMap={triageMap as Record<string, string>}
      username={username}
      variant="gate"
    />
  );
}
