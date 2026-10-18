'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWeezer, AppStep, getProgressState, countCategorizedSongs } from '../context/WeezerContext';
import { FULL_SONG_POOL } from '../data/constants';
import { FlyingWIcon } from './SharedUI';
import WeezerAccountDrawer from './WeezerAccountDrawer';
import BucketGuide from './BucketGuide';

export default function AppShell({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
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
    navigateTo('triage');
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

  // REFRESH FRIENDS DATA INSTANTLY WHEN MENU OPENS
  useEffect(() => {
    if (menuOpen && userId && refreshFriends) {
      refreshFriends();
    }
  }, [menuOpen, userId, refreshFriends]);

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
    /** 'ranking' puts the row in the "The Ranking Project" group (below). */
    group?: 'ranking';
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      step: 'dashboard',
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
      group: 'ranking',
    },
    {
      label: 'My Rankings',
      step: 'master',
      disabled: !progress.isMasterUnlocked,
      group: 'ranking',
    },
    {
      label: 'My Sweater Thread',
      step: 'wrapped',
      disabled: !progress.isWrappedUnlocked,
    },
    {
      label: 'Global Fan Stats',
      step: 'fan_stats',
    },
    {
      label: 'Shareables',
      step: 'shareables',
    },
    {
      label: 'Compare with Friends',
      step: 'friends',
      requiresAuth: true,
    },
  ];

  // FILTER NAV ITEMS
  const visibleNavItems = navItems.filter((item) => {
    if (item.requiresAuth && !userId) return false;
    if (item.hideIf) return false;
    return true;
  });

  // The Ranking Project group rows and the loose rows, each in
  // their configured relative order. The group is rendered as
  // one block (below) and placed by completion state; the loose
  // list is the same in both states.
  const rankingGroupItems = visibleNavItems.filter(
    (item) => item.group === 'ranking'
  );
  const looseNavItems = visibleNavItems.filter(
    (item) => item.group !== 'ranking'
  );

  const activeFriendsCount = Array.isArray(friendsList) ? friendsList.length : 0;

  // One nav row. The current step is marked by the filled blue
  // pill — there are no arrow indicators anywhere in the menu.
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
        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-black transition-all ${
          isDisabled
            ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
            : isActive
            ? 'bg-[#0072CE] text-white shadow-xs cursor-pointer'
            : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
      >
        <span>{item.label}</span>

        {item.step === 'friends' && pendingRequestsCount > 0 && (
          <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
            {pendingRequestsCount}
          </span>
        )}
      </button>
    );
  };

  // "The Ranking Project" group — How It Works, Sort, Refine and
  // My Rankings in one bordered block under a sentence-case
  // eyebrow. The block renders identically wherever it sits;
  // only its position in the nav changes (see the nav render):
  // at the top while sorting or refinement is unfinished, below
  // the loose items once both are complete.
  const renderRankingGroup = () => {
    if (rankingGroupItems.length === 0) return null;

    return (
      <div
        key="ranking-project-group"
        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 space-y-1"
      >
        <p className="px-2 pt-1 text-[9px] font-black tracking-widest text-slate-400">
          The Ranking Project
        </p>
        {rankingGroupItems.map((groupItem) => renderNavButton(groupItem))}
      </div>
    );
  };

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
        className={`flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 transition-all duration-300 ${
          fullWidth ? 'max-w-7xl' : 'max-w-5xl lg:max-w-6xl'
        }`}
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
            <span className="text-xs font-black text-slate-900 tracking-tight">
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

              {/* NAV — while the Ranking Project is unfinished
                  (sorting or refinement incomplete) its group
                  leads the nav, right under the guest card /
                  account panel; once both are complete the same
                  group drops below the loose items. The Help row
                  under the nav stays last in both states. */}
              <nav className="p-2 space-y-1">
                {!rankingProjectComplete && renderRankingGroup()}
                {looseNavItems.map((item) => renderNavButton(item))}
                {rankingProjectComplete && renderRankingGroup()}
              </nav>

              {/* HELP — utility row under the nav list (site-wide
                  home for help; the triage step also carries its
                  own in-body help button). Closes the menu and
                  opens the same help sheet. */}
              <div className="p-2 pt-0">
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
                    The five-step tour of the deck, one more time.
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
