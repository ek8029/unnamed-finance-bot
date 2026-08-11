'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';

/**
 * Persistent signup CTA for mobile readers on long-form pages.
 *
 * Blog posts are where search traffic lands, and they had no CTA that survived
 * scrolling: a reader who got convinced in paragraph nine had to scroll back to
 * the top to act. Desktop keeps the inline links, so this is `md:hidden`.
 *
 * It stays hidden until the reader is past the opening so it does not cover the
 * lede on first paint, and it hides again near the foot of the page so it never
 * sits on top of the footer's own links.
 */
export function StickyMobileCta({
  href = '/signup',
  label = 'Open the terminal',
  source = 'blog',
}: {
  href?: string;
  label?: string;
  source?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Respect a reader who has not committed yet: 600px in, and never within
    // 240px of the bottom where the footer's own CTAs live.
    const onScroll = () => {
      const y = window.scrollY;
      const nearFoot =
        y + window.innerHeight > document.documentElement.scrollHeight - 240;
      setShow(y > 600 && !nearFoot);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-3 transition-transform duration-200 ${
        show ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
      style={{
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        background:
          'linear-gradient(to top, rgba(6,6,6,0.98) 60%, rgba(6,6,6,0))',
      }}
    >
      <Link
        href={href}
        tabIndex={show ? 0 : -1}
        onClick={() => posthog.capture('sticky_cta_clicked', { source })}
        className="flex items-center justify-center min-h-[48px] w-full rounded-[5px] bg-[var(--color-gold)] text-black font-[family-name:var(--font-mono)] text-[12px] font-bold tracking-[0.16em] uppercase shadow-[0_6px_22px_rgba(230,185,77,0.22)] active:bg-[var(--color-gold-hi)]"
      >
        {label} &rarr;
      </Link>
    </div>
  );
}
