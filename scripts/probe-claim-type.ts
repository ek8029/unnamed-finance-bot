/** Blind sample: how does the claim classifier do on rows I have not read? */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { classifyClaim } from '../lib/content/claim-type';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const n = Number(process.argv[2] ?? 40);
  const { data } = await db
    .from('pillar_evidence')
    .select('source_title, excerpt, source_url')
    .eq('source_type', 'news')
    .order('created_at', { ascending: false })
    .limit(600);

  const seen = new Set<string>();
  const rows = (data ?? []).filter((r) => {
    const k = String(r.source_title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Deterministic spread across the set rather than the newest N. The phase arg
  // shifts which rows are picked, so a second run judges rows the first did not.
  const phase = Number(process.argv[3] ?? 0);
  const step = Math.max(1, Math.floor(rows.length / n));
  const sample = rows.filter((_, i) => i % step === phase % step).slice(0, n);

  let ev = 0;
  for (const r of sample) {
    const text = `${r.source_title} ${r.excerpt}`;
    const c = classifyClaim(text);
    if (c === 'reported_event') ev++;
    console.log(`\n[${c === 'reported_event' ? 'EVENT  ' : 'OPINION'}] ${String(r.source_title).slice(0, 110)}`);
    console.log(`          ${String(r.excerpt).replace(/\s+/g, ' ').slice(0, 165)}`);
  }
  console.log(`\n\n${ev}/${sample.length} classified as reported_event`);
}
main();
