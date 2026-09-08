import { createHash } from 'node:crypto';

type SubscriptionPeriod = {
  current_period_end?: number;
  items?: { data: { current_period_end?: number; price?: { id: string } }[] };
};

/** Acacia responses use the subscription; Basil and later webhooks use the item. */
export function subscriptionPeriodEnd(sub: SubscriptionPeriod, priceId?: string | null): string {
  const item = sub.items?.data.find(item => item.price?.id === priceId) ?? sub.items?.data[0];
  const seconds = item?.current_period_end ?? sub.current_period_end;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('Stripe subscription is missing a valid billing period');
  }
  return new Date(seconds * 1000).toISOString();
}

/** Stable UUID lets repeated deliveries describe the same analytics event. */
export function billingInsertId(kind: string, objectId: string): string {
  const hash = createHash('sha256').update(`${kind}:${objectId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

type InvoicePayment = {
  id: string; amount_paid: number; currency: string; status: string | null; livemode: boolean;
  billing_reason?: string | null; subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
};

/** Positive paid invoice, not a claim that this is a customer's first payment. */
export function paidInvoiceProperties(invoice: InvoicePayment): Record<string, unknown> | null {
  if (invoice.status !== 'paid' || !Number.isFinite(invoice.amount_paid) || invoice.amount_paid <= 0) return null;
  const subscription = invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
  return {
    $insert_id: billingInsertId('invoice_paid', invoice.id), invoice_id: invoice.id,
    subscription_id: typeof subscription === 'string' ? subscription : subscription?.id ?? null,
    amount_paid: invoice.amount_paid, currency: invoice.currency,
    billing_reason: invoice.billing_reason ?? null, livemode: invoice.livemode,
  };
}
