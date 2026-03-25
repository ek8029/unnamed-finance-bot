import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A0A',
          borderRadius: 36,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 56 56" fill="none">
          <path
            d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
            stroke="#B8914A"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" stroke-width="2.5" stroke-linecap="round" />
          <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="28" cy="7" r="4.5" fill="#B8914A" />
          <circle cx="28" cy="28" r="6" fill="#E8ECF1" />
          <circle cx="28" cy="28" r="3" fill="#B8914A" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
