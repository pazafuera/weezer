// app/api/og-default/route.tsx
// The site's DEFAULT share-preview image (1200×630), used for plain
// rankingweezer.com links (layout.tsx metadata). Branded, no personal
// data. The PERSONALIZED share-card generator lives at /api/og and is
// only for /share links carrying a ?data= payload — it must not be the
// site default (with no data it renders placeholder text).
import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

// The flying-W path, same mark as FlyingWIcon in components/SharedUI.tsx.
const FLYING_W_PATH =
  'M 0,0 L 240,0 L 330,260 L 500,150 L 670,260 L 760,0 L 1000,0 L 1000,65 L 870,65 L 870,125 L 960,125 L 960,190 L 760,190 L 630,540 L 500,310 L 370,540 L 240,190 L 40,190 L 40,125 L 130,125 L 130,65 L 0,65 Z';

export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#039AD1',
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '48px 64px',
            position: 'relative',
          }}
        >
          {/* Flying W — black silhouette on the bright-blue field,
              the shareables poster language. */}
          <svg
            width={330}
            height={182}
            viewBox="0 0 1000 550"
            fill="#0B0B0C"
            style={{ marginBottom: '30px' }}
          >
            <path d={FLYING_W_PATH} />
          </svg>

          {/* Site title */}
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '-1px',
              textAlign: 'center',
              lineHeight: 1.02,
              display: 'flex',
            }}
          >
            All My Favorite Songs
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 27,
              fontWeight: 800,
              color: '#0B0B0C',
              textTransform: 'uppercase',
              letterSpacing: '6px',
              marginTop: '22px',
              display: 'flex',
            }}
          >
            The Weezer Song Ranking Project
          </div>

          {/* Supporting line */}
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              textAlign: 'center',
              marginTop: '26px',
              display: 'flex',
            }}
          >
            Rank all 206 Weezer songs — and find out how deep your fanhood is.
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: 34,
              fontSize: 21,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '4px',
              display: 'flex',
            }}
          >
            RANKINGWEEZER.COM
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response('Failed to generate image', { status: 500 });
  }
}
