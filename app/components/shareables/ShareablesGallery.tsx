'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportNodeAsPng } from './exportImage';
import { Top10CardVisual } from './Top10Card';
import { Top10AlbumsCardVisual } from './Top10AlbumsCard';
import type { Bucket, ShareSong } from './Top10Card';
import { TribeBadgeCardVisual } from './TribeBadgeCard';
import { EraDnaCardVisual } from './EraDnaCard';
import type { FriendLike } from './TasteCompatibilityCard';
import { FanhoodCardVisual } from './FanhoodCard';
import { useFanhood } from '../../lib/fanhood';
import type { FanhoodRecord } from '../../lib/fanhood';
import TierListChart from '../TierListChart';
import type { RankedAlbum as TierRankedAlbum, RankedSong as TierRankedSong } from '../TierListChart';
import { displayFont } from './fonts';

/** The dashboard poster system's shadows (StepGarage2's
 *  constants, same values): card shadow for floating panels,
 *  hard shadow for framed cards in the page flow. Page chrome
 *  only — the card VISUALS (Top10Card, TribeBadgeCard, …) are
 *  already poster art and keep their own rendering. */
const POSTER_CARD_SHADOW =
  'shadow-[0_10px_28px_rgba(11,30,63,0.12),0_2px_0_rgba(11,30,63,0.9)]';
const POSTER_HARD_SHADOW = 'shadow-[4px_4px_0_rgba(11,30,63,0.85)]';

/** Everything a tier-list card needs. The gallery builds its own
 *  fixed-mode TierListChart instances from this data — Songs and
 *  Albums are SEPARATE card entries, each pinned to one mode (no
 *  toggle inside a card's preview, modal, or export). Hosts pass
 *  data, never a pre-built chart node. */
export interface TierChartData {
  title: string;
  subtitle: string;
  username?: string;
  rankedSongs: TierRankedSong[];
  rankedAlbums: TierRankedAlbum[];
}

/**
 * One asset in the library: a scaled preview, an optional control
 * row, and a single Download button — the tier card's one-button
 * pattern (native share sheet on mobile, file download on desktop).
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
  anchorKey,
  children,
}: {
  title: string;
  description: string;
  filename: string;
  controls?: ReactNode;
  /** When true, the card is showing an empty/placeholder state and
   *  there is nothing worth downloading yet. */
  downloadDisabled?: boolean;
  /** Library-page anchor (full variant only): the dashboard's
   *  share tiles hand this key over via sessionStorage and the
   *  page scrolls the matching item into view. Thumbnail-variant
   *  items never receive one — they use ThumbnailItem instead. */
  anchorKey?: string;
  children: ReactNode;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Preview fit: MEASURED scale (useFitScale, the thumbnail/modal
  // pattern) — see the preview box below for why a fixed scale cut
  // the cards off on the right.
  const { boxRef, scale } = useFitScale(CARD_NATURAL_WIDTH);

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
    <div
      data-shareable={anchorKey}
      className={`rounded-[18px] border-[3px] border-[#0C1220] bg-white p-5 ${POSTER_HARD_SHADOW} space-y-4${anchorKey ? ' scroll-mt-28' : ''}`}
    >
      {/* Scaled preview (visual only — exports never use this node).
          The scale is MEASURED from this box (useFitScale), so the
          rendered width is always exactly the box width. It used to
          be a fixed scale(0.296) with a fixed 400px height — i.e. a
          rendered width of 1080 × 0.296 = 319.68px no matter how
          narrow the real box was. On phones the box is ~256–289px
          wide (viewport minus AppShell main p-4, the page's px-4,
          this card's p-5 and the preview border), so the preview
          overflowed its overflow-hidden box by up to ~64px and the
          card's right edge — title type, framed art, footer —
          clipped mid-word while the exported PNG stayed perfect.
          Height follows the same measured scale (the card's 4:5
          aspect), falling back to the old 400px until first measure. */}
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-[14px] border-[2.5px] border-[#0C1220] bg-[#F2F8FC]"
        style={{ height: scale > 0 ? CARD_NATURAL_HEIGHT * scale : 400 }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width: CARD_NATURAL_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            visibility: scale > 0 ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>
      </div>

      <div>
        <h3 className={`${displayFont.className} text-[21px] leading-tight tracking-wide text-[#0C1220]`}>{title}</h3>
        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[#3D4A63]">{description}</p>
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
        className={`relative flex max-h-[92vh] max-w-full flex-col overflow-hidden rounded-[18px] border-[3px] border-[#0C1220] bg-white ${POSTER_CARD_SHADOW}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-[#0C1220] bg-white/95 text-base font-black text-[#0C1220] shadow-[2px_2px_0_#0C1220] transition hover:bg-white"
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
        className={`relative aspect-[4/5] overflow-hidden rounded-[14px] border-[2.5px] border-[#0C1220] bg-[#F2F8FC] ${POSTER_HARD_SHADOW} transition`}
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
      <p className={`${displayFont.className} mt-2 text-center text-[15px] tracking-wide text-[#0C1220]`}>
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
            <div className="border-t-[3px] border-[#0C1220] bg-white p-4">
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

/** Tier List thumbnail item (one per mode — "Tier List — Songs" and
 *  "Tier List — Albums"): the item builds its own TierListChart from
 *  the shared tier data, pinned to its mode via fixedView (no toggle
 *  anywhere in the card). The chart is the visual — scaled from a
 *  fixed 1024 layout width for the thumbnail, but FLUID at panel
 *  width inside the modal, exactly how it renders on the library
 *  page (scaling the fluid chart down instead would shrink its chip
 *  text to unreadability).
 *
 *  SAVE, PINNED (UAT P-11): the modal also carries a pinned footer
 *  Save (the CardModal footer pattern the portrait cards use), so
 *  saving no longer means scrolling to the bottom of the fluid
 *  chart. The pinned button is wired to the MODAL's own chart
 *  instance — it activates that instance's own save button (marked
 *  data-tier-save in TierListChart), so the export uses the modal
 *  chart's mode and its export node, not the thumbnail's. A
 *  MutationObserver mirrors the instance's generating/failure state
 *  onto the pinned button so the feedback the chart shows on its own
 *  button is not lost. (Sharing ONE chart instance between thumbnail
 *  and modal remains deliberately undone — the owner approved the
 *  pin only.) */
function TierThumbnailItem({
  shortTitle,
  tierCharts,
  mode,
}: {
  shortTitle: string;
  tierCharts: TierChartData;
  mode: 'songs' | 'albums';
}) {
  const chart = <TierListChart {...tierCharts} fixedView={mode} />;
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
        shortTitle={shortTitle}
        naturalWidth={TIER_NATURAL_WIDTH}
        onOpen={() => setOpen(true)}
      >
        <div style={{ width: TIER_NATURAL_WIDTH }}>{chart}</div>
      </ThumbnailButton>

      {open && (
        <CardModal
          title={shortTitle}
          onClose={() => setOpen(false)}
          footer={
            <div className="border-t-[3px] border-[#0C1220] bg-white p-4">
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
          <div ref={modalChartRef}>{chart}</div>
        </CardModal>
      )}
    </div>
  );
}

/** Library-page tier entry (the 'full' variant's tier cards): a
 *  full-width section in the library's card chrome carrying one
 *  fixed-mode chart — Songs and Albums each get their own entry,
 *  and the chart's own Save button (carousel export included) is
 *  the entry's download. No modal/pin here: the library layout
 *  shows the chart itself, like the section it replaces. */
function TierLibrarySection({
  tierCharts,
  mode,
}: {
  tierCharts: TierChartData;
  mode: 'songs' | 'albums';
}) {
  return (
    <div
      data-shareable={mode === 'songs' ? 'tier-songs' : 'tier-albums'}
      className={`rounded-[18px] border-[3px] border-[#0C1220] bg-white p-5 ${POSTER_HARD_SHADOW} scroll-mt-28`}
    >
      <div className="mb-4">
        <h3 className={`${displayFont.className} text-[21px] leading-tight tracking-wide text-[#0C1220]`}>
          {mode === 'songs' ? 'Tier List — Songs' : 'Tier List — Albums'}
        </h3>
        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[#3D4A63]">
          {mode === 'songs'
            ? 'Your full song tier list, S to F.'
            : 'Your albums in tiers, S to F.'}
        </p>
      </div>
      <TierListChart {...tierCharts} fixedView={mode} />
    </div>
  );
}

/** The fanhood card items (both variants). The card exists ONLY
 *  once a fanhood is established (a first finished game — see
 *  app/lib/fanhood.ts); the gallery reads the record
 *  itself via useFanhood, so hosts pass nothing. */
function FanhoodLibraryItem({
  fanhood,
  subtitle,
}: {
  fanhood: FanhoodRecord;
  subtitle?: string;
}) {
  return (
    <LibraryItem
      title="Back to the Shack"
      description="Your stop in Back to the Shack"
      filename="my-weezer-fanhood.png"
      anchorKey="game"
    >
      <FanhoodCardVisual fanhood={fanhood} subtitle={subtitle} />
    </LibraryItem>
  );
}

function FanhoodThumbnailItem({
  fanhood,
  subtitle,
}: {
  fanhood: FanhoodRecord;
  subtitle?: string;
}) {
  return (
    <ThumbnailItem shortTitle="The Shack" filename="my-weezer-fanhood.png">
      <FanhoodCardVisual fanhood={fanhood} subtitle={subtitle} />
    </ThumbnailItem>
  );
}

export default function ShareablesGallery({
  songs,
  triageMap,
  friends: _friends,
  subtitle,
  tierCharts,
  variant = 'full',
  onStartSorting,
  onFindFriends: _onFindFriends,
}: {
  /** Ranked songs only (already filtered to bucketed songs). */
  songs: ShareSong[];
  triageMap: Record<string, Bucket>;
  /** Accepted but currently unused (Nov 5): the Taste Match card —
   *  the gallery's only consumer of the friends list — is buried
   *  for now (Mark's direction). The prop stays in the contract so
   *  the hosts' calls and the card's return need no rewiring; the
   *  component (TasteCompatibilityCard) and its data path are
   *  untouched. */
  friends: FriendLike[];
  subtitle?: string;
  /** Optional tier-list data. The gallery renders it as TWO card
   *  entries — "Tier List — Songs" and "Tier List — Albums" — each
   *  pinned to its mode. In the 'full' variant they are full-width
   *  sections between the two card grids (the standalone library page); in
   *  'thumbnails' they are two grid items opening modals with pinned
   *  Saves. (Previously hosts passed one pre-built tierSection node
   *  with a Songs/Albums toggle inside; that node is gone — the
   *  gallery now owns the fixed-mode chart instances.) */
  tierCharts?: TierChartData;
  /** 'full' (default): large previews with inline Download buttons —
   *  the library page. 'thumbnails': a compact thumbnail grid that
   *  opens each card full-size in a modal — the Sweater Thread. */
  variant?: 'full' | 'thumbnails';
  /** Empty-state forward path: where "Start sorting" goes. Both
   *  hosts pass it; without it the empty state is text-only and
   *  the one action it recommends isn't offered on the page. */
  onStartSorting?: () => void;
  /** Zero-friends forward path for the Taste Match card —
   *  retained with the friends prop while that card is buried. */
  onFindFriends?: () => void;
}) {
  // The fanhood card is the one asset that doesn't come from
  // rankings: it renders off the established fanhood record, so it
  // can exist even when no song is bucketed yet (a fan who marked
  // the gate albums "Don't Know It" has a fanhood but no cards).
  const fanhood = useFanhood();
  if (songs.length === 0) {
    if (fanhood) {
      return variant === 'thumbnails' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <FanhoodThumbnailItem fanhood={fanhood} subtitle={subtitle} />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <FanhoodLibraryItem fanhood={fanhood} subtitle={subtitle} />
        </div>
      );
    }
    return (
      <div className={`rounded-[18px] border-[3px] border-[#0C1220] bg-white p-10 text-center ${POSTER_HARD_SHADOW}`}>
        <p className={`${displayFont.className} text-[24px] leading-tight tracking-wide text-[#0C1220]`}>No shareables yet</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-[#3D4A63]">
          Bucket and rank some songs first — your cards will appear here.
        </p>
        {onStartSorting && (
          <button
            type="button"
            onClick={onStartSorting}
            className="mt-5 cursor-pointer rounded-[11px] border-[2.5px] border-[#0C1220] bg-[#0072CE] px-6 py-3 text-sm font-black text-white shadow-[3px_3px_0_#0C1220] transition-all hover:bg-blue-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]"
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
        {tierCharts && tierCharts.rankedAlbums.length > 0 ? (
          <ThumbnailItem shortTitle="Top 10 Albums" filename="my-weezer-top-10-albums.png">
            <Top10AlbumsCardVisual albums={tierCharts.rankedAlbums} songs={songs} subtitle={subtitle} />
          </ThumbnailItem>
        ) : null}
        {tierCharts ? (
          <>
            <TierThumbnailItem shortTitle="Tier List — Albums" tierCharts={tierCharts} mode="albums" />
            <TierThumbnailItem shortTitle="Tier List — Songs" tierCharts={tierCharts} mode="songs" />
          </>
        ) : null}
        {fanhood ? (
          <FanhoodThumbnailItem fanhood={fanhood} subtitle={subtitle} />
        ) : null}
        <ThumbnailItem shortTitle="Fan Tribe" filename="my-weezer-tribe.png">
          <TribeBadgeCardVisual songs={songs} triageMap={triageMap} subtitle={subtitle} />
        </ThumbnailItem>
        <ThumbnailItem shortTitle="Era DNA" filename="my-weezer-era-dna.png">
          <EraDnaCardVisual songs={songs} subtitle={subtitle} />
        </ThumbnailItem>
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
          anchorKey="top10"
        >
          <Top10CardVisual songs={songs} subtitle={subtitle} />
        </LibraryItem>
        {tierCharts && tierCharts.rankedAlbums.length > 0 ? (
          <LibraryItem
            title="Top 10 Albums"
            description="Your top 10 albums as a shareable graphic."
            filename="my-weezer-top-10-albums.png"
            anchorKey="top10-albums"
          >
            <Top10AlbumsCardVisual albums={tierCharts.rankedAlbums} songs={songs} subtitle={subtitle} />
          </LibraryItem>
        ) : null}
      </div>
      {tierCharts && (
        <div className="mt-6 space-y-6">
          <TierLibrarySection tierCharts={tierCharts} mode="albums" />
          <TierLibrarySection tierCharts={tierCharts} mode="songs" />
        </div>
      )}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {fanhood ? (
          <FanhoodLibraryItem fanhood={fanhood} subtitle={subtitle} />
        ) : null}
        <LibraryItem
          title="Fan Tribe Badge"
          description="Which Weezer tribe do you belong to?"
          filename="my-weezer-tribe.png"
          anchorKey="tribe"
        >
          <TribeBadgeCardVisual songs={songs} triageMap={triageMap} subtitle={subtitle} />
        </LibraryItem>
        <LibraryItem
          title="Era DNA"
          description="Where your taste lives across Weezer history."
          filename="my-weezer-era-dna.png"
          anchorKey="era-dna"
        >
          <EraDnaCardVisual songs={songs} subtitle={subtitle} />
        </LibraryItem>
      </div>
    </div>
  );
}
