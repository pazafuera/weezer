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
        name = decoded.n ? decoded.n.slice(0, 20) : 'A Fan';
        anthem = decoded.t ? decoded.t.slice(0, 40) : 'Undecided';
        album = decoded.a ? decoded.a.slice(0, 30) : 'Unknown Album';
        vibe = decoded.v ? decoded.v.slice(0, 30) : 'Weezer Scientist';
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
            backgroundImage: 'linear-gradient(to bottom right, #0072CE, #0f172a)',
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '40px',
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: 28,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: '4px',
              marginBottom: '30px',
              fontWeight: 900,
            }}
          >
            {name}&apos;s Weezer Taste DNA
          </div>

          {/* Main Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '40px 60px',
              borderRadius: '30px',
              width: '85%',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: '#93c5fd',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '10px',
                fontWeight: 700,
              }}
            >
              Top Anthem
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 900,
                marginBottom: '40px',
                textAlign: 'center',
                lineHeight: 1.1,
              }}
            >
              &quot;{anthem}&quot;
            </div>

            <div
              style={{
                fontSize: 24,
                color: '#93c5fd',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '10px',
                fontWeight: 700,
              }}
            >
              Top Album
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                marginBottom: '40px',
                textAlign: 'center',
              }}
            >
              {album}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '15px',
                backgroundColor: 'rgba(0,0,0,0.3)',
                padding: '15px 30px',
                borderRadius: '100px',
              }}
            >
              <span style={{ fontSize: 24, color: '#94a3b8', fontWeight: 700 }}>
                Vibe:
              </span>
              <span
                style={{
                  fontSize: 32,
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
              bottom: 35,
              fontSize: 20,
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 700,
              letterSpacing: '2px',
            }}
          >
            FAMDUEL.COM/WEEZER
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e: any) {
    return new Response('Failed to generate image', { status: 500 });
  }
}