/**
 * Save diagnostics (Nov 7, 2026 — durability overhaul, item 4:
 * observability).
 *
 * Every rankings incident before this one was diagnosed by
 * reconstruction after the fact — server-side pulls, code
 * archaeology, the owner's memory of what he tapped — because
 * the decisions that lose work (which source a boot chose, why a
 * buffer did or did not promote, when the queue gave up) left no
 * trace on the device where they happened. The Nov 7 recovery
 * failure was the worst case: the buffer did not promote and NO
 * record existed anywhere of the inputs the decision ran on.
 *
 * This ring is that trace. A small localStorage list (last 20
 * events) of the save system's decision points: each boot's
 * source + the revision/timestamp inputs it compared, each
 * buffer promotion, each heal outcome, each queue give-up, each
 * buffer-protection event. The account drawer renders it
 * read-only next to the last-saved line, so the next incident is
 * diagnosed from a screenshot instead of a reconstruction.
 *
 * Recording must never break saving: every storage touch is
 * guarded and degrades silently. The pure append lives apart
 * from the storage I/O so the harness can pin the ring's shape
 * (scenario (m)).
 */

export const SAVE_DIAGNOSTICS_KEY = 'weezer-save-diagnostics';
export const SAVE_DIAGNOSTICS_CAP = 20;

export interface SaveDiagnosticEvent {
  /** ISO timestamp of the event. */
  t: string;
  /**
   * The decision point: 'boot' | 'promote' | 'heal' |
   * 'give-up' | 'buffer-protected' | 'buffer-write-skipped' |
   * 'buffer-superseded' | 'stranded'.
   */
  kind: string;
  /** One compact human line — inputs and outcome, screenshot-sized. */
  detail: string;
}

/** Append one event, dropping the oldest beyond the cap. Pure. */
export function appendSaveDiagnostic(
  events: SaveDiagnosticEvent[],
  event: SaveDiagnosticEvent,
  cap: number = SAVE_DIAGNOSTICS_CAP
): SaveDiagnosticEvent[] {
  const next = [...events, event];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

function isSaveDiagnosticEvent(value: unknown): value is SaveDiagnosticEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.t === 'string' &&
    typeof e.kind === 'string' &&
    typeof e.detail === 'string'
  );
}

/** The stored ring, validated; [] on any problem. */
export function readSaveDiagnostics(
  storage?: Pick<Storage, 'getItem'>
): SaveDiagnosticEvent[] {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return [];
    const raw = store.getItem(SAVE_DIAGNOSTICS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSaveDiagnosticEvent).slice(-SAVE_DIAGNOSTICS_CAP);
  } catch {
    return [];
  }
}

/**
 * Record one event. Fire-and-forget by design: a diagnostics
 * failure (quota, privacy mode, corrupt prior value) must never
 * surface in the save path it describes.
 */
export function recordSaveDiagnostic(kind: string, detail: string): void {
  try {
    if (typeof window === 'undefined') return;
    const next = appendSaveDiagnostic(readSaveDiagnostics(), {
      t: new Date().toISOString(),
      kind,
      detail,
    });
    window.localStorage.setItem(
      SAVE_DIAGNOSTICS_KEY,
      JSON.stringify(next)
    );
  } catch {
    // Diagnostics are a witness, never a participant.
  }
}
