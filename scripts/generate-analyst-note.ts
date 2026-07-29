/**
 * Compose (and optionally store) the weekly analyst note for one account —
 * the manual path for demos and for eyeballing a note before the Friday cron
 * writes them. Prints the memo with its citations so the grounding can be
 * checked against reality line by line.
 *
 * Usage: npx tsx scripts/generate-analyst-note.ts <email> [--save]
 * (email via argv only — never hardcode a real address in this public repo.)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { composeWeeklyNote, saveAnalystNote } from '@/lib/research/analyst-note';

async function main() {
  const email = (process.argv[2] ?? '').toLowerCase();
  const save = process.argv.includes('--save');
  if (!email) return console.log('Usage: npx tsx scripts/generate-analyst-note.ts <email> [--save]');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (!profile) return console.log(`No account for ${email}`);

  console.log(`\nComposing weekly note for ${profile.email}...`);
  const draft = await composeWeeklyNote(db, profile.id as string);
  if (!draft) return console.log('No note composed (empty book or compose failure).');

  console.log(`\n=== ${draft.title} ===  (week of ${draft.weekStart})\n`);
  console.log(draft.body);
  console.log(
    `\nSTATS: ${draft.stats.freshFindings} fresh / ${draft.stats.findings} total findings · $${draft.stats.surfacedTotal.toLocaleString()} surfaced · adviceFlag=${draft.stats.adviceFlag}`,
  );
  console.log(`\nCITATIONS (${draft.citations.length}):`);
  draft.citations.forEach((f, i) => {
    console.log(`  [${i + 1}] ${f.id} · ${f.ticker ?? '—'} · ${f.date ?? 'n/a'} · ${f.source}`);
    if (f.quote) console.log(`      "${f.quote.slice(0, 140)}"`);
  });

  if (save) {
    const { error } = await saveAnalystNote(db, profile.id as string, draft);
    console.log(error ? `\nSAVE FAILED: ${error.message}` : '\nSaved to analyst_notes.');
  } else {
    console.log('\n(dry run — pass --save to store)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
