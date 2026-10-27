'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useWeezer, AppStep, getProgressState, countCategorizedSongs } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import { isLoreUnlocked } from '../data/loreGame';
import { FlyingWIcon } from './SharedUI';
import WeezerAccountDrawer from './WeezerAccountDrawer';
import BucketGuide from './BucketGuide';

export default function AppShell({
  children,
  fullWidth = false,
  fullBleed = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
  /** The child step owns the whole main area (no max-width, no
      padding) — used by the Lore game's full-bleed stage. Header
      and footer are untouched. */
  fullBleed?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bucketsOpen, setBucketsOpen] = useState(false);

  const openAccountDrawer = () => setAccountDrawerOpen(true);
  const closeAccountDrawer = () => setAccountDrawerOpen(false);

  const closeHelp = () => setHelpOpen(false);
  const closeBuckets = () => setBucketsOpen(false);

  // HELP → "Replay the deck tutorial": hand the request to
  // Step1Deck by two routes. The sessionStorage flag is set
  // before navigating, so a deck that mounts on arrival picks
  // it up; the window event reaches a deck that is already
  // mounted on the triage step. (Same-step navigateTo doesn't
  // remount the deck, so the event is the live route there.)
  // The deck clears the flag when the tour actually opens.
  const replayTutorial = () => {
    try {
      window.sessionStorage.setItem('weezer-deck-tutorial-force', '1');
    } catch (e) {
      // sessionStorage unavailable — the event below still
      // covers a deck that is already on screen.
    }
    setHelpOpen(false);
    if (step === 'triage') {
      window.dispatchEvent(new CustomEvent('weezer:replay-tutorial'));
    }
    // preserveOrigins (UAT P-3): a replay is a detour, not a move
    // on — without it this navigation wiped every recorded return
    // origin, and Backs on tracked steps visited before the replay
    // fell back to their hardcoded destinations afterward.
    navigateTo('triage', undefined, { preserveOrigins: true });
  };

  const {
    step,
    userId,
    userProfile,
    navigateTo,
    handleSignOut,
    pendingRequestsCount = 0,
    friendsList = [],
    refreshFriends,
    triageMap,
    masterList,
  } = useWeezer();

  const closeMenu = () => setMenuOpen(false);

  // OPEN HELP — the help sheet below is owned here, but one of
  // its openers lives in the triage step's chrome (the HelpButton
  // in SharedUI, carried by both the deck progress row and the
  // list progress bar). Same window-event pattern as the tutorial
  // replay: the button dispatches 'weezer:open-help', this
  // listener opens the sheet. (The menu's Help item, below, calls
  // setHelpOpen directly.)
  useEffect(() => {
    const onOpenHelp = () => setHelpOpen(true);
    window.addEventListener('weezer:open-help', onOpenHelp);
    return () => window.removeEventListener('weezer:open-help', onOpenHelp);
  }, []);

  // REFRESH FRIENDS DATA WHEN THE MENU OPENS — once per opening,
  // on the closed→open transition only. The latest refreshFriends
  // is held in a ref, so this effect never depends on the
  // function's identity: listing a per-render closure here once
  // meant every provider re-render — including the ones this very
  // fetch causes when it setState's fresh friend arrays —
  // re-fired the fetch, looping the whole app several times a
  // second while the menu stood open. On the phone that churn
  // starved every tap (✕, backdrop, nav rows) and the menu read
  // as locked; touch has no Escape to break out with. Firing on
  // the transition makes that loop impossible from this side,
  // whatever the provider does.
  const refreshFriendsRef = useRef(refreshFriends);
  useEffect(() => {
    refreshFriendsRef.current = refreshFriends;
  }, [refreshFriends]);
  const menuWasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = menuOpen && !menuWasOpenRef.current;
    menuWasOpenRef.current = menuOpen;
    if (justOpened && userId) {
      refreshFriendsRef.current?.();
    }
  }, [menuOpen, userId]);

  // NO SHELL OVERLAY SURVIVES A STEP CHANGE. Every way of landing
  // on a step — nav rows, dashboard tiles, guard bounces, deep
  // links, sign-out — funnels through navigateTo → setStep, so
  // tying the close to `step` itself (rather than trusting each
  // button to remember to close first) is the structural
  // guarantee: whatever path got the user here, arriving on a
  // new step dismisses the menu, the help sheet, the bucket
  // sheet, and the account drawer. Nothing that opens an overlay
  // changes the step as part of opening it, so this never
  // fights a flow that needs an overlay up.
  useEffect(() => {
    setMenuOpen(false);
    setHelpOpen(false);
    setBucketsOpen(false);
    setAccountDrawerOpen(false);
  }, [step]);

  // ESCAPE closes the topmost shell layer — menu, help sheet,
  // bucket sheet. None of them had a keyboard dismissal (the
  // account drawer, which has its own Escape handling, sits
  // above all three: while it's open, this handler stands down
  // and lets the drawer's handler take the key).
  useEffect(() => {
    if (!menuOpen && !helpOpen && !bucketsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || accountDrawerOpen) return;
      if (bucketsOpen) setBucketsOpen(false);
      else if (helpOpen) setHelpOpen(false);
      else if (menuOpen) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, helpOpen, bucketsOpen, accountDrawerOpen]);

  // UNIFIED PROGRESSION STATE — one rule shared with dashboard, navigateTo, URL guard.
  const progress = getProgressState(triageMap, masterList);

  // RANKING PROJECT COMPLETION — drives where the "The Ranking
  // Project" group sits in the menu (see the nav render below).
  // Sorting is complete when every catalog song is categorized —
  // a real bucket OR a "Don't Know It" mark (countCategorizedSongs
  // against the full pool; the same counter behind triage's own
  // "Categorize All Songs (n/206)" completion state). Refinement
  // is complete when a fully ranked master list exists — the
  // hasRefinedMaster rule inside getProgressState, exposed as
  // isMasterUnlocked: the master list is the refine step's
  // finished product, so this means the user finished refining,
  // not merely visited the step.
  const sortingComplete =
    countCategorizedSongs(triageMap) === FULL_SONG_POOL.length;
  const rankingProjectComplete =
    sortingComplete && progress.isMasterUnlocked;

  // NAV ITEM CONFIGURATION
  interface NavItem {
    label: string;
    step: AppStep;
    requiresAuth?: boolean;
    hideIf?: boolean;
    disabled?: boolean;
    /** The unlock condition shown on the row while it is locked
     *  (UAT P-1b) — derived from the same progression guard that
     *  disables the row (getProgressState / resolveGuardedStep),
     *  never invented: Refine's gate is one rated song; My
     *  Rankings' and the Sweater Thread's gate is a refined list,
     *  which Refine produces. */
    unlockHint?: string;
    /** Which menu section carries the row (see the nav render below). */
    group?: 'ranking' | 'fanhood';
  }

  // Array order matters: each section's rows render in the
  // relative order they appear here.
  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      step: 'dashboard',
      group: 'fanhood',
    },
    {
      label: 'How It Works',
      step: 'orientation',
      hideIf: Object.keys(triageMap).length > 0,
      group: 'ranking',
    },
    {
      label: 'Sort',
      step: 'triage',
      group: 'ranking',
    },
    {
      label: 'Refine',
      step: 'rank_buckets',
      disabled: !progress.isRefineUnlocked,
      unlockHint: "Unlocks once you've rated a song",
      group: 'ranking',
    },
    {
      label: 'My Rankings',
      step: 'master',
      disabled: !progress.isMasterUnlocked,
      unlockHint: 'Unlocks after Refine',
      group: 'ranking',
    },
    {
      label: 'Sweater Thread',
      step: 'wrapped',
      disabled: !progress.isWrappedUnlocked,
      unlockHint: 'Unlocks after Refine',
      group: 'fanhood',
    },
    {
      label: 'Global Fan Stats',
      step: 'fan_stats',
      group: 'fanhood',
    },
    {
      label: 'Fan Friends',
      step: 'friends',
      requiresAuth: true,
      group: 'fanhood',
    },
    {
      label: 'Shareables',
      step: 'shareables',
      group: 'fanhood',
    },
    {
      // The lore game (Oct 26 design): locked until the Blue Album
      // and Pinkerton triage sections are both complete — the same
      // section-complete rule the deck milestones use (every song
      // in the section dealt with, bucket or "Don't Know It"). The
      // step itself renders the teaser, and the dashboard card
      // carries the fuller pitch; this row just carries the lock
      // and its reason, like every other locked row.
      label: 'How Rare a Weezer Fan Are You?',
      step: 'lore',
      disabled: !isLoreUnlocked(triageMap),
      unlockHint: 'Unlocks after Blue + Pinkerton',
      group: 'fanhood',
    },
  ];

  // FILTER NAV ITEMS
  const visibleNavItems = navItems.filter((item) => {
    if (item.requiresAuth && !userId) return false;
    if (item.hideIf) return false;
    return true;
  });

  // The two sections' rows, each in their configured relative
  // order. Both sections render identically wherever they sit;
  // only their order in the nav changes (see the nav render).
  const rankingGroupItems = visibleNavItems.filter(
    (item) => item.group === 'ranking'
  );
  const fanhoodGroupItems = visibleNavItems.filter(
    (item) => item.group === 'fanhood'
  );

  const activeFriendsCount = Array.isArray(friendsList) ? friendsList.length : 0;

  // One nav row. Rows share one uniform height (py-4 = 48px at
  // the text-xs line height) and touch — no gap between rows.
  // Inactive rows are inset rounded shapes; the current step is
  // marked by a pale blue tint (#E0F2FE, the app's
  // progress-track blue) with brand-blue text, worn as a
  // full-width square-cornered rectangle in the same shape
  // language as the section header bands: it bleeds edge to
  // edge through the nav's p-2 (-mx-2 out, horizontal padding
  // grown from px-3.5 to px-[22px] so the text does not move).
  // The active branch's w-full is load-bearing: without it the
  // button shrink-wraps to its label and the tint wraps the
  // text instead of spanning the flyout.
  // There are no arrow indicators anywhere in the menu.
  const renderNavButton = (item: NavItem) => {
    const isActive = step === item.step;
    const isDisabled = item.disabled;

    return (
      <button
        key={item.step}
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            closeMenu();
            navigateTo(item.step);
          }
        }}
        className={`flex items-center justify-between py-4 text-xs font-black transition-all ${
          isDisabled
            ? 'w-full px-3.5 rounded-xl opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
            : isActive
            ? 'w-full -mx-2 px-[22px] bg-[#E0F2FE] text-[#0072CE] cursor-pointer'
            : 'w-full px-3.5 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
      >
        <span>{item.label}</span>

        {/* A locked row states its unlock condition (UAT P-1b):
            quiet right-side small text, so the row's uniform
            height is untouched — a greyed row with no reason was
            half of the "stuck" feeling the guard notice (P-1a)
            explains after the fact; this prevents it. */}
        {isDisabled && item.unlockHint && (
          <span className="text-[10px] font-bold text-slate-400 text-right">
            {item.unlockHint}
          </span>
        )}

        {/* Fan Friends carries two counts: the highlighted pill
            is the ACTIVE friends count (friendsList is loaded
            with status='accepted' only); the amber pill keeps
            the pending-requests signal next to it. On the active
            row the count pill goes white — its usual blue-100
            would merge into the row's pale #E0F2FE tint. The
            amber pill contrasts with the tint as-is. */}
        {item.step === 'friends' &&
          (activeFriendsCount > 0 || pendingRequestsCount > 0) && (
            <span className="flex items-center gap-1.5">
              {activeFriendsCount > 0 && (
                <span
                  className={`${
                    isActive ? 'bg-white' : 'bg-blue-100'
                  } text-[#0072CE] border border-blue-200 font-black text-[10px] px-2 py-0.5 rounded-full`}
                >
                  {activeFriendsCount}
                </span>
              )}
              {pendingRequestsCount > 0 && (
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                  {pendingRequestsCount}
                </span>
              )}
            </span>
          )}
      </button>
    );
  };

  // Menu sections — flat groups under full-size headers, each
  // header carried in a full-width background band, no boxes.
  // The header matches the guest card's headline in size
  // and weight (text-xs font-black — "Why Bother creating an
  // account?" carries text-xs font-black text-amber-950; here
  // the ink is slate-900, the drawer's heading color). "The
  // Ranking Project" holds the sorting flow (How It Works, Sort,
  // Refine, My Rankings); "My Fanhood Unraveled" holds the fan
  // destinations (Dashboard, Sweater Thread, Global Fan Stats,
  // Fan Friends, Shareables). A section renders identically
  // wherever it sits; only the sections' order changes: the
  // Ranking Project leads while sorting or refinement is
  // unfinished and drops below My Fanhood Unraveled once both
  // are complete.
  const renderNavSection = (title: string, items: NavItem[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mt-6 first:mt-0">
        {/* The header sits IN a full-width band: a quiet
            bg-slate-200 strip that bleeds edge to edge through
            the nav's p-2 (-mx-2 out, px-2 back in, so the header
            text keeps its px-3.5 alignment with the rows). The
            band's edge is the section delineation — it replaced
            the separator hairlines that used to precede each
            header. Spacing: mt-6 on the section wrapper is the
            air ABOVE the band (the largest gap in the nav; the
            first section needs none — the panel above it carries
            its own margin and the nav's p-2 tops it). Inside the
            band the text gets py-2; below the band, the first
            row's own py-4 is all that separates the header text
            from the first row's text — still the tightest gap.
            Rows inside carry no gap at all (see
            renderNavButton). */}
        <div className="-mx-2 bg-slate-200 px-2">
          <p className="px-3.5 py-2 text-xs font-black text-slate-900">
            {title}
          </p>
        </div>
        <div>{items.map((item) => renderNavButton(item))}</div>
      </div>
    );
  };

  const orderedSections = (
    rankingProjectComplete
      ? [
          { title: 'My Fanhood Unraveled', items: fanhoodGroupItems },
          { title: 'The Ranking Project', items: rankingGroupItems },
        ]
      : [
          { title: 'The Ranking Project', items: rankingGroupItems },
          { title: 'My Fanhood Unraveled', items: fanhoodGroupItems },
        ]
  ).filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col selection:bg-amber-300 selection:text-slate-950">
      {/* WEEZER BLUE TOP HEADER (SCALED UP FOR DESKTOP) */}
      <header className="bg-[#0072CE] border-b border-blue-600 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 lg:h-16 flex items-center justify-between">
          <button
            onClick={() => navigateTo(userId ? 'dashboard' : 'splash')}
            className="flex items-center gap-2.5 lg:gap-3 text-left cursor-pointer group"
          >
            <div className="w-8 h-8 lg:w-9 lg:h-9 bg-white text-[#0072CE] rounded-xl flex items-center justify-center shadow-xs group-hover:bg-blue-50 transition-colors">
              <FlyingWIcon className="w-5 h-5 lg:w-6 lg:h-6 text-[#0072CE]" />
            </div>
            <div>
              <span className="text-sm lg:text-base font-black tracking-tight text-white block leading-none">
                All My Favorite Songs
              </span>
              <span className="text-[9px] lg:text-[10px] font-bold text-blue-100 uppercase tracking-widest block mt-0.5">
                The Weezer Song Ranking Project
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2 lg:gap-3">
            {userId && pendingRequestsCount > 0 && (
              <button
                onClick={() => navigateTo('friends')}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              >
                <span>👥</span>
                <span>{pendingRequestsCount}</span>
              </button>
            )}

            {userId && (
              <button
                onClick={openAccountDrawer}
                aria-label="Account & Profile"
                title="Account & Profile"
                className="w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl bg-white text-[#0072CE] font-black text-sm shadow-xs hover:bg-blue-50 transition-colors cursor-pointer"
              >
                {userProfile?.displayName
                  ? userProfile.displayName.charAt(0).toUpperCase()
                  : userProfile?.username
                    ? userProfile.username.charAt(0).toUpperCase()
                    : '👤'}
              </button>
            )}

            <button
              onClick={() => setMenuOpen(true)}
              className="w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <svg
                className="w-5 h-5 lg:w-6 lg:h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main
        className={
          fullBleed
            ? 'flex flex-1 w-full flex-col transition-all duration-300'
            : `flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 transition-all duration-300 ${
                fullWidth ? 'max-w-7xl' : 'max-w-5xl lg:max-w-6xl'
              }`
        }
      >
        {children}
      </main>

      {/* GLOBAL VISIBLE PAGE FOOTER */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 bg-[#0072CE] text-white rounded-md flex items-center justify-center">
              <FlyingWIcon className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] font-black text-slate-900 tracking-tight whitespace-nowrap">
              All My Favorite Songs • The Weezer Song Ranking Project
            </span>
          </div>

          <p className="text-[10px] font-medium text-slate-400 max-w-xl mx-auto leading-relaxed">
            Fan site. Not affiliated with Weezer. ·{' '}
            <Link href="/terms" className="font-bold text-slate-500 hover:text-[#0072CE] underline underline-offset-2">
              Terms of Use
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="font-bold text-slate-500 hover:text-[#0072CE] underline underline-offset-2">
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>

      {/* SLIDE-OVER DRAWER */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div
            onClick={closeMenu}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-y-auto z-10 animate-in slide-in-from-right duration-300">
            <div>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#0072CE] text-white rounded-lg flex items-center justify-center">
                    <FlyingWIcon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Menu
                  </span>
                </div>

                <button
                  onClick={closeMenu}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close Menu"
                >
                  ✕
                </button>
              </div>

              {userId && (
                <>
                  <div className="mx-4 mt-4 px-1 py-1 flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#0072CE] block">
                        My Name Is...
                      </span>
                      <h3 className="text-xl font-black text-slate-950 truncate mt-1">
                        {userProfile?.displayName ||
                          `@${userProfile?.username}` ||
                          'Weezer Fan'}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        closeMenu();
                        handleSignOut();
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-3 shrink-0"
                    >
                      Sign Out
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      closeMenu();
                      openAccountDrawer();
                    }}
                    className="mx-4 mt-1 mb-1 w-[calc(100%-2rem)] flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <span aria-hidden="true">👤</span>
                    <span>Account & Profile</span>
                  </button>

                  <div className="mx-4 my-3 p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          closeMenu();
                          navigateTo('friends');
                        }}
                        className="text-xs font-black text-[#0072CE] hover:underline cursor-pointer"
                      >
                        Fan Friends
                      </button>

                      <button
                        onClick={() => {
                          closeMenu();
                          navigateTo('friends');
                        }}
                        className="bg-blue-100 hover:bg-blue-200 text-[#0072CE] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                      >
                        {activeFriendsCount} {activeFriendsCount === 1 ? 'Friend' : 'Friends'}
                      </button>
                    </div>

                    {pendingRequestsCount > 0 && (
                      <button
                        onClick={() => {
                          closeMenu();
                          navigateTo('friends');
                        }}
                        className="w-full bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between transition-colors cursor-pointer text-left mt-1"
                      >
                        <span className="text-[11px] font-black">
                          {pendingRequestsCount} Pending Invite{pendingRequestsCount > 1 ? 's' : ''}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      </button>
                    )}
                  </div>
                </>
              )}

              {!userId && (
                <div className="mx-4 my-3 p-4 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-amber-950">
                      Why Bother creating an account?
                    </h4>
                    <p className="text-[11px] font-medium text-amber-800 leading-snug">
                      Guest rankings are only saved temporarily. Create an
                      account now to save your work.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <button
                      onClick={() => {
                        closeMenu();
                        navigateTo('login', 'signup');
                      }}
                      className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-xs cursor-pointer text-center"
                    >
                      Create An Account
                    </button>

                    <button
                      onClick={() => {
                        closeMenu();
                        navigateTo('login', 'login');
                      }}
                      className="w-full text-center text-[11px] font-bold text-amber-900 hover:underline cursor-pointer py-1"
                    >
                      Already have an account? Sign In
                    </button>
                  </div>
                </div>
              )}

              {/* NAV — flat sections, each headed by a full-width
                  header band (see renderNavSection): the band
                  delineates the sections, so no separator rules
                  precede the headers — the one rule left in this
                  column is above the Help row. While the Ranking
                  Project is unfinished (sorting or refinement
                  incomplete) it leads, right under the panel; once
                  both are complete it drops below My Fanhood
                  Unraveled. Help stays last in both states. */}
              <nav className="p-2">
                {orderedSections.map((section) => (
                  <React.Fragment key={section.title}>
                    {renderNavSection(section.title, section.items)}
                  </React.Fragment>
                ))}
              </nav>

              {/* HELP — utility row under the nav list (site-wide
                  home for help; the triage step also carries its
                  own in-body help button). Closes the menu and
                  opens the same help sheet. */}
              <div className="p-2 pt-0">
                <div className="border-t border-slate-200 mb-1" />
                <button
                  onClick={() => {
                    closeMenu();
                    setHelpOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <span className="w-5 h-5 shrink-0 rounded-full bg-[#0072CE] text-white flex items-center justify-center text-[11px] font-black leading-none">
                    ?
                  </span>
                  <span>Help</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP MENU — opened by the menu's Help item and by the
          triage step's help buttons (via the 'weezer:open-help'
          window event; see the listener above) */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={closeHelp}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#0072CE] text-white rounded-lg flex items-center justify-center">
                  <FlyingWIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Help
                </span>
              </div>

              <button
                onClick={closeHelp}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close Help"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={replayTutorial}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-colors cursor-pointer"
              >
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    Replay the deck tutorial
                  </span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">
                    The eight-step tour of the deck, one more time.
                  </span>
                </span>
                <span className="text-[#0072CE] font-black text-sm">→</span>
              </button>

              <button
                onClick={() => {
                  setHelpOpen(false);
                  setBucketsOpen(true);
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-colors cursor-pointer"
              >
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    Bucket definitions
                  </span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">
                    What Banger, Slaps, Mid, Skip and Trash mean.
                  </span>
                </span>
                <span className="text-[#0072CE] font-black text-sm">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUCKET DEFINITIONS — the BucketGuide card in a sheet.
          The panel caps its own height in dvh and scrolls
          internally, so it can't become an iOS scroll trap. */}
      {bucketsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={closeBuckets}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 z-10">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 sm:px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                The buckets
              </span>

              <button
                onClick={closeBuckets}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close Bucket Definitions"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5">
              <BucketGuide />
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT & PROFILE DRAWER */}
      <WeezerAccountDrawer
        isOpen={accountDrawerOpen}
        onClose={closeAccountDrawer}
        userId={userId}
        userProfile={userProfile}
        onLogout={handleSignOut}
        onOpenOnboarding={() => navigateTo('login', 'signup')}
      />
    </div>
  );
}
