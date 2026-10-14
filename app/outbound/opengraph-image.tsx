import { ImageResponse } from 'next/og';
import { BRAND, HERO } from '@/components/outbound/copy';

// Share card for /outbound in the page's own dawn palette, so a link sent to
// a prospect does not preview as Helm Terminal.
export const alt = `${BRAND.wordmark}: ${HERO.headline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(to bottom, #cdcad3 0%, #dcd3d4 30%, #ebd1c0 58%, #f1bf9f 84%, #f5d2b4 100%)',
          color: '#101828',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>
          <svg width="40" height="40" viewBox="0 0 56 56" fill="none">
            <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94" stroke="#101828" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="28" y1="7" x2="28" y2="49" stroke="rgba(16,24,40,0.45)" strokeWidth="4" strokeLinecap="round" />
            <line x1="7" y1="28" x2="49" y2="28" stroke="rgba(16,24,40,0.45)" strokeWidth="4" strokeLinecap="round" />
            <circle cx="28" cy="28" r="9" fill="#101828" />
          </svg>
          {BRAND.wordmark}
        </div>
        <div style={{ display: 'flex', fontSize: 60, lineHeight: 1.08, fontWeight: 500, letterSpacing: '-0.035em', maxWidth: 1056 }}>
          {HERO.headline}
        </div>
      </div>
    ),
    { ...size },
  );
}
