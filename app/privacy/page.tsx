import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Ranking Weezer',
  description:
    'How RankingWeezer.com handles your account, ranking, and email data.',
};

/**
 * DRAFT — pending Mark's final review before launch.
 * Describes the product as it works today (transactional auth email only,
 * no marketing email, no ad trackers). Update the contact line and the
 * email section before this ships if the alerts program launches first.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <Link
          href="/"
          className="text-xs font-black uppercase tracking-widest text-[#0072CE]"
        >
          ← RankingWeezer.com
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs font-bold text-slate-400">
          Last updated: October 2026
        </p>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">What this site is</h2>
          <p>
            RankingWeezer.com (&ldquo;All My Favorite Songs — The Weezer Ranking
            Project&rdquo;) is a fan-made project that lets you rank Weezer
            songs, compare lists with friends, and see community statistics
            from participating fans. It is not affiliated with Weezer or
            their label.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">What we collect</h2>
          <p>
            <strong className="text-slate-900">Account data.</strong> If you
            create an account, we store your email address, username, and
            display name so you can sign in and be found by friends.
          </p>
          <p>
            <strong className="text-slate-900">Ranking data.</strong> The
            songs you bucket and rank, your master list, and your friendships
            on the site. If you use the site as a guest, your work is stored
            in your own browser instead of our database.
          </p>
          <p>
            <strong className="text-slate-900">Technical data.</strong> Our
            hosting and database providers (Vercel and Supabase) process
            standard server logs — like IP address and browser type — to
            run and secure the service.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">How we use it</h2>
          <p>
            Your data runs the site: saving your rankings, showing your
            profile and tier lists to you and the friends you connect with,
            and computing community statistics. Community stats only count
            submissions with at least 10 rated songs, and percentages are
            hidden until at least 50 qualified fans have participated.
          </p>
          <p>
            Your public profile shows your username, display name, and
            rankings to other signed-in fans so they can find and compare
            with you. We never sell personal data, and we don&rsquo;t use
            third-party advertising trackers.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Email</h2>
          <p>
            We send account email only — sign-up confirmation and password
            resets — from no-reply@rankingweezer.com via our email provider,
            Resend. We do not currently send marketing or newsletter email.
            If that ever changes, it will be opt-in, capped, and every
            message will carry a one-click unsubscribe.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Your choices</h2>
          <p>
            You can edit your username and display name any time from
            Account &amp; Profile in the app. To delete your account and its
            data, contact us at{' '}
            <a
              href="mailto:onlyinprivacy@rankingweezer.com"
              className="font-bold text-[#0072CE]"
            >
              onlyinprivacy@rankingweezer.com
            </a>{' '}
            and we&rsquo;ll remove your profile, rankings, and friendships.
          </p>
          <p>
            We keep your data while your account exists. Server logs are
            retained by our providers for a limited time for security.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Changes</h2>
          <p>
            If this policy changes in a way that matters, we&rsquo;ll update
            this page and the date above before the change takes effect.
          </p>
        </section>
      </div>
    </main>
  );
}
