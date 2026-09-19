import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingResponse, reconcileSubscription } from '@/lib/billing-server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // The identity comes only from the validated session, never the body.
    const row = await reconcileSubscription(user.id, { requireRevenueCat: true });
    return NextResponse.json(billingResponse(row), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Your purchase is still being confirmed. Please try again shortly.' }, { status: 503 });
  }
}
