import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { reconcileSubscription } from '@/lib/billing-server';
import { revenueCatUsers } from '@/lib/billing-reconciliation';

export const dynamic = 'force-dynamic';
const EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED', 'TRANSFER', 'PRODUCT_CHANGE', 'EXPIRATION', 'SUBSCRIPTION_PAUSED',
  'REFUND', 'REFUND_REVERSED', 'CANCELLATION', 'BILLING_ISSUE', 'TEMPORARY_ENTITLEMENT_GRANT']);

/** Events trigger a current-state lookup; event order must never determine access. */
export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const event = body?.event;
  if (!event || typeof event !== 'object' || Array.isArray(event)) return NextResponse.json({ error: 'No event' }, { status: 400 });
  const type = String(event.type ?? '');
  if (!EVENTS.has(type)) return NextResponse.json({ ok: true, ignored: type });
  const users = revenueCatUsers(event);
  if (!users.length) return NextResponse.json({ ok: true, skipped: 'unattributed' });
  try {
    const db = await createServiceClient();
    for (const userId of users) {
      const { data, error } = await db.auth.admin.getUserById(userId);
      if (error?.status === 404 || error?.code === 'user_not_found') continue;
      if (error || !data.user) throw new Error('Account lookup unavailable');
      // Transfers reconcile BOTH participants. Partial failure is retried safely.
      await reconcileSubscription(userId, { requireRevenueCat: true });
    }
    return NextResponse.json({ ok: true, type });
  } catch {
    return NextResponse.json({ error: 'Subscription confirmation unavailable; retry required' }, { status: 503 });
  }
}
