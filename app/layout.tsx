import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { WeezerProvider } from './context/WeezerContext';

const inter = Inter({ subsets: ['latin'] });

// Canonical site URL comes from the environment so previews, staging,
// and production each describe themselves correctly. Falls back to the
// production domain. Set NEXT_PUBLIC_SITE_URL in Vercel per environment.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rankingweezer.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'All My Favorite Songs | The Weezer Song Ranking Project',
  description:
    'Rank all 206 Weezer songs your way — triage, refine, and compare your list with friends on RankingWeezer.com.',
  openGraph: {
    title: 'All My Favorite Songs | The Weezer Song Ranking Project',
    description:
      'Rank all 206 Weezer songs, discover your Fan Tribe and Era DNA, and compare lists with friends.',
    url: siteUrl,
    siteName: 'Ranking Weezer',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'Ranking Weezer — All My Favorite Songs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All My Favorite Songs | The Weezer Song Ranking Project',
    description:
      'Rank all 206 Weezer songs, discover your Fan Tribe and Era DNA, and compare lists with friends.',
    images: ['/api/og'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WeezerProvider>{children}</WeezerProvider>
      </body>
    </html>
  );
}
