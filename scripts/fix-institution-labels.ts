// Correct mislabeled institutions: force each institution row's name to the
// Plaid-provided truth (plaid_items.institution_name). Fixes the seed's fake
// plaid_institution_id collisions (ins_11 seeded "Vanguard" is really Schwab,
// ins_12 "E*TRADE" is really Fidelity, ...). Service-role = bypasses the shared-
// table RLS that made the app's own name-sync silently no-op.
// Dry-run by default. Apply: npx tsx scripts/fix-institution-labels.ts --apply
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const apply = process.argv.includes('--apply');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: items } = await sb.from('plaid_items')
    .select('institution_id, plaid_institution_id, institution_name')
    .not('institution_name', 'is', null);
  const { data: insts } = await sb.from('institutions').select('id, name');
  const nameById = new Map((insts ?? []).map(i => [i.id, i.name]));

  // institution_id -> correct name (from Plaid). If one row is somehow used by
  // two different Plaid names, last write wins — but each plaid id has its own row.
  const want = new Map<string, string>();
  for (const it of items ?? []) {
    if (it.institution_id && it.institution_name) want.set(it.institution_id, it.institution_name);
  }

  const changes: { id: string; from: string; to: string }[] = [];
  for (const [id, correct] of want) {
    const current = nameById.get(id);
    if (current && current !== correct) changes.push({ id, from: current, to: correct });
  }

  if (changes.length === 0) { console.log('No mislabeled institutions. Nothing to do.'); return; }
  console.log(`${changes.length} institution row(s) to fix:`);
  for (const c of changes) console.log(`  "${c.from}"  ->  "${c.to}"   (${c.id})`);

  if (!apply) { console.log('\nDRY RUN. Re-run with --apply to write.'); return; }

  for (const c of changes) {
    const { error } = await sb.from('institutions').update({ name: c.to }).eq('id', c.id);
    console.log(error ? `FAIL ${c.id}: ${error.message}` : `OK  "${c.from}" -> "${c.to}"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
