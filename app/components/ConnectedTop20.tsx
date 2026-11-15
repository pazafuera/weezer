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
 * are listed underneath. No measured layout, no SVG —
 * every row is self-contained, so it holds up on a phone.
 *
 * Only-in lists (owner, Nov 14, 2026, later): vertical rows,
 * not chips — and each row notes where the OTHER fan ranks
 * the song on their full list (or that they didn't rank
 * it). The chips wrapped long titles into pills and hid
 * the interesting half: how far down the other fan has it.
 *
 * Visual pass (owner, Nov 14, 2026, night): the other fan's
 * name moves to a column header (it was repeated on every
 * row), and their rank sits in a cell shaded by distance —
 * how far their full-list rank sits from the owner's
 * Top 20 rank. Heat ramp: close green, then yellow, orange,
 * far rose. The number stays on the cell; the color is the
 * at-a-glance read.
 *
 * Ties and near-ties (owner screenshot, Nov 14, 2026,
 * Mark vs Abby): an exact tie collapses to ONE gold badge
 * — a perfect match reads at a glance. Near pairs spread
 * symmetrically around their midpoint so the badges never
 * overlap and bury a number (his 4 was hiding behind her
 * 5 on My Name Is Jonas).
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

/** Distance shading for the other fan's rank cell:
 * |owner's Top 20 rank − other fan's full-list rank|. */
function gapTint(gap: number): string {
  if (gap <= 12) return '#BBF7D0';
  if (gap <= 35) return '#FEF08A';
  if (gap <= 70) return '#FED7AA';
  return '#FDA4AF';
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
  visitorAllRank,
  targetAllRank,
}: {
  visitorName: string;
  targetName: string;
  visitorTop: Top20Entry[];
  targetTop: Top20Entry[];
  /** Full-list rank by song id (bucketed songs only). */
  visitorAllRank: Map<string, number>;
  targetAllRank: Map<string, number>;
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
          // Badge positions, spread so they never overlap.
          const MIN_SEP = 11; // % of track ≈ 36px on a phone
          let lo = Math.min(pos(entry.rank), pos(match.rank));
          let hi = Math.max(pos(entry.rank), pos(match.rank));
          if (gap > 0 && hi - lo < MIN_SEP) {
            const mid = (lo + hi) / 2;
            lo = mid - MIN_SEP / 2;
            hi = mid + MIN_SEP / 2;
            if (lo < 0) {
              hi -= lo;
              lo = 0;
            }
            if (hi > 100) {
              lo -= hi - 100;
              hi = 100;
            }
          }
          const visitorLeft = entry.rank <= match.rank ? lo : hi;
          const targetLeft = entry.rank <= match.rank ? hi : lo;
          const left = lo;
          const width = hi - lo;
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
                    backgroundColor: gap === 0 ? '#FFC72C' : barColor(gap),
                  }}
                />
                {gap === 0 ? (
                  <span
                    className="absolute top-1/2 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-[#0C1220] bg-[#FFC72C] text-[11px] font-black text-[#0C1220]"
                    style={{
                      left: `${pos(entry.rank)}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {entry.rank}
                  </span>
                ) : (
                  <>
                    <span
                      className="absolute top-1/2 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-[#0C1220] bg-[#0072CE] text-[11px] font-black text-white"
                      style={{
                        left: `${visitorLeft}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      {entry.rank}
                    </span>
                    <span
                      className="absolute top-1/2 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-[#0C1220] bg-[#0C1220] text-[11px] font-black text-white"
                      style={{
                        left: `${targetLeft}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      {match.rank}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(onlyVisitor.length > 0 || onlyTarget.length > 0) && (
        <div className="mt-5 space-y-4">
          {[
            {
              ownerName: visitorName,
              otherName: targetName,
              rows: onlyVisitor,
              otherRank: targetAllRank,
            },
            {
              ownerName: targetName,
              otherName: visitorName,
              rows: onlyTarget,
              otherRank: visitorAllRank,
            },
          ]
            .filter((sec) => sec.rows.length > 0)
            .map((sec) => (
              <div key={sec.ownerName + sec.otherName}>
                <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-[#3D4A63]">
                  Only in {sec.ownerName}&apos;s Top 20
                </div>
                <div className="flex items-baseline gap-2 pb-1 text-[9px] font-black uppercase tracking-widest text-[#3D4A63]">
                  <span className="w-8 shrink-0">{sec.ownerName}</span>
                  <span className="min-w-0 flex-1" />
                  <span className="w-[76px] shrink-0 text-center">{sec.otherName}</span>
                </div>
                <div>
                  {sec.rows.map((e) => {
                    const other = sec.otherRank.get(e.id);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 border-b border-[#0C1220]/10 py-[5px] last:border-b-0"
                      >
                        <span className="w-8 shrink-0 text-[12px] font-black text-[#0C1220]">
                          #{e.rank}
                        </span>
                        <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-[#0C1220]">
                          {e.title}
                        </span>
                        {other ? (
                          <span
                            className="w-[76px] shrink-0 rounded-md py-[3px] text-center text-[12px] font-black text-[#0C1220]"
                            style={{ backgroundColor: gapTint(Math.abs(e.rank - other)) }}
                          >
                            #{other}
                          </span>
                        ) : (
                          <span className="w-[76px] shrink-0 text-center text-[10px] font-bold text-[#3D4A63]">
                            not ranked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
