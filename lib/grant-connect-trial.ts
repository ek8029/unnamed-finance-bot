// 14-day Pro trial granted the first time a user gets real holdings on file,
// whether that came from a Plaid connect or from manual entry.
//
// Why it must cover BOTH paths: the thesis layer is Pro-gated (hasThesisAccess ->
// requirePro), so a free user's onboarding silently skips the auto-drafted theses
// entirely. Plaid users were getting the trial and therefore the full experience;
// manual-entry users were not, and lost the flagship moment with no explanation.
//
// Idempotent: trial_ends_at doubles as the has-trialed marker, so reconnecting or
// adding more holdings never restarts the clock. Non-blocking by contract, a failed
// grant must never fail the caller's request.

import { createServiceClient } from '@/lib/supabase/server';

export const TRIAL_DAYS = 14;

export async function grantFirstConnectTrial(userId: string, source: 'plaid' | 'manual'): Promise<void> {
  try {
    const admin = await createServiceClient();
    const { data: sub } = await admin
      .from('user_subscriptions')
      .select('tier, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle();

    // Already paying, already on a plan, or already had a trial: leave it alone.
    if (sub?.trial_ends_at) return;
    if (sub && sub.tier !== 'free') return;

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from('user_subscriptions')
      .upsert(
        { user_id: userId, tier: 'pro', trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error(`[trial][${source}] grant failed for user ${userId}:`, error.message);
    } else {
      console.log(`[trial][${source}] ${TRIAL_DAYS}-day Pro trial started for user ${userId} (ends ${trialEndsAt})`);
    }
  } catch (err) {
    console.error(`[trial][${source}] grant threw:`, err instanceof Error ? err.message : err);
  }
}
