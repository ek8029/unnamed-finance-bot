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

  const gridLines = [];
  const spacing = 60;
  for (let x = 0; x <= 1200; x += spacing) {
    gridLines.push(
      <div key={`v${x}`} style={{ position: 'absolute', left: x, top: 0, width: 1, height: 630, background: 'rgba(230,185,77,0.04)' }} />
    );
  }
  for (let y = 0; y <= 630; y += spacing) {
    gridLines.push(
      <div key={`h${y}`} style={{ position: 'absolute', left: 0, top: y, width: 1200, height: 1, background: 'rgba(230,185,77,0.04)' }} />
    );
  }

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
        {gridLines}

        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(230,185,77,0.06) 0%, transparent 70%)', display: 'flex' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          <img src={logoBase64} width={80} height={80} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 96, fontWeight: 800, color: '#E8ECF1', letterSpacing: '-0.03em', lineHeight: 1 }}>
              ${symbol}
            </div>
            <div style={{ fontSize: 20, fontWeight: 400, color: '#8A94A6', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 8 }}>
              AI Stock Analysis
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', position: 'absolute', bottom: 40, fontSize: 14, color: '#505A6B', letterSpacing: '0.08em' }}>
          helmterminal.dev/analyze
        </div>
      </div>
    ),
    { ...size },
  );
}
