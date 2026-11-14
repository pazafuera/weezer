'use client';

import React from 'react';

// THE MICRO-PROGRAM MODULE (owner, Nov 14, 2026) — replaces
// the always-on Rank/Review toggle and the tools row on the
// Refine stage with one guided, collapsible block:
//
//   Step 1 (lower buckets, undecided): "Rank these, or just
//     review?" — asked once per bucket; the answer is the
//     bucket's remembered mode.
//   Step 2 (Rank mode): "How do you want to start?" — Head
//     to Head / Split in Chunks / Just drag. Picking a tool
//     collapses the module and launches it.
//   Collapsed: a slim strip naming the current mode. After
//     any tool finishes, the stage returns with the module
//     collapsed, so the song list sits as high as possible.
//
// The point is sequence over pile-up: the header's three
// jobs (explain, choose a mode, choose a tool) happen one
// at a time, then get out of the list's way.

export type RefineMode = 'rank' | 'review';

export default function RefineToolsModule({
  open,
  mode,
  isRankableBucket,
  songCount,
  plural,
  onOpen,
  onClose,
  onChooseMode,
  onLaunchMatchups,
  onLaunchSplit,
  toolsTouched = false
}: {
  open: boolean;
  /** 'rank' | 'review' once decided; null = a lower bucket
   *  the fan hasn't chosen for yet. Rankable buckets are
   *  always 'rank'. */
  mode: RefineMode | null;
  isRankableBucket: boolean;
  songCount: number;
  /** Plural bucket name: "Mids", "Slaps", "Trash". */
  plural: string;
  onOpen: () => void;
  onClose: () => void;
  onChooseMode: (mode: RefineMode) => void;
  onLaunchMatchups: () => void;
  onLaunchSplit: () => void;
  /** True once a tool has actually been used in this bucket
   *  (a matchup session that changed the order, or an applied
   *  split pass). The tools step then speaks as a RETURNING
   *  state — drag first, tools again — instead of a fresh
   *  "how do you want to start?" (owner, Nov 14, 2026). */
  toolsTouched?: boolean;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open the ranking tools"
        className="refine-step-in w-full rounded-xl border-[2.5px] border-[#0C1220] bg-white hover:bg-slate-50 px-4 py-2.5 flex items-center justify-between shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
      >
        <span className="text-[12px] font-black text-[#0C1220]">
          {mode === 'rank'
            ? toolsTouched
              ? 'Drag to refine — or use a tool again'
              : 'Ranking — drag, or use a tool'
            : mode === 'review'
              ? 'Just reviewing'
              : `Rank your ${plural}, or just review?`}
        </span>
        <span className="text-[12px] font-black text-[#3D4A63]">▾</span>
      </button>
    );
  }

  return (
    <div className="rounded-[18px] border-[2.5px] border-[#0C1220] bg-white p-4 shadow-[3px_3px_0_rgba(11,30,63,0.85)] refine-step-in">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] pt-1">
          {mode === 'rank' ? 'Ranking tools' : 'Optional deep dive'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] font-black text-[#3D4A63] underline underline-offset-4 hover:text-[#0C1220] cursor-pointer min-h-[32px] px-1"
        >
          Done ▾
        </button>
      </div>

      {mode === null && (
        <div key="ask" className="refine-step-in">
          <p className="text-[15px] font-black text-[#0C1220] leading-snug mb-3">
            Do you want to Rank your {plural} or Just Review?
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onChooseMode('rank')}
              className="flex-1 rounded-xl border-2 border-[#0C1220] bg-amber-400 px-3 py-2.5 text-[13px] font-black text-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
            >
              Rank them
            </button>
            <button
              type="button"
              onClick={() => onChooseMode('review')}
              className="flex-1 rounded-xl border-2 border-[#0C1220] bg-white px-3 py-2.5 text-[13px] font-black text-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
            >
              Just review
            </button>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div key="review" className="refine-step-in">
          <p className="text-[15px] font-black text-[#0C1220] leading-snug mb-3">
            You're just reviewing these.
          </p>
          <button
            type="button"
            onClick={() => onChooseMode('rank')}
            className="w-full rounded-xl border-2 border-[#0C1220] bg-amber-400 px-3 py-2.5 text-[13px] font-black text-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
          >
            Rank them instead
          </button>
        </div>
      )}

      {mode === 'rank' && (
        <div key="tools" className="refine-step-in">
          <p className="text-[15px] font-black text-[#0C1220] leading-snug mb-3">
            {toolsTouched
              ? 'Drag to refine further, or use the tools again:'
              : 'How do you want to start?'}
          </p>
          <div className="space-y-2.5">
            {toolsTouched && (
              <button
                type="button"
                onClick={onClose}
                className="w-full text-left rounded-xl border-2 border-[#0C1220] bg-white px-3.5 py-2.5 shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
              >
                <span className="block text-[13px] font-black text-[#0C1220]">↕️ Just drag</span>
                <span className="block text-[11px] font-bold text-[#3D4A63]">
                  Order them yourself in the list.
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onLaunchMatchups}
              className="w-full text-left rounded-xl border-2 border-[#0C1220] bg-white px-3.5 py-2.5 shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
            >
              <span className="block text-[13px] font-black text-[#0C1220]">⚡️ Head to Head</span>
              <span className="block text-[11px] font-bold text-[#3D4A63]">
                {toolsTouched ? 'Another round, two at a time.' : 'Two at a time. Most precise.'}
              </span>
            </button>
            {songCount > 30 && (
              <button
                type="button"
                onClick={onLaunchSplit}
                className="w-full text-left rounded-xl border-2 border-[#0C1220] bg-white px-3.5 py-2.5 shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
              >
                <span className="block text-[13px] font-black text-[#0C1220]">✂️ Split in Chunks</span>
                <span className="block text-[11px] font-bold text-[#3D4A63]">
                  {toolsTouched ? 'Split another chunk.' : 'Thirds at a time. Fastest on big buckets.'}
                </span>
              </button>
            )}
            {!toolsTouched && (
              <button
                type="button"
                onClick={onClose}
                className="w-full text-left rounded-xl border-2 border-[#0C1220] bg-white px-3.5 py-2.5 shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition cursor-pointer"
              >
                <span className="block text-[13px] font-black text-[#0C1220]">↕️ Just drag</span>
                <span className="block text-[11px] font-bold text-[#3D4A63]">
                  Order them yourself in the list.
                </span>
              </button>
            )}
          </div>
          {!isRankableBucket && (
            <button
              type="button"
              onClick={() => onChooseMode('review')}
              className="mt-3 text-[12px] font-black text-[#3D4A63] underline underline-offset-4 hover:text-[#0C1220] cursor-pointer"
            >
              Switch to just reviewing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
