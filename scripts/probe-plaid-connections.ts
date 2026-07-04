// List every Plaid connection with the owning user's email + holdings/txn counts.
// Run: npx tsx scripts/probe-plaid-connections.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: items, error } = await sb
    .from('plaid_items')
    .select('id, user_id, institution_name, created_at, status')
    .order('created_at', { ascending: true });
  if (error) { console.error('plaid_items error:', error.message); process.exit(1); }
  if (!items?.length) { console.log('no plaid_items rows'); return; }

  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? '?']));

  const uids = [...new Set(items.map((i) => i.user_id))];
  for (const uid of uids) {
    const email = emailOf.get(uid) ?? uid;
    const { count: h } = await sb.from('holdings').select('*', { count: 'exact', head: true }).eq('user_id', uid);
    const { count: tx } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', uid);
    const theirs = items.filter((i) => i.user_id === uid).map((i) => `${i.institution_name}(${i.status})`).join(' + ');
    const first = items.find((i) => i.user_id === uid)!.created_at.slice(0, 10);
    console.log(`${first}  ${email}\n    ${theirs}\n    holdings=${h ?? 0}  transactions=${tx ?? 0}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
