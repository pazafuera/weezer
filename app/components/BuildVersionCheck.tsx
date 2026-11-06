'use client';

import { useEffect } from 'react';
import {
  shouldReloadForBuild,
  BUILD_RELOAD_GUARD_KEY,
} from './buildVersion';
import { readFreshPendingScrollRestore } from '../lib/pendingScrollRestore';
import { logScrollDebug } from '../lib/scrollDebug';

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
 * missing, unreadable ids) quietly does nothing. One deliberate
 * delay: while a fresh pending scroll restore exists (a
 * Back/Forward landing mid-restore — its scroll position is the
 * one piece of state a reload cannot carry), the reload waits
 * for the next check cycle; see the inline note and
 * app/lib/pendingScrollRestore.ts.
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
          // One exception to "reload as soon as a stale build is
          // proven": a Back/Forward landing whose scroll restore
          // is still owed. The design note in buildVersion.ts
          // calls a reload state-safe because the step survives
          // in ?step= — but the landing's scroll position does
          // not, and the owner's Nov 6 device log caught this
          // exact reload wiping a restore 213ms after it started.
          // A fresh persisted restore record
          // (app/lib/pendingScrollRestore.ts) means a landing is
          // mid-flight: skip THIS check cycle. The record clears
          // when the restore consumes it and goes stale in 15s
          // regardless, so the next mount/foreground check still
          // catches a genuinely stale build moments later — and
          // if a later reload does land, the record is what lets
          // the rebooted app finish the restore.
          const pendingRestore = readFreshPendingScrollRestore();
          if (pendingRestore) {
            logScrollDebug(
              `watchdog reload SKIPPED fresh pending scroll restore step=${pendingRestore.step} y=${pendingRestore.y} navIndex=${pendingRestore.navIndex}`
            );
            return;
          }
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
