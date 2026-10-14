'use client';

// The cookie notice for Helm Outbound pages, in the page's own style. Same
// storage key and behavior as the site-wide banner (useCookieConsent), which
// stands aside on these routes. Render it inside the page root so it picks up
// the page font and color tokens. Wording lives in COOKIE_NOTICE in copy.ts.

import Link from 'next/link';
import { useCookieConsent } from '@/components/cookie-consent';
import { COOKIE_NOTICE } from './copy';
import styles from './cookie-notice.module.css';

export function OutboundCookieNotice() {
  const { visible, accept } = useCookieConsent();
  if (!visible) return null;

  return (
    <div className={styles.notice} role="region" aria-label="Cookie notice">
      <p className={styles.text}>
        {COOKIE_NOTICE.text}{' '}
        <Link href={COOKIE_NOTICE.link.href} className={styles.link}>
          {COOKIE_NOTICE.link.label}
        </Link>
      </p>
      <button type="button" onClick={accept} className={styles.button}>
        {COOKIE_NOTICE.button}
      </button>
    </div>
  );
}
