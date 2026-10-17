import React from 'react';
import { BUCKET_CONFIG, BucketType } from '../data/constants';

/**
 * BucketGuide — a display-only replica of the deck's real sort
 * controls, for teaching (orientation today; the help / "?" surface
 * next). Nothing here sorts anything: the tiles copy the deck tray's
 * markup and classes but are rendered as plain <div>s — no <button>,
 * no onClick, no cursor/hover affordances. If the deck tiles' look
 * ever changes, change these replicas to match.
 *
 * Class sources (Step1Deck.tsx):
 *  - Tray tile: `renderBucketButton`, default (unselected) state —
 *    white tile, thin slate border, the bucket's emoji large on top,
 *    its label underneath; slaps displays as "Slaps", matching the
 *    deck. (The deck tile is flex-1 in its tray; here each replica
 *    sits at a fixed legend width so a purpose line can sit beside
 *    it.)
 *  - Don't Know It: the quiet centered line under the deck tray —
 *    `text-sm px-4 py-1 rounded-full text-slate-500 font-medium`.
 */

const GUIDE_BUCKETS: { key: BucketType; purpose: string }[] = [
  { key: 'banger', purpose: 'An all-timer. The best of the best.' },
  { key: 'slaps', purpose: 'Great song — just not elite.' },
  { key: 'mid', purpose: 'Fine. Forgettable.' },
  { key: 'skip', purpose: 'You rarely reach for it.' },
  { key: 'trash', purpose: 'Never again. Keep it away.' },
];

export default function BucketGuide() {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      {GUIDE_BUCKETS.map(({ key, purpose }) => {
        const cfg = BUCKET_CONFIG[key];
        // The deck shortens this one label on its tiles.
        const displayLabel = key === 'slaps' ? 'Slaps' : cfg.label;
        return (
          <div key={key} className="flex items-center gap-3.5">
            {/* Replica of the deck tray tile (default state). */}
            <div className="w-[92px] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-3 shadow-sm bg-white border-slate-200">
              <span className="text-[26px] leading-none">{cfg.emoji}</span>
              <span className="text-[13px] font-bold leading-tight text-slate-800">
                {displayLabel}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-600 leading-snug">
              {purpose}
            </p>
          </div>
        );
      })}

      {/* DON'T KNOW IT — replica of the quiet line under the tray. */}
      <div className="flex items-center gap-3.5 pt-1 border-t border-slate-100">
        <div className="w-[92px] shrink-0 text-center pt-2">
          <span className="inline-block text-sm px-4 py-1 rounded-full text-slate-500 font-medium whitespace-nowrap">
            Don&apos;t Know It
          </span>
        </div>
        <p className="text-sm font-medium text-slate-600 leading-snug pt-2">
          Never heard it. It doesn&apos;t count as a rating.
        </p>
      </div>
    </div>
  );
}
