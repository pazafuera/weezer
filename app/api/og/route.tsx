// app/api/og/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { decodeShareData } from '@/utils/shareHelper';

export const runtime = 'edge';

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
            backgroundColor: '#0f172a',
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '40px',
            position: 'relative',
          }}
        >
          {/* Top Blue Accent Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '12px',
              backgroundColor: '#0072CE',
            }}
          />

          {/* Header */}
          <div
            style={{
              fontSize: 28,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: '4px',
              marginBottom: '24px',
              fontWeight: 900,
              display: 'flex',
            }}
          >
            {name}'s Weezer Taste DNA
          </div>

          {/* Main Card Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              padding: '36px 50px',
              borderRadius: '24px',
              width: '85%',
              border: '2px solid #334155',
            }}
          >
            <div
              style={{
                fontSize: 22,
                color: '#93c5fd',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '8px',
                fontWeight: 700,
                display: 'flex',
              }}
            >
              Top Anthem
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                color: '#ffffff',
                marginBottom: '32px',
                textAlign: 'center',
                lineHeight: 1.1,
                display: 'flex',
              }}
            >
              "{anthem}"
            </div>

            <div
              style={{
                fontSize: 22,
                color: '#93c5fd',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '8px',
                fontWeight: 700,
                display: 'flex',
              }}
            >
              Top Album
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: '32px',
                textAlign: 'center',
                display: 'flex',
              }}
            >
              {album}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0f172a',
                padding: '12px 28px',
                borderRadius: '100px',
                border: '1px solid #334155',
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  color: '#94a3b8',
                  fontWeight: 700,
                  marginRight: '10px',
                }}
              >
                Vibe:
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#fbbf24',
                  textTransform: 'uppercase',
                }}
              >
                {vibe}
              </span>
            </div>
          </div>

          {/* Footer Branding */}
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              fontSize: 18,
              color: '#64748b',
              fontWeight: 700,
              letterSpacing: '2px',
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