# Stripe Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to pay for Helm Terminal Pro ($14.99/mo, $119/yr, $249 lifetime) via Stripe Embedded Checkout, with webhook-driven tier upgrades and self-service billing management.

**Architecture:** Stripe Embedded Checkout renders inside a modal on helmterminal.dev. The checkout route creates sessions server-side, the webhook route is the single source of truth for tier changes, and the Stripe Customer Portal handles billing management. No card data ever touches our servers.

**Tech Stack:** Stripe (stripe@^17, @stripe/stripe-js, @stripe/react-stripe-js), Next.js App Router, Supabase (user_subscriptions table), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-stripe-integration-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/028_stripe_integration.sql` | Create | Add Stripe columns to user_subscriptions |
| `lib/stripe.ts` | Create | Singleton Stripe server client + billing period helpers |
| `app/api/stripe/checkout/route.ts` | Create | Create Embedded Checkout sessions |
| `app/api/stripe/webhook/route.ts` | Create | Handle Stripe events → update tier |
| `app/api/stripe/portal/route.ts` | Create | Create Customer Portal sessions |
| `components/checkout-modal.tsx` | Create | Reusable modal with EmbeddedCheckout |
| `components/pro-gate.tsx` | Modify | Swap waitlist → checkout trigger |
| `app/pricing/page.tsx` | Modify | Real checkout buttons, new prices, lifetime counter, update FAQs + remove "Coming Soon" |
| `app/dashboard/settings/page.tsx` | Modify | Billing section with plan info |
| `app/dashboard/page.tsx` | Modify | Upgrade success polling on ?upgrade=success |
| `app/api/auth/delete-account/route.ts` | Modify | Cancel Stripe sub before deletion |
| `app/api/user/tier/route.ts` | Modify | Add Cache-Control: no-store header |
| `middleware.ts` | Modify | Add Stripe domains to CSP |
| `package.json` | Modify | Add Stripe packages |
| `.env.local.example` | Modify | Document 6 new env vars |

---

## API contract decision (applies to ALL tasks)

The frontend sends `billingPeriod: 'monthly' | 'annual' | 'lifetime'` — NOT raw Stripe price IDs. The checkout API route maps billing period → env var price ID server-side. This keeps price IDs server-only and avoids exposing Stripe internals to the client.

The `CheckoutModal` component accepts `billingPeriod` as a prop, not `priceId`.

---

### Task 1: Install packages + migration

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/028_stripe_integration.sql`
- Modify: `.env.local.example`

- [ ] **Step 1: Install Stripe packages**

```bash
npm install stripe@^17 @stripe/stripe-js @stripe/react-stripe-js
```

Note: pin stripe to ^17 so the `apiVersion` in lib/stripe.ts matches the SDK's bundled types.

- [ ] **Step 2: Create migration 028**

```sql
-- 028: STRIPE INTEGRATION
-- Adds Stripe payment fields to user_subscriptions for Pro tier checkout,
-- subscription management, and lifetime deal tracking.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT CHECK (billing_period IN ('monthly', 'annual', 'lifetime')),
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_sub
  ON user_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
```

- [ ] **Step 3: Add env vars to .env.local.example**

Add after existing Upstash section:

```
# ────────────────────────────────────────────────────────────────────────
# Stripe (payment processing for Pro tier)
# ────────────────────────────────────────────────────────────────────────
# 1. Create a Stripe account: https://dashboard.stripe.com
# 2. Create 3 products: Pro Monthly ($14.99/mo), Pro Annual ($119/yr), Lifetime ($249)
# 3. Copy Price IDs below
# 4. Add webhook endpoint: https://helmterminal.dev/api/stripe/webhook
#    Events: checkout.session.completed, customer.subscription.updated,
#            customer.subscription.deleted, invoice.payment_failed
# 5. For local dev: stripe listen --forward-to localhost:3000/api/stripe/webhook
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_ANNUAL=
STRIPE_PRICE_LIFETIME=
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json supabase/migrations/028_stripe_integration.sql .env.local.example
git commit -m "feat(stripe): install packages + migration 028 for Stripe columns"
```

---

### Task 2: Stripe server client + CSP update

**Files:**
- Create: `lib/stripe.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Create lib/stripe.ts**

```ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
  typescript: true,
});

const BILLING_PERIOD_MAP: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

/** Map a billing period to its Stripe Price ID. Returns null for invalid input. */
export function getPriceId(billingPeriod: string): string | null {
  return BILLING_PERIOD_MAP[billingPeriod] ?? null;
}

/** Whether this billing period uses Stripe 'payment' mode (one-time) vs 'subscription'. */
export function getCheckoutMode(billingPeriod: string): 'payment' | 'subscription' {
  return billingPeriod === 'lifetime' ? 'payment' : 'subscription';
}
```

- [ ] **Step 2: Update CSP in middleware.ts**

In the CSP header block, add:
- `script-src`: add `https://js.stripe.com`
- `frame-src`: add `https://js.stripe.com` (CRITICAL — Embedded Checkout renders in an iframe. Without this, the modal renders blank with no error.)
- `connect-src`: add `https://api.stripe.com`

- [ ] **Step 3: Commit**

```bash
git add lib/stripe.ts middleware.ts
git commit -m "feat(stripe): add Stripe server client + CSP for Embedded Checkout"
```

---

### Task 3: Checkout API route

**Files:**
- Create: `app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Create the checkout route**

Accepts `{ billingPeriod: 'monthly' | 'annual' | 'lifetime' }` — maps to price ID server-side via `getPriceId()`.

Logic:
1. Authenticate user via Supabase session → 401 if not logged in
2. **Guard: already Pro** — check `user_subscriptions.tier`. If already 'pro', return 400 "You already have an active Pro subscription." Prevents duplicate subscriptions.
3. Validate billingPeriod → 400 if invalid
4. Look up or create Stripe customer (use `createServiceClient()` for writes — same pattern as `app/api/plaid/webhook/route.ts`)
5. **Lifetime cap enforcement:** if lifetime, count `WHERE billing_period = 'lifetime'`. If >= 200, return 400 "Lifetime deal is sold out."
6. Create Embedded Checkout Session with `ui_mode: 'embedded'`, `return_url` including `{CHECKOUT_SESSION_ID}` template variable
7. Return `{ clientSecret }`

- [ ] **Step 2: Commit**

```bash
git add app/api/stripe/checkout/route.ts
git commit -m "feat(stripe): checkout route with billingPeriod → priceId mapping"
```

---

### Task 4: Webhook API route

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Create the webhook route**

CRITICAL implementation details:
- Read raw body via `request.text()` — NOT `request.json()`. This is the same pattern used by `app/api/plaid/webhook/route.ts` and is required for Stripe signature verification.
- Use `createServiceClient()` for ALL database writes (webhook has no user session, RLS requires service_role). This pattern is already proven by the Plaid webhook.
- Check duplicate events via `event.id` before processing.

Four event handlers:

**`checkout.session.completed`:**
- Read `metadata.supabase_user_id` and `metadata.billing_period`. If `supabase_user_id` is missing, log warning and return 200 (don't crash on manually-created sessions).
- For subscriptions: call `stripe.subscriptions.retrieve(session.subscription)` to get `current_period_end`
- For lifetime: set `current_period_end = '9999-12-31T23:59:59Z'`
- **Lifetime cap re-check:** count existing lifetime users. If > 200, log `event_type='lifetime_cap_exceeded'` to `auth_events` as an alert — do NOT reject (refund manually).
- Upsert `user_subscriptions` → `tier='pro'`

**`customer.subscription.updated`:**
- Sync `cancel_at_period_end` and `current_period_end`

**`customer.subscription.deleted`:**
- Set `tier='free'`, clear ALL Stripe fields including `current_period_end` and `cancel_at_period_end`

**`invoice.payment_failed`:**
- Log to `auth_events`. Check for duplicate event ID before inserting.

Return 200 for all events.

- [ ] **Step 2: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): webhook route — single source of truth for tier changes"
```

---

### Task 5: Portal API route

**Files:**
- Create: `app/api/stripe/portal/route.ts`

- [ ] **Step 1: Create the portal route**

1. Authenticate user
2. Read `stripe_customer_id` and `billing_period` from `user_subscriptions`
3. **Lifetime guard:** if `billing_period === 'lifetime'`, return `{ url: null, message: 'Lifetime access — no billing to manage.' }`. Lifetime users have no subscription to manage in the portal.
4. If no `stripe_customer_id`, return 400
5. Create Billing Portal session → return `{ url }`

- [ ] **Step 2: Commit**

```bash
git add app/api/stripe/portal/route.ts
git commit -m "feat(stripe): portal route with lifetime user guard"
```

---

### Task 6: CheckoutModal component

**Files:**
- Create: `components/checkout-modal.tsx`

- [ ] **Step 1: Create the CheckoutModal**

Props: `{ billingPeriod: BillingPeriod, onClose: () => void }`

Behavior:
1. Calls `POST /api/stripe/checkout` with `{ billingPeriod }`
2. Receives `clientSecret`
3. Renders `<EmbeddedCheckoutProvider>` + `<EmbeddedCheckout>` inside a modal overlay
4. Loading state while fetching clientSecret
5. Error state with message for failures (lifetime sold out, already Pro, network error)
6. Dark modal overlay matching Helm's design system

Initialize `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)` at module level (not per render) — prevents re-initialization.

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add components/checkout-modal.tsx
git commit -m "feat(stripe): CheckoutModal with Embedded Checkout"
```

---

### Task 7: Update ProGate + pricing page

**Files:**
- Modify: `components/pro-gate.tsx`
- Modify: `app/pricing/page.tsx`

- [ ] **Step 1: Update ProGate**

Replace `ProWaitlistButton` with:
1. Plan selector: Monthly ($14.99/mo) / Annual ($9.99/mo billed yearly, default) / Lifetime ($249)
2. "Upgrade to Pro" button → opens `<CheckoutModal billingPeriod={selected}>`
3. Keep Lock icon, feature description, "Back to Dashboard" link

- [ ] **Step 2: Update pricing page**

Major changes:
1. Update OG metadata from "$24.99/month" to new pricing
2. Replace Pro waitlist button with checkout trigger (monthly/annual toggle, default annual)
3. Add lifetime card with "X of 200 remaining" counter (server-side query)
4. Show "Current plan" badge for Pro users — need richer query than `getUserTier()`: read `billing_period`, `cancel_at_period_end`, `current_period_end` from `user_subscriptions` directly
5. Show "Manage Billing" link for Pro users (calls portal API)
6. **Remove "Coming Soon" badge** from Pro card
7. **Update FAQ items** — replace "Pro is currently in development" with description of what Pro includes and how to subscribe

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add components/pro-gate.tsx app/pricing/page.tsx
git commit -m "feat(stripe): ProGate checkout trigger + pricing page overhaul"
```

---

### Task 8: Settings billing section + upgrade success polling

**Files:**
- Modify: `app/dashboard/settings/page.tsx`
- Modify: `app/api/user/tier/route.ts`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add billing section to settings**

Show current plan, renewal/cancellation date, "Manage Billing" button (Pro users) or "Upgrade to Pro" (free users). Read `billing_period`, `current_period_end`, `cancel_at_period_end` from `user_subscriptions`.

For lifetime users: show "Lifetime access" with no manage billing button.

- [ ] **Step 2: Add Cache-Control: no-store to tier endpoint**

```ts
return NextResponse.json({ tier }, {
  headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
});
```

Prevents Vercel edge from caching stale `free` response during upgrade-success polling.

- [ ] **Step 3: Add upgrade success polling to dashboard**

When `/dashboard?upgrade=success`:
1. Show "Processing your upgrade..." interstitial
2. Poll tier endpoint every 2s (max 30s)
3. On tier='pro' → success toast, remove interstitial
4. On timeout → "Your payment was received. Features will unlock within a few minutes."

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/settings/page.tsx app/api/user/tier/route.ts app/dashboard/page.tsx
git commit -m "feat(stripe): billing section + upgrade success polling"
```

---

### Task 9: Account deletion integration

**Files:**
- Modify: `app/api/auth/delete-account/route.ts`

- [ ] **Step 1: Cancel Stripe subscription before deletion**

BEFORE the existing deletion flow:
1. Read `stripe_customer_id` and `stripe_subscription_id` from `user_subscriptions`
2. If `stripe_subscription_id` exists, call `stripe.subscriptions.cancel()`
3. **If Stripe API call fails → ABORT the entire deletion. Return 500.** Do NOT delete a user with an orphaned billing subscription.
4. Optionally delete the Stripe customer: `stripe.customers.del()`
5. If both succeed, proceed with existing deletion flow (CASCADE handles user_subscriptions cleanup)

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/delete-account/route.ts
git commit -m "feat(stripe): cancel subscription before account deletion"
```

---

### Task 10: Final verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 2: Production build**

```bash
rm -rf .next && npx next build
```

Expected: success, new `/api/stripe/*` routes registered

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: 18/18 pass (no regressions)

- [ ] **Step 4: Verify diff scope**

```bash
git diff --stat HEAD~9..HEAD
```

Should only show files from the File Map above. No unrelated files touched.

- [ ] **Step 5: Do NOT push**

Wait for operator to:
1. Run migration 028 in Supabase SQL editor
2. Create Stripe products + prices in Stripe Dashboard (test mode first)
3. Set 6 env vars in Vercel (test-mode keys)
4. Configure webhook endpoint in Stripe Dashboard
5. Configure Customer Portal in Stripe Dashboard
6. Review the diff
7. Test with `stripe listen --forward-to localhost:3000/api/stripe/webhook`

Then push.
