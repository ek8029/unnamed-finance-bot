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
          background: '#070C17',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        {/* Meridian Mark */}
        <svg width="48" height="48" viewBox="0 0 56 56" fill="none">
          <path
            d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
            stroke="#B8914A"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
          <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
          <circle cx="28" cy="28" r="10" fill="#B8914A" />
        </svg>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '36px',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#E8ECF1',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {symbol}
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: '#8A94A6',
              marginTop: '16px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
            }}
          >
            AI Stock Analysis
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginTop: '44px',
            fontSize: '14px',
            color: '#505A6B',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
          }}
        >
          <span>Real-time Data</span>
          <span style={{ color: '#B8914A' }}>|</span>
          <span>Analyst Consensus</span>
          <span style={{ color: '#B8914A' }}>|</span>
          <span>Earnings</span>
          <span style={{ color: '#B8914A' }}>|</span>
          <span>News Sentiment</span>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '13px',
            color: '#505A6B',
            letterSpacing: '0.05em',
          }}
        >
          helmterminal.dev/analyze
        </div>
      </div>
    ),
    { ...size },
  );
}
