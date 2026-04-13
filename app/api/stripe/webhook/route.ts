import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/stripe/webhook
 *
 * Single source of truth for all Stripe-driven tier changes.
 * Always returns 200 — Stripe retries on non-2xx.
 *
 * Handled events:
 *   checkout.session.completed    → activate Pro
 *   customer.subscription.updated → sync renewal / cancel state
 *   customer.subscription.deleted → downgrade to free
 *   invoice.payment_failed        → log only
 */

// Required so Next.js doesn't parse the body — Stripe needs the raw bytes
export const config = { api: { bodyParser: false } };

export async function POST(request: NextRequest) {
  // ── 1. Read raw body (required for signature verification) ──────────────
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // ── 2. Verify signature ─────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[webhook] Received event: ${event.type} (${event.id})`);

  // ── 3. Dispatch ─────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Ignore unhandled event types — do not error
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Log but still return 200 so Stripe doesn't retry indefinitely.
    // A retry won't help if it's a logic error; alerting/monitoring handles recovery.
    console.error(`[webhook] Handler threw for ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ───────────────────────────────────────────────────────────────

/**
 * checkout.session.completed
 * Activate Pro tier. Supports subscription and lifetime (one-time payment) modes.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  const billingPeriod = session.metadata?.billing_period;

  if (!userId || !billingPeriod) {
    console.error('[webhook][checkout.completed] Missing metadata:', {
      userId,
      billingPeriod,
      sessionId: session.id,
    });
    return;
  }

  let currentPeriodEnd: string;
  let stripeSubscriptionId: string | null = null;
  let stripePriceId: string | null = null;

  if (billingPeriod === 'lifetime') {
    // One-time payment — never expires
    currentPeriodEnd = '9999-12-31T23:59:59Z';
  } else {
    // Retrieve the subscription to get canonical period end + price
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null;

    if (!subscriptionId) {
      console.error('[webhook][checkout.completed] No subscription ID on session:', session.id);
      return;
    }

    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    stripeSubscriptionId = sub.id;
    stripePriceId = sub.items.data[0]?.price?.id ?? null;
    currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
  }

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userId,
        tier: 'pro',
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: stripePriceId,
        billing_period: billingPeriod,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[webhook][checkout.completed] DB upsert failed:', error);
    throw error;
  }

  console.log(`[webhook][checkout.completed] Pro activated for user ${userId}`);
}

/**
 * customer.subscription.updated
 * Sync cancel_at_period_end and current_period_end — no tier change.
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('[webhook][subscription.updated] DB update failed:', error);
    throw error;
  }

  console.log(
    `[webhook][subscription.updated] Synced for customer ${customerId} — ` +
      `cancel_at_period_end=${sub.cancel_at_period_end}`,
  );
}

/**
 * customer.subscription.deleted
 * Downgrade to free and clear all Stripe fields.
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      tier: 'free',
      stripe_subscription_id: null,
      stripe_price_id: null,
      billing_period: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('[webhook][subscription.deleted] DB update failed:', error);
    throw error;
  }

  console.log(`[webhook][subscription.deleted] Downgraded to free for customer ${customerId}`);
}

/**
 * invoice.payment_failed
 * Log only — no tier change. Stripe handles retry/dunning automatically.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? 'unknown';

  console.warn(
    `[webhook][invoice.payment_failed] Payment failed for customer ${customerId} — ` +
      `invoice ${invoice.id}, amount_due=${invoice.amount_due}`,
  );
}
