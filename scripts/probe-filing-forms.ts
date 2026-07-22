/** Which SEC form types are feeding thesis evidence, and how much? Read-only. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function pageAll<T>(table: string, cols: string, eq: [string, string]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from(table).select(cols).eq(eq[0], eq[1]).range(from, from + 999);
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const rows = await pageAll<{ source_title: string; verdict: string; materiality: string; pillar_id: string }>(
    'pillar_evidence',
    'source_title, verdict, materiality, pillar_id',
    ['source_type', 'filing'],
  );
  console.log(`filing-sourced evidence rows: ${rows.length}\n`);

  const byForm = new Map<string, { n: number; material: number; contradicts: number }>();
  for (const r of rows) {
    const form = (String(r.source_title).match(/^([A-Z0-9-]+)\s+filed/)?.[1] ?? 'other').toUpperCase();
    const e = byForm.get(form) ?? { n: 0, material: 0, contradicts: 0 };
    e.n++;
    if (r.materiality === 'material') e.material++;
    if (r.verdict === 'contradicts') e.contradicts++;
    byForm.set(form, e);
  }

  console.log('form      rows   material  contradicts');
  for (const [form, e] of [...byForm].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${form.padEnd(9)} ${String(e.n).padStart(4)}   ${String(e.material).padStart(6)}   ${String(e.contradicts).padStart(9)}`);
  }

  // Prospectus and offering paperwork describes SECURITIES the company issues,
  // not how the business is performing. It should never have been thesis evidence.
  const OFFERING = new Set(['424B2', '424B3', '424B5', 'FWP', 'S-1', 'S-3', 'S-3ASR', '425']);
  const offering = rows.filter((r) => OFFERING.has((String(r.source_title).match(/^([A-Z0-9-]+)\s+filed/)?.[1] ?? '').toUpperCase()));
  console.log(`\noffering paperwork: ${offering.length} of ${rows.length} filing rows (${((offering.length / rows.length) * 100).toFixed(0)}%)`);
  console.log(`   of those, material: ${offering.filter((r) => r.materiality === 'material').length}`);
  console.log(`   distinct pillars affected: ${new Set(offering.map((r) => r.pillar_id)).size}`);
}
main();
