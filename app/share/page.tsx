// app/share/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { decodeShareData } from '@/utils/shareHelper';
import { displayFont } from '../components/shareables/fonts';

type Props = {
  searchParams: { data?: string };
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const dataParam = searchParams.data;
  let ogImageUrl = 'https://rankingweezer.com/img/garage-banner.jpg';
  let title = 'Weezer Taste DNA';
  let description = 'I ranked the Weezer canon. Who has better taste?';

  if (dataParam) {
    ogImageUrl = `https://rankingweezer.com/api/og?data=${dataParam}`;
    const decoded = decodeShareData(dataParam);
    if (decoded) {
      title = `${decoded.n}'s Weezer Taste DNA`;
      description = `Top Song: ${decoded.t} • Top Album: ${decoded.a} • Vibe: ${decoded.v}. Rank your own Weezer favorites!`;
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function SharePage({ searchParams }: Props) {
  const dataParam = searchParams.data;
  const decoded = dataParam ? decodeShareData(dataParam) : null;
  const ogImageUrl = dataParam ? `/api/og?data=${dataParam}` : '/img/garage-banner.jpg';

  return (
    <div
      className="min-h-screen bg-[#DCEEF8] flex flex-col items-center justify-center p-4 selection:bg-amber-300"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="max-w-xl w-full bg-white rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] overflow-hidden border-[3px] border-[#0C1220] text-center pb-8">
        <img src={ogImageUrl} alt="Weezer Taste DNA" className="w-full aspect-[1200/630] object-cover mb-8 border-b-[3px] border-[#0C1220]" />
        
        <h1 className={`${displayFont.className} text-3xl text-[#0C1220] mb-2 px-4`}>
          {decoded ? `${decoded.n} ranked the Weezer canon.` : 'Rank the Weezer canon.'}
        </h1>
        <p className="text-[#3D4A63] font-bold mb-8 px-4">
          Do you have better taste? Unravel your own Taste DNA.
        </p>
        
        <Link
          href="/"
          className="inline-block bg-[#0072CE] hover:bg-blue-600 border-[3px] border-[#0C1220] text-white font-black py-4 px-8 rounded-full shadow-[2px_2px_0_rgba(11,30,63,0.85)] transition-transform hover:scale-105 active:scale-95"
        >
          Start My Ranking 🎸
        </Link>
      </div>
    </div>
  );
}