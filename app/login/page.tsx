'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'magic'>(
    'login'
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // If already logged in, push to main page
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
          text: 'Check your email for the magic link!',
        });
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Success! Check your email to confirm your account.',
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.error_description || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-amber-400 selection:text-slate-950">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
            All My Favorite Songs
          </h1>
          <span className="text-xs font-bold text-[#0072CE] uppercase tracking-widest">
            The Weezer Song Ranking Project
          </span>
        </div>

        {/* AUTH MODE TOGGLES */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => {
              setAuthMode('login');
              setMessage(null);
            }}
            className={`flex-1 text-xs font-black py-2 rounded-lg transition-colors ${
              authMode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setMessage(null);
            }}
            className={`flex-1 text-xs font-black py-2 rounded-lg transition-colors ${
              authMode === 'signup'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => {
              setAuthMode('magic');
              setMessage(null);
            }}
            className={`flex-1 text-xs font-black py-2 rounded-lg transition-colors ${
              authMode === 'magic'
                ? 'bg-white text-[#0072CE] shadow-sm'
                : 'text-slate-500 hover:text-[#0072CE]'
            }`}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="buddy.holly@example.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium text-slate-900"
            />
          </div>

          {authMode !== 'magic' && (
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#0072CE] focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium text-slate-900"
              />
            </div>
          )}

          {message && (
            <div
              className={`p-4 rounded-xl text-sm font-bold ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || (authMode !== 'magic' && !password)}
            className="w-full bg-[#0072CE] hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl transition-colors mt-2"
          >
            {loading
              ? 'Processing...'
              : authMode === 'login'
              ? 'Sign In'
              : authMode === 'signup'
              ? 'Create Account'
              : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
