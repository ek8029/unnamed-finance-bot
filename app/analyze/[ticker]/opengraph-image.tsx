import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const alt = 'Stock Analysis — Helm Terminal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  const logoData = await readFile(join(process.cwd(), 'public', 'helm-logo.png'));
  const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;

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
          padding: '80px',
        }}
      >
        <img src={logoBase64} width={120} height={120} alt="" />

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
