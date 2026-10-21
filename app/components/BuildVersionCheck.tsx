'use client';

import { useEffect } from 'react';
import {
  shouldReloadForBuild,
  BUILD_RELOAD_GUARD_KEY,
} from './buildVersion';

/** The build this bundle was compiled from, stamped at build time
 *  (next.config.js env: VERCEL_GIT_COMMIT_SHA). Empty outside a
 *  Vercel build, which disables the check — a local/dev bundle has
 *  no deployed counterpart to compare against. */
const RUNNING_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || '';

/**
 * Self-heal for a stale installed app: on mount, and again every
 * time the app comes back to the foreground (the moment a frozen
 * standalone snapshot resumes), ask the server which build is
 * deployed. If it isn't the build this code belongs to, reload
 * once per deployed version (guard in sessionStorage) so the
 * user is never stuck driving an old shell — the failure family
 * behind the pre-seed Fan Stats his long-lived session showed
 * him on Oct 19, and behind frozen-overlay states that no
 * in-page control can escape. Any failure (offline, endpoint
 * missing, unreadable ids) quietly does nothing.
 */
export default function BuildVersionCheck() {
  useEffect(() => {
    if (!RUNNING_BUILD_ID) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const deployedBuildId =
          typeof data?.buildId === 'string' ? data.buildId : '';
        let alreadyReloadedFor: string | null = null;
        try {
          alreadyReloadedFor = window.sessionStorage.getItem(
            BUILD_RELOAD_GUARD_KEY
          );
        } catch (e) {
          // sessionStorage unavailable (private mode edges): the
          // decision still runs, just without the spent-guard —
          // a same-session repeat would need the ids to STILL
          // differ after a reload, which a completed reload
          // already makes false.
        }
        if (
          shouldReloadForBuild(
            RUNNING_BUILD_ID,
            deployedBuildId,
            alreadyReloadedFor
          )
        ) {
          try {
            window.sessionStorage.setItem(
              BUILD_RELOAD_GUARD_KEY,
              deployedBuildId
            );
          } catch (e) {
            // Guard couldn't persist; reload anyway — landing on
            // the deployed build makes the ids equal, which stops
            // any repeat on its own.
          }
          window.location.reload();
        }
      } catch (e) {
        // Offline or endpoint unreachable: stay put silently.
      }
    };

    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', check);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', check);
    };
  }, []);

  return null;
}
