import { NextResponse } from 'next/server';

/**
 * Hands the browser the Spotify app's client ID (a public
 * identifier — the PKCE flow never uses the secret). The
 * ID lives in the server-only SPOTIFY_CLIENT_ID env var the
 * owner set in Vercel.
 */
export async function GET() {
  return NextResponse.json({
    clientId: process.env.SPOTIFY_CLIENT_ID || null,
  });
}
