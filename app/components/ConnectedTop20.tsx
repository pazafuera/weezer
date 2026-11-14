/**
 * Side by Side — dumbbell rows (owner pick, Nov 14, 2026;
 * replaces the slope-chart version the same day, whose
 * connector lines collapsed into an unreadable knot in the
 * narrow center gutter, worse on mobile).
 *
 * One row per song that sits in BOTH fans' Top 20s. Each
 * row: the visitor's rank on the left, the target's rank
 * on the right, and a track underneath with a dot at each
 * person's rank position (rank 1 = far left, 20 = far
 * right) joined by a bar. Bar length IS the disagreement;
 * bar color repeats the house language (small gap blue,
 * big gap rose, middle slate). Songs in only one Top 20
 * are listed as chips underneath. No measured layout, no
 * SVG — every row is self-contained, so it holds up on a
 * phone.
 */

export interface Top20Entry {
  id: string;
  title: string;
  rank: number;
}

function barColor(gap: number): string {
  if (gap <= 4) return '#0072CE';
  if (gap >= 10) return '#F43F5E';
  return '#94A3B8';
}

/** Rank 1..20 → percent along the track. */
function pos(rank: number): number {
  return ((rank - 1) / 19) * 100;
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
  const targetById = new Map(targetTop.map((e) => [e.id, e]));
  const visitorById = new Map(visitorTop.map((e) => [e.id, e]));
  const shared = visitorTop.filter((e) => targetById.has(e.id));
  const onlyVisitor = visitorTop.filter((e) => !targetById.has(e.id));
  const onlyTarget = targetTop.filter((e) => !visitorById.has(e.id));

  return (
    <div className="bg-emerald-50 border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 sm:p-8">
      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1 text-center">
        🤝 Side by Side
      </span>
      <h3 className="text-xl sm:text-2xl font-black text-center text-emerald-950 mb-5 tracking-tight">
        Both Top 20s, head to head.
      </h3>

      <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
        <span>{visitorName}</span>
        <span>{targetName}</span>
      </div>

      <div className="space-y-2.5">
        {shared.map((entry) => {
          const match = targetById.get(entry.id);
          if (!match) return null;
          const gap = Math.abs(entry.rank - match.rank);
          const left = Math.min(pos(entry.rank), pos(match.rank));
          const width = Math.abs(pos(entry.rank) - pos(match.rank));
          return (
            <div
              key={entry.id}
              className="rounded-2xl border-2 border-[#0C1220] bg-white px-3.5 pb-3 pt-2.5"
            >
              <div className="text-center text-[13px] font-extrabold leading-tight text-[#0C1220]">
                {entry.title}
              </div>
              <div className="relative mx-5 mb-2.5 mt-3.5 h-[6px] rounded-full bg-slate-200">
                <div
                  className="absolute top-0 h-[6px] rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 1.5)}%`,
                    backgroundColor: barColor(gap),
                  }}
                />
                <span
                  className="absolute top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0C1220] bg-[#0072CE] text-[11px] font-black text-white"
                  style={{
                    left: `${pos(entry.rank)}%`,
                    transform: `translate(${gap === 0 ? 'calc(-50% - 13px)' : '-50%'}, -50%)`,
                  }}
                >
                  {entry.rank}
                </span>
                <span
                  className="absolute top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0C1220] bg-[#0C1220] text-[11px] font-black text-white"
                  style={{
                    left: `${pos(match.rank)}%`,
                    transform: `translate(${gap === 0 ? 'calc(-50% + 13px)' : '-50%'}, -50%)`,
                  }}
                >
                  {match.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px] font-bold text-[#3D4A63]">
        Blue badge is {visitorName}&apos;s rank, black badge is {targetName}&apos;s — the longer the bar, the bigger the fight.
      </p>

      {(onlyVisitor.length > 0 || onlyTarget.length > 0) && (
        <div className="mt-5 space-y-3">
          {onlyVisitor.length > 0 && (
            <div>
              <div className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-[#3D4A63]">
                Only in {visitorName}&apos;s Top 20
              </div>
              <div className="flex flex-wrap gap-1.5">
                {onlyVisitor.map((e) => (
                  <span
                    key={e.id}
                    className="rounded-full border border-[#0C1220]/25 bg-white/70 px-2 py-0.5 text-[11px] font-bold text-[#0C1220]"
                  >
                    #{e.rank} {e.title}
                  </span>
                ))}
              </div>
            </div>
          )}
          {onlyTarget.length > 0 && (
            <div>
              <div className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-[#3D4A63]">
                Only in {targetName}&apos;s Top 20
              </div>
              <div className="flex flex-wrap gap-1.5">
                {onlyTarget.map((e) => (
                  <span
                    key={e.id}
                    className="rounded-full border border-[#0C1220]/25 bg-white/70 px-2 py-0.5 text-[11px] font-bold text-[#0C1220]"
                  >
                    #{e.rank} {e.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
