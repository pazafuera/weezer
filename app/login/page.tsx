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

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { FlyingWIcon } from '@/app/components/SharedUI';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export default function Login() {
  const router = useRouter();

  // Auth Credentials State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'magic'>('login');

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

  // If already logged in, redirect to main Command Center
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/');
      }
    });
  }, [router]);

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
        router.push('/');
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

        // 1. Register Auth User
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authErr) throw authErr;

        // 2. Insert Profile Data into Supabase
        if (authData.user) {
          const locationStr =
            country === 'US' && stateCode ? `${stateCode}, USA` : country;

          const { error: profileErr } = await supabase.from('profiles').upsert({
            id: authData.user.id,
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
            birth_year: birthYear ? parseInt(birthYear, 10) : null,
            country_code: country,
            state_code: country === 'US' ? stateCode : null,
            updated_at: new Date().toISOString(),
          });

          if (profileErr) throw profileErr;
        }

        setMessage({
          type: 'success',
          text: 'Account created! If email confirmation is required, check your inbox to activate.',
        });
        
        // If session exists immediately (e.g., auto-confirm enabled), push to root
        if (authData.session) {
          router.push('/');
        }
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.error_description || error.message || 'An error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 selection:bg-amber-400 selection:text-slate-950 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* BRANDED HEADER BANNER */}
        <div className="bg-[#0072CE] p-8 text-center text-white space-y-2">
          <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto text-white shadow-inner">
            <FlyingWIcon className="w-8 h-8 text-white drop-shadow-sm" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            All My Favorite Songs
          </h1>
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">
            The Weezer Song Ranking Project
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* AUTH MODE TOGGLE BUTTONS */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setMessage(null);
              }}
              className={`flex-1 text-xs font-black py-2.5 rounded-lg transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setMessage(null);
              }}
              className={`flex-1 text-xs font-black py-2.5 rounded-lg transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic');
                setMessage(null);
              }}
              className={`flex-1 text-xs font-black py-2.5 rounded-lg transition-all cursor-pointer ${
                authMode === 'magic'
                  ? 'bg-white text-[#0072CE] shadow-xs'
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
                className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1"
              >
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buddy.holly@weezer.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-900 text-sm"
              />
            </div>

            {/* PASSWORD (Excluding Magic Link) */}
            {authMode !== 'magic' && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1"
                >
                  Password *
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-900 text-sm"
                />
              </div>
            )}

            {/* EXPANDED PROFILE FIELDS ON SIGN UP */}
            {authMode === 'signup' && (
              <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-300">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block">
                  Profile Details
                </span>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Unique Username (Handle) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="rivers_cuomo"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">
                      Birth Year
                    </label>
                    <input
                      type="number"
                      placeholder="1994"
                      min="1930"
                      max={new Date().getFullYear()}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-xs"
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
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">
                      State
                    </label>
                    <select
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0072CE] outline-none font-bold text-slate-900 text-xs"
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
              className="w-full bg-[#0072CE] hover:bg-blue-600 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer text-sm mt-2"
            >
              {loading
                ? 'Processing...'
                : authMode === 'login'
                ? 'Sign In →'
                : authMode === 'signup'
                ? 'Create Account & Save Profile 🚀'
                : 'Send Magic Link ✨'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}