import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { WeezerProvider } from './context/WeezerContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'All My Favorite Songs | The Weezer Ranking Project',
  description:
    'The ultimate Weezer song ranking experience. Triage, rank, and compare your favorite tracks.',
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png', // You can update this asset later
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png', // You can update this asset later
      },
    ],
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
