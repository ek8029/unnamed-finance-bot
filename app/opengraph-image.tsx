import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const alt = 'Helm Terminal - AI-Powered Financial Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {gridLines}

        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(230,185,77,0.06) 0%, transparent 70%)', display: 'flex' }} />

        <img src={logoBase64} width={280} height={280} alt="" style={{ position: 'relative' }} />
      </div>
    ),
    { ...size },
  );
}
