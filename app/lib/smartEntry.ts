/**
 * Smart Entry — the boot's dashboard redirect, as a pure
 * decision (Nov 7, 2026).
 *
 * On a cold open with ranking progress, the boot lands the user
 * on the dashboard instead of the splash. That redirect is a
 * convenience for a landing nobody has directed yet — it must
 * never override a destination that was actually chosen:
 *
 * - A URL carrying ?step= was addressed explicitly (a deep link,
 *   or a step the app itself wrote into the webapp's persisted
 *   URL on a previous visit). The boot keeps its hands off.
 * - A user who has already navigated this session (a tap during
 *   a slow boot, a menu detour while a session was still
 *   reviving) owns the current step. A boot finishing late —
 *   the mount boot or the auth listener's per-account boot —
 *   must not stomp it.
 * - With no progress there is nothing to land on the dashboard
 *   for; the splash is the honest front door.
 *
 * The DOM side (reading the URL, the navigated ref, applying
 * setStepState) lives in WeezerContext's initUserAndLoadRankings;
 * everything decidable without a browser is decided here and
 * pinned in the navigation harness.
 */
export interface SmartEntryInput {
  /** The URL names a step: `?step=` is present with a non-empty
   *  value. (An empty value names nothing — the pre-helper code
   *  tested `!params.get('step')`, and this preserves that.) */
  hasUrlStep: boolean;
  /** navigateInternal has run at least once this session: the
   *  user (or an app flow acting for them) has chosen where
   *  they are. */
  userNavigated: boolean;
  /** The loaded state holds ranking progress (any triage entry,
   *  or — on the signed-in path — any master-list entry). */
  hasProgress: boolean;
}

export function decideSmartEntry(input: SmartEntryInput): boolean {
  return !input.hasUrlStep && !input.userNavigated && input.hasProgress;
}
