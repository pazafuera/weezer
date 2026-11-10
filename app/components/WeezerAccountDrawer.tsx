'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { useWeezer } from '../context/WeezerContext';
import { saveIndicatorCopy, formatTimeOfDay } from '../lib/saveStatus';
import { isOwnerUser } from '../lib/owner';
import { COUNTRY_OPTIONS, US_STATES } from './WeezerOnboardingModal';
import Link from 'next/link';
import { displayFont } from './shareables/fonts';

interface WeezerAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Authenticated user's id from WeezerContext — scopes every write. */
  userId: string | null;
  userProfile: {
    username?: string;
    displayName?: string;
    birthYear?: number;
    location?: string;
  } | null;
  onLogout: () => void;
  onOpenOnboarding: () => void;
}

/**
 * Raw columns on public.profiles — the actual table columns, mirrored from
 * the select in WeezerContext and the upsert in WeezerOnboardingModal.
 */
interface ProfileRow {
  username: string | null;
  display_name: string | null;
  birth_year: number | null;
  country_code: string | null;
  state_code: string | null;
}

/** Exact phrase the user must type to confirm account deletion. */
const DELETE_CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

/**
 * Whether the delete-account Edge Function is DEPLOYED and
 * verified. The function source is complete
 * (supabase/functions/delete-account/) and the handler below is
 * fully wired to it — but the button stays disabled while this
 * is false, so the shipped app can never call a backend that
 * isn't there. Flip to true ONLY after the deploy + throwaway-
 * account test in that folder's README pass. (Build 6, Nov 7:
 * prepared, deliberately not deployed.)
 */
const DELETE_ACCOUNT_BACKEND_LIVE = false;

/** Validation bounds mirror the onboarding form. */
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const DISPLAY_NAME_MAX = 60;
const BIRTH_YEAR_MIN = 1930;

/** Same username sanitization rule as signup: lowercase, trimmed, a-z0-9_. */
function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '');
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

function isSelectableCountry(code: string): boolean {
  return COUNTRY_OPTIONS.some((c) => c.code === code && c.code !== 'DIVIDER');
}

/** Derives the context's display `location` string from the raw columns. */
function toLocationLabel(
  countryCode: string | null,
  stateCode: string | null
): string | undefined {
  if (countryCode === 'US' && stateCode) return `${stateCode}, USA`;
  return countryCode || undefined;
}

export default function WeezerAccountDrawer({
  isOpen,
  onClose,
  userId,
  userProfile,
  onLogout,
  onOpenOnboarding,
}: WeezerAccountDrawerProps) {
  const {
    setUserProfile,
    setTriageMap,
    handleSignOut,
    saveState,
    navigateTo,
    isShell,
  } = useWeezer();

  const [copiedLink, setCopiedLink] = useState(false);

  // Raw profile row, loaded when the drawer opens, used to prepopulate edits.
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [rowLoading, setRowLoading] = useState(false);

  // Edit-profile form state.
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBirthYear, setEditBirthYear] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editStateCode, setEditStateCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // Password-reset state. No password is ever collected or logged here.
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete-account state.
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Shell-upgrade state (game front door, Nov 9, 2026): the
  // email + password that convert a name-only account in place.
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSent, setUpgradeSent] = useState(false);

  // Keyboard-focus management.
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Open/close + focus: Escape closes, focus moves into the drawer on open
  // and is restored to the opener on close. Transient form state resets.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current =
      document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    setEditing(false);
    setEditError(null);
    setEditSuccess(false);
    setResetSent(false);
    setResetError(null);
    setDeleteConfirmText('');
    setDeleteError(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Load the raw profile row when the drawer opens so the edit form is
  // prepopulated with the actual column values.
  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;
    const loadProfileRow = async () => {
      setRowLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, display_name, birth_year, country_code, state_code')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setProfileRow((data as ProfileRow | null) ?? null);
      } catch {
        if (!cancelled) setProfileRow(null);
      } finally {
        if (!cancelled) setRowLoading(false);
      }
    };
    loadProfileRow();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

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

  // Shell upgrade: attach an email + password to THIS anonymous
  // account. Supabase converts it in place — same id, same
  // username, same scores; the email confirmation link is what
  // finishes it.
  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgradeError(null);
    const email = upgradeEmail.trim();
    if (!email || !upgradePassword) {
      setUpgradeError('Enter an email and a password.');
      return;
    }
    if (upgradePassword.length < 6) {
      setUpgradeError('Passwords need at least 6 characters.');
      return;
    }
    setUpgradeBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email,
        password: upgradePassword,
      });
      if (error) throw error;
      setUpgradeSent(true);
    } catch (err) {
      setUpgradeError(
        err instanceof Error
          ? err.message
          : 'That didn\u2019t go through — try again.'
      );
    } finally {
      setUpgradeBusy(false);
    }
  };

  // SHELL ACCOUNT (game front door, Nov 9, 2026): a name-only
  // account gets its own drawer. No profile editor, no saving
  // card, no danger zone — and no sign-out, which would strand
  // the shell (its session is the only key). The one job here
  // is the upgrade.
  if (isShell) {
    return (
      <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="flex-1" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-drawer-title"
          className="w-full max-w-sm bg-white h-full shadow-[-6px_0_0_rgba(11,30,63,0.85)] border-l-[3px] border-[#0C1220] p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
        >
          <div>
            <div className="flex items-center justify-between pb-6 border-b-2 border-[#0C1220]">
              <h2
                id="account-drawer-title"
                className="${displayFont.className} text-xl text-[#0C1220]"
              >
                Account & Profile
              </h2>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close account drawer"
                className="text-[#0C1220] bg-white hover:bg-sky-50 border-[2.5px] border-[#0C1220] rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-6 space-y-6">
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]">
                <div className="w-12 h-12 bg-[#0072CE] text-white rounded-xl flex items-center justify-center font-black text-xl border-[2.5px] border-[#0C1220] shrink-0">
                  {userProfile?.displayName
                    ? userProfile.displayName.charAt(0).toUpperCase()
                    : 'W'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-[#0C1220] truncate">
                    {userProfile?.displayName || 'Your account'}
                  </h3>
                  <p className="text-xs font-bold text-[#0072CE]">
                    {userProfile?.username
                      ? `@${userProfile.username}`
                      : 'No username yet'}
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-[#3D4A63] leading-relaxed">
                You&rsquo;re on the board under this name. For now
                the account lives on this device — no email, no
                password. Clear this browser or switch phones
                before upgrading and it&rsquo;s stranded.
              </p>

              {upgradeSent ? (
                <div className="bg-emerald-50 border-[2.5px] border-emerald-600 rounded-2xl p-4 space-y-1">
                  <h3 className="text-sm font-black text-emerald-900">
                    Check your email to finish
                  </h3>
                  <p className="text-xs font-medium text-emerald-800 leading-relaxed">
                    Tap the link we sent and this account is fully
                    yours — same name, same scores, on any device.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUpgrade} className="space-y-3">
                  <h3 className="text-sm font-black text-[#0C1220]">
                    Make it yours
                  </h3>
                  <p className="text-xs font-medium text-[#3D4A63] leading-relaxed">
                    Add an email and password to this account.
                    Nothing moves — the name and scores stay right
                    where they are.
                  </p>
                  <input
                    type="email"
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-[#0C1220] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0072CE]"
                  />
                  <input
                    type="password"
                    value={upgradePassword}
                    onChange={(e) => setUpgradePassword(e.target.value)}
                    placeholder="New password (6+ characters)"
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-[#0C1220] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0072CE]"
                  />
                  {upgradeError && (
                    <p className="text-xs font-bold text-rose-600">
                      {upgradeError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={upgradeBusy}
                    className="w-full bg-[#0072CE] hover:bg-blue-600 border-2 border-[#0C1220] text-white text-sm font-black px-3 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {upgradeBusy ? 'Adding…' : 'Add email & password'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="pt-6 border-t-2 border-slate-100 space-y-2">
            <button
              onClick={async () => {
                onClose();
                await onLogout();
                navigateTo('login');
              }}
              className="w-full text-xs font-black text-[#3D4A63] hover:underline cursor-pointer"
            >
              Sign in with a full account instead
            </button>
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed text-center">
              This name stays on the board — you&rsquo;d just be
              leaving it behind on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const openEditForm = () => {
    setEditUsername(profileRow?.username ?? userProfile?.username ?? '');
    setEditDisplayName(
      profileRow?.display_name ?? userProfile?.displayName ?? ''
    );
    setEditBirthYear(
      profileRow?.birth_year ? String(profileRow.birth_year) : ''
    );
    setEditCountry(profileRow?.country_code ?? '');
    setEditStateCode(profileRow?.state_code ?? '');
    setEditError(null);
    setEditSuccess(false);
    setEditing(true);
  };

  const closeEditForm = () => {
    setEditing(false);
    setEditError(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(false);

    const cleanUsername = sanitizeUsername(editUsername);
    if (cleanUsername.length < USERNAME_MIN) {
      setEditError(`Username must be at least ${USERNAME_MIN} characters long.`);
      return;
    }
    if (cleanUsername.length > USERNAME_MAX) {
      setEditError(`Username must be ${USERNAME_MAX} characters or fewer.`);
      return;
    }

    const cleanDisplayName = editDisplayName.trim();
    if (cleanDisplayName.length > DISPLAY_NAME_MAX) {
      setEditError(
        `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`
      );
      return;
    }

    const currentYear = new Date().getFullYear();
    let parsedBirthYear: number | null = null;
    if (editBirthYear.trim() !== '') {
      const parsed = parseInt(editBirthYear, 10);
      if (
        Number.isNaN(parsed) ||
        parsed < BIRTH_YEAR_MIN ||
        parsed > currentYear
      ) {
        setEditError(
          `Birth year must be between ${BIRTH_YEAR_MIN} and ${currentYear}.`
        );
        return;
      }
      parsedBirthYear = parsed;
    }

    const cleanCountry = editCountry.trim();
    if (cleanCountry !== '' && !isSelectableCountry(cleanCountry)) {
      setEditError('Please choose a valid country.');
      return;
    }

    const cleanState = editStateCode.trim();
    if (
      cleanCountry === 'US' &&
      cleanState !== '' &&
      US_STATES.indexOf(cleanState) === -1
    ) {
      setEditError('Please choose a valid US state.');
      return;
    }

    if (!userId) {
      setEditError('You must be signed in to edit your profile.');
      return;
    }

    // Reuse the existing is_username_available RPC — but only when the
    // username actually changed, since the user's own handle reads as taken.
    try {
      const originalUsername = sanitizeUsername(
        profileRow?.username ?? userProfile?.username ?? ''
      );
      if (cleanUsername !== originalUsername) {
        const { data: isAvailable, error: rpcError } = await supabase.rpc(
          'is_username_available',
          { p_username: cleanUsername }
        );
        if (rpcError) throw rpcError;
        if (isAvailable === false) {
          setEditError('That username is taken. Please pick another.');
          return;
        }
      }
    } catch (err: unknown) {
      setEditError(getErrorMessage(err));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: cleanUsername,
        display_name: cleanDisplayName || cleanUsername,
        birth_year: parsedBirthYear,
        country_code: cleanCountry || null,
        state_code: cleanCountry === 'US' ? cleanState || null : null,
        updated_at: new Date().toISOString(),
      };

      // Update ONLY the authenticated user's own row.
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select('username, display_name, birth_year, country_code, state_code')
        .maybeSingle();
      if (updateError) throw updateError;

      let saved: ProfileRow | null = (updated as ProfileRow | null) ?? null;
      if (!saved) {
        // No profile row existed yet (e.g. signed in before completing
        // onboarding): create it scoped to the user's own id, as in signup.
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .upsert({ id: userId, ...payload })
          .select('username, display_name, birth_year, country_code, state_code')
          .maybeSingle();
        if (insertError) throw insertError;
        saved = (inserted as ProfileRow | null) ?? null;
      }
      if (!saved) {
        throw new Error('Could not save your profile. Please try again.');
      }

      // Update WeezerContext only after Supabase confirms the write.
      setProfileRow(saved);
      setUserProfile({
        username: saved.username ?? cleanUsername,
        displayName: saved.display_name ?? cleanUsername,
        birthYear: saved.birth_year ?? undefined,
        location: toLocationLabel(saved.country_code, saved.state_code),
      });
      setEditSuccess(true);
      setEditing(false);
    } catch (err: unknown) {
      setEditError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Sends a password-reset email via Supabase's supported flow.
   * No password is collected or logged in this drawer.
   */
  const handlePasswordReset = async () => {
    setResetError(null);
    setResetSent(false);
    setResetSending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = user?.email;
      if (!email) {
        throw new Error('No email address is associated with this account.');
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) throw error;
      // Neutral confirmation — does not reveal whether an account exists.
      setResetSent(true);
    } catch (err: unknown) {
      setResetError(getErrorMessage(err));
    } finally {
      setResetSending(false);
    }
  };

  /**
   * Runs the delete-account Edge Function (supabase/functions/
   * delete-account) and, only on its confirmed success, tears
   * the session down: clear local ranking state, sign out, and
   * return to the splash screen. The function's own error
   * message is shown verbatim on failure — it is written for
   * the user ("Could not delete your rankings. Try again.").
   *
   * Reachable only when DELETE_ACCOUNT_BACKEND_LIVE is true —
   * the button stays disabled until the function is deployed
   * and verified, so this never fires against a missing backend.
   */
  const handleDeleteAccount = async () => {
    if (!userId || !DELETE_ACCOUNT_BACKEND_LIVE) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        let message = 'Account deletion failed. Please try again later.';
        try {
          const body = await (
            error as { context?: Response }
          ).context?.json();
          if (body && typeof body.error === 'string') message = body.error;
        } catch {
          // The function's message wasn't readable — the plain
          // fallback above stands.
        }
        throw new Error(message);
      }
      // Backend confirmed deletion: clear local ranking state, sign out,
      // and return to splash.
      setTriageMap({});
      onClose();
      await handleSignOut();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const deleteReady = deleteConfirmText.trim() === DELETE_CONFIRM_PHRASE;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* BACKGROUND TAP TO CLOSE */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      {/* DRAWER CONTAINER */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-drawer-title"
        className="w-full max-w-sm bg-white h-full shadow-[-6px_0_0_rgba(11,30,63,0.85)] border-l-[3px] border-[#0C1220] p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        <div>
          {/* HEADER */}
          <div className="flex items-center justify-between pb-6 border-b-2 border-[#0C1220]">
            <h2
              id="account-drawer-title"
              className="${displayFont.className} text-xl text-[#0C1220]"
            >
              Account & Profile
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close account drawer"
              className="text-[#0C1220] bg-white hover:bg-sky-50 border-[2.5px] border-[#0C1220] rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* USER LOGGED IN — keyed on userId, NOT on having a
              username: this used to branch on userProfile?.username,
              so a signed-in user who hadn't claimed a handle was
              told they were in "Guest Mode", offered a sign-in CTA
              that looped them to the dashboard, and never saw a
              Sign Out. Signed-in is signed-in. */}
          {userId ? (
            <div className="py-6 space-y-6">
              {/* PROFILE BADGE */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]">
                <div className="w-12 h-12 bg-[#0072CE] text-white rounded-xl flex items-center justify-center font-black text-xl border-[2.5px] border-[#0C1220] shrink-0">
                  {userProfile?.displayName
                    ? userProfile.displayName.charAt(0).toUpperCase()
                    : 'W'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-[#0C1220] truncate">
                    {userProfile?.displayName || 'Your account'}
                  </h3>
                  <p className="text-xs font-bold text-[#0072CE]">
                    {userProfile?.username
                      ? `@${userProfile.username}`
                      : 'No username yet'}
                  </p>
                </div>
              </div>

              {/* PUBLIC LINK MODULE — needs a username; without one,
                  say so (the Edit Profile form below is where a
                  handle gets claimed) instead of showing an empty
                  link box with a Copy button that copies nothing. */}
              {userProfile?.username ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-[#3D4A63] tracking-wider block">
                    Your Public Profile Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl || ''}
                      className="flex-1 px-3 py-2 bg-white border-2 border-[#0C1220] rounded-xl text-xs font-mono text-[#3D4A63] truncate focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="bg-[#0072CE] hover:bg-blue-600 border-2 border-[#0C1220] text-white text-xs font-black px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      {copiedLink ? 'Copied! ✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold text-[#3D4A63] leading-relaxed">
                  Add a username in Edit Profile below to claim your
                  public profile link.
                </p>
              )}

              {/* PROFILE DETAILS + EDIT */}
              <div className="bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] block">
                  Profile Details
                </span>
                {rowLoading ? (
                  <p className="text-xs font-bold text-[#3D4A63]">
                    Loading profile…
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#0C1220]">
                    <div>
                      <span className="text-[9px] uppercase text-[#3D4A63] block">
                        Display Name
                      </span>
                      <span>
                        {profileRow?.display_name ||
                          userProfile?.displayName ||
                          'Not set'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-[#3D4A63] block">
                        Username
                      </span>
                      <span>@{profileRow?.username || userProfile?.username || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-[#3D4A63] block">
                        Birth Year
                      </span>
                      <span>
                        {profileRow?.birth_year ||
                          userProfile?.birthYear ||
                          'Not set'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-[#3D4A63] block">
                        Location
                      </span>
                      <span>
                        {toLocationLabel(
                          profileRow?.country_code ?? null,
                          profileRow?.state_code ?? null
                        ) ||
                          userProfile?.location ||
                          'Not set'}
                      </span>
                    </div>
                  </div>
                )}

                {!editing ? (
                  <button
                    onClick={openEditForm}
                    className="text-xs font-black text-[#0072CE] hover:underline pt-1 block cursor-pointer"
                  >
                    Edit Profile →
                  </button>
                ) : (
                  <form
                    onSubmit={handleSaveProfile}
                    className="space-y-3 pt-3 border-t border-slate-200"
                  >
                    <div>
                      <label
                        htmlFor="account-edit-username"
                        className="text-[10px] font-black uppercase text-[#3D4A63] tracking-wider block mb-1"
                      >
                        Username *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3D4A63] font-black text-sm">
                          @
                        </span>
                        <input
                          id="account-edit-username"
                          type="text"
                          required
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                        />
                      </div>
                      <p className="text-[10px] font-medium text-[#3D4A63] mt-1">
                        Lowercase letters, numbers, and underscores only · min 3
                        characters. Changing it updates your public link.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="account-edit-display-name"
                        className="text-[10px] font-black uppercase text-[#3D4A63] tracking-wider block mb-1"
                      >
                        Display Name
                      </label>
                      <input
                        id="account-edit-display-name"
                        type="text"
                        placeholder="Rivers C."
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="account-edit-birth-year"
                          className="text-[10px] font-black uppercase text-[#3D4A63] tracking-wider block mb-1"
                        >
                          Birth Year
                        </label>
                        <input
                          id="account-edit-birth-year"
                          type="number"
                          placeholder="1994"
                          min={BIRTH_YEAR_MIN}
                          max={new Date().getFullYear()}
                          value={editBirthYear}
                          onChange={(e) => setEditBirthYear(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="account-edit-country"
                          className="text-[10px] font-black uppercase text-[#3D4A63] tracking-wider block mb-1"
                        >
                          Country
                        </label>
                        <select
                          id="account-edit-country"
                          value={editCountry}
                          onChange={(e) => {
                            setEditCountry(e.target.value);
                            setEditStateCode('');
                          }}
                          className="w-full px-3 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
                        >
                          <option value="">Not set</option>
                          {COUNTRY_OPTIONS.map((c) =>
                            c.code === 'DIVIDER' ? (
                              <option
                                key={c.code}
                                value="DIVIDER"
                                disabled
                                className="text-slate-400"
                              >
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

                    {editCountry === 'US' && (
                      <div>
                        <label
                          htmlFor="account-edit-state"
                          className="text-[10px] font-black uppercase text-[#3D4A63] tracking-wider block mb-1"
                        >
                          State
                        </label>
                        <select
                          id="account-edit-state"
                          value={editStateCode}
                          onChange={(e) => setEditStateCode(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border-2 border-[#0C1220] rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
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

                    {editError && (
                      <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                        {editError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeEditForm}
                        disabled={saving}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-black py-2.5 rounded-xl transition-colors text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-[#0072CE] hover:bg-blue-600 disabled:opacity-50 text-white font-black py-2.5 rounded-xl transition-colors text-xs cursor-pointer"
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {editSuccess && !editing && (
                  <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                    Profile updated ✓
                  </p>
                )}
              </div>

              {/* SAVING — the same save state the header indicator
                  shows (durability overhaul, Nov 7). The recent-save
                  activity list that used to render under it was
                  removed Nov 7 evening (owner call): raw diagnostics
                  telemetry has no place in a user's drawer. The ring
                  itself (app/lib/saveDiagnostics.ts) still records
                  in the background; it just isn't displayed here. */}
              <div className="bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] block">
                  Saving
                </span>
                <p className="text-xs font-bold text-[#0C1220]">
                  {saveState.phase === 'saved' && saveState.savedAt
                    ? `Last saved ${formatTimeOfDay(saveState.savedAt)}`
                    : (saveIndicatorCopy(saveState) ?? 'Nothing to save yet')}
                </p>
              </div>

              {/* SITE STATS — owner only (Nov 7). This row is
                  the only door to the stats page, and it renders
                  only for the owner's own account (app/lib/owner.ts);
                  the page bounces anyone else who reaches it, and
                  the numbers themselves sit behind a server-side
                  owner check. Not a menu item, by design. */}
              {isOwnerUser(userId) && (
                <button
                  onClick={() => {
                    onClose();
                    navigateTo('owner_stats');
                  }}
                  className="w-full bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] flex items-center justify-between cursor-pointer text-left"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63]">
                    Site stats
                  </span>
                  <span className="text-xs font-black text-[#0072CE]">
                    View →
                  </span>
                </button>
              )}

              {/* PASSWORD RESET */}
              <div className="bg-white p-4 rounded-2xl border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)] space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] block">
                  Security
                </span>
                <p className="text-xs font-medium text-[#3D4A63] leading-relaxed">
                  Forgot your password? We&apos;ll email you a secure reset
                  link.
                </p>
                <button
                  onClick={handlePasswordReset}
                  disabled={resetSending}
                  className="w-full bg-[#0C1220] hover:bg-slate-700 border-[2.5px] border-[#0C1220] disabled:opacity-50 text-white font-black py-2.5 rounded-xl transition-colors text-xs cursor-pointer"
                >
                  {resetSending ? 'Sending…' : 'Send password reset email'}
                </button>
                {resetSent && (
                  <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl leading-relaxed">
                    If an account exists for this email address, a password
                    reset link is on its way. Check your inbox.
                  </p>
                )}
                {resetError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    {resetError}
                  </p>
                )}
              </div>

              {/* DELETE ACCOUNT */}
              <div className="p-4 rounded-2xl border-2 border-rose-200 bg-rose-50/50 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block">
                  Danger Zone
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Delete my account
                  </h3>
                  <p className="text-xs font-medium text-slate-600 leading-relaxed mt-1">
                    Permanently deletes your profile, song rankings,
                    friendships, game record, and sign-in. This cannot
                    be undone.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="account-delete-confirm"
                    className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1"
                  >
                    Type{' '}
                    <span className="text-rose-600">
                      {DELETE_CONFIRM_PHRASE}
                    </span>{' '}
                    to confirm
                  </label>
                  <input
                    id="account-delete-confirm"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={DELETE_CONFIRM_PHRASE}
                    autoComplete="off"
                    className="w-full px-4 py-2.5 bg-white border border-rose-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-400"
                  />
                </div>
                {/*
                  DELETE BACKEND — BUILT, NOT YET LIVE. The backend
                  exists: supabase/functions/delete-account (verifies
                  the caller's JWT, deletes friendships / rankings /
                  fanhood / profile with the service-role key on the
                  server, then deletes the auth user). It is NOT
                  deployed, and DELETE_ACCOUNT_BACKEND_LIVE above
                  stays false — keeping this button disabled — until
                  it is deployed and verified with a throwaway
                  account (exact steps in that folder's README).
                  Never put the Supabase service_role key in browser
                  code or a NEXT_PUBLIC_* variable.
                */}
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    !DELETE_ACCOUNT_BACKEND_LIVE || !deleteReady || deleting
                  }
                  aria-disabled={
                    !DELETE_ACCOUNT_BACKEND_LIVE || !deleteReady || deleting
                  }
                  title={
                    DELETE_ACCOUNT_BACKEND_LIVE
                      ? undefined
                      : 'Account deletion is not available yet — the secure service is built and waiting on its final deploy check.'
                  }
                  className={
                    DELETE_ACCOUNT_BACKEND_LIVE && deleteReady && !deleting
                      ? 'w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-xl text-xs transition-colors cursor-pointer'
                      : 'w-full bg-rose-600 text-white font-black py-3 rounded-xl text-xs opacity-40 cursor-not-allowed'
                  }
                >
                  {deleting ? 'Deleting…' : 'Delete my account'}
                </button>
                {!DELETE_ACCOUNT_BACKEND_LIVE && (
                  <p className="text-[11px] font-bold text-rose-500 leading-relaxed">
                    Account deletion isn&rsquo;t live yet — the secure
                    service is built and waiting on its final deploy
                    check. Your data stays untouched until then.
                  </p>
                )}
                {deleteError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* USER LOGGED OUT / GUEST */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-[#0072CE] rounded-2xl flex items-center justify-center font-black text-2xl mx-auto border-[2.5px] border-[#0C1220]">
                👤
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0C1220]">
                  Guest Mode
                </h3>
                <p className="text-xs font-semibold text-[#3D4A63] mt-1 max-w-xs mx-auto leading-relaxed">
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

        {/* FOOTER / LOGOUT — every signed-in user gets a Sign
            Out, username or not. */}
        {userId && (
          <div className="pt-4 border-t-2 border-[#0C1220]">
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 text-rose-600 font-black py-3 rounded-xl transition-colors text-xs cursor-pointer"
            >
              Sign Out
            </button>
              {/* LEGAL LINKS */}
              <div className="flex items-center justify-center gap-2 pt-3 text-[11px] text-[#3D4A63]">
                <Link href="/privacy" className="hover:text-slate-600 transition-colors">
                  Privacy Policy
                </Link>
                <span aria-hidden="true">·</span>
                <Link href="/terms" className="hover:text-slate-600 transition-colors">
                  Terms of Use
                </Link>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
