import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getStripe,
  getPriceId,
  isValidBillingPeriod,
  getCheckoutMode,
} from '@/lib/stripe';
import { tierAtLeast, normalizeTier } from '@/lib/tier-shared';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Embedded Checkout session for upgrading to Pro.
 * Body: { billingPeriod: 'monthly' | 'annual' | 'lifetime' }
 * Returns: { clientSecret: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth — read user from Supabase session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await req.json();
    const { billingPeriod } = body;

    // 2. Validate billingPeriod
    if (!billingPeriod || !isValidBillingPeriod(billingPeriod)) {
      return NextResponse.json(
        { error: 'Invalid billing period.' },
        { status: 400 },
      );
    }

    const serviceClient = await createServiceClient();

    // 3. Already-Pro guard
    const { data: subscription, error: subError } = await serviceClient
      .from('user_subscriptions')
      .select('tier, stripe_customer_id, stripe_subscription_id, trial_ends_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subError) {
      console.error('[checkout] Failed to read subscription:', subError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    // A trial row carries tier='pro' with no Stripe subscription — for purchase
    // purposes that user is free, otherwise trialing users get "You already
    // have Pro" and can never convert (and a lapsed trial could never buy).
    const isTrialRow = !!subscription?.trial_ends_at && !subscription?.stripe_subscription_id;
    const currentTier = isTrialRow ? 'free' : normalizeTier(subscription?.tier);

    // Only Pro exists now, so any current holder of it is already at the top.
    if (tierAtLeast(currentTier, billingPeriod)) {
      return NextResponse.json({ error: 'You already have Pro.' }, { status: 400 });
    }

    // 4. Find or create Stripe customer
    let stripeCustomerId = subscription?.stripe_customer_id ?? null;

    // If no row exists at all, upsert a free-tier row (defensive)
    if (!subscription) {
      const { error: upsertError } = await serviceClient
        .from('user_subscriptions')
        .upsert(
          {
            user_id: user.id,
            tier: 'free',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (upsertError) {
        console.error('[checkout] Failed to upsert free-tier row:', upsertError);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 },
        );
      }
    }

    // Create Stripe customer if we don't have one
    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;

      // Save stripe_customer_id to user_subscriptions
      const { error: updateError } = await serviceClient
        .from('user_subscriptions')
        .update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[checkout] Failed to save stripe_customer_id:', updateError);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 },
        );
      }
    }

    // 5. Get price ID
    const priceId = getPriceId(billingPeriod);
    if (!priceId) {
      console.error(`[checkout] No price ID configured for billingPeriod: ${billingPeriod}`);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    // 7. Create Checkout Session
    const session = await getStripe().checkout.sessions.create({
      ui_mode: 'embedded',
      mode: getCheckoutMode(billingPeriod),
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev'}/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        supabase_user_id: user.id,
        billing_period: billingPeriod,
      },
    });

    // 8. Return client secret
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[checkout] Unexpected error:', msg);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
