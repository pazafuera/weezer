'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase';

interface WeezerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: { username: string; displayName: string; birthYear?: number; location?: string }) => void;
  currentUserId?: string | null;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function WeezerOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
  currentUserId,
}: WeezerOnboardingModalProps) {
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  // Profile Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [country, setCountry] = useState('US');
  const [stateCode, setStateCode] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
      });

      if (error) throw error;
      setMagicSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send login link.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long (letters, numbers, underscores).');
      return;
    }

    setSaving(true);

    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', currentUserId || '')
        .maybeSingle();

      if (existingUser) {
        setErrorMsg('That username is already taken. Please pick another.');
        setSaving(false);
        return;
      }

      const updates = {
        id: currentUserId,
        username: cleanUsername,
        display_name: displayName.trim() || cleanUsername,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        country_code: country,
        state_code: country === 'US' ? stateCode : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      const locationStr = country === 'US' && stateCode ? `${stateCode}, USA` : country;

      onSuccess({
        username: cleanUsername,
        displayName: displayName.trim() || cleanUsername,
        birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
        location: locationStr,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
        >
          ✕
        </button>

        {!currentUserId ? (
          <div className="space-y-5 text-center">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto text-xl">
              🧵
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">Save Your Sweater Thread</h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Claim your custom handle and compare stats with friends.
              </p>
            </div>

            {magicSent ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-800 text-xs font-bold leading-relaxed">
                Check your email! We sent a magic login link to <strong>{email}</strong>. Click it to verify and continue.
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3 text-left">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rivers@weezer.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 p-2.5 rounded-lg text-center border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? 'Sending Link...' : 'Send Magic Login Link →'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">Profile Setup</span>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">Claim Your Handle</h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Customize how your rankings appear in friend matchups and global stats.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Unique Username (Handle) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">@</span>
                  <input
                    type="text"
                    required
                    placeholder="rivers_cuomo"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Display Name
                  </label>
                  <span className="text-[9px] font-bold text-slate-400">
                    First Name + Last Initial
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Rivers C."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Optional Demographics (For Community Stats)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Birth Year</label>
                    <input
                      type="number"
                      placeholder="1994"
                      min="1930"
                      max={new Date().getFullYear()}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Country</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="UK">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                {country === 'US' && (
                  <div className="mt-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">State</label>
                    <select
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                    >
                      <option value="">Select State...</option>
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-rose-500 bg-rose-50 p-2.5 rounded-lg text-center border border-rose-100">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer mt-2"
              >
                {saving ? 'Saving Profile...' : 'Complete & Save ✨'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}