import { useState, useEffect } from 'react';
import { cachedGet } from '@/lib/api-cache';

export interface TierInfo {
  tier: 'free' | 'pro' | 'max';
  /** Tier as the subscriptions table has it — ignores the open-access window. */
  realTier?: 'free' | 'pro' | 'max';
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
    let active = true;
    const MAX_ATTEMPTS = 5;

    // On first login the auth cookie can take a beat to propagate, so /api/user/tier
    // 401s momentarily. The old code parsed that 401 body as the tier payload, landed
    // on tier=undefined -> 'free', and never retried, so a paying user got stuck on
    // "Free Tier" with paid nav hidden. Retry the 401 with backoff and only ever set
    // state from a real 200 payload.
    async function load() {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && active; attempt++) {
        // cachedGet caches a 2xx only, so the 401 below is always a live answer
        // and the retry keeps working. status 0 is the network error the old
        // try/catch handled; it retries on the same backoff.
        const res = await cachedGet<TierInfo>('/api/user/tier');
        if (res.ok && res.data) {
          if (active) setData(res.data);
          return;
        }
        if (res.status === 0) {
          if (attempt === MAX_ATTEMPTS) { console.error('tier lookup failed (network)'); return; }
        } else if (res.status !== 401 || attempt === MAX_ATTEMPTS) {
          return; // give up quietly
        }
        await new Promise(r => setTimeout(r, 400 * attempt)); // 0.4s .. 1.6s backoff
      }
    }

    load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const tier = data?.tier ?? 'free';
  return {
    tier,
    realTier: data?.realTier ?? tier,
    quota: data?.quota ?? null,
    isPro: tier === 'pro' || tier === 'max', // max is a superset of pro
    isMax: tier === 'max',
    loading,
  };
}
