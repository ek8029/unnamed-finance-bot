/**
 * User tier & quota utilities.
 *
 * Free tier: 5 AI analyses per day, basic alerts, core dashboard.
 * Pro tier:  Unlimited analyses (fair-use daily ceiling), full intelligence
 *            feed, tax-loss harvesting, earnings impact, Portfolio Wrapped.
 */

import { createClient } from '@/lib/supabase/server';

import { tierAtLeast, TIER_RANK, normalizeTier, type Tier } from '@/lib/tier-shared';
export { tierAtLeast, TIER_RANK, normalizeTier, type Tier };

const FREE_DAILY_ANALYSIS_LIMIT = 5;
// Fair-use ceiling for Pro: effectively unlimited for a human, but bounds the
// cost of the grounded chat path (a real LLM call per question) against loops
// or abuse.
const PRO_DAILY_ANALYSIS_LIMIT = 100;

// ── Features gated behind Pro ──
export const PRO_FEATURES = [
  'tax_opportunities',
  'earnings_impact',
  'portfolio_wrapped',
  'full_intelligence_feed',
  'unlimited_analysis',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

// ── Open-access window (ENDED) ──
//
// Every signed-in account used to read as Pro regardless of what the table
// said. It was opened so a specific investor could look around without being
// comped in the database, on the reasoning that revenue was coming from a
// raise rather than from the product. He never signed up, the raise has not
// landed, and free-for-everyone is now the thing standing between Helm and its
// first arm's-length payer, so the window is closed.
//
// Closing it does NOT downgrade anyone who was really given access. Of 152
// subscription rows, 138 are free (these are the accounts the window was
// silently upgrading), 4 are permanent comps with no Stripe subscription, 4
// are manual trials still running, and 1 is a live paid subscription. Only the
// 138 change, and they change to what the table already says they are.
//
// Kept as a dated constant rather than deleted: it is the honest record of why
// every metric before this date shows universal Pro access, and re-opening it
// for a demo is a one-line date change.
const OPEN_ACCESS_UNTIL = Date.parse('2026-08-09T00:00:00Z'); // closed 2026-08-09

export function isOpenAccessWindow(): boolean {
  return Date.now() < OPEN_ACCESS_UNTIL;
}

/** Window end (ms epoch) — trials granted during the window start from here. */
export function openAccessWindowEnd(): number {
  return OPEN_ACCESS_UNTIL;
}

// ── Get user tier ──

export interface SubscriptionInfo {
  tier: Tier;
  /** Non-null while a Plaid-connect trial is active (tier already reflects it). */
  trialEndsAt: string | null;
  /** When a never-paid trial ended (so the UI can show the post-trial receipt). */
  lapsedTrialEndedAt: string | null;
}

/**
 * Effective subscription: applies the 14-day Pro trial lazily at read time.
 * A trial row is tier='pro' + trial_ends_at set + no Stripe subscription;
 * once trial_ends_at passes it reads as 'free' — no cron, no write needed.
 * Paid checkouts clear trial_ends_at via the Stripe webhook upsert.
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  if (isOpenAccessWindow()) {
    return { tier: 'pro', trialEndsAt: null, lapsedTrialEndedAt: null };
  }
  return getRealSubscriptionInfo(userId);
}

/**
 * The subscription as the table actually has it — ignores the open-access
 * window. Billing/purchase surfaces must use this: the window unlocks
 * features, it does not create subscriptions.
 */
export async function getRealSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier, trial_ends_at, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();

  // Rows written before Max was retired still say 'max'; they read as Pro.
  const tier = normalizeTier(data?.tier);
  const trialEndsAt: string | null = data?.trial_ends_at ?? null;
  if (trialEndsAt && !data?.stripe_subscription_id) {
    if (new Date(trialEndsAt).getTime() > Date.now()) {
      return { tier, trialEndsAt, lapsedTrialEndedAt: null };
    }
    // Trial expired, never paid — surface when it ended so the app can show
    // the post-trial receipt instead of lapsing silently.
    return { tier: 'free', trialEndsAt: null, lapsedTrialEndedAt: trialEndsAt };
  }
  return { tier, trialEndsAt: null, lapsedTrialEndedAt: null };
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
  tier: Tier;
}

export async function checkAnalysisQuota(userId: string): Promise<QuotaCheck> {
  const tier = await getUserTier(userId);
  const dailyLimit = tierAtLeast(tier, 'pro') ? PRO_DAILY_ANALYSIS_LIMIT : FREE_DAILY_ANALYSIS_LIMIT;

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('analysis_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString());

  const used = count ?? 0;
  const remaining = Math.max(0, dailyLimit - used);

  return {
    allowed: used < dailyLimit,
    used,
    limit: dailyLimit,
    remaining,
    tier,
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

// requireMax is gone with the Max tier. Everything it gated is Pro now.
