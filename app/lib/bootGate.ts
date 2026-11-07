/**
 * Boot gate — the rankings boot's serialization and
 * account-marker decisions, as pure functions (Nov 7, 2026).
 *
 * The boot (WeezerContext's initUserAndLoadRankings) is the one
 * load that decides who the app thinks is signed in and what
 * their rankings are. Two disciplines keep it honest:
 *
 * SERIALIZATION. At most one boot runs at a time. A request
 * that arrives while a boot is in flight — a sign-in landing
 * mid-boot, the auth listener's INITIAL_SESSION racing the
 * mount call — is QUEUED, never run concurrently and never
 * dropped: when the running boot settles, exactly one re-run
 * happens, and it reads the then-current session. Racing
 * callers collapse into the boolean, so any number of them
 * still produce exactly one re-run.
 *
 * MARKER OWNERSHIP. bootedRankingsUserRef names the account a
 * boot has committed to loading, and ONLY a boot may set it —
 * at its commit point, after its own duplicate guard passes.
 * The auth listener asks shouldBootForAccount and calls the
 * boot; it never marks the account itself. The listener used
 * to pre-set the marker before calling (so an INITIAL_SESSION
 * racing the mount boot "couldn't double it"), and the boot
 * it triggered then always found its own marker already in
 * place and skipped itself — setUserId never ran and the row
 * never loaded. On the mount path the ordering race sometimes
 * saved it; a password-form sign-in has no race and lost every
 * time, landing on the dashboard as a guest. The gate makes
 * the marker mean what it says, and serialization — not a
 * pre-set marker — is what absorbs the INITIAL_SESSION race.
 *
 * The provider side (refs, getSession, the load itself) lives
 * in WeezerContext; everything decidable without a browser is
 * decided here and pinned in the navigation harness.
 */
export interface BootGateState {
  /** A boot is running right now. */
  inFlight: boolean;
  /** A request arrived during the running boot and is owed
   *  exactly one re-run when it settles. */
  pending: boolean;
}

export function createBootGate(): BootGateState {
  return { inFlight: false, pending: false };
}

/**
 * A boot was requested. 'run' — start it now (the gate is in
 * flight). 'queue' — one is already running; the request is
 * remembered in the gate's pending flag, not dropped.
 */
export function requestBoot(state: BootGateState): {
  state: BootGateState;
  action: 'run' | 'queue';
} {
  if (state.inFlight) {
    return { state: { inFlight: true, pending: true }, action: 'queue' };
  }
  // Pending only ever exists under an in-flight boot, so a
  // request that runs starts from a clean flag.
  return { state: { inFlight: true, pending: false }, action: 'run' };
}

/**
 * The running boot settled. 'rerun' — a queued request exists:
 * the gate opens and the caller MUST start the owed boot
 * immediately (the provider re-invokes synchronously in the
 * same finally, so no other request can slip between the
 * settle and the re-run, and the re-run's own requestBoot
 * flips the gate back to in-flight before anything else can
 * interleave). 'idle' — nothing queued; the gate simply
 * opens. (The earlier shape — settle straight into in-flight
 * for the re-run — deadlocked: the re-run's requestBoot saw
 * the gate in flight, queued itself, and no boot remained
 * running to ever settle it.)
 */
export function settleBoot(state: BootGateState): {
  state: BootGateState;
  action: 'rerun' | 'idle';
} {
  if (state.pending) {
    return { state: { inFlight: false, pending: false }, action: 'rerun' };
  }
  return { state: { inFlight: false, pending: false }, action: 'idle' };
}

/**
 * The auth listener's question: does this session event name
 * an account whose rankings have not booted? A pure read of
 * the marker — asking the question never changes it.
 */
export function shouldBootForAccount(
  bootedUserId: string | null,
  eventUserId: string
): boolean {
  return bootedUserId !== eventUserId;
}

/**
 * The boot's own duplicate guard: has a boot already committed
 * to loading this account? True only when the marker names
 * this very account — which, under marker ownership, only a
 * boot that passed this guard could have set.
 */
export function isBootedAccount(
  bootedUserId: string | null,
  uid: string
): boolean {
  return bootedUserId === uid;
}
