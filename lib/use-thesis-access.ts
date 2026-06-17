'use client';

// Client allowlist check for embedded thesis surfaces (WhyIOwnThis on the
// holdings + portfolio pages). Reads the signed-in user's email from the existing
// profile endpoint and returns whether the thesis layer is enabled for them.
// The real security boundary is server-side (middleware + the gated /api/thesis
// routes); this only hides UI so non-allowlisted users never see the feature.

import { useEffect, useState } from 'react';
import { isThesisUser } from '@/lib/thesis-access';
import { useTier } from '@/hooks/use-tier';

// Thesis layer is a Pro feature, with the email allowlist as a backstop (founder +
// comped testers). Mirrors the server-side hasThesisAccess. UI-only; the real
// boundary is the gated /api/thesis routes.
export function useThesisEnabled(): boolean {
  const { isPro } = useTier();
  const [allowlisted, setAllowlisted] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/user/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setAllowlisted(isThesisUser(d?.profile?.email));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return isPro || allowlisted;
}
