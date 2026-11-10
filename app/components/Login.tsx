'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { FlyingWIcon } from '@/app/components/SharedUI';
import { displayFont } from './shareables/fonts';
import { useWeezer } from '../context/WeezerContext';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

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

export default function Login() {
  const router = useRouter();
  const {
    navigateTo,
    initialAuthMode,
    closeLogin,
    setAccountCreated,
    userId,
    isShell,
    userProfile,
    handleSignOut,
  } = useWeezer();

  // Auth Credentials State synced with context initialAuthMode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'login' | 'magic'>(
    initialAuthMode || 'signup'
  );

  useEffect(() => {
    if (initialAuthMode) {
      setAuthMode(initialAuthMode);
    }
  }, [initialAuthMode]);

  // Reset signup-only fields (and any leftover message) whenever the user
  // enters signup mode, so a fresh signup form is unmistakably blank.
  // Keyed on [authMode] only: runs on mode-enter, never while typing.
  useEffect(() => {
    if (authMode === 'signup') {
      setUsername('');
      setDisplayName('');
      setBirthYear('');
      setCountry('US');
      setStateCode('');
      setMessage(null);
    }
  }, [authMode]);

  // Unified Profile State for Sign-up
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [country, setCountry] = useState('US');
  const [stateCode, setStateCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Password reset (UAT P-4): the same Supabase reset flow the
  // account drawer uses, surfaced here for users who are locked
  // OUT — the drawer copy is unreachable until you can sign in.
  const [resetSending, setResetSending] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({
        type: 'error',
        text: 'Enter your email address above first — the reset link goes there.',
      });
      return;
    }
    setResetSending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) throw error;
      // Neutral confirmation — does not reveal whether an account
      // exists for the email (same wording policy as the drawer).
      setMessage({
        type: 'success',
        text: 'If an account exists for that email, a password reset link is on its way. Check your inbox.',
      });
    } catch (error: unknown) {
      const err = error as { error_description?: string; message?: string } | null;
      setMessage({
        type: 'error',
        text: err?.error_description || err?.message || 'Could not send the reset email.',
      });
    } finally {
      setResetSending(false);
    }
  };

  // Already signed in? This component used to check the session
  // itself on mount and silently bounce to the dashboard when it
  // found one — a signed-in user who tapped Sign In (the splash
  // offered it unconditionally; a session could also revive under
  // a guest paint) landed on the dashboard with no explanation
  // and no way to stay. That bounce is GONE (Nov 7, 2026): the
  // render below keys off the context's settled auth state and
  // shows an honest already-signed-in card instead — the form
  // only ever renders for a genuinely signed-out visitor.

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (authMode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Check your email for your magic login link!',
        });
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Replace the login entry: Back after signing in never
        // lands on the login screen.
        navigateTo('dashboard', undefined, { history: 'replace' });
      } else if (authMode === 'signup') {
        // Validate Username
        const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
        if (cleanUsername.length < 3) {
          throw new Error('Username must be at least 3 characters long.');
        }

        // Check if handle is already taken
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (existingUser) {
          throw new Error('That username is already taken. Please pick another.');
        }

        // Register Auth User with Metadata for Database Trigger
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: cleanUsername,
              display_name: displayName.trim() || cleanUsername,
              birth_year: birthYear ? parseInt(birthYear, 10) : null,
              country: country,
              state: country === 'US' ? stateCode : null,
            },
          },
        });

        if (authErr) throw authErr;

        // Route immediately upon account creation: land on the
        // orientation page under an "account created" banner (the
        // accountCreated flag) instead of the old signup_success
        // step (owner, Oct 18). That step has since been removed
        // entirely (UAT P-2): no in-app flow ever routed to it,
        // and a cold ?step=signup_success URL now falls through
        // the unknown-step handling like any other bad step name.
        if (authData.session || authData.user) {
          setAccountCreated(true);
          // Replace the login entry, like the sign-in landing:
          // Back from orientation must not resurrect the
          // sign-up form.
          navigateTo('orientation', undefined, { history: 'replace' });
        } else {
          setMessage({
            type: 'success',
            text: 'Account created! Please check your email to confirm your account.',
          });
        }
      }
    } catch (error: unknown) {
      const err = error as { error_description?: string; message?: string } | null;
      setMessage({
        type: 'error',
        text: err?.error_description || err?.message || 'An error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  // The already-signed-in card names the account the way the app
  // knows it: display name first, handle as a suffix when it adds
  // information (a profile created before display names existed
  // may carry only a handle; the boot's fallback guarantees at
  // least one of the two for a signed-in user).
  const accountName =
    userProfile?.displayName ||
    (userProfile?.username ? `@${userProfile.username}` : 'your account');
  const accountHandleSuffix =
    userProfile?.username &&
    userProfile?.displayName &&
    userProfile.username !== userProfile.displayName
      ? ` (@${userProfile.username})`
      : '';

  return (
    <div
      className="min-h-screen bg-[#DCEEF8] flex flex-col justify-center items-center p-4 selection:bg-amber-400 selection:text-slate-950 font-sans"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="max-w-md w-full bg-white rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] border-[3px] border-[#0C1220] overflow-hidden relative">
        
        {/* CLOSE (X) BUTTON — abandons sign-in: back to the step the
            user came from (closeLogin), NOT hardcoded to splash. */}
        <button
          type="button"
          onClick={() => closeLogin()}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-sky-50 text-[#0C1220] border-[2.5px] border-[#0C1220] transition-all cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* BRANDED HEADER BANNER */}
        <div className="bg-[#0072CE] p-8 text-center text-white space-y-2 relative border-b-[3px] border-[#0C1220]">
          <div className="w-12 h-12 bg-white border-[2.5px] border-[#0C1220] rounded-[14px] flex items-center justify-center mx-auto">
            <FlyingWIcon className="w-8 h-8 text-[#0072CE]" />
          </div>
          <h1 className={`${displayFont.className} text-2xl sm:text-3xl leading-tight`}>
            All My Favorite Songs
          </h1>
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">
            The Weezer Song Ranking Project
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {userId && !isShell ? (
            /* ALREADY SIGNED IN — the honest landing for a
                signed-in user who reaches this step (a deep link,
                the /login route stub, a menu detour). No form,
                no silent bounce: name the account, offer the two
                things they could actually mean to do. The card's
                X (closeLogin) still takes them back where they
                came from. */
            <div className="space-y-5 text-center">
              <div className="space-y-2">
                <h2 className="text-lg font-black text-[#0C1220]">
                  You&rsquo;re already signed in
                </h2>
                <p className="text-sm font-bold text-[#3D4A63] leading-relaxed">
                  Signed in as {accountName}
                  {accountHandleSuffix}. There&rsquo;s nothing to
                  fill in — head back to your rankings, or sign out
                  to switch accounts.
                </p>
              </div>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() =>
                    navigateTo('dashboard', undefined, {
                      history: 'replace',
                    })
                  }
                  className="w-full bg-white hover:bg-sky-50 text-[#0C1220] font-black py-3.5 rounded-xl border-[3px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)] cursor-pointer text-sm"
                >
                  Continue to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => handleSignOut()}
                  className="w-full bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 text-rose-600 font-black py-3 rounded-xl transition-colors text-xs cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
          {/* AUTH MODE TOGGLE BUTTONS */}
          <div className="flex bg-white border-2 border-[#0C1220] rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setMessage(null);
              }}
              className={`flex-1 text-xs font-black py-2.5 rounded-lg transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-[#0C1220] border-2 border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setMessage(null);
              }}
              className={`flex-1 text-xs font-black py-2.5 rounded-lg transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-[#0C1220] border-2 border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic');
                setMessage(null);
              }}
              className={`flex-1 text-xs font-black py-2.5 rounded-lg transition-all cursor-pointer ${
                authMode === 'magic'
                  ? 'bg-white text-[#0072CE] border-2 border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]'
                  : 'text-slate-500 hover:text-[#0072CE]'
              }`}
            >
              Magic Link
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* EMAIL ADDRESS */}
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] font-black text-[#3D4A63] uppercase tracking-wider mb-1"
              >
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-900 text-base"
              />
            </div>

            {/* PASSWORD (Excluding Magic Link) */}
            {authMode !== 'magic' && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-[10px] font-black text-[#3D4A63] uppercase tracking-wider mb-1"
                >
                  Password *
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-900 text-base"
                />
                {authMode === 'login' && (
                  <div className="text-right mt-1.5">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetSending}
                      className="text-[11px] font-bold text-[#0072CE] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {resetSending ? 'Sending…' : 'Forgot password?'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* EXPANDED PROFILE FIELDS ON SIGN UP */}
            {authMode === 'signup' && (
              <div className="space-y-3 pt-2 border-t-2 border-[#0C1220] animate-in fade-in duration-300">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block">
                  Profile Details
                </span>

                <div>
                  <label htmlFor="login-username" className="block text-[10px] font-black text-[#3D4A63] uppercase tracking-wider mb-1">
                    Unique Username (Handle) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3D4A63] font-black text-base">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="your_handle"
                      id="login-username"
                      name="username"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-base"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-display-name" className="block text-[10px] font-black text-[#3D4A63] uppercase tracking-wider">
                      Display Name
                    </label>
                    <span className="text-[9px] font-bold text-[#3D4A63]">
                      First Name + Last Initial
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Display name"
                    id="login-display-name"
                    name="displayName"
                    autoComplete="nickname"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[9px] font-black text-[#3D4A63] uppercase mb-1">
                      Birth Year
                    </label>
                    <input
                      type="number"
                      placeholder="1994"
                      min="1930"
                      max={new Date().getFullYear()}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-[#3D4A63] uppercase mb-1">
                      Country
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-base"
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
                  <div>
                    <label className="block text-[9px] font-black text-[#3D4A63] uppercase mb-1">
                      State
                    </label>
                    <select
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#0C1220] bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-base"
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
            )}

            {/* MESSAGE FEEDBACK */}
            {message && (
              <div
                className={`p-4 rounded-2xl text-xs font-bold leading-relaxed ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={
                loading ||
                !email ||
                (authMode !== 'magic' && !password) ||
                (authMode === 'signup' && !username.trim())
              }
              className="w-full bg-white hover:bg-sky-50 disabled:opacity-50 text-[#0C1220] font-black py-3.5 rounded-xl border-[3px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgba(11,30,63,0.85)] cursor-pointer text-sm mt-2"
            >
              {loading
                ? 'Processing...'
                : authMode === 'signup'
                ? 'Create Account & Save Profile 🚀'
                : authMode === 'login'
                ? 'Sign In →'
                : 'Send Magic Link ✨'}
            </button>
          </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}