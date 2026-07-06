// Users with MANUAL holdings (no Plaid required): who they are, what they added.
// Run: npx tsx scripts/probe-manual-users.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const userOf = new Map((users?.users ?? []).map((u) => [u.id, u]));

  const { data: manualAccts, error } = await sb
    .from('linked_accounts')
    .select('user_id, account_name, created_at')
    .eq('source', 'manual')
    .order('created_at', { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }
  if (!manualAccts?.length) { console.log('no manual accounts'); return; }

  const { data: plaidItems } = await sb.from('plaid_items').select('user_id');
  const hasPlaid = new Set((plaidItems ?? []).map((p) => p.user_id));

  const uids = [...new Set(manualAccts.map((a) => a.user_id))];
  for (const uid of uids) {
    const u = userOf.get(uid);
    const email = u?.email ?? uid;
    const name = (u?.user_metadata?.full_name || u?.user_metadata?.name || '(no name)') as string;
    const first = manualAccts.find((a) => a.user_id === uid)!.created_at.slice(0, 10);
    const { data: hs } = await sb.from('holdings').select('ticker, total_value').eq('user_id', uid);
    const book = (hs ?? []).reduce((s, h) => s + (Number(h.total_value) || 0), 0);
    console.log(
      `${name}  <${email}>\n` +
      `  first manual entry ${first} | signed up ${u?.created_at?.slice(0, 10) ?? '?'} | last sign-in ${(u?.last_sign_in_at ?? '').slice(0, 10) || '?'} | also has Plaid: ${hasPlaid.has(uid) ? 'YES' : 'no'}\n` +
      `  holdings: ${hs?.length ?? 0} | book ~$${Math.round(book).toLocaleString()} | tickers: ${(hs ?? []).slice(0, 8).map((h) => h.ticker).join(', ')}${(hs?.length ?? 0) > 8 ? '…' : ''}\n`,
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
