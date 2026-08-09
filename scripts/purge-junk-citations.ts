/**
 * Delete pillar_evidence rows whose citation is not evidence.
 *
 * The judge scores relevance, which is not the same test, so the corpus
 * accumulated safe-harbor boilerplate, broker price-target moves, listicle
 * placements and headless clauses, all filed as findings. `citationDefect` is
 * the same gate that now runs at ingest in lib/score-theses.ts; this applies it
 * to what is already stored.
 *
 * Only HARD defects are deleted. A soft defect (a chopped clause) is real text
 * presented badly and is left alone here.
 *
 * Writes a full backup of every row it is about to delete BEFORE deleting.
 *
 * Dry run by default. Pass --apply to write.
 *
 * AFTER APPLYING, run scripts/recompute-pillar-status.ts --apply. Statuses are
 * written at scan time, so deleting evidence without a replay leaves pillars
 * asserting a status the remaining evidence no longer supports.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { citationDefect } from '../lib/content/citation-quality';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Outside the repo on purpose: this file holds user-scoped rows and the repo is public.
const BACKUP = process.env.PURGE_BACKUP_PATH
  ?? 'C:/Users/Evan/AppData/Local/Temp/claude/C--Users-Evan-Desktop-unnamed-fintech-bot/1b7d3cbb-cad6-429a-80b9-6b9b4c123ce0/scratchpad/pillar-evidence-backup.json';

async function main() {
  const apply = process.argv.includes('--apply');

  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    // Supabase caps a select at 1000 rows and does not say so. Paginate.
    const { data, error } = await db.from('pillar_evidence').select('*').range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const doomed: any[] = [];
  const kept: Record<string, number> = {};
  const reasons = new Map<string, number>();
  for (const r of all) {
    const d = citationDefect(r.excerpt, r.verdict, r.source_type);
    if (!d) continue;
    if (d.severity === 'soft') { kept[d.detail] = (kept[d.detail] ?? 0) + 1; continue; }
    doomed.push({ ...r, _defect: d });
    reasons.set(`${d.code}/${d.detail}`, (reasons.get(`${d.code}/${d.detail}`) ?? 0) + 1);
  }

  console.log(`${all.length} evidence rows`);
  console.log(`${doomed.length} to delete (${(doomed.length / all.length * 100).toFixed(1)}%)`);
  console.log(`${Object.values(kept).reduce((a, b) => a + b, 0)} soft defects left in place:`, kept);
  console.log('\nreasons:');
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);

  const pillars = new Set(doomed.map((r) => r.pillar_id));
  console.log(`\ntouches ${pillars.size} pillar(s)`);
  const verdicts = new Map<string, number>();
  for (const r of doomed) verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
  console.log('verdicts being removed:', [...verdicts.entries()]);

  console.log('\nsample of what goes:');
  for (const r of doomed.slice(0, 8)) {
    console.log(`  [${r._defect.detail}] ${String(r.excerpt).replace(/\s+/g, ' ').slice(0, 110)}`);
  }

  if (!apply) return console.log('\nDRY RUN. Nothing written. Re-run with --apply.');

  writeFileSync(BACKUP, JSON.stringify(doomed, null, 2), 'utf8');
  console.log(`\nbacked up ${doomed.length} rows to ${BACKUP}`);

  let deleted = 0;
  for (let i = 0; i < doomed.length; i += 100) {
    const ids = doomed.slice(i, i + 100).map((r) => r.id);
    const { error } = await db.from('pillar_evidence').delete().in('id', ids);
    if (error) { console.log('  delete failed:', error.message); continue; }
    deleted += ids.length;
  }
  console.log(`deleted ${deleted} row(s).`);
  console.log('\nNOW RUN: npx tsx scripts/recompute-pillar-status.ts --apply');
}
main();
