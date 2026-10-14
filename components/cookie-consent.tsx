'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export const COOKIE_CONSENT_KEY = 'helm-cookie-consent';

// Routes that render their own consent notice (same key, same behavior) in
// their own visual style. Helm Outbound is client facing and does not use the
// Helm Terminal look; see components/outbound/cookie-notice.tsx.
const OWN_NOTICE_PREFIXES = ['/outbound'];

export function hasOwnConsentNotice(path: string | null) {
  return !!path && OWN_NOTICE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

// Shared by the site-wide banner and any route-specific notice, so accepting
// on one page counts everywhere.
export function useCookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true);
    } catch {
      // Storage blocked (private mode, storage disabled): it cannot be remembered, so show it and let it close.
      setVisible(true);
    }
  }, []);

  const accept = useCallback(() => {
    // Hide FIRST. When localStorage is blocked, setItem throws, and the old order never
    // reached setVisible(false): one visitor clicked Got it six times and left the site.
    setVisible(false);
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    } catch {
      // not remembered; it closes anyway
    }
  }, []);

  return { visible, accept };
}

export function CookieConsent() {
  const path = usePathname();
  const { visible, accept } = useCookieConsent();

  if (!visible || hasOwnConsentNotice(path)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-3">
        We use cookies to keep you signed in and optional analytics to improve Helm.
        Manage analytics in Settings &gt; Data &amp; Privacy.{' '}
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
