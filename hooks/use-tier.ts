import { useState, useEffect } from 'react';

export interface TierInfo {
  tier: 'free' | 'pro';
  quota: {
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
  };
}

export function useTier() {
  const [data, setData] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/tier')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return {
    tier: data?.tier ?? 'free',
    quota: data?.quota ?? null,
    isPro: data?.tier === 'pro',
    loading,
  };
}
