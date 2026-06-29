/**
 * Citation scoreboard (manual run). Same probe the weekly cron runs, but prints a
 * scannable table and writes logs/citation-probe-<date>.json instead of the DB.
 *
 * Usage: tsx scripts/probe-citation.ts
 * Optional: PROBE_MODEL=gpt-4o tsx scripts/probe-citation.ts
 *
 * The cron (/api/cron/citation-probe, Mondays 14:00 UTC) is the automated version;
 * use this for an ad-hoc check or to eyeball which queries miss.
 */
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runCitationProbe } from '../lib/citation-probe';

config({ path: '.env.local' });

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const result = await runCitationProbe({ date });
  console.log(`\nCitation scoreboard  ${result.date}  (model: ${result.model})\n`);

  for (const row of result.rows) {
    const mark = row.error ? 'ERR ' : row.appeared ? 'HIT ' : 'miss';
    const where = row.error ? row.error.slice(0, 40)
      : row.appeared ? (row.helmUrls[0] ? row.helmUrls[0] : 'in answer text') : '';
    console.log(`  [${mark}] ${row.query}`);
    if (where) console.log(`         ${where}`);
  }

  const errs = result.rows.filter((r) => r.error).length;
  console.log(`\n  Appeared: ${result.hits}/${result.total}` + (errs ? `  (${errs} errored)` : ''));
  console.log('  Track this rate weekly. Up and to the right = the machine working.\n');

  mkdirSync('logs', { recursive: true });
  const outPath = `logs/citation-probe-${result.date}.json`;
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`  Wrote ${outPath}\n`);
}

main();
