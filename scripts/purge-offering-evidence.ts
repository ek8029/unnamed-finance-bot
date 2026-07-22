/**
 * Remove thesis evidence sourced from offering paperwork.
 *
 * score-theses now filters EDGAR to business forms, so new scans are clean, but
 * the rows already stored are not. Until they go, every pillar status and every
 * ladder number is computed partly from prospectus boilerplate: measured
 * 2026-07-22, 297 of 347 filing-sourced rows were 424B2/FWP, and JPM had 131 of
 * 136 findings on one pillar from them.
 *
 * Dry run by default. Pass --apply to delete.
 *   npx tsx scripts/purge-offering-evidence.ts
 *   npx tsx scripts/purge-offering-evidence.ts --apply
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/**
 * Prospectus supplements, free writing prospectuses, registration statements
 * and merger paperwork. All describe securities being issued rather than how
 * the business is performing.
 */
const OFFERING_FORM = /^(424B\d?|FWP|S-1|S-3|S-3ASR|S-4|425|POS AM)\b/i;

/** A form we deliberately keep, listed so the match can be eyeballed. */
const BUSINESS_FORM = /^(10-K|10-Q|8-K|20-F|40-F|6-K)\b/i;

async function pageAll<T>(cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('pillar_evidence').select(cols).eq('source_type', 'filing').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  type Row = { id: string; source_title: string; pillar_id: string; verdict: string; materiality: string; excerpt: string };
  const rows = await pageAll<Row>('id, source_title, pillar_id, verdict, materiality, excerpt');

  const form = (t: string) => (String(t).match(/^([A-Z0-9-]+(?:\s+AM)?)\s+filed/i)?.[1] ?? String(t)).toUpperCase();
  const doomed = rows.filter((r) => OFFERING_FORM.test(form(r.source_title)));
  const kept = rows.filter((r) => !OFFERING_FORM.test(form(r.source_title)));

  console.log(`filing-sourced evidence: ${rows.length}`);
  console.log(`  offering paperwork    : ${doomed.length}`);
  console.log(`  keeping               : ${kept.length}`);

  const tally = (list: Row[]) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(form(r.source_title), (m.get(form(r.source_title)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}:${n}`).join('  ');
  };
  console.log(`\n  to delete: ${tally(doomed) || 'none'}`);
  console.log(`  to keep  : ${tally(kept) || 'none'}`);

  // Anything kept that is not a recognised business form deserves a look before
  // this is ever run again.
  const oddKept = kept.filter((r) => !BUSINESS_FORM.test(form(r.source_title)));
  if (oddKept.length) {
    console.log(`\n  NOTE: ${oddKept.length} kept row(s) are neither offering nor business forms:`);
    for (const r of oddKept.slice(0, 5)) console.log(`    ${form(r.source_title)}  "${r.source_title}"`);
  }

  console.log(`\n  sample of what would be deleted:`);
  for (const r of doomed.slice(0, 5)) {
    console.log(`    [${r.verdict}/${r.materiality}] ${r.source_title}`);
    console.log(`       ${r.excerpt.replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  console.log(`\n  pillars affected: ${new Set(doomed.map((r) => r.pillar_id)).size}`);

  if (!apply) {
    console.log(`\nDRY RUN. Nothing deleted. Re-run with --apply to delete ${doomed.length} rows.`);
    return;
  }

  let removed = 0;
  for (let i = 0; i < doomed.length; i += 200) {
    const batch = doomed.slice(i, i + 200).map((r) => r.id);
    const { error, count } = await db.from('pillar_evidence').delete({ count: 'exact' }).in('id', batch);
    if (error) {
      console.log(`  delete failed on batch ${i}: ${error.message}`);
      break;
    }
    removed += count ?? 0;
  }
  console.log(`\nDeleted ${removed} of ${doomed.length} rows.`);
}
main();
