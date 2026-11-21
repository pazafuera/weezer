/**
 * Meta (Facebook) pixel bridge — the ad-measurement seam.
 *
 * The pixel itself is loaded by components/MetaPixel.tsx, and
 * only when the deployment carries NEXT_PUBLIC_META_PIXEL_ID
 * (set in Vercel per environment). Until then window.fbq does
 * not exist and every call here is a no-op, so the events can
 * be wired ahead of the campaign existing; the day the ID
 * lands, the same build starts reporting.
 *
 * The event set mirrors the funnel's own milestones, detected
 * where the app detects them (the context's edit funnel,
 * commitEdit — acts, never boot-loaded states):
 * - SortStart         — the first song bucketed.
 * - ScopeSortComplete — a sort path's songs are all bucketed
 *   (the Blue + Pinkerton campaign's conversion).
 * - SortComplete      — all 218 bucketed.
 *
 * Failure posture matches the first-party analytics: ads
 * measurement must never break sorting, so every call is
 * wrapped and silent.
 */

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { fbq?: unknown }).fbq;
  return typeof candidate === 'function' ? (candidate as Fbq) : null;
}

export function trackMetaCustom(
  event: string,
  params?: Record<string, unknown>
): void {
  try {
    fbq()?.('trackCustom', event, params ?? {});
  } catch {
    // Measurement is expendable; the sort is not.
  }
}

// Once-per-page-load guards: a dip-and-return across a finish
// line is one conversion, however many times the edit funnel
// watches the count cross it.
let sortStartSent = false;
const scopeCompleteSent = new Set<string>();

export function trackMetaSortStartOnce(): void {
  if (sortStartSent) return;
  sortStartSent = true;
  trackMetaCustom('SortStart');
}

export function trackMetaScopeCompleteOnce(scope: string): void {
  if (scopeCompleteSent.has(scope)) return;
  scopeCompleteSent.add(scope);
  trackMetaCustom('ScopeSortComplete', { scope });
}
