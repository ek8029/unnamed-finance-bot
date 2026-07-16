/** What did the judge actually store for the KO fairlife 8-K? */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await db
    .from('pillar_evidence')
    .select('id, verdict, materiality, source_type, source_title, excerpt, why, what_it_means, created_at, pillar_id, thesis_pillars(claim, status, thesis_id, theses(ticker, user_id))')
    .ilike('excerpt', '%fairlife%');
  if (error) { console.log('ERR', error.message); return; }
  for (const r of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = r.thesis_pillars as any;
    console.log('---');
    console.log('ticker:', p?.theses?.ticker, '| pillar:', p?.claim);
    console.log('verdict:', r.verdict, '| materiality:', r.materiality, '| type:', r.source_type, '| created:', r.created_at);
    console.log('title:', r.source_title);
    console.log('why:', r.why);
    console.log('what_it_means:', r.what_it_means);
  }
  console.log((data ?? []).length, 'rows');
}
main().catch((e) => { console.error(e); process.exit(1); });
