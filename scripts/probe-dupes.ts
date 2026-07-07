import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const em = new Map((users?.users ?? []).map(u => [u.id, u.email ?? u.id]));
  const dupUsers = ['26c5dbd3', '5286e427'];
  for (const [id, email] of em) if (dupUsers.some(d => id.startsWith(d))) {
    const { data: its } = await sb.from('plaid_items').select('id, institution_name, status, plaid_institution_id').eq('user_id', id);
    console.log(`${email}: ${(its??[]).map(i=>`${i.institution_name}(${i.status})`).join(', ')}`);
  }
  // $0 holding owner
  const { data: h } = await sb.from('holdings').select('user_id, ticker, shares, current_price').eq('ticker','021ESC017');
  for (const r of h ?? []) console.log(`$0 holding 021ESC017: user ${em.get(r.user_id)} shares=${r.shares}`);
  // the 4 active-accounts-0-holdings users
  const { data: accts } = await sb.from('linked_accounts').select('user_id, account_name, account_type').eq('is_active', true);
  const { data: holds } = await sb.from('holdings').select('user_id');
  const holdU = new Set((holds??[]).map(h=>h.user_id));
  const noHold = [...new Set((accts??[]).filter(a=>!holdU.has(a.user_id)).map(a=>a.user_id))];
  console.log('\nactive-accounts-but-0-holdings:');
  for (const u of noHold) { const mine=(accts??[]).filter(a=>a.user_id===u); console.log(`  ${em.get(u)}: ${mine.map(a=>a.account_type).join(',')}`); }
}
main().catch(e=>{console.error(e);process.exit(1);});
