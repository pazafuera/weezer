'use client';

const COUNTRY_OPTIONS = [
  // Featured / Top Western Markets
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DIVIDER', name: '------------------------' },
  // Full Alphabetical World List
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KR', name: 'Korea (South)' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase';

interface WeezerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: {
    username: string;
    displayName: string;
    birthYear?: number;
    location?: string;
  }) => void;
  currentUserId?: string | null;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export default function WeezerOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
  currentUserId,
}: WeezerOnboardingModalProps) {
  // Auth Mode: 'magic' | 'password'
  const [authMethod, setAuthMethod] = useState<'magic' | 'password'>('password');
  const [stepIndex, setStepIndex] = useState<1 | 2>(currentUserId ? 2 : 1);

  // Auth Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  // Profile Credentials
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [country, setCountry] = useState('US');
  const [stateCode, setStateCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Step 1: Magic Link Flow
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined' ? window.location.href : undefined,
        },
      });

      if (error) throw error;
      setMagicSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send login link.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1 -> Step 2 Validation for Full Password Signup
  const handleProceedToProfileStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setStepIndex(2);
  };

  // Step 2: Final Submission (Auth Creation + Profile Creation in One Flow)
  const handleCompleteSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if username is already taken via the is_username_available()
      // SECURITY DEFINER function instead of selecting other users' profile
      // rows directly (blocked by RLS). Returns true when available.
      const { data: isAvailable } = await supabase.rpc(
        'is_username_available',
        { p_username: cleanUsername }
      );

      if (isAvailable === false) {
        setErrorMsg('That username is taken. Please pick another.');
        setLoading(false);
        return;
      }

      let activeUserId = currentUserId;

      // 2. If user isn't authenticated yet, perform standard SignUp
      if (!activeUserId) {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authErr) throw authErr;
        activeUserId = authData.user?.id || null;
      }

      if (!activeUserId) {
        throw new Error('Could not establish user session.');
      }

      // 3. Upsert Profile Details immediately
      const locationStr =
        country === 'US' && stateCode ? `${stateCode}, USA` : country;

      const updates = {
        id: activeUserId,
        username: cleanUsername,
        display_name: displayName.trim() || cleanUsername,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        country_code: country,
        state_code: country === 'US' ? stateCode : null,
        updated_at: new Date().toISOString(),
      };

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(updates);
      if (profileErr) throw profileErr;

      onSuccess({
        username: cleanUsername,
        displayName: displayName.trim() || cleanUsername,
        birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
        location: locationStr,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete signup.');
    } finally {
      setLoading(false);
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

        {/* STEP 1: AUTHENTICATION SELECTION */}
        {stepIndex === 1 && !currentUserId && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <span className="text-2xl block mb-1">🧵</span>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">
                Create Your Account
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Save your rankings, claim your handle, and compare with friends.
              </p>
            </div>

            {/* METHOD TOGGLE BUTTONS */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('password');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  authMethod === 'password'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Password Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('magic');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  authMethod === 'magic'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Magic Link
              </button>
            </div>

            {authMethod === 'magic' ? (
              magicSent ? (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-800 text-xs font-bold leading-relaxed text-center">
                  Check your inbox! We sent a magic login link to{' '}
                  <strong>{email}</strong>.
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3">
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                    />
                  </div>

                  {errorMsg && (
                    <p className="text-xs font-bold text-rose-500 bg-rose-50 p-2.5 rounded-lg text-center border border-rose-100">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {loading ? 'Sending...' : 'Send Magic Link →'}
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleProceedToProfileStep} className="space-y-3">
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 p-2.5 rounded-lg text-center border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer text-sm"
                >
                  Continue to Profile →
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: UNIFIED PROFILE CREATION */}
        {(stepIndex === 2 || currentUserId) && (
          <div className="space-y-5">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">
                Step 2 of 2
              </span>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">
                Complete Your Profile
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Pick your unique handle and display name for friend matchups.
              </p>
            </div>

            <form onSubmit={handleCompleteSignUp} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Unique Username (Handle) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                    @
                  </span>
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
                    First Name + Last Initial Suggested
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
                  Optional Demographics (For Fan Stats)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      Birth Year
                    </label>
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
  <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">
    Country
  </label>
  <select
    value={country}
    onChange={(e) => setCountry(e.target.value)}
    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-xs"
  >
    {COUNTRY_OPTIONS.map((c) =>
      c.code === 'DIVIDER' ? (
        <option key={c.code} disabled className="text-slate-400">
          {c.name}
        </option>
      ) : (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      )
    )}
  </select>
</div>
                </div>

                {country === 'US' && (
                  <div className="mt-3">
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                      State
                    </label>
                    <select
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                    >
                      <option value="">Select State...</option>
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
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

              <div className="flex gap-2 pt-2">
                {!currentUserId && (
                  <button
                    type="button"
                    onClick={() => setStepIndex(1)}
                    className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3.5 rounded-xl transition-all cursor-pointer text-xs"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#0072CE] hover:bg-blue-600 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-xs"
                >
                  {loading ? 'Creating Account...' : 'Finish & Launch 🚀'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


