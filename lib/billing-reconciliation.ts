/** Provider snapshots, never webhook event types, determine paid access. */
export interface BillingRow {
  user_id: string;
  tier: string;
  source: 'stripe' | 'revenuecat';
  updated_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  store_product_id: string | null;
  billing_period: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  permanent_access?: 'complimentary' | 'lifetime' | null;
}
export interface ProviderAccess {
  active: boolean;
  productId?: string | null;
  subscriptionId?: string | null;
  period?: string | null;
  expiresAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string | null;
}
export interface BillingOptions {
  requireRevenueCat?: boolean;
  stripeCustomerId?: string | null;
  legacyLifetime?: boolean;
}
export interface BillingDependencies {
  load: (userId: string) => Promise<BillingRow | null>;
  revenueCat: (userId: string) => Promise<ProviderAccess>;
  stripe: (customerId: string) => Promise<ProviderAccess>;
  /** false means the row changed while providers were being queried. */
  save: (previous: BillingRow | null, next: BillingRow) => Promise<boolean>;
  now: () => number;
}

export async function reconcileBillingState(userId: string, deps: BillingDependencies, options: BillingOptions = {}): Promise<BillingRow> {
  for (let attempt = 0; attempt < 4; attempt++) {
    // This read MUST precede provider calls. A stale response that finishes
    // after a newer reconciliation fails the version check and is re-fetched.
    const previous = await deps.load(userId);
    const customerId = options.stripeCustomerId ?? previous?.stripe_customer_id ?? null;
    const checkApple = options.requireRevenueCat || previous?.source === 'revenuecat' || !!previous?.store_product_id;
    const [apple, stripe] = await Promise.all([
      checkApple ? deps.revenueCat(userId) : Promise.resolve<ProviderAccess>({ active: false }),
      customerId ? deps.stripe(customerId) : Promise.resolve<ProviderAccess>({ active: false }),
    ]);
    const now = deps.now();
    // Permanent grants are independent of the currently displayed provider.
    // Inferring a comp from a missing subscription id loses grants after an
    // Apple purchase, and can resurrect an expired paid subscription.
    const permanent = options.legacyLifetime ? 'lifetime' : previous?.permanent_access ?? null;
    const trial = !!previous?.trial_ends_at && (previous.tier === 'pro' || previous.tier === 'max')
      && !previous.stripe_customer_id && !previous.stripe_subscription_id
      && Date.parse(previous.trial_ends_at) > now;
    const grant: ProviderAccess | null = permanent
      ? { active: true, period: permanent === 'lifetime' ? 'lifetime' : null,
          expiresAt: permanent === 'lifetime' ? '9999-12-31T23:59:59Z' : null }
      : trial ? { active: true, expiresAt: previous!.trial_ends_at } : null;
    const access = apple.active ? apple : stripe.active ? stripe : grant;
    const source = apple.active ? 'revenuecat' : stripe.active || grant ? 'stripe' : previous?.source ?? 'stripe';
    const next: BillingRow = {
      user_id: userId,
      tier: access?.active ? 'pro' : 'free',
      source,
      updated_at: new Date(Math.max(now, (Date.parse(previous?.updated_at ?? '') || 0) + 1)).toISOString(),
      stripe_customer_id: customerId,
      stripe_subscription_id: stripe.active ? stripe.subscriptionId ?? null : null,
      stripe_price_id: stripe.active ? stripe.productId ?? null : null,
      // Retain the Apple marker so later Stripe events also recheck Apple.
      store_product_id: apple.productId ?? previous?.store_product_id ?? null,
      billing_period: access?.period ?? null,
      current_period_end: access?.expiresAt ?? null,
      cancel_at_period_end: access?.cancelAtPeriodEnd ?? false,
      trial_ends_at: previous?.trial_ends_at ?? stripe.trialEndsAt ?? null,
      permanent_access: permanent,
    };
    if (await deps.save(previous, next)) return next;
  }
  throw new Error('Subscription changed during reconciliation; retry required');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function revenueCatUsers(event: Record<string, unknown>): string[] {
  const fields = event.type === 'TRANSFER'
    ? [event.transferred_from, event.transferred_to]
    : [event.app_user_id, event.original_app_user_id, event.aliases];
  return [...new Set(fields.flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && UUID.test(value)))];
}

type RCRecord = Record<string, unknown>;
const record = (value: unknown): RCRecord | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RCRecord : null;
export function revenueCatAccess(body: unknown, now: number): ProviderAccess {
  const subscriber = record(record(body)?.subscriber);
  const entitlements = record(subscriber?.entitlements);
  if (!subscriber || !entitlements) throw new Error('Invalid RevenueCat customer response');
  // An entitlement is keyed by its RevenueCat dashboard identifier, which here
  // is 'Helm Terminal Pro'. Looking the key up as `pro` matched nothing, so
  // every live App Store entitlement read as absent and reconciled to free.
  // Select on the product instead, which is the access gate either way.
  const held = Object.values(entitlements).map(record).filter((value): value is RCRecord => !!value);
  if (!held.length) return { active: false };
  // A malformed entitlement must never be read as "no entitlement".
  if (held.some(value => typeof value.product_identifier !== 'string')) throw new Error('RevenueCat entitlement is missing its product');
  // This app currently sells exactly this App Store product. Other project
  // apps/products cannot grant access merely by reaching the same webhook.
  const product = 'helm_pro_monthly';
  const pro = held.find(value => value.product_identifier === product);
  if (!pro) return { active: false };
  const subscription = record(record(subscriber.subscriptions)?.[product]);
  if (subscription?.store !== 'app_store') return { active: false };
  const expires = pro.expires_date;
  const grace = pro.grace_period_expires_date ?? subscription.grace_period_expires_date;
  if (typeof expires !== 'string' || !Number.isFinite(Date.parse(expires))) throw new Error('Invalid RevenueCat expiration');
  const expiry = Math.max(Date.parse(expires), typeof grace === 'string' ? Date.parse(grace) || 0 : 0);
  return {
    active: expiry > now && !subscription.refunded_at,
    productId: product,
    period: 'monthly', expiresAt: new Date(expiry).toISOString(),
    cancelAtPeriodEnd: !!subscription.unsubscribe_detected_at,
  };
}
