/** Fresh, verified numbers for the Mucker call. Read-only, Supabase only. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DAY = 86400_000;
const ago = (n: number) => new Date(Date.now() - n * DAY).toISOString();

async function main() {
  const { data: u } = await db.auth.admin.listUsers({ perPage: 1000 });
  const users = u?.users ?? [];
  const emailOf = new Map(users.map((x) => [x.id, x.email ?? '?']));
  const now = Date.now();
  console.log(`AS OF ${new Date().toISOString().slice(0, 16)} UTC\n`);

  const sorted = [...users].sort((a, b) => (a.created_at! < b.created_at! ? -1 : 1));
  const since = (n: number) => users.filter((x) => x.created_at! >= ago(n)).length;
  console.log('SIGNUPS');
  console.log(`  total ${users.length}  |  7d ${since(7)}  |  30d ${since(30)}  |  90d ${since(90)}`);
  console.log(`  first ${sorted[0]?.created_at?.slice(0, 10)}  latest ${sorted[sorted.length - 1]?.created_at?.slice(0, 10)}`);

  const { data: items } = await db.from('plaid_items').select('user_id, status');
  const connected = new Set((items ?? []).filter((i) => i.status === 'active').map((i) => i.user_id));
  const { data: manual } = await db.from('linked_accounts').select('user_id, account_name');
  const manualUsers = new Set((manual ?? []).filter((a) => a.account_name === 'Manual Portfolio').map((a) => a.user_id));
  const { data: hUsers } = await db.from('holdings').select('user_id');
  const anyHoldings = new Set((hUsers ?? []).map((r) => r.user_id as string));
  console.log('\nCONNECTIONS');
  console.log(`  active Plaid item : ${connected.size} users`);
  console.log(`  manual portfolio  : ${manualUsers.size} users`);
  console.log(`  ANY holdings row  : ${anyHoldings.size} users`);
  console.log(`  activation (holdings/signups): ${((anyHoldings.size / users.length) * 100).toFixed(0)}%`);

  // Subscription reality. Columns per migration 049: tier, stripe_subscription_id,
  // billing_period, current_period_end, trial_ends_at.
  const { data: subs } = await db
    .from('user_subscriptions')
    .select('user_id, tier, stripe_subscription_id, billing_period, current_period_end, trial_ends_at, cancel_at_period_end');
  const byTier = new Map<string, number>();
  for (const s of subs ?? []) byTier.set(String(s.tier), (byTier.get(String(s.tier)) ?? 0) + 1);
  console.log('\nSUBSCRIPTIONS');
  console.log(`  by tier: ${[...byTier].sort().map(([t, n]) => `${t}:${n}`).join('  ')}`);

  // Real revenue = a live Stripe subscription. Comped pro/max have no stripe_sub.
  // The DB does not store the amount (price/period are null on these rows), so
  // the true MRR is read from Stripe itself. livemode is printed so a test-mode
  // sub can never be mistaken for revenue.
  const billing = (subs ?? []).filter((s) => s.stripe_subscription_id);
  console.log('\n  ACTUALLY BILLING (live Stripe subscription):');
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let mrr = 0;
  for (const s of billing) {
    try {
      const sub = await stripe.subscriptions.retrieve(String(s.stripe_subscription_id));
      const price = sub.items.data[0]?.price;
      const amt = (price?.unit_amount ?? 0) / 100;
      const monthly = price?.recurring?.interval === 'year' ? amt / 12 : amt;
      if (sub.status === 'active' || sub.status === 'trialing') mrr += monthly;
      console.log(`    ${emailOf.get(s.user_id as string)}  ${sub.status}  $${amt}/${price?.recurring?.interval}  =$${monthly.toFixed(2)}/mo  livemode=${sub.livemode}  cancel_at_end=${sub.cancel_at_period_end}`);
    } catch (e) {
      console.log(`    ${emailOf.get(s.user_id as string)}  STRIPE ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!billing.length) console.log('    none');
  console.log(`  MRR from live Stripe subs: $${mrr.toFixed(2)}`);

  const comped = (subs ?? []).filter((s) => !s.stripe_subscription_id && s.tier !== 'free' && !s.trial_ends_at);
  console.log(`\n  COMPED (paid tier, no Stripe, no trial): ${comped.length}`);
  for (const s of comped) console.log(`    ${emailOf.get(s.user_id as string)}  ${s.tier}`);

  const trials = (subs ?? []).filter((s) => s.trial_ends_at);
  console.log(`\n  TRIALS (trial_ends_at set): ${trials.length}`);
  for (const s of trials) {
    const end = String(s.trial_ends_at);
    const daysLeft = Math.round((new Date(end).getTime() - now) / DAY);
    const state = new Date(end).getTime() > now ? `active, ${daysLeft}d left` : `EXPIRED ${-daysLeft}d ago`;
    console.log(`    ${emailOf.get(s.user_id as string)}  ends ${end.slice(0, 10)}  (${state})`);
  }

  const { data: theses } = await db.from('theses').select('user_id, tracked');
  const thesisUsers = new Set((theses ?? []).map((t) => t.user_id));
  console.log('\nTHESIS ENGAGEMENT');
  console.log(`  users with >=1 thesis: ${thesisUsers.size}  |  theses ${(theses ?? []).length} (tracked ${(theses ?? []).filter((t) => t.tracked).length})`);

  const active = (n: number) => users.filter((x) => x.last_sign_in_at && x.last_sign_in_at >= ago(n)).length;
  console.log('\nRETURN VISITS (supabase last_sign_in_at = a FLOOR; PostHog is truth)');
  console.log(`  7d ${active(7)}  |  30d ${active(30)}`);
}
main();
