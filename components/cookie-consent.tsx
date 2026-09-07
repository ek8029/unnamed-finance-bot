'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('helm-cookie-consent')) setVisible(true);
    } catch {
      // Storage blocked (private mode, storage disabled): it cannot be remembered, so show it and let it close.
      setVisible(true);
    }
  }, []);

  const accept = () => {
    // Hide FIRST. When localStorage is blocked, setItem throws, and the old order never
    // reached setVisible(false): one visitor clicked Got it six times and left the site.
    setVisible(false);
    try {
      localStorage.setItem('helm-cookie-consent', 'accepted');
    } catch {
      // not remembered; it closes anyway
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-3">
        We use essential cookies for authentication. No tracking cookies are used.{' '}
        <Link href="/privacy" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">
          Privacy Policy
        </Link>
      </p>
      <button
        onClick={accept}
        className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded transition-colors hover:bg-[var(--color-gold-hi)]"
      >
        Got it
      </button>
    </div>
  );
}
