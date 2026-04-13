import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription, update payment methods, or cancel.
 * Returns: { url: string | null, message?: string }
 */
export async function POST() {
  try {
    // 1. Auth — read user from Supabase session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Query user_subscriptions for stripe_customer_id and billing_period
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id, billing_period')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError) {
      console.error('[portal] Failed to read subscription:', subError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // 3. Lifetime access — no billing portal needed
    if (subscription?.billing_period === 'lifetime') {
      return NextResponse.json(
        { url: null, message: 'Lifetime access — no billing to manage.' },
        { status: 200 },
      );
    }

    // 4. No Stripe customer on record
    const stripeCustomerId = subscription?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found.' },
        { status: 400 },
      );
    }

    // 5. Create Customer Portal session
    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev'}/dashboard/settings`,
    });

    // 6. Return portal URL
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[portal] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
