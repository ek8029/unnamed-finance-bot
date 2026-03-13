import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D1117',
          borderRadius: 6,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 56 56" fill="none">
          <path
            d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
            stroke="#B8914A"
            stroke-width="4.5"
            stroke-linecap="round"
          />
          <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" stroke-width="5" stroke-linecap="round" />
          <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" stroke-width="5" stroke-linecap="round" />
          <circle cx="28" cy="28" r="10" fill="#B8914A" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
