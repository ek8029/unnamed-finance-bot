import type { SupabaseClient } from '@supabase/supabase-js';
import { isThesisUser } from '@/lib/thesis-access';
import { normalizeTier, tierAtLeast } from '@/lib/tier-shared';

/**
 * Who is entitled to ONGOING thesis monitoring.
 *
 * The split this exists to enforce: a free user can draft a thesis, confirm it,
 * and see the twelve months of history behind it. What they do not get is the
 * agent continuing to watch it. Free gets the past, Pro gets the future.
 *
 * Before this, `tracked = true` was the whole gate and the scoring cron applied
 * no entitlement check at all. That was safe only because thesis creation was
 * Pro-gated, so a free user could never own a tracked thesis. Once free users
 * can seed one, the cron would hand them the paid feature for nothing.
 *
 * Bulk by design: the cron holds user ids, not sessions, and calling the
 * per-user tier lookup once per thesis would be a query per row.
 *
 * NOTE: deliberately does NOT honour the open-access window. That window
 * unlocked features for everyone while it ran, and the theses created under it
 * are still tracked. Scoring is a recurring cost, so it follows what the user
 * is actually entitled to now, not what they could reach in July.
 */
/**
 * How many theses a free user may hold.
 *
 * One is enough to see what the product is: draft it, confirm the reasons,
 * and read the twelve months of evidence behind them. The second one is the
 * paid product, and so is every day of watching after today.
 */
export const FREE_THESIS_LIMIT = 1;

export async function entitledToMonitoring(
  serviceClient: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const entitled = new Set<string>();
  if (userIds.length === 0) return entitled;

  const { data: subs } = await serviceClient
    .from('user_subscriptions')
    .select('user_id, tier, trial_ends_at, stripe_subscription_id')
    .in('user_id', userIds);

  const now = Date.now();
  for (const s of subs ?? []) {
    // Mirrors getRealSubscriptionInfo: a trial row with no Stripe subscription
    // is only worth its tier while the trial is still running.
    let tier = normalizeTier(s.tier);
    if (s.trial_ends_at && !s.stripe_subscription_id) {
      tier = new Date(s.trial_ends_at).getTime() > now ? tier : 'free';
    }
    if (tierAtLeast(tier, 'pro')) entitled.add(s.user_id);
  }

  // Allowlist backstop, by email, for the founder and comped testers. They are
  // also pro/max in the table today, but the allowlist is the documented
  // override and losing it here would silently stop their monitoring.
  const unresolved = userIds.filter((id) => !entitled.has(id));
  for (const id of unresolved) {
    try {
      const { data } = await serviceClient.auth.admin.getUserById(id);
      if (isThesisUser(data?.user?.email)) entitled.add(id);
    } catch {
      // A failed lookup must not promote anyone.
    }
  }

  return entitled;
}
