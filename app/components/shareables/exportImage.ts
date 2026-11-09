import { toPng } from 'html-to-image';
import { cardFromExportFilename, trackAnalytics } from '../../lib/analytics';

export type ExportMode = 'auto' | 'save' | 'share';

function isMobileDevice(): boolean {
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Render a DOM node to PNG and save/share it.
 * Mirrors TierListChart's proven export flow on this site: a brief settle,
 * an invisible warmup render (iOS Safari foreignObject quirk), then the
 * real render at pixelRatio 2. The background matches the scrapbook
 * cards' cream paper so any edge blends in.
 *
 * mode:
 * - 'save'  → always download the PNG file.
 * - 'share' → native share sheet when possible, download fallback.
 * - 'auto'  → share on mobile, download on desktop (TierListChart behavior).
 *
 * IMPORTANT: `node` must be a full-size, untransformed export copy (the
 * TierListChart pattern renders a dedicated off-screen copy for capture).
 * Exporting a CSS-scaled preview node produces a tiny card in the corner
 * of a blank canvas.
 *
 * TEXT OUTLINES: html-to-image DROPS -webkit-text-stroke — never rely
 * on it for an export. A text-shadow ring (offsets in every direction,
 * ink color, ahead of any drop shadow) survives and is the minimum
 * for display type on flat fields. Over busy art (the Top 10 twins'
 * vinyl record) even the ring under-delivered — the download kept
 * washing out while the site looked right — so those headlines paint
 * the outline as SVG vector strokes via OutlinedDisplayText in
 * ShareCardShell (owner-caught twice on the Top 10 card, Nov 8, 2026).
 */
export async function exportNodeAsPng(
  node: HTMLElement | null,
  filename: string,
  mode: ExportMode = 'auto',
): Promise<void> {
  if (!node) return;
  // Analytics: every card export on the site funnels through
  // here, so this is the one honest "share initiated" point —
  // fired at the tap, before the render (an initiated share is
  // the funnel event; render success is the card code's own
  // business). Unrecognized filenames are not counted cards.
  const card = cardFromExportFilename(filename);
  if (card) trackAnalytics('share_initiated', { card });
  await new Promise((r) => setTimeout(r, 150));
  try {
    await toPng(node, { quality: 0.1, pixelRatio: 1 });
  } catch {
    // Warmup failures are non-fatal; the real render still runs.
  }
  const dataUrl = await toPng(node, {
    quality: 1.0,
    pixelRatio: 2,
    backgroundColor: '#f1e8d0',
  });

  const wantShare = mode === 'share' || (mode === 'auto' && isMobileDevice());
  if (wantShare && typeof navigator.share === 'function') {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Weezer Shareable' });
        return;
      }
    } catch {
      // Share dismissed or failed — fall through to download.
    }
  }

  const a = document.createElement('a');
  a.download = filename;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
