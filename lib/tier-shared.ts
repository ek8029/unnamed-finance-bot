// Client-safe tier primitives (no server imports). Shared by lib/tier.ts
// (server) and the client preview/lock components.
//
// MAX IS RETIRED (Aug 2026). Three tiers with zero arm's-length payers was
// segmentation of an empty set, and every Max-only surface (the agent, factor
// lens, thesis builder, cross-position risk) now sits in Pro. The string still
// exists in user_subscriptions rows and in old Stripe prices, so it survives
// here as a LEGACY INPUT ONLY: normalizeTier() folds it into 'pro' at the read
// boundary and nothing downstream can see it.

export type Tier = 'free' | 'pro';

/** What a subscription row or Stripe price may historically contain. */
export type StoredTier = Tier | 'max';

/** Fold retired tiers into the live ones. The one coercion point. */
export function normalizeTier(stored: string | null | undefined): Tier {
  return stored === 'pro' || stored === 'max' ? 'pro' : 'free';
}

// free < pro.
export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1 };

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

export const TIER_META: Record<Tier, { label: string; price: string; color: string }> = {
  free: { label: 'Free', price: '', color: '#8A8A8A' },
  pro: { label: 'Pro', price: '$20/mo', color: '#E6B94D' },
};
