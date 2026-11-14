/**
 * Spotify playlist export (owner feature request, Nov 14,
 * 2026): turn a fan's ranking — the full list or one bucket
 * — into a playlist in THEIR Spotify account.
 *
 * Flow (Authorization Code + PKCE, all client-side; the
 * app's client secret is never used by the browser):
 *   1. startSpotifyConnect() sends the fan to Spotify's
 *      authorize page with a PKCE challenge.
 *   2. Spotify returns to /api/spotify/callback, a tiny
 *      server-rendered page that finishes the token
 *      exchange and parks the tokens in localStorage.
 *   3. adoptPendingSpotifyTokens() (called by the export
 *      UI on mount) moves them into the fan's
 *      spotify_connections row so the link follows their
 *      account; the localStorage copy stays as the
 *      device-local fallback if that table isn't there.
 *
 * Spotify's February 2026 rules cap a new developer app at
 * 5 authorized users, so today this works for allowlisted
 * accounts (the owner + testers); everyone else gets a
 * clean "not available" from Spotify at the connect step.
 */
import { supabase } from '@/utils/supabase';
import { PREVIEW_MAP } from '@/app/data/previewMap';

export interface SpotifyConnection {
  spotifyUserId: string;
  displayName: string | null;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: number; // epoch ms
}

interface TokenBundle {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const LS_VERIFIER = 'weezer-spotify-verifier';
const LS_STATE = 'weezer-spotify-state';
const LS_PENDING = 'weezer-spotify-pending';
const LS_LOCAL = 'weezer-spotify-local';

const SCOPES = 'playlist-modify-public playlist-modify-private user-read-private';

let cachedClientId: string | null | undefined;

export async function getSpotifyClientId(): Promise<string | null> {
  if (cachedClientId !== undefined) return cachedClientId;
  try {
    const res = await fetch('/api/spotify/config');
    const data = await res.json();
    const cid: unknown = data?.clientId;
    cachedClientId = typeof cid === 'string' && cid ? cid : null;
  } catch {
    cachedClientId = null;
  }
  return cachedClientId;
}

function redirectUri(): string {
  return `${window.location.origin}/api/spotify/callback`;
}

function randomString(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join('');
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(digest));
  return btoa(String.fromCharCode.apply(null, bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Kick off the OAuth round-trip (full-page redirect). */
export async function startSpotifyConnect(): Promise<boolean> {
  const clientId = await getSpotifyClientId();
  if (!clientId) return false;
  const verifier = randomString(64);
  const state = randomString(24);
  try {
    localStorage.setItem(LS_VERIFIER, verifier);
    localStorage.setItem(LS_STATE, state);
  } catch {
    return false;
  }
  const challenge = await sha256Base64Url(verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  return true;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenBundle | null> {
  const clientId = await getSpotifyClientId();
  if (!clientId) return null;
  body.set('client_id', clientId);
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenBundle;
  } catch {
    return null;
  }
}

function bundleToConnection(bundle: TokenBundle, prev?: SpotifyConnection | null): SpotifyConnection {
  return {
    spotifyUserId: prev?.spotifyUserId || '',
    displayName: prev?.displayName ?? null,
    refreshToken: bundle.refresh_token || prev?.refreshToken || '',
    accessToken: bundle.access_token,
    expiresAt: Date.now() + bundle.expires_in * 1000,
  };
}

function saveLocal(conn: SpotifyConnection) {
  try {
    localStorage.setItem(LS_LOCAL, JSON.stringify(conn));
  } catch {
    /* private mode — connection just won't persist */
  }
}

function loadLocal(): SpotifyConnection | null {
  try {
    const raw = localStorage.getItem(LS_LOCAL);
    return raw ? (JSON.parse(raw) as SpotifyConnection) : null;
  } catch {
    return null;
  }
}

async function upsertConnectionRow(userId: string, conn: SpotifyConnection) {
  await supabase.from('spotify_connections').upsert(
    {
      user_id: userId,
      spotify_user_id: conn.spotifyUserId,
      display_name: conn.displayName,
      refresh_token: conn.refreshToken,
      access_token: conn.accessToken,
      expires_at: new Date(conn.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

/**
 * After the callback page parks fresh tokens in
 * localStorage, adopt them: resolve the Spotify identity,
 * mirror into the fan's spotify_connections row (best
 * effort), keep the local copy either way.
 */
export async function adoptPendingSpotifyTokens(): Promise<void> {
  let pending: TokenBundle | null = null;
  try {
    const raw = localStorage.getItem(LS_PENDING);
    if (raw) pending = JSON.parse(raw) as TokenBundle;
    localStorage.removeItem(LS_PENDING);
  } catch {
    pending = null;
  }
  if (!pending?.access_token || !pending.refresh_token) return;

  const conn = bundleToConnection(pending);
  try {
    const me = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    if (me.ok) {
      const profile = await me.json();
      conn.spotifyUserId = profile.id || '';
      conn.displayName = profile.display_name || null;
    }
  } catch {
    /* identity is a nicety; tokens are the substance */
  }
  saveLocal(conn);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      await upsertConnectionRow(session.user.id, conn);
    } catch {
      /* table may not exist yet — local copy still works */
    }
  }
}

/** The fan's connection: account row first, local fallback. */
export async function loadSpotifyConnection(): Promise<SpotifyConnection | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      const { data } = await supabase
        .from('spotify_connections')
        .select('spotify_user_id, display_name, refresh_token, access_token, expires_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data?.refresh_token) {
        const conn: SpotifyConnection = {
          spotifyUserId: data.spotify_user_id,
          displayName: data.display_name,
          refreshToken: data.refresh_token,
          accessToken: data.access_token,
          expiresAt: data.expires_at ? Date.parse(data.expires_at) : 0,
        };
        saveLocal(conn);
        return conn;
      }
    } catch {
      /* fall through to the local copy */
    }
  }
  return loadLocal();
}

/** A currently-valid access token, refreshing when needed. */
export async function getValidAccessToken(conn: SpotifyConnection): Promise<string | null> {
  if (conn.accessToken && conn.expiresAt - Date.now() > 60_000) return conn.accessToken;
  const bundle = await tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken,
    })
  );
  if (!bundle?.access_token) return null;
  const next = bundleToConnection(bundle, conn);
  saveLocal(next);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      await upsertConnectionRow(session.user.id, next);
    } catch {
      /* mirror is best-effort */
    }
  }
  Object.assign(conn, next);
  return next.accessToken;
}

// --------------------------------------------------------
// Track matching
// --------------------------------------------------------

function cleanTitle(t: string): string {
  return t
    .replace(/\s*\((bonus track|remaster(?:ed)?[^)]*|deluxe[^)]*)\)\s*/gi, '')
    .replace(/\s*-\s*(remaster(?:ed)?[^)]*|bonus track)\s*$/gi, '')
    .trim();
}

function normalize(t: string): string {
  return cleanTitle(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

interface SearchHit {
  uri: string;
  name: string;
  artists: { name: string }[];
}

async function searchTracks(accessToken: string, query: string): Promise<SearchHit[]> {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.tracks?.items || []) as SearchHit[];
  } catch {
    return [];
  }
}

function pickHit(hits: SearchHit[], targetTitle: string): SearchHit | null {
  const weezer = hits.filter((h) =>
    (h.artists || []).some((a) => a.name.toLowerCase() === 'weezer')
  );
  const target = normalize(targetTitle);
  return (
    weezer.find((h) => normalize(h.name) === target) ||
    weezer.find((h) => normalize(h.name).startsWith(target) || target.startsWith(normalize(h.name))) ||
    weezer[0] ||
    null
  );
}

export interface ExportSong {
  id: string;
  title: string;
  album: string;
}

/** Resolve one catalogue song to a Spotify track URI. */
export async function resolveTrackUri(accessToken: string, song: ExportSong): Promise<string | null> {
  const verified = PREVIEW_MAP[song.id];
  const attempts: { title: string; album?: string }[] = [];
  if (verified?.trackName) {
    attempts.push({ title: verified.trackName, album: verified.collectionName });
    attempts.push({ title: verified.trackName });
  }
  attempts.push({ title: song.title, album: song.album });
  attempts.push({ title: song.title });

  const seen = new Set<string>();
  for (const attempt of attempts) {
    const title = cleanTitle(attempt.title);
    const q = attempt.album
      ? `track:"${title}" album:"${attempt.album}" artist:Weezer`
      : `track:"${title}" artist:Weezer`;
    if (seen.has(q)) continue;
    seen.add(q);
    const hit = pickHit(await searchTracks(accessToken, q), attempt.title);
    if (hit) return hit.uri;
  }
  return null;
}

// --------------------------------------------------------
// Playlist creation
// --------------------------------------------------------

export interface ExportResult {
  playlistUrl: string;
  added: number;
  missing: string[];
}

export async function createSpotifyPlaylist(
  conn: SpotifyConnection,
  name: string,
  description: string,
  songs: ExportSong[],
  onProgress?: (done: number, total: number) => void
): Promise<ExportResult> {
  const accessToken = await getValidAccessToken(conn);
  if (!accessToken) throw new Error('Spotify session expired — reconnect and try again.');

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const createRes = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!createRes.ok) {
    throw new Error(
      createRes.status === 403
        ? 'Spotify refused the playlist — this app is limited to a few authorized accounts for now.'
        : `Spotify error (${createRes.status}) while creating the playlist.`
    );
  }
  const playlist = await createRes.json();
  const playlistId: string = playlist.id;
  const playlistUrl: string = playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlistId}`;

  // Resolve tracks in small parallel batches.
  const uris: (string | null)[] = new Array(songs.length).fill(null);
  let done = 0;
  const BATCH = 5;
  for (let i = 0; i < songs.length; i += BATCH) {
    const slice = songs.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((s) => resolveTrackUri(accessToken, s)));
    results.forEach((uri, j) => {
      uris[i + j] = uri;
    });
    done += slice.length;
    onProgress?.(done, songs.length);
  }

  const missing = songs.filter((_, i) => !uris[i]).map((s) => s.title);
  const found = uris.filter((u): u is string => !!u);

  for (let i = 0; i < found.length; i += 100) {
    const chunk = found.slice(i, i + 100);
    let res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uris: chunk }),
    });
    if (res.status === 404 || res.status === 405 || res.status === 400) {
      // Older endpoint name, kept as a fallback.
      res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ uris: chunk }),
      });
    }
    if (!res.ok) throw new Error(`Spotify error (${res.status}) while adding songs.`);
  }

  return { playlistUrl, added: found.length, missing };
}
