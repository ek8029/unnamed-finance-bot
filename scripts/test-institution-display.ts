// End-to-end display test across EVERY connected book: query the same shape the
// financial-summary route uses (linked_accounts → institutions(name)) and compare
// the rendered institution name to the Plaid truth (plaid_items.institution_name)
// for that account's institution_id. Any mismatch = a user seeing a wrong name.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map(u => [u.id, u.email ?? u.id]));

  const { data: items } = await sb.from('plaid_items').select('user_id, institution_id, institution_name');
  const connectedUsers = [...new Set((items ?? []).map(i => i.user_id))];

  let bad = 0, checked = 0;
  for (const uid of connectedUsers) {
    // truth: institution_id -> Plaid-provided name
    const truthById = new Map((items ?? []).filter(i => i.user_id === uid && i.institution_name).map(i => [i.institution_id, i.institution_name!]));
    const { data: accts } = await sb
      .from('linked_accounts')
      .select('institution_id, institutions(name)')
      .eq('user_id', uid)
      .eq('is_active', true);

    const wrong: string[] = [];
    const shownSet = new Set<string>();
    for (const a of accts ?? []) {
      const shown = (a.institutions as unknown as { name: string } | null)?.name ?? '(none)';
      shownSet.add(shown);
      const truth = truthById.get(a.institution_id);
      if (truth && shown !== '(none)' && norm(shown) !== norm(truth)) wrong.push(`shows "${shown}" for a "${truth}" account`);
    }
    checked++;
    if (wrong.length) { bad++; console.log(`FAIL  ${emailOf.get(uid)}: ${wrong.join('; ')}`); }
    else console.log(`PASS  ${emailOf.get(uid)}: ${[...shownSet].join(', ')}`);
  }
  console.log(`\n${checked} connected books checked — ${bad} showing a wrong institution name.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
