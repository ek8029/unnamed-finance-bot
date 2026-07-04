// Compare user_subscriptions vs user_tiers rows + holdings columns.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  const { data: subs, error: e1 } = await sb.from('user_subscriptions').select('user_id, tier, trial_ends_at, stripe_subscription_id');
  console.log('user_subscriptions:', e1?.message ?? '');
  for (const s of subs ?? []) console.log(`  ${emailOf.get(s.user_id)}  tier=${s.tier}  trial=${s.trial_ends_at ?? '-'}  stripe=${s.stripe_subscription_id ? 'yes' : '-'}`);

  const { data: tiers, error: e2 } = await sb.from('user_tiers').select('*');
  console.log('user_tiers:', e2?.message ?? '');
  for (const t of tiers ?? []) console.log(`  ${emailOf.get(t.user_id)}  ${JSON.stringify({ ...t, user_id: undefined, id: undefined })}`);

  const { data: h } = await sb.from('holdings').select('*').limit(1);
  console.log('holdings columns:', h?.[0] ? Object.keys(h[0]).join(', ') : 'none');
}
main().catch((e) => { console.error(e); process.exit(1); });
