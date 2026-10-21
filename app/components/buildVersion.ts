/**
 * Stale-build decision for the installed (home-screen) app.
 *
 * iOS standalone web apps resume from a frozen snapshot of the
 * page and cache aggressively: across a deploy, the installed
 * app can keep running the previous build's JS while the server
 * has moved on. There is no service worker here to mediate that
 * (none exists in this app — checked), so the shell defends
 * itself: BuildVersionCheck asks the server which build is
 * deployed and reloads ONCE when it differs from the running
 * one. A reload is state-safe by the site's own design — guest
 * picks live in localStorage, account picks in the database,
 * and the current step is mirrored in the ?step= URL param, so
 * the user lands back exactly where they were, on fresh code.
 *
 * Conservative by construction (the rules this function pins):
 * - Either id unknown (local dev, endpoint unreachable) → never
 *   reload: an unverifiable build is not a stale build.
 * - Ids equal → never reload.
 * - Ids differ but a reload was already spent on THAT deployed
 *   id in this session → never reload again for it: at most one
 *   reload per deployed version, so a mismatch that somehow
 *   survives the reload can't become a reload loop.
 */
export function shouldReloadForBuild(
  runningBuildId: string,
  deployedBuildId: string,
  alreadyReloadedFor: string | null
): boolean {
  if (!runningBuildId || !deployedBuildId) return false;
  if (runningBuildId === deployedBuildId) return false;
  return alreadyReloadedFor !== deployedBuildId;
}

/** sessionStorage key holding the deployed id a reload was spent on. */
export const BUILD_RELOAD_GUARD_KEY = 'weezer-build-reload-for';
