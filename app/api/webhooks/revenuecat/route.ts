import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeTier } from '@/lib/tier-shared';

/**
 * POST /api/webhooks/revenuecat
 *
 * RevenueCat tells us when an iOS entitlement changes and we write the tier.
 *
 * WHY THIS EXISTS AT ALL. StoreKit purchases happen on the device, and the
 * interesting events happen when nobody is holding the phone: a renewal at 3am,
 * a cancellation, a failed card, a refund. The app cannot observe those. This
 * endpoint is the only path by which a purchase becomes a tier.
 *
 * ONE ROW, TWO RAILS. user_subscriptions is also written by the Stripe webhook.
 * Both write the same row and `source` records who wrote it last, so
 * most-recent-wins falls out of updated_at instead of every reader
 * reimplementing a merge. See migration 064.
 *
 * IDENTITY. The app calls Purchases.logIn(supabaseUserId), so app_user_id IS
 * the Supabase user id. A payload whose app_user_id is not a uuid is one where
 * that call did not happen, and writing a tier for it would mean guessing whose
 * subscription it is. Those are rejected loudly rather than absorbed.
 *
 * A NOTE ON 'max', because it looks like a bug and is not. A grant writes 'pro'
 * over a comped 'max' row, but normalizeTier() folds max into pro at every read
 * boundary — Max was retired in Aug 2026 — so the label changes and the access
 * does not. There is no entitlement to preserve, and inventing rank arithmetic
 * for a tier that no longer means anything would be code protecting a string.
 */

export const dynamic = 'force-dynamic';

/** RevenueCat event types that mean "this account should have Pro right now". */
const GRANTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TRANSFER',
  'PRODUCT_CHANGE',
]);

/** Types that end access. CANCELLATION is deliberately NOT here: it means auto
 *  renew was turned off, and the person keeps what they paid for until the
 *  period ends. EXPIRATION is the event that actually ends it. Treating a
 *  cancellation as a revocation would delete access somebody is still owed. */
const REVOKES = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'REFUND']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  // RevenueCat signs by a shared Authorization header you set in their
  // dashboard. Without the secret configured this route would accept anything
  // that could POST to it, and what it writes is who has paid, so it refuses to
  // run rather than defaulting open.
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[revenuecat] REVENUECAT_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const event = body.event;
  if (!event || typeof event !== 'object') {
    return NextResponse.json({ error: 'No event' }, { status: 400 });
  }

  const type = String(event.type ?? '');
  const appUserId = String(event.app_user_id ?? '');
  const productId = event.product_id == null ? null : String(event.product_id);
  const expiresMs = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;

  if (!UUID.test(appUserId)) {
    // Anonymous ids ($RCAnonymousID:…) mean the purchase was never tied to an
    // account. 200 so RevenueCat stops retrying something no retry can fix.
    console.error('[revenuecat] non-uuid app_user_id, cannot attribute:', appUserId.slice(0, 24));
    return NextResponse.json({ ok: true, skipped: 'unattributed' });
  }

  const grants = GRANTS.has(type);
  const revokes = REVOKES.has(type);
  if (!grants && !revokes) {
    // Billing issues, product changes we do not price on, test events. Logged
    // and acknowledged; silently 500ing would make RevenueCat retry forever.
    return NextResponse.json({ ok: true, ignored: type });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // The user must exist. RevenueCat will happily send an app_user_id for an
  // account that has since been deleted, and inserting a subscription row for a
  // missing user leaves an orphan nothing will ever clean up.
  const { data: who, error: whoErr } = await db.auth.admin.getUserById(appUserId);
  if (whoErr || !who?.user) {
    console.error('[revenuecat] no such user:', appUserId);
    return NextResponse.json({ ok: true, skipped: 'unknown user' });
  }

  // WHAT IS ALREADY THERE DECIDES WHETHER WE MAY REVOKE.
  //
  // user_subscriptions is one row written by two rails. An App Store
  // EXPIRATION says "the thing Apple was billing has ended" — it says nothing
  // about a Stripe subscription, and there is nothing stopping the same person
  // from holding both. Writing tier 'free' on an EXPIRATION would cancel, for
  // free, a subscription the person is still being charged for on the web.
  //
  // So a revocation may only revoke what RevenueCat granted. If the row was
  // last written by Stripe and still carries a paid tier, this event is not
  // about that entitlement and must not touch it. Grants are safe either way:
  // the worst case is Pro arriving slightly early for someone who is paying
  // twice, and the Stripe webhook writes the row back on its next event.
  const { data: existing } = await db
    .from('user_subscriptions')
    .select('tier, source')
    .eq('user_id', appUserId)
    .maybeSingle();

  if (revokes && existing && existing.source !== 'revenuecat' && normalizeTier(existing.tier) !== 'free') {
    console.log('[revenuecat]', type, 'ignored: entitlement belongs to', existing.source, 'for', appUserId);
    return NextResponse.json({ ok: true, skipped: 'not ours to revoke', source: existing.source });
  }

  const row = {
    user_id: appUserId,
    tier: grants ? 'pro' : 'free',
    source: 'revenuecat',
    store_product_id: productId,
    billing_period: 'monthly',
    current_period_end: expiresMs ? new Date(expiresMs).toISOString() : null,
    // Auto-renew off is a CANCELLATION event, which does not reach here. A grant
    // arriving means renewal is on; a revocation means there is nothing left to
    // cancel.
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('user_subscriptions')
    .upsert(row, { onConflict: 'user_id' });

  // supabase-js does NOT throw on a failed write, it returns { error }. A
  // webhook that swallows that would report success to RevenueCat, which then
  // stops retrying, and the person stays on free having paid.
  if (error) {
    console.error('[revenuecat] write failed:', error.message, { type, appUserId });
    return NextResponse.json({ error: 'Write failed' }, { status: 500 });
  }

  console.log('[revenuecat]', type, '->', row.tier, 'for', appUserId);
  return NextResponse.json({ ok: true, type, tier: row.tier });
}
