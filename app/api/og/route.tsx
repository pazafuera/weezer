// app/api/og/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { decodeShareData } from '@/utils/shareHelper';

export const runtime = 'edge';

/* Display fonts for the poster design, bundled beside the route
 * and loaded as ArrayBuffers for ImageResponse (the documented
 * @vercel/og pattern — the built-in font can't carry the poster
 * look). Lilita One: the app's display font (next/font in
 * components/shareables/fonts.ts). Caveat 700: its handwritten
 * annotation font. Files: LilitaOne-Regular.ttf (google/fonts),
 * Caveat-Bold.ttf (static 700, latin). */
const lilitaFont = fetch(
  new URL('./fonts/LilitaOne-Regular.ttf', import.meta.url)
).then((res) => res.arrayBuffer());
const caveatFont = fetch(
  new URL('./fonts/Caveat-Bold.ttf', import.meta.url)
).then((res) => res.arrayBuffer());

const INK = '#0C1220';
const POSTER = '#039AD1';
const TAPE = '#FFE066';
const BRAND = '#0072CE';

/* Poster redesign (owner-approved mock, Nov 5): this image is the
 * share page's sibling — same flat poster field, friend tape,
 * giant Lilita headline, three fact boxes, and the ink bottom bar
 * with the challenge + site name; the domain rides top-right in
 * Caveat, as on the shipped poster cards. Payload handling is
 * unchanged from the navy design it replaces: same decodeShareData
 * fields, same per-field defaults, same truncation (name 20,
 * anthem 40, album 30, vibe 30). The payload carries no pronoun,
 * so the challenge is neutral: "THEIRS", not the mock's "HIS". */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataParam = searchParams.get('data');

    let name = 'A Fan';
    let anthem = 'Undecided';
    let album = 'Unknown Album';
    let vibe = 'Weezer Scientist';

    if (dataParam) {
      const decoded = decodeShareData(dataParam);
      if (decoded) {
        if (decoded.n) name = decoded.n.slice(0, 20);
        if (decoded.t) anthem = decoded.t.slice(0, 40);
        if (decoded.a) album = decoded.a.slice(0, 30);
        if (decoded.v) vibe = decoded.v.slice(0, 30);
      }
    }

    const [lilita, caveat] = await Promise.all([lilitaFont, caveatFont]);

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: POSTER,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.16) 2px, transparent 2.1px)',
            backgroundSize: '26px 26px',
            border: `4px solid ${INK}`,
            padding: '44px 60px 0',
            position: 'relative',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Domain, top-right (Caveat, as on the poster cards) */}
          <div
            style={{
              position: 'absolute',
              top: 26,
              right: 48,
              display: 'flex',
              fontFamily: 'Caveat',
              fontWeight: 700,
              fontSize: 30,
              color: '#ffffff',
            }}
          >
            rankingweezer.com
          </div>

          {/* Friend tape */}
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              backgroundColor: TAPE,
              color: INK,
              fontFamily: 'Lilita One',
              fontSize: 26,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              padding: '12px 26px 9px',
              transform: 'rotate(-2deg)',
              boxShadow: '3px 3px 0 rgba(12,18,32,0.5)',
            }}
          >
            Your friend {name}
          </div>

          {/* Headline — the name rides the tape, so the headline
              keeps the mock's line structure for every name. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Lilita One',
              color: '#ffffff',
              fontSize: 74,
              lineHeight: 0.98,
              marginTop: 34,
              WebkitTextStroke: `2px ${INK}`,
              textShadow: `4px 4px 0 ${INK}`,
            }}
          >
            <div style={{ display: 'flex' }}>
              RANKED ALL&nbsp;<span style={{ color: TAPE }}>206</span>
            </div>
            <div style={{ display: 'flex' }}>WEEZER SONGS.</div>
          </div>

          {/* DNA fact boxes */}
          <div style={{ display: 'flex', gap: 24, marginTop: 34 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                backgroundColor: '#ffffff',
                border: `3px solid ${INK}`,
                borderRadius: 12,
                boxShadow: `4px 4px 0 ${INK}`,
                padding: '14px 20px 12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '2.2px',
                  color: BRAND,
                  marginBottom: 4,
                }}
              >
                TOP ANTHEM
              </div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Lilita One',
                  fontSize: 29,
                  lineHeight: 1.05,
                  color: INK,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                &ldquo;{anthem}&rdquo;
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                backgroundColor: '#ffffff',
                border: `3px solid ${INK}`,
                borderRadius: 12,
                boxShadow: `4px 4px 0 ${INK}`,
                padding: '14px 20px 12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '2.2px',
                  color: BRAND,
                  marginBottom: 4,
                }}
              >
                TOP ALBUM
              </div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Lilita One',
                  fontSize: 29,
                  lineHeight: 1.05,
                  color: INK,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {album}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                backgroundColor: INK,
                border: `3px solid ${INK}`,
                borderRadius: 12,
                boxShadow: `4px 4px 0 ${INK}`,
                padding: '14px 20px 12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '2.2px',
                  color: TAPE,
                  marginBottom: 4,
                }}
              >
                VIBE
              </div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Lilita One',
                  fontSize: 29,
                  lineHeight: 1.05,
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {vibe}
              </div>
            </div>
          </div>

          {/* Ink bottom bar: challenge + site */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'auto',
              marginLeft: -60,
              marginRight: -60,
              backgroundColor: INK,
              color: '#ffffff',
              fontFamily: 'Lilita One',
              fontSize: 25,
              letterSpacing: '1px',
              padding: '16px 60px 13px',
            }}
          >
            <span>THINK YOUR LIST BEATS THEIRS?</span>
            <span style={{ color: TAPE }}>RANKINGWEEZER.COM</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Lilita One', data: lilita, weight: 400, style: 'normal' },
          { name: 'Caveat', data: caveat, weight: 700, style: 'normal' },
        ],
      }
    );
  } catch (e: any) {
    return new Response('Failed to generate image', { status: 500 });
  }
}
