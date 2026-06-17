'use client';

// Company logo with a graceful gold-monogram fallback. Tries the logo.dev ticker
// endpoint (publishable token, fallback=404 so a miss errors); on any failure, or when
// no token is configured, renders the same gold-gradient monogram the app used before.
// Nothing ever shows a broken image. Attribution lives on the public /about page.
import { useState } from 'react';

const TOKEN = process.env.NEXT_PUBLIC_LOGODEV_TOKEN;

export function CompanyLogo({
  ticker,
  size = 32,
  shape = 'rounded',
  className = '',
}: {
  ticker: string;
  size?: number;
  shape?: 'rounded' | 'circle' | 'square';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const sym = (ticker || '').toUpperCase();
  const radius = shape === 'circle' ? '9999px' : shape === 'square' ? '0px' : `${Math.max(4, Math.round(size * 0.22))}px`;
  const base: React.CSSProperties = { width: size, height: size, borderRadius: radius, flexShrink: 0 };

  if (TOKEN && !failed && sym) {
    // theme=dark returns the logo made for a dark background, so it sits transparently on
    // the app (no white tile, no ring). contain = never cropped. 3x size = crisp.
    const px = Math.min(800, Math.max(96, Math.round(size * 3)));
    const src = `https://img.logo.dev/ticker/${encodeURIComponent(sym)}?token=${TOKEN}&size=${px}&format=png&theme=dark&fallback=404`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={sym}
        onError={() => setFailed(true)}
        className={className}
        style={{ ...base, objectFit: 'contain' }}
      />
    );
  }

  return (
    <div
      className={className}
      aria-label={sym}
      style={{
        ...base,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--color-gold) 0%, #b8860b 100%)',
        color: '#0A0A0A',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        fontSize: Math.round(size * 0.38),
        letterSpacing: '-0.02em',
      }}
    >
      {sym.slice(0, 2)}
    </div>
  );
}
