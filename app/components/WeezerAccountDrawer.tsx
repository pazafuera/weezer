'use client';



import React, { useState } from 'react';

interface WeezerAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: {
    username?: string;
    displayName?: string;
    birthYear?: number;
    location?: string;
  } | null;
  onLogout: () => void;
  onOpenOnboarding: () => void;
}

export default function WeezerAccountDrawer({
  isOpen,
  onClose,
  userProfile,
  onLogout,
  onOpenOnboarding,
}: WeezerAccountDrawerProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const publicUrl = userProfile?.username
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/u/${userProfile.username}`
    : null;

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* BACKGROUND TAP TO CLOSE */}
      <div className="flex-1" onClick={onClose} />

      {/* DRAWER CONTAINER */}
      <div className="w-full max-w-sm bg-white h-full shadow-2xl border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        <div>
          {/* HEADER */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <h2 className="text-xl font-black text-slate-950 tracking-tight">
              Account & Profile
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* USER LOGGED IN */}
          {userProfile?.username ? (
            <div className="py-6 space-y-6">
              {/* PROFILE BADGE */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-[#0072CE] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md shrink-0">
                  {userProfile.displayName
                    ? userProfile.displayName.charAt(0).toUpperCase()
                    : 'W'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {userProfile.displayName}
                  </h3>
                  <p className="text-xs font-bold text-[#0072CE]">
                    @{userProfile.username}
                  </p>
                </div>
              </div>

              {/* PUBLIC LINK MODULE */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Your Public Profile Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl || ''}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-[#0072CE] hover:bg-blue-600 text-white text-xs font-black px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    {copiedLink ? 'Copied! ✓' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* DEMOGRAPHICS DISPLAY */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Demographics
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">
                      Birth Year
                    </span>
                    <span>{userProfile.birthYear || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">
                      Location
                    </span>
                    <span>{userProfile.location || 'Not set'}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenOnboarding();
                  }}
                  className="text-xs font-black text-[#0072CE] hover:underline pt-1 block cursor-pointer"
                >
                  Edit Profile Info →
                </button>
              </div>
            </div>
          ) : (
            /* USER LOGGED OUT / GUEST */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-[#0072CE] rounded-2xl flex items-center justify-center font-black text-2xl mx-auto border border-blue-100">
                👤
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Guest Mode
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Your song rankings are currently stored locally in your browser.
                  Claim your handle to save your Sweater Thread and compare rankings
                  with friends.
                </p>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenOnboarding();
                }}
                className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                Sign In / Save Sweater Thread 🧵
              </button>
            </div>
          )}
        </div>

        {/* FOOTER / LOGOUT */}
        {userProfile?.username && (
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-3 rounded-xl transition-colors text-xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}