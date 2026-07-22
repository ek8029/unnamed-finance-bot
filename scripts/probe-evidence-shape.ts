/** Real pillar_evidence row shapes, so the v2 mapper is built on facts not guesses. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  for (const st of ['filing', 'news', 'price_move', 'form4', 'xbrl']) {
    const { data } = await db.from('pillar_evidence').select('*').eq('source_type', st).order('created_at', { ascending: false }).limit(2);
    console.log(`\n================ ${st} (${(data ?? []).length}) ================`);
    for (const r of data ?? []) {
      for (const [k, v] of Object.entries(r)) {
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        console.log(`  ${k.padEnd(20)} ${s === null ? 'null' : String(s).slice(0, 220)}`);
      }
      console.log('  ---');
    }
  }
  // How many distinct news domains, to see if primary vs opinion is separable.
  const { data: news } = await db.from('pillar_evidence').select('source_url, source_title').eq('source_type', 'news').limit(1000);
  const dom = new Map<string, number>();
  for (const n of news ?? []) {
    let d = 'none';
    try { d = new URL(String(n.source_url)).hostname.replace(/^www\./, ''); } catch { /* keep none */ }
    dom.set(d, (dom.get(d) ?? 0) + 1);
  }
  console.log('\n================ news domains ================');
  for (const [d, n] of [...dom].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(4)}  ${d}`);
}
main();
