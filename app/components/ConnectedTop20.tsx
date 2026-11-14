'use client';

/**
 * Connected Top 20 (owner idea, Nov 14, 2026): replaces the
 * Common Ground list on the profile comparison. Two ranked
 * columns — yours and theirs — with a line joining every
 * song that sits in both Top 20s. Flat lines agree; steep
 * lines are the fights. Songs in only one list get no line.
 * Tapping a song highlights its line.
 *
 * Lines are drawn on an SVG overlay measured from the real
 * row positions (refs + layout effect, recomputed on
 * resize and once webfonts land, since row heights depend
 * on them).
 */
import { useLayoutEffect, useRef, useState } from 'react';

export interface Top20Entry {
  id: string;
  title: string;
  rank: number;
}

interface DrawnLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  gap: number;
}

function lineColor(gap: number): string {
  if (gap <= 4) return '#0072CE';
  if (gap >= 10) return '#F43F5E';
  return '#94A3B8';
}

export default function ConnectedTop20({
  visitorName,
  targetName,
  visitorTop,
  targetTop,
}: {
  visitorName: string;
  targetName: string;
  visitorTop: Top20Entry[];
  targetTop: Top20Entry[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const targetById = new Map(targetTop.map((e) => [e.id, e]));
  const visitorById = new Map(visitorTop.map((e) => [e.id, e]));

  useLayoutEffect(() => {
    const compute = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const next: DrawnLine[] = [];
      for (const entry of visitorTop) {
        const match = targetById.get(entry.id);
        if (!match) continue;
        const left = rowRefs.current.get(`v:${entry.id}`);
        const right = rowRefs.current.get(`t:${entry.id}`);
        if (!left || !right) continue;
        const lr = left.getBoundingClientRect();
        const rr = right.getBoundingClientRect();
        next.push({
          id: entry.id,
          x1: lr.right - wrapRect.left,
          y1: lr.top + lr.height / 2 - wrapRect.top,
          x2: rr.left - wrapRect.left,
          y2: rr.top + rr.height / 2 - wrapRect.top,
          gap: Math.abs(entry.rank - match.rank),
        });
      }
      setLines(next);
    };
    compute();
    window.addEventListener('resize', compute);
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) compute();
      });
    }
    return () => {
      cancelled = true;
      window.removeEventListener('resize', compute);
    };
    // targetById/visitorById derive from the props above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorTop, targetTop]);

  const renderRow = (entry: Top20Entry, side: 'v' | 't') => {
    const matched = side === 'v' ? targetById.has(entry.id) : visitorById.has(entry.id);
    const isActive = activeId === entry.id;
    return (
      <div
        key={`${side}:${entry.id}`}
        ref={(el) => {
          if (el) rowRefs.current.set(`${side}:${entry.id}`, el);
        }}
        role="button"
        onClick={() => matched && setActiveId(isActive ? null : entry.id)}
        className={`flex items-center gap-2 rounded-lg px-2 py-[5px] ${
          side === 't' ? 'flex-row-reverse text-right' : ''
        } ${matched ? 'cursor-pointer' : ''} ${isActive ? 'bg-white shadow-[2px_2px_0_rgba(11,30,63,0.85)] border-2 border-[#0C1220]' : 'border-2 border-transparent'}`}
      >
        <span className="w-5 shrink-0 text-[11px] font-black text-[#3D4A63]">
          {entry.rank}
        </span>
        <span
          className={`text-[13px] font-extrabold leading-tight text-[#0C1220] ${matched ? '' : 'opacity-45'}`}
        >
          {entry.title}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-emerald-50 border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 sm:p-8">
      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1 text-center">
        🤝 Side by Side
      </span>
      <h3 className="text-xl sm:text-2xl font-black text-center text-emerald-950 mb-5 tracking-tight">
        Both your Top 20s, connected.
      </h3>

      <div className="mb-1 flex">
        <div className="w-[calc(50%-28px)] text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
          {visitorName}
        </div>
        <div className="w-[56px] shrink-0" />
        <div className="w-[calc(50%-28px)] text-right text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
          {targetName}
        </div>
      </div>

      <div ref={wrapRef} className="relative">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {lines.map((line) => {
            const isActive = activeId === line.id;
            const dimmed = activeId !== null && !isActive;
            return (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={lineColor(line.gap)}
                strokeWidth={isActive ? 3.5 : 2}
                strokeLinecap="round"
                opacity={dimmed ? 0.1 : isActive ? 1 : 0.55}
              />
            );
          })}
        </svg>
        <div className="relative flex justify-between">
          <div className="w-[calc(50%-28px)]">{visitorTop.map((e) => renderRow(e, 'v'))}</div>
          <div className="w-[calc(50%-28px)]">{targetTop.map((e) => renderRow(e, 't'))}</div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] font-bold text-[#3D4A63]">
        Lines join songs in both Top 20s — flat lines agree, steep lines fight. Tap a song to trace it.
      </p>
    </div>
  );
}
