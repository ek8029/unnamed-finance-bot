// Disarm the seed landmines: null the fictional plaid_institution_id on low-range
// institution rows (ins_3..ins_14) so a future real connection can't wrong-match
// by Plaid id. Keeps ins_11 (Charles Schwab) + ins_12 (Fidelity) — verified REAL
// Plaid production ids, correctly named, actively matched. Slug fallback + the
// service-client name-sync (now in the exchange route) keep future connects correct.
// Dry-run by default. Apply: npx tsx scripts/scrub-institution-landmines.ts --apply
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const KEEP = new Set(['ins_11', 'ins_12']); // real prod ids, correct + in use

async function main() {
  const apply = process.argv.includes('--apply');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: insts } = await sb.from('institutions').select('id, name, plaid_institution_id');
  const targets = (insts ?? []).filter(i => /^ins_\d{1,2}$/.test(i.plaid_institution_id ?? '') && !KEEP.has(i.plaid_institution_id!));

  if (!targets.length) { console.log('No landmines to scrub.'); return; }
  console.log(`${targets.length} fictional plaid_institution_id(s) to null:`);
  for (const t of targets) console.log(`  ${t.plaid_institution_id} "${t.name}"`);

  if (!apply) { console.log('\nDRY RUN. Re-run with --apply.'); return; }
  for (const t of targets) {
    const { error } = await sb.from('institutions').update({ plaid_institution_id: null }).eq('id', t.id);
    console.log(error ? `FAIL ${t.plaid_institution_id}: ${error.message}` : `OK  nulled ${t.plaid_institution_id} "${t.name}"`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
