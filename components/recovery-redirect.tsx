'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Detects Supabase recovery hash fragments (#access_token=...&type=recovery)
 * on any page and redirects to /reset-password with the hash preserved.
 * This handles the implicit flow where Supabase sends tokens as hash fragments
 * to the site URL instead of a specific callback route.
 */
export function RecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only run if we're NOT already on /reset-password
    if (pathname === '/reset-password') return;

    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Redirect to /reset-password, preserving the hash fragment
      window.location.href = `/reset-password${hash}`;
    }
  }, [pathname, router]);

  return null;
}
