import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { WeezerProvider } from './context/WeezerContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://famduel.com'),
  title: 'All My Favorite Songs | The Weezer Ranking Project',
  description:
    'The ultimate Weezer song ranking experience. Triage, rank, and compare your favorite tracks.',
  openGraph: {
    title: 'All My Favorite Songs | The Weezer Ranking Project',
    description:
      'The ultimate Weezer song ranking experience. Unravel your Weezer Taste DNA and challenge friends.',
    url: 'https://famduel.com/weezer',
    siteName: 'Weezer Canon Ranker',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'Weezer Canon Ranker - The Sweater Thread',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All My Favorite Songs | The Weezer Ranking Project',
    description:
      'The ultimate Weezer song ranking experience. Unravel your Weezer Taste DNA and challenge friends.',
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