'use client';

/**
 * "Save to Spotify" (owner feature, Nov 14, 2026): on the
 * My Rankings page, under the share buttons. Connect once
 * (PKCE round-trip), then one tap per playlist — the full
 * ranking or a single bucket — built in the fan's own
 * Spotify account in their ranked order. Track matching
 * leans on the verified preview-map names (app/lib/spotify).
 *
 * Renders nothing until it knows the deployment has a
 * Spotify client ID, so the feature simply doesn't exist
 * on deployments where the env var isn't set.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  adoptPendingSpotifyTokens,
  createSpotifyPlaylist,
  getSpotifyClientId,
  loadSpotifyConnection,
  startSpotifyConnect,
  type ExportSong,
  type SpotifyConnection,
} from '@/app/lib/spotify';

type Phase =
  | 'loading'
  | 'hidden'
  | 'disconnected'
  | 'connected'
  | 'working'
  | 'done'
  | 'error';

const BUCKETS: { key: string; plural: string }[] = [
  { key: 'banger', plural: 'Bangers' },
  { key: 'slaps', plural: 'Slaps' },
  { key: 'mid', plural: 'Mids' },
  { key: 'skip', plural: 'Skips' },
  { key: 'trash', plural: 'Trash' },
];

const REAL = new Set(BUCKETS.map((b) => b.key));

export default function SpotifyExport({
  masterList,
  triageMap,
  username,
}: {
  masterList: { id: string; title: string; album: string }[];
  triageMap: Record<string, string>;
  username: string;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [conn, setConn] = useState<SpotifyConnection | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneInfo, setDoneInfo] = useState<{ url: string; added: number; missing: string[] } | null>(null);

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
      if (connection) {
        setConn(connection);
        setPhase('connected');
      } else {
        setPhase('disconnected');
        try {
          if (new URLSearchParams(window.location.search).get('spotify') === 'error') {
            setErrorMsg("Spotify connect didn't go through — try again.");
          }
        } catch {
          /* no-op */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scopes = useMemo(() => {
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
    return { full, byBucket };
  }, [masterList, triageMap]);

  if (phase === 'loading' || phase === 'hidden') return null;

  const runExport = async (label: string, songs: ExportSong[]) => {
    if (!conn || songs.length === 0) return;
    setPhase('working');
    setErrorMsg('');
    setProgress(`Finding your songs on Spotify… 0/${songs.length}`);
    try {
      const name = label === 'Full ranking' ? 'My Weezer Ranking' : `My Weezer ${label}`;
      const description = `Ranked by @${username} on RankingWeezer — https://rankingweezer.com/u/${username}`;
      const result = await createSpotifyPlaylist(conn, name, description, songs, (done, total) =>
        setProgress(`Finding your songs on Spotify… ${done}/${total}`)
      );
      setDoneInfo({ url: result.playlistUrl, added: result.added, missing: result.missing });
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong building the playlist.');
      setPhase('error');
    }
  };

  const buttonClass =
    'rounded-full border-[3px] border-[#0C1220] bg-white px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:bg-sky-50 active:translate-y-[1px] cursor-pointer';

  return (
    <div className="mt-4 flex flex-col items-center">
      {phase === 'disconnected' && (
        <>
          <button type="button" onClick={() => void startSpotifyConnect()} className={buttonClass}>
            Connect Spotify
          </button>
          {errorMsg && (
            <p className="mt-2 text-center text-xs font-bold text-rose-700">{errorMsg}</p>
          )}
        </>
      )}

      {(phase === 'connected' || phase === 'working' || phase === 'error') && (
        <>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            disabled={phase === 'working'}
            className={buttonClass}
          >
            {phase === 'working' ? 'Building your playlist…' : 'Save to Spotify'}
          </button>

          {phase === 'working' && (
            <p className="mt-2 text-center text-xs font-bold text-[#3D4A63]">{progress}</p>
          )}
          {phase === 'error' && (
            <p className="mt-2 max-w-sm text-center text-xs font-bold text-rose-700">{errorMsg}</p>
          )}

          {panelOpen && phase !== 'working' && (
            <div className="mt-3 w-full max-w-md rounded-2xl border-2 border-[#0C1220] bg-white p-3">
              <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
                Make a playlist from…
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => void runExport('Full ranking', scopes.full)}
                  className="flex items-center justify-between rounded-xl border-2 border-[#0C1220] bg-[#FFC72C] px-4 py-2.5 text-[13px] font-black text-[#0C1220] transition hover:brightness-105 cursor-pointer"
                >
                  <span>Full ranking</span>
                  <span>{scopes.full.length} songs</span>
                </button>
                {BUCKETS.map(({ key, plural }) => {
                  const songs = scopes.byBucket.get(key) || [];
                  if (songs.length === 0) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void runExport(plural, songs)}
                      className="flex items-center justify-between rounded-xl border-2 border-[#0C1220] bg-white px-4 py-2.5 text-[13px] font-black text-[#0C1220] transition hover:bg-sky-50 cursor-pointer"
                    >
                      <span>{plural}</span>
                      <span>{songs.length} songs</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[11px] font-bold text-[#3D4A63]">
                Lands in your Spotify as a private playlist, in your order.
              </p>
            </div>
          )}
        </>
      )}

      {phase === 'done' && doneInfo && (
        <div className="mt-1 flex flex-col items-center">
          <a
            href={doneInfo.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border-[3px] border-[#0C1220] bg-[#1DB954] px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:brightness-105 active:translate-y-[1px]"
          >
            Open in Spotify →
          </a>
          <p className="mt-2 max-w-sm text-center text-xs font-bold text-[#3D4A63]">
            {doneInfo.added} songs added.
            {doneInfo.missing.length > 0 &&
              ` Not on Spotify: ${doneInfo.missing.slice(0, 4).join(', ')}${doneInfo.missing.length > 4 ? ` and ${doneInfo.missing.length - 4} more` : ''}.`}
          </p>
          <button
            type="button"
            onClick={() => {
              setDoneInfo(null);
              setPhase('connected');
              setPanelOpen(true);
            }}
            className="mt-1 text-xs font-black text-[#0072CE] underline underline-offset-4 cursor-pointer"
          >
            Make another
          </button>
        </div>
      )}
    </div>
  );
}
