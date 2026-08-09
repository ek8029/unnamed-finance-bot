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
 * Length of the card-required free trial, in days.
 *
 * FOURTEEN, not the seven Astor runs, and the difference is arithmetic rather
 * than taste. Adverse findings arrive at roughly 0.57 per tracked thesis per
 * month, so the chance that at least one lands inside the trial is:
 *
 *              7 days    14 days
 *   1 thesis    12.5%     23.4%
 *   3 theses    30.4%     55.0%
 *   5 theses    48.6%     73.6%
 *
 * A seven-day trial for someone tracking one thesis is an 87% chance of a
 * window in which the product visibly does nothing. Astor can run seven days
 * because its value is continuous; Helm's arrives episodically, and copying a
 * competitor's number without copying its cadence ships a trial that cannot
 * fire.
 *
 * This does not mean the trial sells the interrupt. It should sell the
 * harvestable-loss figure, which is computed from the book on day one and waits
 * on nothing. Fourteen days is the hedge, not the plan.
 *
 * ⚠️ The 0.57 rate was measured on a corpus that has since had boilerplate
 * purged out of it, so the real rate is probably LOWER, which argues for longer
 * rather than shorter. Re-derive it before treating this number as settled.
 */
const TRIAL_DAYS = 14;

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

    // Has this person ever had a trial, of either kind? trial_ends_at is set by
    // the connect grant and cleared by a real purchase, so its presence is the
    // has-trialed marker regardless of which path set it.
    const hasHadTrial = !!subscription?.trial_ends_at;

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
    //
    // TRIAL WITH A CARD. Stripe collects the payment method up front and does
    // not charge until the trial ends, which is the difference that matters:
    // the manual trials granted in July had no card on file, so converting
    // required the person to come back and actively subscribe, and almost
    // nobody does. `missing_payment_method: 'cancel'` means a trial that
    // somehow reaches the end without one lapses instead of erroring.
    //
    // Nothing downstream needed changing. The webhook derives tier from the
    // purchased price rather than from payment status, so a `trialing`
    // subscription reads as Pro immediately, and `current_period_end` is the
    // trial end date. If it lapses, customer.subscription.deleted already
    // downgrades to free.
    //
    // Subscription mode only: lifetime is a one-time payment and cannot trial.
    const mode = getCheckoutMode(billingPeriod);
    const session = await getStripe().checkout.sessions.create({
      ui_mode: 'embedded',
      mode,
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(mode === 'subscription'
        ? {
            payment_method_collection: 'always' as const,
            subscription_data: {
              // One trial per person, ever. trial_ends_at doubles as the
              // has-trialed marker, so a user who already had the no-card
              // connect trial does not get a second 14 days on top of it.
              // Without this the two trial paths stacked to 28 free days and
              // the conversion read as a trial start rather than a sale.
              ...(hasHadTrial ? {} : { trial_period_days: TRIAL_DAYS }),
              trial_settings: {
                end_behavior: { missing_payment_method: 'cancel' as const },
              },
            },
          }
        : {}),
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
