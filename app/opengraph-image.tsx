import { ImageResponse } from 'next/og';

export const alt = 'Helm Terminal — AI-Powered Financial Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
        {/* Meridian Mark — simplified */}
        <svg width="64" height="64" viewBox="0 0 56 56" fill="none">
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
            marginTop: '40px',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#E8ECF1',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            Helm Terminal
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: '#8A94A6',
              marginTop: '16px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
            }}
          >
            AI-Powered Financial Intelligence
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '48px',
            fontSize: '14px',
            color: '#505A6B',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
          }}
        >
          <span>Net Worth</span>
          <span style={{ color: '#B8914A' }}>|</span>
          <span>Portfolio</span>
          <span style={{ color: '#B8914A' }}>|</span>
          <span>Tax Intelligence</span>
          <span style={{ color: '#B8914A' }}>|</span>
          <span>Market Data</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
