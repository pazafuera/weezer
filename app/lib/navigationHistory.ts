/**
 * Pure navigation-stack model behind the app's browser-history
 * integration (Nov 4, 2026). WeezerContext owns every DOM touch —
 * pushState / replaceState / the popstate listener — and this
 * module owns the bookkeeping those calls depend on, so the rules
 * can be proven without a browser (see
 * harness/navigation-history-harness.cjs).
 *
 * The model: the app's steps live in one browser session stack.
 * Each history entry the app writes carries a marker
 * ({ weezerNav, step, navIndex, gen }); navIndex is the entry's
 * position in OUR stack, which is deliberately not the browser's
 * own history length — entries the app didn't write (a /u profile
 * visit, the page the user came from) sit between ours in the
 * browser's stack and are simply not ours to manage.
 *
 * The stack is SPARSE: entries live in a record keyed by navIndex,
 * not an array, so a popstate landing after a reload — when the
 * in-memory record holds only the entry init wrote — can still
 * adopt the step/index the browser entry itself carries and keep
 * navigating from there.
 *
 * `gen` is a generation counter bumped by init and reset. Markers
 * written before a reset (sign-out) carry the older generation and
 * are stale: the context compares generations on pop and ignores
 * them, so Back/Forward after sign-out can never resurrect a
 * signed-in stack.
 */

export interface NavHistoryMarker<S extends string = string> {
  weezerNav: true;
  step: S;
  navIndex: number;
  gen: number;
}

export interface NavStack<S extends string = string> {
  /** Sparse step record keyed by navIndex. */
  entries: Record<number, S>;
  /** navIndex of the current entry; -1 before init. */
  index: number;
  /** One past the highest navIndex ever assigned in this stack. */
  length: number;
  /** Generation: bumped by init/reset; see the header note. */
  gen: number;
  /** True once init/reset has anchored the stack at an entry. */
  initialized: boolean;
}

export function createNavStack<S extends string>(): NavStack<S> {
  return { entries: {}, index: -1, length: 0, gen: 0, initialized: false };
}

/**
 * Anchor the stack at a landed step: navIndex 0, generation
 * bumped. Used for the initial landing (the settled step becomes
 * the stack's first entry; Back from it exits, as a fresh arrival
 * should).
 */
export function initNavStack<S extends string>(
  stack: NavStack<S>,
  step: S
): NavStack<S> {
  return {
    entries: { 0: step },
    index: 0,
    length: 1,
    gen: stack.gen + 1,
    initialized: true,
  };
}

/**
 * Reset is init by another name — sign-out re-anchors the stack
 * at the splash step and the generation bump orphans every marker
 * written before it.
 */
export function resetNavStack<S extends string>(
  stack: NavStack<S>,
  step: S
): NavStack<S> {
  return initNavStack(stack, step);
}

/**
 * Push a step: any forward entries (indices above the current
 * one, left over from Back-then-elsewhere) are truncated first.
 * Pushing the step the stack is already on is a no-op — a
 * same-step navigation must not grow the stack.
 */
export function pushNavStep<S extends string>(
  stack: NavStack<S>,
  step: S
): NavStack<S> {
  if (!stack.initialized) return initNavStack(stack, step);
  if (stack.entries[stack.index] === step) return stack;
  const entries: Record<number, S> = {};
  Object.keys(stack.entries).forEach((key) => {
    const idx = Number(key);
    if (idx <= stack.index) entries[idx] = stack.entries[idx];
  });
  const nextIndex = stack.index + 1;
  entries[nextIndex] = step;
  return { ...stack, entries, index: nextIndex, length: nextIndex + 1 };
}

/**
 * Replace the current entry's step (guard rewrites, corrective
 * redirects, post-auth landings): the stack neither grows nor
 * moves. Before init it simply anchors the stack.
 */
export function replaceNavStep<S extends string>(
  stack: NavStack<S>,
  step: S
): NavStack<S> {
  if (!stack.initialized) return initNavStack(stack, step);
  return {
    ...stack,
    entries: { ...stack.entries, [stack.index]: step },
  };
}

/**
 * Apply a popstate landing by the marker the browser entry
 * carried: the current index moves to the marker's navIndex and
 * the marker's step is adopted at that index (the browser entry
 * is ground truth — after a reload the in-memory record may not
 * hold it yet). Returns the landed step, or null when the marker
 * is unusable. Generation checking is the caller's job (it needs
 * the live stack, and a rejected marker must not move anything).
 */
export function applyPopNavIndex<S extends string>(
  stack: NavStack<S>,
  marker: NavHistoryMarker<S>
): { stack: NavStack<S>; step: S } {
  const entries = { ...stack.entries, [marker.navIndex]: marker.step };
  return {
    stack: {
      ...stack,
      entries,
      index: marker.navIndex,
      length: Math.max(stack.length, marker.navIndex + 1),
      initialized: true,
    },
    step: marker.step,
  };
}

/** The marker to stamp into a browser entry for the stack's
 *  current position. */
export function createNavMarker<S extends string>(
  stack: NavStack<S>,
  step: S
): NavHistoryMarker<S> {
  return { weezerNav: true, step, navIndex: stack.index, gen: stack.gen };
}

/**
 * Validate untrusted history state (event.state on popstate can
 * be anything: Next's own router state, another library's, null).
 * Returns the marker only when every field has the right shape
 * AND the step passes the caller's validity check (canonical app
 * steps only — aliases and retired names are rejected, since
 * markers are only ever written with canonical steps).
 */
export function parseNavMarker<S extends string>(
  state: unknown,
  isValidStep: (step: string) => step is S
): NavHistoryMarker<S> | null {
  if (state === null || typeof state !== 'object') return null;
  const candidate = state as Record<string, unknown>;
  if (candidate.weezerNav !== true) return null;
  if (typeof candidate.step !== 'string' || !isValidStep(candidate.step)) {
    return null;
  }
  if (
    typeof candidate.navIndex !== 'number' ||
    !Number.isInteger(candidate.navIndex) ||
    candidate.navIndex < 0
  ) {
    return null;
  }
  if (
    typeof candidate.gen !== 'number' ||
    !Number.isInteger(candidate.gen) ||
    candidate.gen < 1
  ) {
    return null;
  }
  return {
    weezerNav: true,
    step: candidate.step,
    navIndex: candidate.navIndex,
    gen: candidate.gen,
  };
}

/** True when browser Back has somewhere in-app to land. */
export function canGoBackInStack<S extends string>(
  stack: NavStack<S>
): boolean {
  return stack.initialized && stack.index > 0;
}

/** The step browser Back would land on, when it is known. After
 *  a reload the previous entry may not be in memory yet — null
 *  then means "unknown", not "none" (canGoBackInStack is the
 *  authority on existence). */
export function previousStackStep<S extends string>(
  stack: NavStack<S>
): S | null {
  if (!stack.initialized || stack.index <= 0) return null;
  return stack.entries[stack.index - 1] ?? null;
}
