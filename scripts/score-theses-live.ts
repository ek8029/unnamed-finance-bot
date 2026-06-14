/**
 * Local live thesis scan = the /api/cron/score-theses cron, runnable on your
 * machine against PRODUCTION Supabase, with NO Vercel deploy and NO public UI.
 * It writes live (non-backfill) evidence + recomputes pillar status, so the
 * statuses you see on localhost move. Nothing about the thesis feature is exposed
 * publicly: only the shared Supabase data updates, which your localhost reads.
 *
 * Run:   npx tsx scripts/score-theses-live.ts            (all tracked theses)
 *        npx tsx scripts/score-theses-live.ts --ticker=NVDA
 *
 * Schedule (Windows Task Scheduler) to run daily, e.g. 9:25 AM:
 *   Program:   npx
 *   Arguments: tsx scripts/score-theses-live.ts
 *   Start in:  C:\Users\Evan\Desktop\unnamed fintech bot
 *
 * dotenv loads BEFORE importing lib/score-theses (that module builds an OpenAI
 * client at module load from process.env.OPENAI_API_KEY), so the import is dynamic.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const ticker = process.argv.find((a) => a.startsWith('--ticker='))?.split('=')[1];

  const { scoreAllTheses } = await import('../lib/score-theses');
  console.log(`[live scan] ${ticker ?? 'all tracked theses'} ...`);
  const result = await scoreAllTheses(sb, ticker);

  console.log('--- result ---');
  console.log(`scanned=${result.scanned} evidenceAdded=${result.evidenceAdded} statusChanges=${result.statusChanges}`);
  for (const line of result.log) console.log(line);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
