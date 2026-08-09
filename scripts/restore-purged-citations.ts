/**
 * Put back the rows the purge should not have taken.
 *
 * The first cut of the gate had four rules that were too broad, and they took
 * real findings with them: a named competitive threat to a memory-demand pillar
 * (deleted because the sentence ended "$1,550 price target"), three rows
 * carrying "analysts estimate generates about 20% of Broadcom's annual revenue"
 * (deleted on a character offset pretending to be a subject test), and a short
 * line carrying a figure (deleted because the figure test only ran from six
 * words up). One of them was a CONTRADICTING row, and the corpus only has 90.
 *
 * This replays the CURRENT gate over the backup and re-inserts everything that
 * now survives, or that is now only a soft defect. Rows that are still hard
 * defects stay deleted.
 *
 * Dry run by default. Pass --apply to write.
 *
 * AFTER APPLYING, run scripts/recompute-pillar-status.ts --apply. Adding
 * evidence back changes what the statuses derive from, exactly as removing it
 * did.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { citationDefect } from '../lib/content/citation-quality';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const BACKUP = process.env.PURGE_BACKUP_PATH
  ?? 'C:/Users/Evan/AppData/Local/Temp/claude/C--Users-Evan-Desktop-unnamed-fintech-bot/1b7d3cbb-cad6-429a-80b9-6b9b4c123ce0/scratchpad/pillar-evidence-backup.json';

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('supabase:', new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host);
  console.log('backup:  ', BACKUP);

  const rows: any[] = JSON.parse(readFileSync(BACKUP, 'utf8'));
  console.log(`\n${rows.length} rows in the backup`);

  const restore: any[] = [];
  const keepDeleted = new Map<string, number>();
  for (const r of rows) {
    const d = citationDefect(r.excerpt, r.verdict, r.source_type);
    if (d && d.severity === 'hard') {
      keepDeleted.set(d.detail, (keepDeleted.get(d.detail) ?? 0) + 1);
      continue;
    }
    // _defect was added by the purge script and is not a column.
    const { _defect, ...row } = r;
    restore.push(row);
  }

  console.log(`${restore.length} to restore, ${rows.length - restore.length} stay deleted`);
  console.log('\nstill deleted, by rule:');
  for (const [k, n] of [...keepDeleted].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);

  const verdicts = new Map<string, number>();
  for (const r of restore) verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
  console.log('\nrestoring verdicts:', [...verdicts.entries()]);
  console.log('\nwhat comes back:');
  for (const r of restore.slice(0, 12)) {
    console.log(`  [${r.verdict}] ${String(r.excerpt).replace(/\s+/g, ' ').slice(0, 120)}`);
  }

  if (!apply) return console.log('\nDRY RUN. Nothing written. Re-run with --apply.');

  let done = 0;
  for (let i = 0; i < restore.length; i += 100) {
    const batch = restore.slice(i, i + 100);
    // The rows carry their original ids, so a re-run is idempotent rather than
    // duplicating everything it already put back.
    const { error } = await db.from('pillar_evidence').upsert(batch, { onConflict: 'id' });
    if (error) { console.log('  restore failed:', error.message); continue; }
    done += batch.length;
  }
  console.log(`\nrestored ${done} row(s).`);
  console.log('NOW RUN: npx tsx scripts/recompute-pillar-status.ts --apply');
}
main();
