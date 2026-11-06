'use client';

/**
 * Temporary scroll-restoration debug overlay (Nov 6, 2026) — see
 * app/lib/scrollDebug.ts. Renders only while the sessionStorage
 * flag is set (?scrolldebug=1 on any URL); otherwise it renders
 * nothing and costs one storage read. Fixed and compact, it takes
 * pointer events only on its own panel so the page underneath
 * stays fully tappable/scrollable, and it lives at the provider
 * level so it survives step changes.
 */

import React, { useEffect, useState } from 'react';
import {
  activateScrollDebugFromUrl,
  disableScrollDebug,
  getScrollDebugEvents,
  isScrollDebugOn,
  scrollDebugLogText,
  subscribeScrollDebug,
} from '../lib/scrollDebug';

export default function ScrollDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEnabled(activateScrollDebugFromUrl() || isScrollDebugOn());
    const unsub = subscribeScrollDebug(() => {
      setEnabled(isScrollDebugOn());
      setTick((n) => n + 1);
    });
    return unsub;
  }, []);

  if (!enabled) return null;

  const events = getScrollDebugEvents();

  const copyLog = async () => {
    const text = scrollDebugLogText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can refuse (permissions / non-secure
      // context): fall back to a prompt the owner can copy from.
      window.prompt('Copy the scroll debug log:', text);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-start p-2">
      <div className="pointer-events-auto w-[340px] max-w-[92vw] rounded-lg border border-emerald-300/60 bg-black/85 p-2 font-mono text-[10px] leading-tight text-emerald-200 shadow-xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-bold text-emerald-300">
            SCROLLDEBUG ({events.length})
          </span>
          <button
            type="button"
            onClick={copyLog}
            className="rounded bg-emerald-500/90 px-2 py-0.5 font-bold text-black"
          >
            {copied ? 'Copied ✓' : 'Copy log'}
          </button>
          <button
            type="button"
            onClick={() => disableScrollDebug()}
            className="rounded bg-white/15 px-2 py-0.5 font-bold text-white"
          >
            Close
          </button>
        </div>
        <div className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap break-all">
          {events.length === 0
            ? 'no events yet — navigate around'
            : events.map((e) => `+${e.t}ms ${e.text}`).join('\n')}
        </div>
      </div>
    </div>
  );
}
