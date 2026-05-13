import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Helm Wrapped — Your 2025 Investment Year in Review';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
            width: 700,
            height: 700,
            background:
              'radial-gradient(circle, rgba(230,185,77,0.08) 0%, transparent 60%)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            gap: 24,
          }}
        >
          {/* Big return number */}
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: '#4ADE80',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            +28.4%
          </div>

          {/* Label */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#E6B94D',
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
            }}
          >
            YOUR 2025 WRAPPED
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
            helmterminal.dev/wrapped
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
