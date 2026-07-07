import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, tierForPriceId } from '@/lib/stripe';
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
    // Return 5xx so Stripe retries — a transient DB error must not silently drop a paid
    // user's tier upgrade. Stripe gives up after ~3 days, so a genuine logic error won't
    // loop forever; server logs/alerting cover the permanent-error case.
    console.error(`[webhook] Handler threw for ${event.type}:`, err);
    return NextResponse.json({ error: 'Handler error, retry' }, { status: 500 });
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

  // Tier from the purchased price (source of truth); fall back to the metadata
  // tier name if the price isn't recognized.
  const tier = tierForPriceId(stripePriceId) ?? (billingPeriod === 'max' ? 'max' : 'pro');

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userId,
        tier,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: stripePriceId,
        billing_period: billingPeriod,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
        trial_ends_at: null, // paid subscription supersedes any Plaid-connect trial
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[webhook][checkout.completed] DB upsert failed:', error);
    throw error;
  }

  // Send Pro welcome email (non-blocking)
  try {
    const { resend, FROM_EMAIL } = await import('@/lib/emails/resend');
    if (resend) {
      const email = session.customer_email || session.customer_details?.email;
      if (email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: 'Welcome to Helm Pro',
          html: getProWelcomeEmail(),
          text: `Welcome to Helm Pro!\n\nYou now have access to the full suite of institutional-grade financial intelligence tools.\n\nYour Pro features are active immediately:\n- Deep portfolio analysis\n- Tax-loss harvesting alerts\n- Advanced intelligence scans\n- Priority support\n\nOpen your dashboard: https://helmterminal.dev/dashboard\n\n- Helm Terminal`,
        });
        console.log(`[webhook][checkout.completed] Pro welcome email sent to ${email}`);
      }
    }
  } catch (emailErr) {
    console.error('[webhook][checkout.completed] Failed to send Pro welcome email:', emailErr);
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

  // Reflect plan switches (Pro <-> Max) — derive tier from the active price.
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const tier = tierForPriceId(priceId);

  const { data, error } = await supabase
    .from('user_subscriptions')
    .update({
      ...(tier ? { tier, stripe_price_id: priceId, billing_period: tier } : {}),
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    // Match by customer OR subscription id — a customer id can drift (e.g. re-created
    // customer, or the row was seeded via a path that stored a different id), and
    // matching only on customer silently dropped the cancel/renewal sync.
    .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${sub.id}`)
    .select('user_id');

  if (error) {
    console.error('[webhook][subscription.updated] DB update failed:', error);
    throw error;
  }

  // A 0-row update is silent in supabase-js. Surface it: this is how a cross-mode
  // (test vs live) or otherwise-orphaned subscription event slips through unnoticed.
  if (!data || data.length === 0) {
    console.warn(
      `[webhook][subscription.updated] No user_subscriptions row matched customer ${customerId} — ` +
        `ignored. Likely a test-mode subscription absent from this database.`,
    );
    return;
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

  const { data, error } = await supabase
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
    // Match by customer OR subscription id (see subscription.updated) so a
    // drifted customer id can't leave a cancelled user stuck on a paid tier.
    .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${sub.id}`)
    .select('user_id');

  if (error) {
    console.error('[webhook][subscription.deleted] DB update failed:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn(
      `[webhook][subscription.deleted] No user_subscriptions row matched customer ${customerId} — ` +
        `ignored. Likely a test-mode subscription absent from this database.`,
    );
    return;
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

// ── Pro Welcome Email Template ──────────────────────────────────────────────

const DASHBOARD_URL = 'https://helmterminal.dev/dashboard';
const LOGO_URL = 'https://helmterminal.dev/helm-logo-transparent.png';

function getProWelcomeEmail(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body bgcolor="#FFFFFF" style="margin:0;padding:0;background-color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;">
<tr>
<td align="center" valign="top" bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:40px 16px 48px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr>
<td>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#1E1E1E" style="background-color:#1E1E1E;border-radius:8px;">

<!-- Gold accent bar -->
<tr><td height="2" bgcolor="#E6B94D" style="height:2px;line-height:2px;font-size:0;background-color:#E6B94D;border-radius:8px 8px 0 0;">&nbsp;</td></tr>

<!-- Logo -->
<tr><td align="center" bgcolor="#1E1E1E" style="background-color:#1E1E1E;padding:36px 40px 24px;">
<img src="${LOGO_URL}" width="120" height="120" alt="Helm Terminal" border="0" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;">
</td></tr>

<!-- Content -->
<tr><td bgcolor="#1E1E1E" style="background-color:#1E1E1E;padding:0 40px 36px;">
<div style="text-align:center;">
<h1 style="margin:0 0 14px;font-size:28px;font-weight:300;color:#F5F5F5;line-height:1.25;letter-spacing:-0.3px;text-align:center;">Welcome to <span style="font-weight:700;color:#E6B94D;">Helm Pro.</span></h1>
<p style="margin:0 0 24px;font-size:14px;color:#A0A0A0;line-height:1.65;text-align:center;max-width:360px;display:inline-block;">You now have access to the full suite of institutional-grade financial intelligence tools.</p>
</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:4px 0;">
<tr><td height="1" bgcolor="#2A2A2A" style="height:1px;line-height:1px;font-size:0;background-color:#2A2A2A;">&nbsp;</td></tr>
</table>
<p style="margin:24px 0 12px;font-size:9px;font-weight:700;color:#8A8A8A;text-transform:uppercase;letter-spacing:2px;">Now unlocked</p>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
<tr>
<td width="24" valign="top"><div style="width:4px;height:4px;border-radius:50%;background-color:#E6B94D;margin-top:7px;"></div></td>
<td><p style="margin:0;font-size:13px;color:#E0E0E0;line-height:1.5;padding:6px 0;"><strong>Deep analysis</strong><span style="color:#9A9A9A;"> &#8212; Advanced portfolio intelligence and risk modeling.</span></p></td>
</tr>
</table>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
<tr>
<td width="24" valign="top"><div style="width:4px;height:4px;border-radius:50%;background-color:#E6B94D;margin-top:7px;"></div></td>
<td><p style="margin:0;font-size:13px;color:#E0E0E0;line-height:1.5;padding:6px 0;"><strong>Tax-loss harvesting</strong><span style="color:#9A9A9A;"> &#8212; Automated detection of harvestable losses.</span></p></td>
</tr>
</table>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
<tr>
<td width="24" valign="top"><div style="width:4px;height:4px;border-radius:50%;background-color:#E6B94D;margin-top:7px;"></div></td>
<td><p style="margin:0;font-size:13px;color:#E0E0E0;line-height:1.5;padding:6px 0;"><strong>Advanced scans</strong><span style="color:#9A9A9A;"> &#8212; Full intelligence engine with prioritized actions.</span></p></td>
</tr>
</table>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
<tr>
<td width="24" valign="top"><div style="width:4px;height:4px;border-radius:50%;background-color:#E6B94D;margin-top:7px;"></div></td>
<td><p style="margin:0;font-size:13px;color:#E0E0E0;line-height:1.5;padding:6px 0;"><strong>Priority support</strong><span style="color:#9A9A9A;"> &#8212; Direct line to the team when you need help.</span></p></td>
</tr>
</table>
<div style="height:12px;"></div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;">
<tr><td align="center" bgcolor="#E6B94D" style="background-color:#E6B94D;border-radius:3px;">
<a href="${DASHBOARD_URL}" target="_blank" style="display:block;text-align:center;background-color:#E6B94D;color:#0A0A0A;font-size:12px;font-weight:800;text-decoration:none;padding:16px 32px;text-transform:uppercase;letter-spacing:2.5px;border-radius:3px;">Open Dashboard</a>
</td></tr>
</table>
</td></tr>

<!-- Fallback link -->
<tr><td bgcolor="#1E1E1E" style="background-color:#1E1E1E;padding:0 40px 24px;text-align:center;">
<p style="margin:0;font-size:10px;color:#8A8A8A;line-height:1.5;">Button not working? Go directly to</p>
<p style="margin:4px 0 0;font-size:9px;color:#8A8A8A;word-break:break-all;line-height:1.4;"><a href="${DASHBOARD_URL}" style="color:#8A8A8A;">${DASHBOARD_URL}</a></p>
</td></tr>

</table>
</td>
</tr>

<!-- Footer -->
<tr><td style="padding:24px 0 0;text-align:center;">
<p style="margin:0 0 6px;font-size:10px;color:#999999;line-height:1.5;">Sent by Helm Terminal</p>
<p style="margin:0;font-size:9px;">
<a href="https://helmterminal.dev/privacy" style="color:#999999;text-decoration:none;">Privacy</a>
<span style="color:#CCCCCC;">&ensp;&#183;&ensp;</span>
<a href="https://helmterminal.dev/terms" style="color:#999999;text-decoration:none;">Terms</a>
<span style="color:#CCCCCC;">&ensp;&#183;&ensp;</span>
<a href="https://helmterminal.dev/dashboard/settings" style="color:#999999;text-decoration:none;">Unsubscribe</a>
</p>
</td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}
