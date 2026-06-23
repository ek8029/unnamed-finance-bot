import { useState, useEffect } from 'react';

export interface TierInfo {
  tier: 'free' | 'pro' | 'max';
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

  const tier = data?.tier ?? 'free';
  return {
    tier,
    quota: data?.quota ?? null,
    isPro: tier === 'pro' || tier === 'max', // max is a superset of pro
    isMax: tier === 'max',
    loading,
  };
}
