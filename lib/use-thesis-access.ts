'use client';

// Client allowlist check for embedded thesis surfaces (WhyIOwnThis on the
// holdings + portfolio pages). Reads the signed-in user's email from the existing
// profile endpoint and returns whether the thesis layer is enabled for them.
// The real security boundary is server-side (middleware + the gated /api/thesis
// routes); this only hides UI so non-allowlisted users never see the feature.

import { useEffect, useState } from 'react';
import { isThesisUser } from '@/lib/thesis-access';

export function useThesisEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/user/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setEnabled(isThesisUser(d?.profile?.email));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
