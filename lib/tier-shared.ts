// Client-safe tier primitives (no server imports). Shared by lib/tier.ts
// (server) and the client preview/lock components.

export type Tier = 'free' | 'pro' | 'max';

// free < pro < max. Max is a superset of Pro access.
export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, max: 2 };

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

export const TIER_META: Record<Tier, { label: string; price: string; color: string }> = {
  free: { label: 'Free', price: '', color: '#8A8A8A' },
  pro: { label: 'Pro', price: '$20/mo', color: '#E6B94D' },
  max: { label: 'Max', price: '$50/mo', color: '#FFD67A' },
};
