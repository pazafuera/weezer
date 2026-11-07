/**
 * First-party launch analytics (Nov 7, 2026 — the owner's A1
 * decision: lightweight, privacy-respecting measurement; the
 * marketing plan's §7 gate — starts and shares were the two
 * funnel numbers with NO instrument at all).
 *
 * What this is: a tiny event beacon that writes rows into the
 * app's own Supabase table `app_events` (migration
 * 20261107_app_events.sql — the owner runs it; until then every
 * send fails and this module disables itself, see below). No
 * third-party tracker, no fingerprinting, no cross-site
 * anything, no free-text, no user-agent storage. An event is a
 * name, optionally a share-card type, and — for signed-in
 * events — the user's own id (nullable; guests and pre-boot
 * events record null). That is the whole schema.
 *
 * The event set answers the launch funnel questions only:
 * - session_start   — a visit (the funnel's top; Vercel's rough
 *                     traffic stays the cross-check).
 * - sort_started    — the first song bucketed in a session
 *                     (§7's "Starts", previously invisible).
 * - sort_completed  — the session's triage reached all 206
 *                     songs bucketed (crossing observed in the
 *                     context; a boot that LOADS a finished sort
 *                     does not fire it — completions are acts,
 *                     not states).
 * - share_initiated — a share/download was tapped, with which
 *                     card (§7's "Shares", previously invisible).
 * - game_started / game_completed — the lore game's funnel.
 *
 * Failure posture, deliberate: fire-and-forget, and the FIRST
 * failure disables the tracker for the rest of the session.
 * Before the owner runs the migration the table does not exist
 * and every insert errors — disabling on first failure turns
 * that into one dead request per session instead of an error
 * per event, with zero console output and zero user-facing
 * effect. A transient failure costs the session's later events;
 * for a launch funnel that trade beats retry machinery and
 * noise. The code ships safe before the migration runs; data
 * flows only after it.
 */

export type AnalyticsEventName =
  | 'session_start'
  | 'sort_started'
  | 'sort_completed'
  | 'share_initiated'
  | 'game_started'
  | 'game_completed';

export type ShareCardType =
  | 'top_10_songs'
  | 'top_10_albums'
  | 'tier_list_albums'
  | 'tier_list_songs'
  | 'era_dna'
  | 'tribe'
  | 'fanhood'
  | 'thread';

export interface AnalyticsRow {
  event: AnalyticsEventName;
  card: ShareCardType | null;
  user_id: string | null;
}

const EVENT_NAMES: ReadonlySet<string> = new Set([
  'session_start',
  'sort_started',
  'sort_completed',
  'share_initiated',
  'game_started',
  'game_completed',
]);

const CARD_TYPES: ReadonlySet<string> = new Set([
  'top_10_songs',
  'top_10_albums',
  'tier_list_albums',
  'tier_list_songs',
  'era_dna',
  'tribe',
  'fanhood',
  'thread',
]);

/**
 * Shape one event into its stored row, or null to drop it.
 * Unknown event names drop; a card is carried only by
 * share_initiated and only when it names a real card (an
 * unrecognized card drops the CARD, not the event — the share
 * still happened). user_id passes through as given (the wiring
 * supplies the session's user or null).
 */
export function shapeAnalyticsRow(
  event: string,
  opts?: { card?: string | null; userId?: string | null }
): AnalyticsRow | null {
  if (!EVENT_NAMES.has(event)) return null;
  const name = event as AnalyticsEventName;
  const card =
    name === 'share_initiated' && opts?.card && CARD_TYPES.has(opts.card)
      ? (opts.card as ShareCardType)
      : null;
  return { event: name, card, user_id: opts?.userId ?? null };
}

/**
 * The share cards' PNG filenames → card types. Every card
 * export on the site funnels through exportNodeAsPng with one
 * of these names (ShareablesGallery / ShareCardShell); the
 * tier chart composes `{username}-weezer-{view}-tiers.png`, so
 * it is matched by suffix. An unrecognized filename maps to
 * null (the export still runs; it just isn't a counted card).
 */
export function cardFromExportFilename(filename: string): ShareCardType | null {
  const base = filename.toLowerCase();
  if (base.endsWith('weezer-albums-tiers.png')) return 'tier_list_albums';
  if (base.endsWith('weezer-songs-tiers.png')) return 'tier_list_songs';
  switch (base) {
    case 'my-weezer-top-10.png':
      return 'top_10_songs';
    case 'my-weezer-top-10-albums.png':
      return 'top_10_albums';
    case 'my-weezer-era-dna.png':
      return 'era_dna';
    case 'my-weezer-tribe.png':
      return 'tribe';
    case 'my-weezer-fanhood.png':
      return 'fanhood';
    default:
      return null;
  }
}

export type AnalyticsSend = (row: AnalyticsRow) => Promise<unknown>;

export interface AnalyticsTracker {
  track: (
    event: string,
    opts?: { card?: string | null; userId?: string | null; oncePerSession?: boolean }
  ) => void;
  isDisabled: () => boolean;
}

/**
 * A tracker around an injected send. Every failure — a rejected
 * send, a synchronous throw — is swallowed and disables the
 * tracker (see the header for why). `oncePerSession` events
 * fire at most once per tracker lifetime.
 */
export function createAnalyticsTracker(send: AnalyticsSend): AnalyticsTracker {
  let disabled = false;
  const firedOnce = new Set<string>();
  return {
    track(event, opts) {
      if (disabled) return;
      if (opts?.oncePerSession) {
        if (firedOnce.has(event)) return;
        firedOnce.add(event);
      }
      const row = shapeAnalyticsRow(event, opts);
      if (!row) return;
      try {
        const result = send(row);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(() => {
            disabled = true;
          });
        }
      } catch {
        disabled = true;
      }
    },
    isDisabled: () => disabled,
  };
}

/**
 * The app singleton. The context configures the send once (the
 * Supabase insert, translating its { error } result into a
 * rejection so the tracker's failure rule can see it) and keeps
 * the current user id current; call sites then just name the
 * event. Events tracked before configuration are dropped
 * silently — configuration happens at provider mount, before
 * any interaction can fire one.
 */
let singletonSend: AnalyticsSend | null = null;
let singletonTracker: AnalyticsTracker | null = null;
let singletonUserId: string | null = null;

export function configureAnalytics(send: AnalyticsSend): void {
  singletonSend = send;
  if (!singletonTracker) {
    singletonTracker = createAnalyticsTracker((row) => {
      if (!singletonSend) return Promise.resolve();
      return singletonSend(row);
    });
  }
}

export function setAnalyticsUserId(userId: string | null): void {
  singletonUserId = userId;
}

export function trackAnalytics(
  event: AnalyticsEventName,
  opts?: { card?: string | null; oncePerSession?: boolean }
): void {
  if (!singletonTracker) return;
  singletonTracker.track(event, { ...opts, userId: singletonUserId });
}
