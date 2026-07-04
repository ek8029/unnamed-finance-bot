/**
 * User tier & quota utilities.
 *
 * Free tier: 5 AI analyses per day, basic alerts, core dashboard.
 * Pro tier:  Unlimited analyses, full intelligence feed,
 *            tax-loss harvesting, earnings impact, Portfolio Wrapped.
 */

import { createClient } from '@/lib/supabase/server';

import { tierAtLeast, TIER_RANK, type Tier } from '@/lib/tier-shared';
export { tierAtLeast, TIER_RANK, type Tier };

const FREE_DAILY_ANALYSIS_LIMIT = 5;

// ── Features gated behind Pro ──
export const PRO_FEATURES = [
  'tax_opportunities',
  'earnings_impact',
  'portfolio_wrapped',
  'full_intelligence_feed',
  'unlimited_analysis',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

// ── Get user tier ──

export interface SubscriptionInfo {
  tier: Tier;
  /** Non-null while a Plaid-connect trial is active (tier already reflects it). */
  trialEndsAt: string | null;
}

/**
 * Effective subscription: applies the 14-day Pro trial lazily at read time.
 * A trial row is tier='pro' + trial_ends_at set + no Stripe subscription;
 * once trial_ends_at passes it reads as 'free' — no cron, no write needed.
 * Paid checkouts clear trial_ends_at via the Stripe webhook upsert.
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier, trial_ends_at, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();

  const tier = (data?.tier as Tier) ?? 'free';
  const trialEndsAt: string | null = data?.trial_ends_at ?? null;
  if (trialEndsAt && !data?.stripe_subscription_id) {
    if (new Date(trialEndsAt).getTime() > Date.now()) {
      return { tier, trialEndsAt };
    }
    return { tier: 'free', trialEndsAt: null }; // trial expired, never paid
  }
  return { tier, trialEndsAt: null };
}

export async function getUserTier(userId: string): Promise<Tier> {
  return (await getSubscriptionInfo(userId)).tier;
}

// ── Check analysis quota (for AI analysis endpoint) ──

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
}

export async function checkAnalysisQuota(userId: string): Promise<QuotaCheck> {
  const tier = await getUserTier(userId);

  if (tierAtLeast(tier, 'pro')) {
    return { allowed: true, used: 0, limit: null, remaining: null };
  }

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('analysis_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString());

  const used = count ?? 0;
  const remaining = Math.max(0, FREE_DAILY_ANALYSIS_LIMIT - used);

  return {
    allowed: used < FREE_DAILY_ANALYSIS_LIMIT,
    used,
    limit: FREE_DAILY_ANALYSIS_LIMIT,
    remaining,
  };
}

// ── Record an analysis usage ──

export async function recordAnalysisUsage(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('analysis_usage').insert({ user_id: userId });
}

// ── Check if user has access to a Pro feature ──

export async function requirePro(userId: string): Promise<{ allowed: boolean }> {
  const tier = await getUserTier(userId);
  return { allowed: tierAtLeast(tier, 'pro') };
}

// ── Check if user has Max-tier access ──

export async function requireMax(userId: string): Promise<{ allowed: boolean }> {
  const tier = await getUserTier(userId);
  return { allowed: tierAtLeast(tier, 'max') };
}
