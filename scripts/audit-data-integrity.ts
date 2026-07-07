// Read-only sweep for ACTUAL wrong state in prod data (the institution-mislabel
// class: orphans, seed landmines, silent-null money, duplicate/broken rows).
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const line = (t: string) => console.log(`\n=== ${t} ===`);

  // 1. Orphaned plaid_items — institution_id not in institutions (the "(no institution row)" we saw)
  line('1. plaid_items pointing at a missing institution row');
  const { data: items } = await sb.from('plaid_items').select('id, user_id, institution_id, plaid_institution_id, institution_name, status');
  const { data: insts } = await sb.from('institutions').select('id, name, slug, plaid_institution_id');
  const instIds = new Set((insts ?? []).map(i => i.id));
  const orphanItems = (items ?? []).filter(i => i.institution_id && !instIds.has(i.institution_id));
  console.log(orphanItems.length ? orphanItems.map(i => `  item ${i.id.slice(0,8)} user ${i.user_id.slice(0,8)} inst_id=${i.institution_id?.slice(0,8)} (${i.institution_name})`).join('\n') : '  none');

  // 2. Orphaned linked_accounts
  line('2. linked_accounts pointing at a missing institution row');
  const { data: accts } = await sb.from('linked_accounts').select('id, user_id, institution_id, account_name, is_active');
  const orphanAccts = (accts ?? []).filter(a => a.institution_id && !instIds.has(a.institution_id));
  console.log(orphanAccts.length ? orphanAccts.map(a => `  acct ${a.id.slice(0,8)} user ${a.user_id.slice(0,8)} "${a.account_name}" active=${a.is_active}`).join('\n') : '  none');

  // 3. Fake low-range seed landmines still armed (ins_3..ins_20 w/ plaid id, unclaimed by any real item)
  line('3. fake low-id institution seed rows (collision landmines)');
  const usedInstIds = new Set((items ?? []).map(i => i.institution_id));
  const lowSeed = (insts ?? []).filter(i => /^ins_\d{1,2}$/.test(i.plaid_institution_id ?? ''));
  console.log(lowSeed.map(i => `  ${i.plaid_institution_id} "${i.name}" ${usedInstIds.has(i.id) ? 'IN USE' : 'unclaimed'} (real Plaid ${i.plaid_institution_id} may be a different institution)`).join('\n') || '  none');

  // 4. Duplicate plaid_items per (user, plaid_institution_id)
  line('4. duplicate plaid_items (same user + same plaid institution)');
  const seen = new Map<string, number>();
  for (const i of items ?? []) { const k = `${i.user_id}|${i.plaid_institution_id}`; seen.set(k, (seen.get(k) ?? 0) + 1); }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  console.log(dups.length ? dups.map(([k, n]) => `  ${k.slice(0,20)}... x${n}`).join('\n') : '  none');

  // 5. Holdings rendered as $0 — null/zero price or missing security (understates real books)
  line('5. holdings with null/zero price or null total_value (silent $0)');
  const { data: holds } = await sb.from('holdings').select('user_id, ticker, shares, current_price, total_value, security_id');
  const zeroed = (holds ?? []).filter(h => (Number(h.total_value) === 0 || h.total_value == null || Number(h.current_price) === 0 || h.current_price == null) && Number(h.shares) > 0);
  const byUser = new Map<string, number>();
  for (const h of zeroed) byUser.set(h.user_id, (byUser.get(h.user_id) ?? 0) + 1);
  console.log(zeroed.length ? `  ${zeroed.length} zeroed holdings across ${byUser.size} users. sample: ${zeroed.slice(0,8).map(h=>`${h.ticker}(sh=${h.shares},px=${h.current_price})`).join(', ')}` : '  none');

  // 6. Subscriptions: weird tier/trial/stripe combos
  line('6. user_subscriptions anomalies');
  const { data: subs } = await sb.from('user_subscriptions').select('user_id, tier, trial_ends_at, stripe_subscription_id, cancel_at_period_end, current_period_end');
  const badTier = (subs ?? []).filter(s => !['free','pro','max'].includes(s.tier));
  const trialAndStripe = (subs ?? []).filter(s => s.trial_ends_at && s.stripe_subscription_id);
  console.log(`  tier not in (free,pro,max): ${badTier.length ? badTier.map(s=>s.tier).join(',') : 'none'}`);
  console.log(`  has BOTH trial_ends_at and stripe sub (trial should've cleared): ${trialAndStripe.length}`);

  // 7. securities missing a name (renders blank/ticker-only)
  line('7. securities with null/empty name');
  const { data: secs } = await sb.from('securities').select('ticker, security_name').or('security_name.is.null,security_name.eq.');
  console.log(secs?.length ? `  ${secs.length}: ${secs.slice(0,15).map(s=>s.ticker).join(', ')}` : '  none');

  // 8. active linked_accounts whose user has NO holdings but account_type brokerage (empty book shown as connected)
  line('8. brokerage accounts (source plaid) with zero holdings for that user');
  const holdUsers = new Set((holds ?? []).map(h => h.user_id));
  const emptyBrokerage = (accts ?? []).filter(a => a.is_active && !holdUsers.has(a.user_id));
  const ebUsers = [...new Set(emptyBrokerage.map(a => a.user_id))];
  console.log(ebUsers.length ? `  ${ebUsers.length} users have active accounts but 0 holdings (bank-only or failed holdings sync)` : '  none');
}
main().catch(e => { console.error(e); process.exit(1); });
