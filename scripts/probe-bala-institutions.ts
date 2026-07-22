// Why do Bala's Schwab + Fidelity show as Vanguard + E-Trade? Dump his
// plaid_items, linked_accounts, and the institutions rows they point at.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const target = (process.argv[2] ?? '').toLowerCase();
  if (!target) return console.log('Usage: npx tsx scripts/probe-bala-institutions.ts <email>');
  const u = users?.users.find((x) => x.email?.toLowerCase() === target);
  if (!u) { console.log('no user'); return; }
  console.log('user', u.id);

  const { data: items } = await sb.from('plaid_items')
    .select('id, institution_id, plaid_institution_id, institution_name, status')
    .eq('user_id', u.id);
  console.log('\n=== plaid_items ===');
  for (const it of items ?? []) console.log(JSON.stringify(it));

  const { data: accts } = await sb.from('linked_accounts')
    .select('id, institution_id, account_name, official_name, account_type, source, plaid_account_id')
    .eq('user_id', u.id);
  console.log('\n=== linked_accounts ===');
  for (const a of accts ?? []) console.log(JSON.stringify(a));

  const instIds = [...new Set([...(items ?? []).map(i => i.institution_id), ...(accts ?? []).map(a => a.institution_id)].filter(Boolean))];
  const { data: insts } = await sb.from('institutions')
    .select('id, name, slug, plaid_institution_id, supports_plaid, institution_type')
    .in('id', instIds);
  console.log('\n=== institutions these point at ===');
  for (const i of insts ?? []) console.log(JSON.stringify(i));

  // Also: are there duplicate/seeded institution rows for these names/slugs?
  const { data: seeded } = await sb.from('institutions')
    .select('id, name, slug, plaid_institution_id')
    .or('name.ilike.%schwab%,name.ilike.%fidelity%,name.ilike.%vanguard%,name.ilike.%trade%');
  console.log('\n=== all institutions matching schwab/fidelity/vanguard/etrade ===');
  for (const i of seeded ?? []) console.log(JSON.stringify(i));
}
main().catch((e) => { console.error(e); process.exit(1); });
