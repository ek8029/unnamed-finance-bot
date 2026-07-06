// Full audit of one user's holdings/accounts rows — is the census undercounting?
// Run: npx tsx scripts/probe-cameron.ts cameronazizi14@gmail.com
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const email = (process.argv[2] ?? 'cameronazizi14@gmail.com').toLowerCase();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const u = users?.users.find((x) => x.email?.toLowerCase() === email);
  if (!u) { console.log('no user'); return; }
  console.log(`${u.email}  id=${u.id}  signed up ${u.created_at}`);

  const { data: accts } = await sb.from('linked_accounts').select('id, account_name, account_type, source, current_balance, is_active, created_at').eq('user_id', u.id);
  console.log(`\nlinked_accounts (${accts?.length ?? 0}):`);
  for (const a of accts ?? []) console.log(`  ${a.created_at.slice(0, 16)}  [${a.source}] ${a.account_name} (${a.account_type}) balance=$${Number(a.current_balance ?? 0).toLocaleString()} active=${a.is_active}`);

  const { data: hs } = await sb
    .from('holdings')
    .select('ticker, shares, average_cost_basis, total_cost_basis, current_price, total_value, account_id, created_at, last_updated_at')
    .eq('user_id', u.id)
    .order('created_at', { ascending: true });
  console.log(`\nholdings (${hs?.length ?? 0}):`);
  for (const h of hs ?? []) {
    console.log(`  ${h.created_at.slice(0, 16)}  ${h.ticker}  shares=${h.shares}  cost_basis=$${Number(h.total_cost_basis ?? 0).toLocaleString()}  px=${h.current_price}  total_value=$${Number(h.total_value ?? 0).toLocaleString()}  acct=${String(h.account_id).slice(0, 8)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
