import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use | Ranking Weezer',
  description: 'The simple rules for using RankingWeezer.com.',
};

/**
 * DRAFT — pending Mark's final review before launch.
 */
export default function TermsPage() {
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
          Terms of Use
        </h1>
        <p className="text-xs font-bold text-slate-400">
          Last updated: October 2026 · Draft pending final review
        </p>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">The short version</h2>
          <p>
            RankingWeezer.com is a free, fan-made project for ranking Weezer
            songs and comparing lists with friends. Be decent, don&rsquo;t
            break things, and have fun arguing about Pinkerton.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Not affiliated</h2>
          <p>
            This is an unofficial fan project. It is not affiliated with,
            endorsed by, or sponsored by Weezer, their label, or their
            management. Song titles and album artwork are referenced for
            identification and commentary; all trademarks belong to their
            owners.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Your account and content</h2>
          <p>
            You&rsquo;re responsible for activity under your account and for
            keeping your password to yourself. Your rankings, lists, and
            profile are yours; by posting them on the site you give us
            permission to display them to you and to other signed-in fans as
            part of how the site works (profiles, comparisons, and community
            statistics). Pick a username and display name that aren&rsquo;t
            offensive or impersonating someone else.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Acceptable use</h2>
          <p>
            Don&rsquo;t scrape or hammer the service, try to access other
            people&rsquo;s accounts or data, upload anything unlawful, or
            use the site to harass anyone. We may suspend accounts that do —
            the fan club stays friendly.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">As-is</h2>
          <p>
            The site is provided &ldquo;as is,&rdquo; for fun. Rankings,
            tribes, and statistics are editorial entertainment — our
            methodology is published in the app and the labels are for fun,
            not science. We may change or discontinue features, and
            we&rsquo;re not liable for lost lists or heated Blue-vs-Pinkerton
            debates.
          </p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 text-sm leading-relaxed font-medium text-slate-600">
          <h2 className="text-base font-black text-slate-900">Changes</h2>
          <p>
            If these terms change in a way that matters, we&rsquo;ll update
            this page and the date above. Continuing to use the site after a
            change means you accept the updated terms.
          </p>
        </section>
      </div>
    </main>
  );
}
