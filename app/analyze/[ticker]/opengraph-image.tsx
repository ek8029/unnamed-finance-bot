import { ImageResponse } from 'next/og';

export const alt = 'Stock Analysis — Helm Terminal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0A',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gold radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 600,
            background:
              'radial-gradient(circle, rgba(230,185,77,0.06) 0%, transparent 60%)',
            display: 'flex',
          }}
        />

        {/* Ticker + label */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: '#FAFAFA',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            ${symbol}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#E6B94D',
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              marginTop: 16,
            }}
          >
            AI Stock Analysis
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#E6B94D',
            }}
          />
          <div
            style={{
              fontSize: 13,
              color: '#525252',
              letterSpacing: '0.06em',
            }}
          >
            helmterminal.dev/analyze
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
