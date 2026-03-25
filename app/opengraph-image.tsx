import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const alt = 'Helm Terminal - AI-Powered Financial Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
          padding: '60px',
        }}
      >
        <img src={logoBase64} width={180} height={180} alt="" />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '32px',
          }}
        >
          <div
            style={{
              fontSize: '52px',
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
              fontSize: '22px',
              fontWeight: 400,
              color: '#8A94A6',
              marginTop: '16px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
            }}
          >
            Institutional-Grade Financial Intelligence
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '40px',
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
