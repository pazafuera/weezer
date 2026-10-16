import { Caveat, Permanent_Marker } from 'next/font/google';

/** Display/marker type for the scrapbook card system. */
export const markerFont = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

/** Handwritten annotations (Caveat) for the scrapbook card system. */
export const handFont = Caveat({
  weight: ['600', '700'],
  subsets: ['latin'],
  display: 'swap',
});
