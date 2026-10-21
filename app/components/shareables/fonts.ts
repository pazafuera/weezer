import { Caveat, Lilita_One, Permanent_Marker } from 'next/font/google';

/** Display/marker type for the scrapbook card system. */
export const markerFont = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

/** Chunky rounded display type for the poster-style cards (Abby's
 *  direction: flat blue field, huge heavy letterforms). */
export const displayFont = Lilita_One({
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
