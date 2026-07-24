/**
 * Compute + cache the LLM mechanism grouping for tickers' pillars (thesis v2).
 * Same runner the score-theses cron uses, uncapped by default here.
 *
 * Usage:
 *   npx tsx scripts/judge-mechanisms.ts NVDA PLTR ...
 *   npx tsx scripts/judge-mechanisms.ts --tracked     (every tracked thesis ticker)
 *   npx tsx scripts/judge-mechanisms.ts --tracked --cap 8
 * Requires migration 058 (mechanism_cache) applied and OPENAI_API_KEY.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  // Dynamic import: lib modules build clients at module load, which must happen
  // after dotenv has populated the env (same gotcha as sync-one-user).
  const { rejudgeStaleMechanisms } = await import('@/lib/content/judge-runner');

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const args = process.argv.slice(2);
  const capIdx = args.indexOf('--cap');
  const cap = capIdx !== -1 ? Number(args[capIdx + 1]) : Number.POSITIVE_INFINITY;
  const tickers = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--cap').map((t) => t.toUpperCase());
  const useTracked = args.includes('--tracked');
  if (!useTracked && tickers.length === 0) {
    return console.log('Usage: npx tsx scripts/judge-mechanisms.ts <TICKER...> | --tracked [--cap N]');
  }

  const r = await rejudgeStaleMechanisms(db, { cap, tickers: useTracked ? undefined : tickers });
  console.log(
    `tickers ${r.tickers} · pillars checked ${r.pillarsChecked} · judged ${r.judged} · fresh ${r.skippedFresh}`,
  );
  for (const e of r.errors) console.log(`  ! ${e}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
