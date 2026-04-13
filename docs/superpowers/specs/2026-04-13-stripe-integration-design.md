# Stripe Integration — Design Spec

## Goal

Enable users to pay for Helm Terminal Pro via Stripe Embedded Checkout, upgrading from the current waitlist-only model to a functioning payment flow.

## Pricing

| Tier | Price | Stripe Mode | Billing Period |
|------|-------|-------------|----------------|
| Free | $0 | — | — |
| Pro Monthly | $14.99/mo | subscription | monthly |
| Pro Annual | $119/yr (~$9.99/mo, 33% discount) | subscription | annual |
| Pro Lifetime | $249 one-time (200 seat cap) | payment | lifetime |

No trial period. Free tier is the trial.

## Architecture

### Database — Migration 028

Extend `user_subscriptions` (created in migration 021) with Stripe fields:

```sql
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT CHECK (billing_period IN ('monthly', 'annual', 'lifetime')),
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
```

Key constraints:
- `stripe_customer_id` is UNIQUE — one Stripe customer per Supabase user
- No new tables — extends the existing user_subscriptions
- Existing RLS policies (user can read own, service role can write) cover the new columns

Conventions:
- Lifetime users: `current_period_end = '9999-12-31T23:59:59Z'`, `stripe_subscription_id = NULL`
- Free users: all Stripe fields NULL (code must handle NULL for `cancel_at_period_end` alongside `false`)
- Cancelled users (still in period): `cancel_at_period_end = true`, `current_period_end` set to actual end date
- Cancelled users (period over): `tier = 'free'`, all Stripe fields cleared (including `current_period_end` and `cancel_at_period_end`)

### Shared Stripe Client — `lib/stripe.ts`

Create a singleton Stripe server client following the existing pattern (`lib/plaid.ts`, `lib/polygon.ts`):

```ts
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil', // pin the API version
});
```

All API routes import from `lib/stripe.ts` — no inline Stripe initialization.

### API Routes

#### `POST /api/stripe/checkout`

**Auth:** Requires authenticated Supabase user.

**Request body:** `{ priceId: string }`

**Logic:**
1. Read user from Supabase session
2. Look up `stripe_customer_id` in `user_subscriptions`. If no `user_subscriptions` row exists at all, upsert a free-tier row before proceeding (defensive — covers edge case where signup insert failed silently).
3. If no Stripe customer exists, create one via `stripe.customers.create({ email, metadata: { supabase_user_id } })`
4. Save `stripe_customer_id` to `user_subscriptions`
5. **Lifetime cap enforcement:** If priceId is `STRIPE_PRICE_LIFETIME`, query `SELECT count(*) FROM user_subscriptions WHERE billing_period = 'lifetime'`. If >= 200, return 400 with "Lifetime deal is sold out."
6. Determine `mode` from priceId:
   - If priceId matches `STRIPE_PRICE_LIFETIME` → `mode: 'payment'`
   - Otherwise → `mode: 'subscription'`
7. Create Embedded Checkout Session:
   ```
   stripe.checkout.sessions.create({
     ui_mode: 'embedded',
     mode,
     customer: stripeCustomerId,
     line_items: [{ price: priceId, quantity: 1 }],
     return_url: 'https://helmterminal.dev/dashboard?upgrade=success',
     metadata: {
       supabase_user_id: user.id,
       billing_period: determineBillingPeriod(priceId),
     },
   })
   ```
8. Return `{ clientSecret: session.client_secret }`

**Error handling:**
- 401 if not authenticated
- 400 if priceId is not one of the 3 configured prices
- 400 if lifetime cap reached
- 500 with generic message on Stripe API errors (log details server-side)

#### `POST /api/stripe/webhook`

**Auth:** No Supabase auth. Verified via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`.

**CRITICAL implementation details:**
- Read the raw body via `request.text()` before passing to `constructEvent()`. Do NOT parse with `request.json()` first — this breaks signature verification. Follow the same pattern as `app/api/plaid/webhook/route.ts`.
- Use `createServiceClient()` (service role) for ALL database writes. The webhook has no user session, and RLS requires service_role for writes to `user_subscriptions`.
- Use the Stripe event ID (`event.id`) for idempotency. Before processing, check if the event was already handled (store in `auth_events.metadata.stripe_event_id`) to prevent duplicate processing on webhook retries.

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Read `metadata.supabase_user_id` + `metadata.billing_period`. For subscription-mode: call `stripe.subscriptions.retrieve(session.subscription)` to get `current_period_end` and `cancel_at_period_end` (the session object alone does not contain these). Update `user_subscriptions`: set `tier='pro'`, `stripe_subscription_id`, `stripe_price_id`, `billing_period`, `current_period_end`. For lifetime: set `current_period_end='9999-12-31T23:59:59Z'`, `stripe_subscription_id=NULL`. For lifetime: also re-check the 200-seat cap — if exceeded (extreme race), log an alert but do not reject (refund manually). Log to `auth_events` with `event_type='stripe_checkout_completed'`. |
| `customer.subscription.updated` | Sync `cancel_at_period_end` and `current_period_end` from the Stripe subscription object. Log to `auth_events` with `event_type='stripe_subscription_updated'`. |
| `customer.subscription.deleted` | Set `tier='free'`, clear ALL Stripe fields: `stripe_subscription_id`, `stripe_price_id`, `billing_period`, `current_period_end`, `cancel_at_period_end`. Log to `auth_events` with `event_type='stripe_subscription_deleted'`. |
| `invoice.payment_failed` | Log to `auth_events` with `event_type='payment_failed'`, `email`, `metadata: { stripe_customer_id, invoice_id, stripe_event_id }`. No tier change — Stripe handles retry + dunning. Check for duplicate event ID before inserting. |

**Critical design decision:** The webhook is the **single source of truth** for tier changes. The checkout route does NOT update the tier — it waits for webhook confirmation. This prevents the race condition where someone appears as Pro before payment actually succeeds.

**Return:** `200 OK` for all events, including unhandled ones (Stripe retries on non-2xx).

#### `POST /api/stripe/portal`

**Auth:** Requires authenticated Supabase user.

**Logic:**
1. Look up `stripe_customer_id` from `user_subscriptions`
2. If no Stripe customer, return 400
3. Create Billing Portal session: `stripe.billingPortal.sessions.create({ customer, return_url })`
4. Return `{ url }` — frontend redirects to Stripe's portal

### Client Components

#### `CheckoutModal`

Shared reusable component used by ProGate and the pricing page.

**Props:** `{ priceId: string, onClose: () => void }`

**Behavior:**
1. On mount, calls `POST /api/stripe/checkout` with priceId
2. Receives `clientSecret`
3. Renders `<EmbeddedCheckout clientSecret={clientSecret} />` from `@stripe/react-stripe-js` inside a modal overlay
4. Stripe handles card form, Apple Pay, Google Pay, validation, success
5. On success, Stripe redirects to `/dashboard?upgrade=success`

**Dependencies:** `@stripe/stripe-js`, `@stripe/react-stripe-js`

#### Upgrade Success Handling

When the user returns to `/dashboard?upgrade=success`, the webhook may not have fired yet (typical Stripe latency is 1-5 seconds). The dashboard should:
1. Detect the `?upgrade=success` query parameter
2. Show a "Processing your upgrade..." interstitial with a spinner
3. Poll `/api/user/tier` every 2 seconds (up to 30 seconds)
4. When tier changes to `'pro'`, show a success toast and remove the interstitial
5. If timeout reached, show: "Your payment was received. Features will unlock within a few minutes."

#### Updated `ProGate`

Currently shows a waitlist button. Changes to:
- Plan selector: monthly ($14.99/mo) / annual ($9.99/mo billed annually) / lifetime ($249)
- "Upgrade to Pro" button → opens `CheckoutModal` with selected priceId
- Still shows feature description and Lock icon
- Rendered in context on taxes, earnings, wrapped, intelligence pages

#### Updated Pricing Page

- Monthly/annual toggle (default annual)
- Free card: links to `/signup`
- Pro card: "Get Started" → opens `CheckoutModal`
- Lifetime card: "Get Lifetime Access" + shows "X of 200 remaining" (server-side query — `user_subscriptions WHERE billing_period = 'lifetime'`. Must run server-side or via dedicated API route; RLS prevents client-side cross-user counts)
- If logged-in Pro user: show "Current plan" badge, "Manage Billing" link
- If logged-in free user: show checkout buttons
- If not logged in: "Sign up" CTA → `/signup`
- **Update displayed price from $24.99/month to the new tiered structure. Update OG meta description.**

#### Settings Page — Billing Section

Add to `/dashboard/settings`:
- Current plan display (Free / Pro Monthly / Pro Annual / Lifetime)
- Renewal date or "Lifetime access" or "Cancels on [date]"
- "Manage Billing" button → calls `/api/stripe/portal` → redirects to Stripe Customer Portal
- Free users see "Upgrade to Pro" button

### Account Deletion Integration

The existing account deletion flow (`app/api/auth/delete-account/route.ts`) must cancel any active Stripe subscription before deleting the user. Add to the deletion logic:
1. Look up `stripe_customer_id` and `stripe_subscription_id` from `user_subscriptions`
2. If `stripe_subscription_id` exists, call `stripe.subscriptions.cancel(stripe_subscription_id)`
3. Optionally delete the Stripe customer via `stripe.customers.del(stripe_customer_id)` to clean up
4. Proceed with existing account deletion flow

This prevents orphaned Stripe subscriptions that continue billing with no corresponding user.

### Environment Variables (6)

```
STRIPE_SECRET_KEY=sk_live_...           # Server-side only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Client-side (public)
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signature verification
STRIPE_PRICE_MONTHLY=price_...          # Stripe Price ID for $14.99/mo
STRIPE_PRICE_ANNUAL=price_...           # Stripe Price ID for $119/yr
STRIPE_PRICE_LIFETIME=price_...         # Stripe Price ID for $249 one-time
```

**Development note:** During development, use test-mode keys (`sk_test_...` / `pk_test_...`). For local webhook testing, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook` which provides a local webhook secret.

### Stripe Dashboard Setup (manual, done by operator)

1. Create Stripe account if not already done
2. Create 3 Products with the above pricing
3. Copy the 3 Price IDs → env vars
4. Add webhook endpoint: `https://helmterminal.dev/api/stripe/webhook`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`
6. Configure Customer Portal: enable cancel subscription, update payment method, view invoices

### Files Changed

**New files:**
- `supabase/migrations/028_stripe_integration.sql`
- `lib/stripe.ts` — singleton Stripe server client (pinned API version)
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/stripe/portal/route.ts`
- `components/checkout-modal.tsx`

**Modified files:**
- `components/pro-gate.tsx` — swap waitlist → checkout trigger with plan selector
- `app/pricing/page.tsx` — real checkout buttons, monthly/annual toggle, lifetime counter, update prices from $24.99 to new tiers, update OG metadata
- `app/dashboard/settings/page.tsx` — billing section with plan info + manage billing
- `app/api/auth/delete-account/route.ts` — cancel Stripe subscription before deletion
- `package.json` — add `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`
- `.env.local.example` — document 6 new env vars with setup instructions
- `middleware.ts` — add to CSP: `script-src` + `frame-src` → `https://js.stripe.com`; `connect-src` → `https://api.stripe.com`

**Not changed:**
- `lib/tier.ts` — already reads from `user_subscriptions.tier`, no changes needed
- All existing Pro-gated routes — they already check tier via `requirePro()` or `getUserTier()`
- Signup flow, analyze pages, dashboard, SEO — untouched

### Security Considerations

- Stripe secret key is server-side only (never exposed to client)
- Webhook signature verification via `stripe.webhooks.constructEvent()` with raw body (`request.text()`) prevents spoofed events
- Card data never touches our servers — Stripe's Embedded Checkout handles PCI compliance
- CSP updated to allow Stripe's JS, iframe, and API domains
- Price IDs validated server-side against the 3 configured env vars — can't pass an arbitrary price
- Lifetime seat cap enforced server-side in both checkout route and webhook handler

### Testing

Manual verification after deploy:
1. Create test products in Stripe (test mode) matching the 3 price tiers
2. Set test-mode env vars in `.env.local`
3. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` for local webhook forwarding
4. Click "Upgrade to Pro" → embedded checkout appears inside modal
5. Use Stripe test card `4242 4242 4242 4242` → success
6. Verify webhook fires → `user_subscriptions` updated to `tier='pro'`
7. Verify Pro features unlocked (taxes, earnings, wrapped pages load without ProGate)
8. Go to Settings → Manage Billing → Stripe Portal opens
9. Cancel subscription in portal → verify `customer.subscription.updated` webhook fires → `cancel_at_period_end=true`
10. Wait for period end (or use Stripe test clock) → `customer.subscription.deleted` fires → tier reverts to 'free', all Stripe fields cleared
11. Test lifetime purchase → verify `billing_period='lifetime'`, `current_period_end='9999-12-31'`
12. Test lifetime cap: set cap to 1, buy 1 lifetime, try to buy a second → should get 400 "sold out"
13. Test account deletion with active subscription → subscription should be cancelled in Stripe before user is deleted
