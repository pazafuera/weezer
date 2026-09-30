'use client';

import React, { useState } from 'react';
import { useWeezer } from '../context/WeezerContext';
import WeezerAccountDrawer from './WeezerAccountDrawer';
import WeezerOnboardingModal from './WeezerOnboardingModal';
import { FlyingWIcon } from './SharedUI';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    step,
    userId,
    userProfile,
    setUserProfile,
    navigateTo,
    handleSignOut,
    handleMagicFill,
    triageMap,
    masterList,
    syncRankingsToDatabase,
  } = useWeezer();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const hasProgress = Object.keys(triageMap).length > 0;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-950">
      <div>
        {/* UNIVERSAL HEADER */}
        {step !== 'splash' && (
          <header className="bg-[#0072CE] sticky top-0 z-40 shadow-md">
            <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
              {/* BRANDING + FLYING W ICON BUTTON */}
              <button
                onClick={() => navigateTo(hasProgress ? 'dashboard' : 'splash')}
                className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
                aria-label="Go to Dashboard or Splash"
              >
                {/* Translucent Badge with White Flying W */}
                <div className="w-9 h-9 bg-white/10 group-hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center text-white transition-all shrink-0">
                  <FlyingWIcon className="w-6 h-6 text-white drop-shadow-sm" />
                </div>

                <div className="flex flex-col">
                  <h1 className="font-black tracking-tight text-white text-lg sm:text-xl leading-none group-hover:text-blue-100 transition-colors">
                    All My Favorite Songs
                  </h1>
                  <span className="text-[9px] sm:text-[10px] font-bold text-blue-200/90 uppercase tracking-widest mt-0.5">
                    The Weezer Song Ranking Project
                  </span>
                </div>
              </button>

              {/* HAMBURGER MENU BUTTON */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMenuOpen(true)}
                  className="p-2 -mr-2 text-white hover:text-amber-300 transition-colors cursor-pointer"
                  aria-label="Open Menu"
                >
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* ACCOUNT DRAWER & ONBOARDING MODAL */}
        <WeezerAccountDrawer
          isOpen={isAccountDrawerOpen}
          onClose={() => setIsAccountDrawerOpen(false)}
          userProfile={userProfile || undefined}
          onLogout={handleSignOut}
          onOpenOnboarding={() => setIsOnboardingModalOpen(true)}
        />

        <WeezerOnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
          currentUserId={userId}
          onSuccess={(newProfile) => {
            setUserProfile(newProfile);
            syncRankingsToDatabase(triageMap, masterList);
          }}
        />

        {/* FLYOUT HAMBURGER MENU */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsMenuOpen(false)}
            />

            <div className="w-64 sm:w-80 bg-white h-full relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="font-black text-slate-900 tracking-tight uppercase text-xs">
                  Menu
                </span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* ACCOUNT CARD AT TOP OF MENU */}
              <div className="p-4 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  {userId ? (
                    userProfile?.username ? (
                      <>
                        <div className="text-xs font-black text-slate-900 truncate">
                          {userProfile.displayName ||
                            `@${userProfile.username}`}
                        </div>
                        <div className="text-[10px] font-extrabold text-[#0072CE]">
                          @{userProfile.username}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-black text-slate-900">
                          Profile Not Set Up
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500">
                          Claim your username
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <div className="text-xs font-black text-slate-900">
                        Guest Mode
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        Unsaved local rankings
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (userProfile?.username) setIsAccountDrawerOpen(true);
                    else setIsOnboardingModalOpen(true);
                  }}
                  className="bg-[#0072CE] hover:bg-blue-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  {userProfile?.username
                    ? 'Manage'
                    : userId
                    ? 'Setup Profile'
                    : 'Sign In'}
                </button>
              </div>

              {/* NAVIGATION LINKS */}
              <nav className="flex-1 overflow-y-auto py-2">
                {[
                  'dashboard',
                  'triage',
                  'rank_buckets',
                  'master',
                  'wrapped',
                  'fan_stats',
                  'friends',
                ].map((targetStep) => {
                  const labels: Record<string, string> = {
                    dashboard: 'Command Center 🏠',
                    triage: 'The Gut Check',
                    rank_buckets: 'Refine Buckets',
                    master: 'Final Rankings',
                    wrapped: 'Sweater Thread',
                    fan_stats: 'Fan Stats 🌐',
                    friends: 'Friends & Matchups 🤝',
                  };
                  return (
                    <button
                      key={targetStep}
                      onClick={() => {
                        navigateTo(targetStep as any);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 font-extrabold text-sm border-b border-slate-50 transition cursor-pointer ${
                        step === targetStep
                          ? 'bg-blue-50 text-[#0072CE]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {labels[targetStep]}
                    </button>
                  );
                })}
              </nav>

              {/* DEV TOOLS & SIGN OUT */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                <button
                  onClick={() => {
                    handleMagicFill();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-xs font-black px-4 py-3 rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 transition cursor-pointer text-center"
                >
                  🧪 Dev: Magic Fill
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full text-xs font-black px-4 py-3 rounded-xl text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer text-center"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main
          className={step === 'splash' ? '' : 'max-w-3xl mx-auto px-4 mt-6'}
        >
          {children}
        </main>
      </div>

      {/* UNIVERSAL FOOTER */}
      <footer className="mt-16 border-t border-slate-100 bg-slate-50 py-8 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            All My Favorite Songs • The Weezer Ranking Project
          </p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            This is an independent, non-commercial fan project created for the
            Weezer fan community. It is not affiliated with, endorsed by, or
            connected to Weezer, Rivers Cuomo, Geffen Records, Atlantic Records,
            or Crush Music. All song titles, lyrics, and album artwork remain
            the property of their respective trademark and copyright holders.
          </p>
        </div>
      </footer>
    </div>
  );
}
