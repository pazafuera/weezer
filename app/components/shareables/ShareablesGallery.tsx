'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportNodeAsPng } from './exportImage';
import { Top10CardVisual } from './Top10Card';
import type { Bucket, ShareSong } from './Top10Card';
import { TribeBadgeCardVisual } from './TribeBadgeCard';
import { EraDnaCardVisual } from './EraDnaCard';
import { TasteCompatibilityCardVisual, friendKey, friendLabel } from './TasteCompatibilityCard';
import type { FriendLike } from './TasteCompatibilityCard';

/**
 * One asset in the library: a scaled preview, an optional control row
 * (e.g. the compatibility card's friend picker), and a single Download
 * button — the tier card's one-button pattern (native share sheet on
 * mobile, file download on desktop).
 *
 * Exports ALWAYS render from a hidden full-size off-screen copy (the
 * TierListChart pattern) — never from the CSS-scaled preview — so PNGs
 * come out at the card's natural 1080px size, fully framed.
 *
 * `children` renders the card's visual; any state a card needs lives in
 * the wrapping item component so preview and export copies stay in sync.
 */
function LibraryItem({
  title,
  description,
  filename,
  controls,
  downloadDisabled,
  children,
}: {
  title: string;
  description: string;
  filename: string;
  controls?: ReactNode;
  /** When true, the card is showing an empty/placeholder state and
   *  there is nothing worth downloading yet. */
  downloadDisabled?: boolean;
  children: ReactNode;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const download = async () => {
    if (busy || downloadDisabled) return;
    setBusy(true);
    try {
      await exportNodeAsPng(exportRef.current, filename, 'auto');
      // Confirm the save right on the button the user just tapped.
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch {
      // A failed render used to be indistinguishable from success
      // that "didn't take" — the button just went back to
      // 'Download'. Say it failed, on the same button.
      setFailed(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setFailed(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
      {/* Scaled preview (visual only — exports never use this node) */}
      <div className="relative h-[400px] overflow-hidden rounded-2xl bg-slate-100 border border-slate-200">
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{ width: 1080, transform: 'scale(0.296)', transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>

      <div>
        <h3 className="font-black text-lg text-slate-950 leading-tight">{title}</h3>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">{description}</p>
      </div>

      {controls}

      <button
        onClick={download}
        disabled={busy || downloadDisabled}
        className={`w-full text-white font-black text-xs py-3 px-3 rounded-xl transition cursor-pointer disabled:opacity-50 ${
          failed ? 'bg-rose-500' : saved ? 'bg-emerald-500' : 'bg-[#0072CE] hover:bg-blue-600'
        }`}
      >
        {busy ? 'Generating Image...' : failed ? "Couldn't generate — try again" : saved ? '✓ Saved!' : '📸 Download'}
      </button>

      {/* Hidden full-size export copy (TierListChart pattern) */}
      <div
        className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={exportRef}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thumbnails variant (Sweater Thread): a grid of scaled previews with */
/* short titles; tapping one opens the full-size card in a modal with  */
/* the same single Download button.                                    */
/* ------------------------------------------------------------------ */

/** Natural size of the scrapbook card visuals (they render at
 *  1080×1350, a 4:5 box). */
const CARD_NATURAL_WIDTH = 1080;
const CARD_NATURAL_HEIGHT = 1350;
/** Fixed layout width used to thumbnail the tier section, whose
 *  content is fluid — matches the width it gets on the library page.
 *  Thumbnail only: inside the modal the section renders fluid at
 *  panel width instead (see TierThumbnailItem). */
const TIER_NATURAL_WIDTH = 1024;

/** Scale a fixed-natural-width visual down to fit its (responsive)
 *  thumbnail box: measures the box and returns width / naturalWidth. */
function useFitScale(naturalWidth: number) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / naturalWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth]);
  return { boxRef, scale };
}

/** Centered modal: dark backdrop (click to close), a panel capped at
 *  92vh whose content scrolls, a high-contrast panel-anchored ✕
 *  (light disc with a ≥44px tap target — readable over the cream
 *  portrait cards and the tier chart's dark frame alike, and it
 *  never scrolls away), and an optional pinned footer (the Download
 *  bar). Esc closes; body scroll is locked while open. */
function CardModal({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative flex max-h-[92vh] max-w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/95 text-base font-black text-slate-900 shadow-lg ring-1 ring-slate-900/25 transition hover:bg-white"
        >
          ✕
        </button>
        <div className="overflow-auto p-4 sm:p-6">{children}</div>
        {footer}
      </div>
    </div>
  );
}

/** The clickable thumbnail: the real visual scaled to fit a 4:5 box
 *  (visual subtree is pointer-events-none), short title underneath. */
function ThumbnailButton({
  shortTitle,
  naturalWidth,
  onOpen,
  children,
}: {
  shortTitle: string;
  naturalWidth: number;
  onOpen: () => void;
  children: ReactNode;
}) {
  const { boxRef, scale } = useFitScale(naturalWidth);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="group block w-full cursor-pointer text-left"
    >
      <div
        ref={boxRef}
        className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs transition group-hover:border-slate-300"
      >
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width: naturalWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            visibility: scale > 0 ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
      <p className="mt-2 text-center text-sm font-black text-slate-800">
        {shortTitle}
      </p>
    </button>
  );
}

/** The portrait card inside the modal, scaled to fit the modal's
 *  content box — the ThumbnailButton fit pattern (useFitScale)
 *  applied to the modal instead of the thumbnail box: the visual
 *  renders at its natural 1080 width inside a wrapper sized to the
 *  scaled box, so the whole card is visible with no panning or
 *  scrolling in either axis.
 *
 *  The measuring box needs a definite width of its own — the modal
 *  panel is shrink-to-fit, so a plain w-full box would measure the
 *  collapsed panel rather than the space the modal actually offers.
 *  The box therefore takes the full phone width the modal leaves for
 *  content (viewport minus the backdrop's p-3 and the content's p-4,
 *  wider p-6/p-6 padding at sm), capped at the card's natural width
 *  so large screens keep the old natural-size render. At 390px the
 *  box is 334px → scale ≈ 0.31 → card displays 334×417px. */
function FitScaledCard({ children }: { children: ReactNode }) {
  const { boxRef, scale } = useFitScale(CARD_NATURAL_WIDTH);
  return (
    <div
      ref={boxRef}
      className="w-[calc(100vw-3.5rem)] max-w-[1080px] sm:w-[calc(100vw-6rem)]"
    >
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          width: CARD_NATURAL_WIDTH * scale,
          height: CARD_NATURAL_HEIGHT * scale,
          visibility: scale > 0 ? 'visible' : 'hidden',
        }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width: CARD_NATURAL_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * One thumbnail-grid asset: thumbnail, a modal with the card scaled
 * to fit the screen, and the download — same pattern as LibraryItem:
 * the download renders from a hidden full-size off-screen copy,
 * never from the scaled thumbnail or the modal node.
 */
function ThumbnailItem({
  shortTitle,
  filename,
  controls,
  downloadDisabled,
  children,
}: {
  shortTitle: string;
  filename: string;
  controls?: ReactNode;
  downloadDisabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const download = async () => {
    if (busy || downloadDisabled) return;
    setBusy(true);
    try {
      await exportNodeAsPng(exportRef.current, filename, 'auto');
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch {
      setFailed(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setFailed(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ThumbnailButton
        shortTitle={shortTitle}
        naturalWidth={CARD_NATURAL_WIDTH}
        onOpen={() => setOpen(true)}
      >
        {children}
      </ThumbnailButton>

      {open && (
        <CardModal
          title={shortTitle}
          onClose={() => setOpen(false)}
          footer={
            <div className="border-t border-slate-200 bg-white p-4">
              <button
                onClick={download}
                disabled={busy || downloadDisabled}
                className={`w-full text-white font-black text-xs py-3 px-3 rounded-xl transition cursor-pointer disabled:opacity-50 ${
                  failed ? 'bg-rose-500' : saved ? 'bg-emerald-500' : 'bg-[#0072CE] hover:bg-blue-600'
                }`}
              >
                {busy ? 'Generating Image...' : failed ? "Couldn't generate — try again" : saved ? '✓ Saved!' : '📸 Download'}
              </button>
            </div>
          }
        >
          {controls && <div className="mb-4 max-w-sm">{controls}</div>}
          <FitScaledCard>{children}</FitScaledCard>
        </CardModal>
      )}

      {/* Hidden full-size export copy (TierListChart pattern) */}
      <div
        className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={exportRef}>{children}</div>
      </div>
    </div>
  );
}

/** Compatibility thumbnail item: same friend-selection state pattern as
 *  CompatibilityLibraryItem — the picker lives in the modal above the
 *  card, and the download stays disabled until a friend is chosen. */
function CompatibilityThumbnailItem({
  songs,
  friends,
  subtitle,
  onFindFriends,
}: {
  songs: ShareSong[];
  friends: FriendLike[];
  subtitle?: string;
  onFindFriends?: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const controls = (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        Compare with
      </label>
      {friends.length === 0 ? (
        /* No friends: the picker used to render empty and the
           Download stayed disabled with no explanation and no
           way forward. Say what's missing and offer the trip. */
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-500 leading-snug">
            Taste Match compares your rankings with a friend&apos;s —
            you don&apos;t have any Fan Friends yet.
          </p>
          {onFindFriends && (
            <button
              type="button"
              onClick={onFindFriends}
              className="text-sm font-black text-[#0072CE] underline underline-offset-4 cursor-pointer"
            >
              Find friends →
            </button>
          )}
        </div>
      ) : (
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900"
        >
          <option value="">Choose a friend…</option>
          {friends.map((f, i) => (
            <option key={friendKey(f, i)} value={friendKey(f, i)}>
              {friendLabel(f)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
  return (
    <ThumbnailItem
      shortTitle="Taste Match"
      filename="weezer-taste-match.png"
      controls={controls}
      downloadDisabled={selectedKey === ''}
    >
      <TasteCompatibilityCardVisual
        songs={songs}
        friends={friends}
        subtitle={subtitle}
        selectedKey={selectedKey}
      />
    </ThumbnailItem>
  );
}

/** Tier List thumbnail item: the tierSection node (chart + its own
 *  Songs/Albums toggle + its own save button) is the visual — scaled
 *  from a fixed 1024 layout width for the thumbnail, but FLUID at
 *  panel width inside the modal, exactly how it renders on the
 *  library page (scaling the fluid chart down instead would shrink
 *  its chip text to unreadability).
 *
 *  SAVE, PINNED (UAT P-11): the modal also carries a pinned footer
 *  Save (the CardModal footer pattern the portrait cards use), so
 *  saving no longer means scrolling to the bottom of the fluid
 *  chart. The pinned button is wired to the MODAL's own chart
 *  instance — it activates that instance's own save button (marked
 *  data-tier-save in TierListChart), so the export uses the modal
 *  chart's toggle state and its export node, not the library
 *  page's or the thumbnail's. A MutationObserver mirrors the
 *  instance's generating/failure state onto the pinned button so
 *  the feedback the chart shows on its own button is not lost.
 *  (Sharing ONE chart instance between page and modal remains
 *  deliberately undone — the owner approved the pin only.) */
function TierThumbnailItem({ tierSection }: { tierSection: ReactNode }) {
  const [open, setOpen] = useState(false);
  const modalChartRef = useRef<HTMLDivElement>(null);
  const [pinnedBusy, setPinnedBusy] = useState(false);
  const [pinnedFailed, setPinnedFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const root = modalChartRef.current;
    if (!root) return;
    const source =
      root.querySelector<HTMLButtonElement>('[data-tier-save]');
    if (!source) return;
    const sync = () => {
      setPinnedBusy(source.disabled);
      setPinnedFailed(source.textContent?.includes("Couldn't generate") ?? false);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(source, {
      attributes: true,
      attributeFilter: ['disabled', 'class'],
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [open ]);

  const saveFromModal = () => {
    modalChartRef.current
      ?.querySelector<HTMLButtonElement>('[data-tier-save]')
      ?.click();
  };

  return (
    <div>
      <ThumbnailButton
        shortTitle="Tier List"
        naturalWidth={TIER_NATURAL_WIDTH}
        onOpen={() => setOpen(true)}
      >
        <div style={{ width: TIER_NATURAL_WIDTH }}>{tierSection}</div>
      </ThumbnailButton>

      {open && (
        <CardModal
          title="Tier List"
          onClose={() => setOpen(false)}
          footer={
            <div className="border-t border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={saveFromModal}
                disabled={pinnedBusy}
                className={`w-full text-white font-black text-xs py-3 px-3 rounded-xl transition cursor-pointer disabled:opacity-50 ${
                  pinnedFailed ? 'bg-rose-500' : 'bg-[#0072CE] hover:bg-blue-600'
                }`}
              >
                {pinnedBusy
                  ? 'Generating Image...'
                  : pinnedFailed
                  ? "Couldn't generate — try again"
                  : '📸 Save Tier List as Image'}
              </button>
            </div>
          }
        >
          <div ref={modalChartRef}>{tierSection}</div>
        </CardModal>
      )}
    </div>
  );
}

/** Compatibility item holds the friend selection so the preview and the
 *  export copy render the same match. The picker sits under the preview
 *  at natural size. */
function CompatibilityLibraryItem({
  songs,
  friends,
  subtitle,
  onFindFriends,
}: {
  songs: ShareSong[];
  friends: FriendLike[];
  subtitle?: string;
  onFindFriends?: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const controls = (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        Compare with
      </label>
      {friends.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-500 leading-snug">
            Taste Match compares your rankings with a friend&apos;s —
            you don&apos;t have any Fan Friends yet.
          </p>
          {onFindFriends && (
            <button
              type="button"
              onClick={onFindFriends}
              className="text-sm font-black text-[#0072CE] underline underline-offset-4 cursor-pointer"
            >
              Find friends →
            </button>
          )}
        </div>
      ) : (
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-900"
        >
          <option value="">Choose a friend…</option>
          {friends.map((f, i) => (
            <option key={friendKey(f, i)} value={friendKey(f, i)}>
              {friendLabel(f)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
  return (
    <LibraryItem
      title="Taste Compatibility"
      description="Your taste match score vs. a friend."
      filename="weezer-taste-match.png"
      controls={controls}
      downloadDisabled={selectedKey === ''}
    >
      <TasteCompatibilityCardVisual
        songs={songs}
        friends={friends}
        subtitle={subtitle}
        selectedKey={selectedKey}
      />
    </LibraryItem>
  );
}

export default function ShareablesGallery({
  songs,
  triageMap,
  friends,
  subtitle,
  tierSection,
  variant = 'full',
  onStartSorting,
  onFindFriends,
}: {
  /** Ranked songs only (already filtered to bucketed songs). */
  songs: ShareSong[];
  triageMap: Record<string, Bucket>;
  friends: FriendLike[];
  subtitle?: string;
  /** Optional tier-list section. In the 'full' variant it renders as a
   *  full-width section under the card grid (the standalone library
   *  page); in 'thumbnails' it becomes the "Tier List" grid item. */
  tierSection?: ReactNode;
  /** 'full' (default): large previews with inline Download buttons —
   *  the library page. 'thumbnails': a compact thumbnail grid that
   *  opens each card full-size in a modal — the Sweater Thread. */
  variant?: 'full' | 'thumbnails';
  /** Empty-state forward path: where "Start sorting" goes. Both
   *  hosts pass it; without it the empty state is text-only and
   *  the one action it recommends isn't offered on the page. */
  onStartSorting?: () => void;
  /** Zero-friends forward path for the Taste Match card. */
  onFindFriends?: () => void;
}) {
  if (songs.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-10 text-center shadow-xs">
        <p className="text-xl font-black text-slate-950">No shareables yet</p>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          Bucket and rank some songs first — your cards will appear here.
        </p>
        {onStartSorting && (
          <button
            type="button"
            onClick={onStartSorting}
            className="mt-5 bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm px-6 py-3 rounded-full transition-colors cursor-pointer"
          >
            Start sorting →
          </button>
        )}
      </div>
    );
  }
  if (variant === 'thumbnails') {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <ThumbnailItem shortTitle="Top 10 Songs" filename="my-weezer-top-10.png">
          <Top10CardVisual songs={songs} subtitle={subtitle} />
        </ThumbnailItem>
        <ThumbnailItem shortTitle="Fan Tribe" filename="my-weezer-tribe.png">
          <TribeBadgeCardVisual songs={songs} triageMap={triageMap} subtitle={subtitle} />
        </ThumbnailItem>
        <ThumbnailItem shortTitle="Era DNA" filename="my-weezer-era-dna.png">
          <EraDnaCardVisual songs={songs} subtitle={subtitle} />
        </ThumbnailItem>
        <CompatibilityThumbnailItem songs={songs} friends={friends} subtitle={subtitle} onFindFriends={onFindFriends} />
        {tierSection ? <TierThumbnailItem tierSection={tierSection} /> : null}
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <LibraryItem
          title="Top 10 Songs"
          description="Your ranked top 10 as a shareable graphic."
          filename="my-weezer-top-10.png"
        >
          <Top10CardVisual songs={songs} subtitle={subtitle} />
        </LibraryItem>
        <LibraryItem
          title="Fan Tribe Badge"
          description="Which Weezer tribe do you belong to?"
          filename="my-weezer-tribe.png"
        >
          <TribeBadgeCardVisual songs={songs} triageMap={triageMap} subtitle={subtitle} />
        </LibraryItem>
        <LibraryItem
          title="Era DNA"
          description="Where your taste lives across Weezer history."
          filename="my-weezer-era-dna.png"
        >
          <EraDnaCardVisual songs={songs} subtitle={subtitle} />
        </LibraryItem>
        <CompatibilityLibraryItem songs={songs} friends={friends} subtitle={subtitle} onFindFriends={onFindFriends} />
      </div>
      {tierSection}
    </div>
  );
}
