import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionInfo, checkAnalysisQuota } from '@/lib/tier';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [sub, quota] = await Promise.all([
    getSubscriptionInfo(user.id),
    checkAnalysisQuota(user.id),
  ]);
  const tier = sub.tier;

  // Fetch billing fields from user_tiers table
  const { data } = await supabase
    .from('user_tiers')
    .select('tier, billing_period, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    // getUserTier (user_subscriptions) is the canonical, webhook-written tier;
    // user_tiers is only consulted for billing display fields below.
    tier: tier || data?.tier || 'free',
    quota,
    trialEndsAt: sub.trialEndsAt,
    billingPeriod: data?.billing_period || null,
    currentPeriodEnd: data?.current_period_end || null,
    cancelAtPeriodEnd: data?.cancel_at_period_end || false,
  }, {
    headers: NO_CACHE_HEADERS,
  });
}
