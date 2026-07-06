// Full census of Plaid-connected users: name, email, when they connected,
// institutions, account/holdings counts, book value, tier, last seen.
// Run: npx tsx scripts/probe-plaid-connections.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: items, error } = await sb
    .from('plaid_items')
    .select('user_id, institution_name, created_at, status')
    .order('created_at', { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }

  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const userOf = new Map((users?.users ?? []).map((u) => [u.id, u]));

  // one sample holding to discover the value column
  const { data: sample } = await sb.from('holdings').select('*').limit(1);
  const cols = sample?.[0] ? Object.keys(sample[0]) : [];
  const valueCol = ['total_value', 'market_value', 'institution_value', 'current_value', 'value'].find((c) => cols.includes(c));

  const uids = [...new Set((items ?? []).map((i) => i.user_id))];
  for (const uid of uids) {
    const u = userOf.get(uid);
    const email = u?.email ?? uid;
    const name = (u?.user_metadata?.full_name || u?.user_metadata?.name || '(no name)') as string;
    const signedUp = u?.created_at?.slice(0, 10) ?? '?';
    const lastSeen = (u?.last_sign_in_at ?? '').slice(0, 10) || '?';

    const theirs = (items ?? []).filter((i) => i.user_id === uid);
    const insts = theirs.map((i) => `${i.institution_name}${i.status !== 'active' ? ` (${i.status})` : ''}`).join(' + ');
    const firstConnect = theirs[0].created_at.slice(0, 10);

    const { count: acctCount } = await sb.from('linked_accounts').select('*', { count: 'exact', head: true }).eq('user_id', uid);
    const { data: holdings } = await sb.from('holdings').select(valueCol ?? 'id').eq('user_id', uid);
    const hCount = holdings?.length ?? 0;
    const book = valueCol ? (holdings ?? []).reduce((s, h) => s + (Number((h as unknown as Record<string, unknown>)[valueCol]) || 0), 0) : 0;

    const { data: subRow } = await sb.from('user_subscriptions').select('tier').eq('user_id', uid).maybeSingle();

    console.log(
      `${name}  <${email}>\n` +
      `  signed up ${signedUp} | first connect ${firstConnect} | last sign-in ${lastSeen} | tier ${subRow?.tier ?? 'free'}\n` +
      `  institutions: ${insts}\n` +
      `  accounts: ${acctCount ?? 0} | holdings: ${hCount} | book ~$${Math.round(book).toLocaleString()}\n`,
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
