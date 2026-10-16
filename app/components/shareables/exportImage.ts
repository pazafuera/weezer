import { toPng } from 'html-to-image';

/**
 * Render a DOM node to PNG and download/share it.
 * Same pattern as TierListChart's "Save as Image": a low-quality warmup
 * render first (improves font/paint reliability), then the real render,
 * then native share on mobile, download-link fallback otherwise.
 */
export async function exportNodeAsPng(node: HTMLElement | null, filename: string): Promise<void> {
  if (!node) return;
  try {
    await toPng(node, { quality: 0.1, pixelRatio: 1 });
  } catch {
    // Warmup failures are non-fatal; the real render still runs.
  }
  const dataUrl = await toPng(node, { pixelRatio: 2 });
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  try {
    if (
      typeof navigator.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: 'My Weezer Shareable' });
      return;
    }
  } catch {
    // User dismissed the share sheet — fall through to download.
  }
  const a = document.createElement('a');
  a.download = filename;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
