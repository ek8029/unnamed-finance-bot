// Verify Noah's subscription is truly set to cancel — DB row + live Stripe state.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const noah = users?.users.find((u) => u.email === 'n.a.kincer@gmail.com');
  if (!noah) { console.log('no user'); return; }

  const { data: sub } = await sb.from('user_subscriptions').select('*').eq('user_id', noah.id).maybeSingle();
  console.log('DB row:', JSON.stringify({ tier: sub?.tier, billing: sub?.billing_period, period_end: sub?.current_period_end, cancel_at_period_end: sub?.cancel_at_period_end, stripe_sub: sub?.stripe_subscription_id }, null, 2));

  if (!process.env.STRIPE_SECRET_KEY) { console.log('no STRIPE_SECRET_KEY in .env.local'); return; }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  if (sub?.stripe_subscription_id) {
    const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    console.log('Stripe:', JSON.stringify({ status: s.status, cancel_at_period_end: s.cancel_at_period_end, current_period_end: new Date(s.current_period_end * 1000).toISOString(), canceled_at: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null }, null, 2));
  } else {
    console.log('no stripe_subscription_id in DB — searching Stripe by customer');
    if (sub?.stripe_customer_id) {
      const list = await stripe.subscriptions.list({ customer: sub.stripe_customer_id, status: 'all', limit: 5 });
      for (const s of list.data) console.log(`  ${s.id} status=${s.status} cancel_at_period_end=${s.cancel_at_period_end} period_end=${new Date(s.current_period_end * 1000).toISOString()}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
