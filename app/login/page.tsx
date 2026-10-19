import { redirect } from 'next/navigation';

/**
 * The standalone /login route no longer renders its own page
 * (UAT P-5): the login card lives in the app as the 'login' step
 * (app/components/Login.tsx, rendered inside the AppShell by
 * app/page.tsx), and a bare /login showed that card with no app
 * shell around it — its ✕ was the only navigation on the page.
 *
 * Nothing targets /login as an auth callback: sign-up confirmation
 * links point at the site root (emailRedirectTo = origin + '/'),
 * magic links redirect to the page they were requested from, and
 * password resets redirect to the site origin. So this route now
 * simply hands off to the in-app login step, which is where every
 * sign-in control in the app already leads.
 */
export default function LoginRoute() {
  redirect('/?step=login');
}
