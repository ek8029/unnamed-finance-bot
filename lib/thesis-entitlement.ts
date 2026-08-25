import type { SupabaseClient } from '@supabase/supabase-js';
import { isThesisUser } from '@/lib/thesis-access';
import { normalizeTier, tierAtLeast } from '@/lib/tier-shared';

/**
 * Who is entitled to FULL thesis monitoring.
 *
 * The split this exists to enforce: a free user keeps one thesis under watch,
 * its oldest tracked one, and reads the twelve months of history behind it.
 * Every thesis past that, and every agentic pipeline (reassessment,
 * investigation, shared exposure), is Pro. Decided 2026-08-25: after the 8/09
 * paywall the free theses had accumulated no evidence at all, and every
 * August signup who wrote one got nothing after the onboarding scan.
 *
 * Before this, `tracked = true` was the whole gate and the scoring cron applied
 * no entitlement check at all. That was safe only because thesis creation was
 * Pro-gated, so a free user could never own a tracked thesis.
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
 * read the twelve months of evidence behind them, and watch it hold or break.
 * The second one is the paid product.
 */
export const FREE_THESIS_LIMIT = 1;

/** How many of a free user's tracked theses the scorer keeps watching. */
export const FREE_MONITORED_LIMIT = 1;

/**
 * Which tracked theses the scorer should scan this run.
 *
 * Entitled owners keep everything. A free owner keeps their oldest tracked
 * thesis (created_at ascending, id as the tie-break so the pick never flips
 * between runs) up to FREE_MONITORED_LIMIT; the rest are skipped. Input order
 * is preserved for the kept rows.
 */
export function selectMonitored<T extends { id: string; user_id: string; created_at?: string | null }>(
  theses: T[],
  entitled: Set<string>,
): { kept: T[]; skipped: number } {
  const byFreeOwner = new Map<string, T[]>();
  for (const t of theses) {
    if (entitled.has(t.user_id)) continue;
    const list = byFreeOwner.get(t.user_id) ?? [];
    list.push(t);
    byFreeOwner.set(t.user_id, list);
  }
  const allowed = new Set<string>();
  for (const list of byFreeOwner.values()) {
    const sorted = [...list].sort((a, b) =>
      (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id),
    );
    for (const t of sorted.slice(0, FREE_MONITORED_LIMIT)) allowed.add(t.id);
  }
  const kept = theses.filter((t) => entitled.has(t.user_id) || allowed.has(t.id));
  return { kept, skipped: theses.length - kept.length };
}

interface SubRow {
  user_id: string;
  tier: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
}

export async function entitledToMonitoring(
  serviceClient: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const entitled = new Set<string>();
  if (userIds.length === 0) return entitled;

  // FAILS OPEN, deliberately. If entitlement cannot be read, everyone keeps
  // monitoring for this run. Failing closed would silently unmonitor every
  // paying customer on a transient database error and log it as the normal
  // "skipped N unentitled" line, which reads like correct behaviour. A day of
  // scoring given away is cheap; a paying user quietly losing the product is
  // not.
  const subs: SubRow[] = [];
  // PostgREST caps a result set at 1000 rows, so a large .in() truncates and
  // the missing owners read as unentitled. Chunk rather than trust the cap.
  const CHUNK = 500;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const { data, error } = await serviceClient
      .from('user_subscriptions')
      .select('user_id, tier, trial_ends_at, stripe_subscription_id')
      .in('user_id', userIds.slice(i, i + CHUNK));
    if (error) {
      console.error('[thesis-entitlement] lookup failed, failing open:', error.message);
      return new Set(userIds);
    }
    subs.push(...((data ?? []) as SubRow[]));
  }

  const now = Date.now();
  for (const s of subs) {
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
