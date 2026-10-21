/**
 * Which build is deployed, for the client's stale-build
 * self-check (components/BuildVersionCheck). Vercel sets
 * VERCEL_GIT_COMMIT_SHA in the function's environment, the same
 * value next.config.js stamps into the client bundle at build
 * time — so the two sides of the comparison always come from
 * the same source. Empty when not on Vercel, which the client
 * treats as "unknown → never reload".
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { buildId: process.env.VERCEL_GIT_COMMIT_SHA || '' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
