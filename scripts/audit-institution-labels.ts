// Systemic audit: for EVERY plaid_item, does the institution row it resolves to
// display the right name? plaid_items.institution_name is the truth from Plaid;
// institutions.name is what the UI shows. Any mismatch = a mislabeled user.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map(u => [u.id, u.email ?? u.id]));

  const { data: items } = await sb.from('plaid_items')
    .select('user_id, institution_id, plaid_institution_id, institution_name, status');
  const { data: insts } = await sb.from('institutions')
    .select('id, name, slug, plaid_institution_id');
  const instById = new Map((insts ?? []).map(i => [i.id, i]));

  console.log('=== per plaid_item: Plaid truth  vs  displayed institution ===');
  let mismatches = 0;
  for (const it of items ?? []) {
    const inst = instById.get(it.institution_id);
    const displayed = inst?.name ?? '(no institution row)';
    const truth = it.institution_name ?? '(null)';
    const bad = truth !== '(null)' && displayed.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6) !== truth.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6);
    if (bad) mismatches++;
    console.log(`${bad ? 'XX' : 'ok'}  ${emailOf.get(it.user_id)}  plaid=${it.plaid_institution_id} truth="${truth}"  ->  displayed="${displayed}" (inst.plaid_id=${inst?.plaid_institution_id})`);
  }
  console.log(`\n${mismatches} mismatched item(s).`);

  console.log('\n=== ALL institutions with a plaid_institution_id (the seed map) ===');
  for (const i of (insts ?? []).filter(i => i.plaid_institution_id).sort((a, b) => String(a.plaid_institution_id).localeCompare(String(b.plaid_institution_id)))) {
    console.log(`${i.plaid_institution_id}  name="${i.name}"  slug=${i.slug}  id=${i.id}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
