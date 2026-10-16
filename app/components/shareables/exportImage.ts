import { toPng } from 'html-to-image';

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
 * real render at pixelRatio 2 on the export card's #0f172a background.
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
 */
export async function exportNodeAsPng(
  node: HTMLElement | null,
  filename: string,
  mode: ExportMode = 'auto',
): Promise<void> {
  if (!node) return;
  await new Promise((r) => setTimeout(r, 150));
  try {
    await toPng(node, { quality: 0.1, pixelRatio: 1 });
  } catch {
    // Warmup failures are non-fatal; the real render still runs.
  }
  const dataUrl = await toPng(node, {
    quality: 1.0,
    pixelRatio: 2,
    backgroundColor: '#0f172a',
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
