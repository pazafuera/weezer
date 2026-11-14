'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Song, BucketType } from '../data/constants';
import { AudioPreviewButton, SortingIncompleteNotice } from './SharedUI';
import type { TriageValue } from '../context/WeezerContext';
import { displayFont } from './shareables/fonts';

// THE SPLIT PASS (owner, Nov 13, 2026) — a coarse-sort game for
// big buckets. Ranking 75 Mids by dragging fails on distance:
// a top Mid buried at the bottom is a 65-spot drag. The split
// fixes distance first: one song at a time, the fan drags the
// card into one of three thirds (Best / Middle / Low of the
// bucket) — or taps a third — and the bucket's order is
// rewritten band by band. One pass bounds every song's error
// to a third of the bucket; splitting a third bounds it again.
// What remains is short drags and neighbor matchups.
//
// Owner's interaction call: this is a DRAG, not the triage
// deck's taps — the game feel is the point, and it keeps the
// pass distinct from the initial sort. The drags are short
// (a few inches into a big target), and each third is also a
// button, so a tap does the same job for anyone whose thumb
// gives out.
//
// The thirds are NOT buckets: triage values never change here,
// only the order inside the bucket, so community stats (which
// read bucket points only) are untouched.
//
// Progress is device-local and resumable (the sweep-cursor
// lesson): placements persist per bucket + scope, validated
// against the song set they were made on; nothing applies to
// the real order until a pass completes a scope.

const SPLIT_STORE_KEY = 'weezer-split-progress';

type Band = 0 | 1 | 2;
type PlacedPair = [string, Band];

interface StoredPass {
  ids: string[];
  placed: PlacedPair[];
}

function readStoredPass(key: string): StoredPass | null {
  try {
    const raw = localStorage.getItem(SPLIT_STORE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, StoredPass>;
    const rec = map[key];
    if (!rec || !Array.isArray(rec.ids) || !Array.isArray(rec.placed)) return null;
    return rec;
  } catch {
    return null;
  }
}

function storePass(key: string, rec: StoredPass | null) {
  try {
    const raw = localStorage.getItem(SPLIT_STORE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, StoredPass>) : {};
    if (rec) map[key] = rec;
    else delete map[key];
    localStorage.setItem(SPLIT_STORE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — resuming is best-effort */
  }
}

interface ActivePass {
  scopeKey: string;
  title: string;
  base: Song[];
  start: number;
  end: number;
  queue: Song[];
  placed: PlacedPair[];
}

const BAND_NAMES = ['Best', 'Middle', 'Low'] as const;

export default function Step1_5SplitPass({
  songs,
  bucket,
  plural,
  onApply,
  onExit,
  triageMap,
  onKeepSorting
}: {
  songs: Song[];
  bucket: BucketType;
  /** Plural bucket name for copy: "Mids", "Slaps", "Trash". */
  plural: string;
  /** Applies a completed pass's full bucket order. The
   *  takeover stays open (the done panel offers third-splits). */
  onApply: (sortedSongs: Song[]) => void;
  onExit: () => void;
  triageMap?: Record<string, TriageValue>;
  onKeepSorting?: () => void;
}) {
  const songsRef = useRef(songs);
  songsRef.current = songs;

  const [pass, setPass] = useState<ActivePass | null>(null);
  const [doneScope, setDoneScope] = useState<string | null>(null);

  const startPass = (
    scopeKey: string,
    title: string,
    start: number,
    end: number,
    base: Song[]
  ) => {
    const slice = base.slice(start, end);
    const ids = slice.map((s) => s.id);
    const storeKey = `${bucket}|${scopeKey}`;
    let placed: PlacedPair[] = [];
    const stored = readStoredPass(storeKey);
    if (
      stored &&
      stored.ids.length === ids.length &&
      stored.ids.every((id, i) => id === ids[i])
    ) {
      const inSlice = new Set(ids);
      placed = stored.placed.filter(([id]) => inSlice.has(id));
    }
    const placedIds = new Set(placed.map(([id]) => id));
    setPass({
      scopeKey,
      title,
      base,
      start,
      end,
      queue: slice.filter((s) => !placedIds.has(s.id)),
      placed
    });
    setDoneScope(null);
  };

  // The first pass is always the whole bucket, started once on
  // mount. Later passes (the thirds) start from the done panel
  // against the freshest order, via songsRef.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const base = songsRef.current;
    startPass('whole', `Split the ${plural}`, 0, base.length, base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (p: ActivePass, queue: Song[], placed: PlacedPair[]) => {
    storePass(`${bucket}|${p.scopeKey}`, {
      ids: p.base.slice(p.start, p.end).map((s) => s.id),
      placed
    });
  };

  const place = (band: Band) => {
    if (!pass || pass.queue.length === 0) return;
    const song = pass.queue[0];
    const placed: PlacedPair[] = [...pass.placed, [song.id, band]];
    const queue = pass.queue.slice(1);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch (e) { /* ignore */ }
    }
    if (queue.length > 0) {
      persist(pass, queue, placed);
      setPass({ ...pass, queue, placed });
      return;
    }
    // Pass complete: rebuild the order band by band (within a
    // band, songs keep the order they were presented in), splice
    // the scope back into the full bucket, and apply.
    const byId = new Map(pass.base.map((s) => [s.id, s]));
    const orderedSlice: Song[] = [];
    ([0, 1, 2] as Band[]).forEach((b) => {
      placed
        .filter(([, pb]) => pb === b)
        .forEach(([id]) => {
          const s = byId.get(id);
          if (s) orderedSlice.push(s);
        });
    });
    const next = [
      ...pass.base.slice(0, pass.start),
      ...orderedSlice,
      ...pass.base.slice(pass.end)
    ];
    storePass(`${bucket}|${pass.scopeKey}`, null);
    setPass(null);
    setDoneScope(pass.title);
    onApply(next);
  };

  const undo = () => {
    if (!pass || pass.placed.length === 0) return;
    const placed = pass.placed.slice(0, -1);
    const [lastId] = pass.placed[pass.placed.length - 1];
    const song = pass.base.find((s) => s.id === lastId);
    if (!song) return;
    const queue = [song, ...pass.queue];
    persist(pass, queue, placed);
    setPass({ ...pass, queue, placed });
  };

  // --- Drag mechanics (pointer events; HTML5 drag is a no-show
  // on touch). The card follows the pointer; dropping it over a
  // third places the song there. A drop anywhere else springs
  // the card back and places nothing. ---
  const cardRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [hoverZone, setHoverZone] = useState<Band | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const zoneAt = (x: number, y: number): Band | null => {
    for (let i = 0; i < 3; i++) {
      const el = zoneRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return i as Band;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!pass || pass.queue.length === 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ dx: 0, dy: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setDrag({ dx, dy });
    setHoverZone(zoneAt(e.clientX, e.clientY));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const zone = zoneAt(e.clientX, e.clientY);
    dragStart.current = null;
    setDrag(null);
    setHoverZone(null);
    if (zone !== null) place(zone);
  };

  const current = pass && pass.queue.length > 0 ? pass.queue[0] : null;
  const placedCount = pass ? pass.placed.length : 0;
  const totalInPass = pass ? pass.end - pass.start : 0;
  const bandCounts: [number, number, number] = [0, 0, 0];
  if (pass) pass.placed.forEach(([, b]) => { bandCounts[b] += 1; });

  const n = songs.length;
  const third = Math.ceil(n / 3);
  const third2 = Math.ceil((2 * n) / 3);

  return (
    <div className="flex flex-col h-[80vh] py-6 px-4 max-w-lg mx-auto animate-in fade-in duration-500">
      {triageMap && onKeepSorting && (
        <div className="shrink-0 mb-4">
          <SortingIncompleteNotice triageMap={triageMap} onKeepSorting={onKeepSorting} />
        </div>
      )}

      {pass && current ? (
        <>
          <div className="text-center mb-4 mt-2 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
              {placedCount} of {totalInPass} placed
            </span>
            <h2 className={`${displayFont.className} text-[27px] text-[#0C1220] mt-1`}>
              {pass.title}
            </h2>
            <p className="text-sm font-bold text-[#3D4A63]">
              Drag the song to its third — or just tap one.
            </p>
          </div>

          {/* THE SONG CARD — the drag handle. shrink-0 and the
              fixed column are the matchup discipline: this
              screen never scrolls. */}
          <div className="shrink-0 flex justify-center mb-4 px-1">
            <div
              ref={cardRef}
              role="button"
              aria-label={`Song: ${current.title}. Drag it to a third, or tap a third below.`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full max-w-sm bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] px-5 pt-4 pb-5 text-center cursor-grab active:cursor-grabbing touch-none select-none"
              style={{
                transform: drag
                  ? `translate(${drag.dx}px, ${drag.dy}px) rotate(${Math.max(-6, Math.min(6, drag.dx * 0.04))}deg) scale(1.03)`
                  : undefined,
                transition: drag ? 'none' : 'transform 200ms ease',
                zIndex: drag ? 30 : undefined,
                position: 'relative'
              }}
            >
              <h3 className={`${displayFont.className} text-2xl sm:text-3xl leading-tight text-[#0C1220] line-clamp-3 mb-2`}>
                {current.title}
              </h3>
              <p className="text-xs font-bold uppercase tracking-widest text-[#3D4A63] mb-4">
                {current.album}
              </p>
              <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <AudioPreviewButton id={current.id} title={current.title} album={current.album} />
              </div>
            </div>
          </div>

          {/* THE THREE THIRDS — drop targets and, equally,
              plain tap buttons. flex-1 so the column absorbs
              any viewport shortfall instead of scrolling. */}
          <div className="flex-1 flex flex-col gap-2.5 min-h-0">
            {([0, 1, 2] as Band[]).map((b) => (
              <button
                key={b}
                ref={(el) => { zoneRefs.current[b] = el; }}
                type="button"
                onClick={() => place(b)}
                className={`flex-1 rounded-[14px] border-[2.5px] border-[#0C1220] px-4 flex items-center justify-between transition-all cursor-pointer ${
                  hoverZone === b
                    ? 'bg-amber-400 shadow-[3px_3px_0_rgba(11,30,63,0.85)] scale-[1.01]'
                    : 'bg-white shadow-[2px_2px_0_rgba(11,30,63,0.85)]'
                }`}
              >
                <span className={`${displayFont.className} text-xl text-[#0C1220]`}>
                  {BAND_NAMES[b]} {plural}
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#3D4A63]">
                  {bandCounts[b]} placed
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 shrink-0 px-1">
            <button
              type="button"
              onClick={undo}
              className={`min-h-[44px] px-2 text-sm font-black underline underline-offset-4 cursor-pointer ${
                placedCount > 0 ? 'text-[#3D4A63] hover:text-[#0C1220]' : 'invisible'
              }`}
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={onExit}
              className="min-h-[44px] px-2 text-sm font-black text-[#3D4A63] underline underline-offset-4 hover:text-[#0C1220] cursor-pointer"
            >
              {placedCount === 0 ? 'Skip for now' : 'Finish later'}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* DONE PANEL — the pass applied; from here a third
              can be split again (the radix second pass), or
              the fan goes back to short drags. */}
          <div className="text-center mb-4 mt-2 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
              Split complete
            </span>
            <h2 className={`${displayFont.className} text-[27px] text-[#0C1220] mt-1`}>
              The {plural} are in rough order
            </h2>
            <p className="text-sm font-bold text-[#3D4A63]">
              Drags are short now. Split a third to get even closer.
            </p>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 min-h-0">
            {([
              { label: `Top third`, sub: `${third} songs`, start: 0, end: third, key: `t0` },
              { label: `Middle third`, sub: `${third2 - third} songs`, start: third, end: third2, key: `t${third}` },
              { label: `Bottom third`, sub: `${n - third2} songs`, start: third2, end: n, key: `t${third2}` }
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() =>
                  startPass(t.key, `Split the ${t.label.toLowerCase()}`, t.start, t.end, songsRef.current)
                }
                className="flex-1 rounded-[14px] border-[2.5px] border-[#0C1220] bg-white shadow-[2px_2px_0_rgba(11,30,63,0.85)] px-4 flex items-center justify-between cursor-pointer"
              >
                <span className={`${displayFont.className} text-xl text-[#0C1220]`}>
                  {t.label}
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#3D4A63]">
                  {t.sub}
                </span>
              </button>
            ))}
          </div>

          <div className="text-center mt-4 shrink-0">
            <button
              type="button"
              onClick={onExit}
              className="min-h-[44px] px-4 text-sm font-black text-[#0C1220] underline underline-offset-4 cursor-pointer"
            >
              Done — back to the list
            </button>
          </div>
        </>
      )}
    </div>
  );
}
