/**
 * User tier & quota utilities.
 *
 * Free tier: 5 AI analyses per day, basic alerts, core dashboard.
 * Pro tier:  Unlimited analyses, full intelligence feed,
 *            tax-loss harvesting, earnings impact, Portfolio Wrapped.
 */

import { createClient } from '@/lib/supabase/server';

export type Tier = 'free' | 'pro';

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

export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle();

  return (data?.tier as Tier) ?? 'free';
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

  if (tier === 'pro') {
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
  return { allowed: tier === 'pro' };
}
