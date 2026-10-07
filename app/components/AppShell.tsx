'use client';

import React, { useState, useEffect } from 'react';
import { useWeezer, AppStep } from '../context/WeezerContext';
import { FlyingWIcon } from './SharedUI';

export default function AppShell({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasViewedWrapped, setHasViewedWrapped] = useState(false);

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

  // REFRESH FRIENDS DATA INSTANTLY WHEN MENU OPENS
  useEffect(() => {
    if (menuOpen && userId && refreshFriends) {
      refreshFriends();
    }
  }, [menuOpen, userId, refreshFriends]);

  // TRACK IF USER HAS VIEWED SWEATER THREAD (WRAPPED)
  useEffect(() => {
    if (step === 'wrapped') {
      setHasViewedWrapped(true);
      try {
        localStorage.setItem('weezer_viewed_wrapped', 'true');
      } catch (e) {
        // Fallback for private browsing storage restrictions
      }
    } else if (
      typeof window !== 'undefined' &&
      localStorage.getItem('weezer_viewed_wrapped') === 'true'
    ) {
      setHasViewedWrapped(true);
    }
  }, [step]);

  // PROGRESS COMPLETION CHECKS
  const isGutCheckDone = Boolean(triageMap && Object.keys(triageMap).length > 0);
  const isRankOrderDone = Boolean(masterList && masterList.length > 0);
  const hasNavigatedToRankings = isRankOrderDone;

  // CALCULATE WHICH STEP GETS THE NEXT-STEP ARROW (→)
  let nextStepKey: AppStep | null = null;
  if (!isGutCheckDone) {
    nextStepKey = 'triage';
  } else if (isGutCheckDone && !isRankOrderDone) {
    nextStepKey = 'rank_buckets';
  } else if (isGutCheckDone && isRankOrderDone && !hasViewedWrapped) {
    nextStepKey = 'wrapped';
  } else if (hasViewedWrapped) {
    nextStepKey = 'fan_stats';
  }

  // NAV ITEM CONFIGURATION
  interface NavItem {
    label: string;
    step: AppStep;
    requiresAuth?: boolean;
    hideIf?: boolean;
    disabled?: boolean;
  }

  const navItems: NavItem[] = [
    {
      label: 'In The Garage',
      step: 'dashboard',
      requiresAuth: true,
    },
    {
      label: 'How It Works',
      step: 'orientation',
      hideIf: isGutCheckDone,
    },
    {
      label: 'Gut Check',
      step: 'triage',
    },
    {
      label: 'Rank Order',
      step: 'rank_buckets',
      disabled: !isGutCheckDone,
    },
    {
      label: 'My Rankings',
      step: 'master',
      disabled: !isRankOrderDone,
    },
    {
      label: 'My Sweater Thread',
      step: 'wrapped',
      disabled: !hasNavigatedToRankings,
    },
    {
      label: 'Global Rankings',
      step: 'fan_stats',
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

  const activeFriendsCount = Array.isArray(friendsList) ? friendsList.length : 0;

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
                Weezer Canon Ranker
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
              All My Favorite Songs • Weezer Canon Ranker
            </span>
          </div>

          <p className="text-[10px] font-medium text-slate-400 max-w-xl mx-auto leading-relaxed">
            This is an unofficial, non-commercial fan application. It is not affiliated with, endorsed by, sponsored by, or associated with Weezer, Crush Music, Atlantic Records, or Geffen Records. All song titles, album artwork, and trademarks belong to their respective owners.
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

          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-right duration-300">
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
                          {pendingRequestsCount} Pending Invite{pendingRequestsCount > 1 ? 's' : ''} →
                        </span>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      </button>
                    )}
                  </div>
                </>
              )}

              {!userId && (
                <div className="mx-4 my-3 p-4 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-start">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200/70 text-amber-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      Guest Mode
                    </span>
                  </div>

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
                      Create Free Account to Backup 🚀
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

              <nav className="p-2 space-y-1">
                {visibleNavItems.map((item) => {
                  const isActive = step === item.step;
                  const isDisabled = item.disabled;
                  const isNextStep = nextStepKey === item.step;

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
                      <div className="flex items-center gap-2">
                        {isNextStep && (
                          <span
                            className={
                              isActive
                                ? 'text-white font-black text-sm'
                                : 'text-[#0072CE] font-black text-sm animate-pulse'
                            }
                          >
                            →
                          </span>
                        )}
                        <span>{item.label}</span>
                      </div>

                      {item.step === 'friends' && pendingRequestsCount > 0 && (
                        <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-300">
                All My Favorite Songs • 2026 Canon
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}