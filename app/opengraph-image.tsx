import { ImageResponse } from 'next/og';

export const alt = 'Helm Terminal — Institutional-grade financial intelligence for individuals';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const gridLines = [];
  const spacing = 80;
  for (let x = 0; x <= 1200; x += spacing) {
    gridLines.push(
      <div key={`v${x}`} style={{ position: 'absolute', left: x, top: 0, width: 1, height: 630, background: 'rgba(230,185,77,0.03)' }} />
    );
  }
  for (let y = 0; y <= 630; y += spacing) {
    gridLines.push(
      <div key={`h${y}`} style={{ position: 'absolute', left: 0, top: y, width: 1200, height: 1, background: 'rgba(230,185,77,0.03)' }} />
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

        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(230,185,77,0.05) 0%, transparent 60%)', display: 'flex' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', gap: 28 }}>
          <svg width="80" height="80" viewBox="0 0 56 56" fill="none">
            <path
              d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
              stroke="#B8914A"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="28" cy="7" r="4.5" fill="#B8914A" />
            <circle cx="28" cy="28" r="6" fill="#E8ECF1" />
            <circle cx="28" cy="28" r="3" fill="#B8914A" />
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#FAFAFA', letterSpacing: '-0.02em', lineHeight: 1 }}>
              HELM TERMINAL
            </div>
            <div style={{ fontSize: 18, fontWeight: 400, color: '#8A8A8A', letterSpacing: '0.08em', textTransform: 'uppercase' as const, textAlign: 'center' as const, maxWidth: 500 }}>
              Institutional-grade financial intelligence for individuals
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8914A' }} />
          <div style={{ fontSize: 13, color: '#525252', letterSpacing: '0.06em' }}>
            helmterminal.dev
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
