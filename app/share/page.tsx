// app/share/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { decodeShareData } from '@/utils/shareHelper';
import { displayFont, handFont } from '../components/shareables/fonts';

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

/* Poster redesign (owner-approved mock, Nov 5): the page used to
 * embed the OG image as a picture inside a white card — the
 * redesign builds the same content natively as a poster card on
 * the shell backdrop (flat #039AD1 field, 3px ink frame, hard
 * shadow, halftone), so the text is crisp and the CTA lives
 * inside the card. The link-preview image (/api/og) is its
 * sibling, same design at 1200x630.
 *
 * Data is exactly the share payload's four fields (n/t/a/v via
 * utils/shareHelper) with the OG route's own defaults when a
 * field is empty, so the page and the preview never disagree.
 * The payload carries no pronoun, so the copy is neutral:
 * "their/theirs/they" where the mock (drawn for Mark) said
 * "his/he". The friend's name rides the tape strip; the headline
 * keeps the mock's three-line punch ("RANKED ALL 206 WEEZER
 * SONGS.") at a size no 20-char name can break. */
export default function SharePage({ searchParams }: Props) {
  const dataParam = searchParams.data;
  const decoded = dataParam ? decodeShareData(dataParam) : null;

  const name = decoded?.n ? decoded.n.slice(0, 20) : null;
  const anthem = decoded?.t || 'Undecided';
  const album = decoded?.a || 'Unknown Album';
  const vibe = decoded?.v || 'Weezer Scientist';

  return (
    <div
      className="min-h-screen bg-[#DCEEF8] flex flex-col items-center justify-center p-4 selection:bg-amber-300"
      style={{
        backgroundImage:
          'radial-gradient(rgba(0,114,206,0.10) 1.2px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="max-w-xl w-full">
        {/* Friend tape — only when a friend's data is in the link */}
        {decoded && (
          <div className="relative z-10 mx-6 -rotate-2 bg-[#FFE066] px-3 pb-2 pt-[9px] text-center text-[#0C1220] shadow-[2px_2px_0_rgba(12,18,32,0.35)]">
            <div
              className={`${displayFont.className} text-[19px] uppercase leading-none tracking-[1.2px]`}
            >
              Your friend {name ?? 'A Fan'}
            </div>
            <div className="mt-[3px] text-[10.5px] font-bold uppercase tracking-[2.4px]">
              Sent you their Taste DNA
            </div>
          </div>
        )}

        {/* Poster card */}
        <div
          className="relative z-0 -mt-2 rounded-[18px] border-[3px] border-[#0C1220] bg-[#039AD1] px-5 pb-5 pt-[30px] text-center shadow-[6px_6px_0_#0C1220]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
            backgroundSize: '20px 20px',
          }}
        >
          <span
            className={`${displayFont.className} inline-block rounded-full bg-[#0C1220] px-[14px] pb-[4px] pt-[6px] text-[14px] tracking-[3px] text-white`}
          >
            WEEZER TASTE DNA
          </span>

          <h1
            className={`${displayFont.className} mt-[14px] text-[clamp(38px,10vw,56px)] leading-[1.04] text-white [-webkit-text-stroke:1.5px_#0C1220] [text-shadow:4px_4px_0_#0C1220]`}
          >
            {decoded ? (
              <>
                RANKED ALL <span className="text-[#FFE066]">206</span>
                <br />
                WEEZER SONGS.
              </>
            ) : (
              <>
                RANK ALL <span className="text-[#FFE066]">206</span>
                <br />
                WEEZER SONGS.
              </>
            )}
          </h1>

          <p className="mt-2 text-[16.5px] font-bold leading-[1.35] text-white [text-shadow:1px_1px_0_rgba(12,18,32,0.45)]">
            Every album. Every deep cut.
            {decoded && (
              <>
                <br />
                And they have opinions.
              </>
            )}
          </p>

          {/* DNA facts — only with a friend's data to show */}
          {decoded && (
            <div className="mt-[22px] space-y-[14px]">
              <div className="rounded-[14px] border-[3px] border-[#0C1220] bg-white px-[14px] pb-[10px] pt-3 shadow-[4px_4px_0_#0C1220]">
                <div className="mb-[3px] text-[10.5px] font-black uppercase tracking-[2.6px] text-[#0072CE]">
                  Top Anthem
                </div>
                <div
                  className={`${displayFont.className} text-[31px] leading-[1.05] text-[#0C1220]`}
                >
                  &ldquo;{anthem}&rdquo;
                </div>
              </div>

              <div className="rounded-[14px] border-[3px] border-[#0C1220] bg-white px-[14px] pb-[10px] pt-3 shadow-[4px_4px_0_#0C1220]">
                <div className="mb-[3px] text-[10.5px] font-black uppercase tracking-[2.6px] text-[#0072CE]">
                  Top Album
                </div>
                <div
                  className={`${displayFont.className} text-[25px] leading-[1.05] text-[#0C1220]`}
                >
                  {album}
                </div>
              </div>

              <div className="rounded-[14px] border-[3px] border-[#0C1220] bg-[#0C1220] px-[14px] pb-[10px] pt-3 shadow-[4px_4px_0_#0C1220]">
                <div className="mb-[3px] text-[10.5px] font-black uppercase tracking-[2.6px] text-[#FFE066]">
                  Vibe
                </div>
                <div
                  className={`${displayFont.className} text-[19px] uppercase leading-[1.05] tracking-[0.6px] text-white`}
                >
                  {vibe}
                </div>
              </div>
            </div>
          )}

          <div
            className={`${displayFont.className} mt-5 text-[24px] text-white [-webkit-text-stroke:1px_#0C1220] [text-shadow:3px_3px_0_#0C1220]`}
          >
            {decoded ? 'THINK YOUR LIST BEATS THEIRS?' : 'DO YOU HAVE BETTER TASTE?'}
          </div>

          <Link
            href="/"
            className={`${displayFont.className} mt-[14px] block rounded-full border-[3px] border-[#0C1220] bg-white px-[10px] pb-3 pt-[15px] text-[22px] uppercase tracking-[0.6px] text-[#0C1220] shadow-[4px_4px_0_#0C1220] transition-all hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#0C1220]`}
          >
            Start My Ranking
          </Link>

          {/* Standard card footer (the Round 1 system footer, in
              the share design's white-on-blue register) */}
          <div className="mt-5 border-t-2 border-white/50 pt-3 text-white">
            <div className="flex items-center justify-center gap-2 text-[9.5px] font-black uppercase tracking-[1.6px]">
              <svg
                viewBox="0 0 1000 550"
                className="h-[14px] w-[26px] shrink-0"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M 0,0 L 240,0 L 330,260 L 500,150 L 670,260 L 760,0 L 1000,0 L 1000,65 L 870,65 L 870,125 L 960,125 L 960,190 L 760,190 L 630,540 L 500,310 L 370,540 L 240,190 L 40,190 L 40,125 L 130,125 L 130,65 L 0,65 Z" />
              </svg>
              <span>All My Favorite Songs · The Weezer Song Ranking Project</span>
            </div>
            <div className={`${handFont.className} mt-[3px] text-[21px] font-bold leading-none`}>
              Join the debate at rankingweezer.com
            </div>
          </div>
        </div>

        <p
          className={`${handFont.className} mt-[18px] text-center text-[20px] font-bold text-[#3D4A63]`}
        >
          Free. No account needed to start.
        </p>
      </div>
    </div>
  );
}
