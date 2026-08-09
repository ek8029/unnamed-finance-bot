/**
 * Apply the citation gate to what is ALREADY PUBLIC on /masthead.
 *
 * The gate was wired into score-theses (which writes pillar_evidence) and not
 * into lib/content/select.ts (which writes content_events, which is what the
 * masthead renders). So the corpus got cleaned and the public page did not, and
 * MSTR's safe-harbor paragraph — "fluctuations in the price of Bitcoin and the
 * risk factors discussed under the caption Risk Factors" — has been sitting on
 * helmterminal.dev/masthead scored as a BROKEN pillar. It appears verbatim in
 * every filing the company has ever made.
 *
 * That page's entire argument is that nothing on it can be faked, so it is held
 * to a higher bar than a stored row: soft defects are pulled too.
 *
 * This does not delete anything. It sets content_queue.status to 'rejected',
 * which is the same state a human rejection produces, so the event stays in the
 * database and simply stops being published.
 *
 * Dry run by default. Pass --apply to write.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { citationDefect } from '../lib/content/citation-quality';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const apply = process.argv.includes('--apply');
  console.log('supabase:', new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host);

  const { data, error } = await db
    .from('content_queue')
    .select('id, status, decided_at, content_events(id, ticker, verdict, verbatim_cite, source_type, cite_date)')
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((r: any) => r.content_events);
  console.log(`${rows.length} approved catches on the public page\n`);

  const bad: { queueId: string; ticker: string; detail: string; cite: string }[] = [];
  const soft: string[] = [];
  for (const r of rows as any[]) {
    const e = r.content_events;
    const d = citationDefect(e.verbatim_cite, e.verdict, e.source_type);
    if (!d) continue;
    // Only HARD defects get pulled from what is already published. The soft
    // ones are chopped clauses, and several are the best evidence on the page:
    // "the decrease was primarily attributable to our Sports revenue, which
    // decreased $106.0 million, or 10.6%" starts lowercase and is a real,
    // figure-carrying line from a 10-Q. Rejecting those at selection is right,
    // because the pipeline can pick a better sentence from the same document.
    // Deleting them retroactively just removes true things from the record.
    if (d.severity !== 'hard') { soft.push(`[${e.ticker}] ${d.detail}`); continue; }
    bad.push({
      queueId: r.id,
      ticker: e.ticker,
      detail: `${d.code}/${d.detail} (${d.severity})`,
      cite: String(e.verbatim_cite).replace(/\s+/g, ' ').slice(0, 110),
    });
  }

  console.log(`${bad.length} fail the gate and are publicly visible:\n`);
  for (const b of bad) console.log(`  [${b.ticker}] ${b.detail}\n      ${b.cite}\n`);

  if (soft.length > 0) {
    console.log(`\n${soft.length} soft defect(s) LEFT IN PLACE (chopped clauses, still true):`);
    for (const s2 of soft) console.log('  ' + s2);
    console.log('  These want a better sentence from the same document, not deletion.');
  }

  if (bad.length === 0) return console.log('\nNothing to pull.');
  if (!apply) return console.log('DRY RUN. Nothing written. Re-run with --apply.');

  let pulled = 0;
  for (const b of bad) {
    const { error: e } = await db
      .from('content_queue')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', b.queueId);
    if (e) { console.log(`  failed for ${b.queueId}: ${e.message}`); continue; }
    pulled++;
  }
  console.log(`\nunpublished ${pulled} catch(es). They remain in content_events.`);
}
main();
