/**
 * Compute + cache the LLM mechanism grouping for tickers' pillars (thesis v2).
 * One gpt-4o call per stale pillar; fresh cache rows are skipped, so re-runs
 * are free. Pages read the cache and never call the model.
 *
 * Usage:
 *   npx tsx scripts/judge-mechanisms.ts NVDA PLTR ...
 *   npx tsx scripts/judge-mechanisms.ts --tracked     (every tracked thesis ticker)
 * Requires migration 058 (mechanism_cache) applied and OPENAI_API_KEY.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  // Dynamic imports: lib modules build clients at module load, which must
  // happen after dotenv has populated the env (same gotcha as sync-one-user).
  const { getScoringThesisData } = await import('@/lib/content/scoring-thesis');
  const { judgeMechanisms, MECHANISM_MODEL } = await import('@/lib/content/mechanism-judge');
  const { evidenceHash, readMechanismCache, writeMechanismCache, scopeKey } = await import(
    '@/lib/content/mechanism-cache'
  );

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  let tickers = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((t) => t.toUpperCase());
  if (process.argv.includes('--tracked')) {
    const { data } = await db.from('theses').select('ticker').eq('tracked', true);
    tickers = [...new Set((data ?? []).map((t) => String(t.ticker).toUpperCase()))];
  }
  if (!tickers.length) return console.log('Usage: npx tsx scripts/judge-mechanisms.ts <TICKER...> | --tracked');

  let calls = 0;
  for (const ticker of tickers) {
    const data = await getScoringThesisData(ticker);
    if (!data.pillars.length) {
      console.log(`${ticker}: no scored pillars`);
      continue;
    }
    const cache = await readMechanismCache(db, data.pillars.map((p) => scopeKey(ticker, p.key)));
    for (const p of data.pillars) {
      if (p.catches.length < 2) continue; // nothing to group
      const key = scopeKey(ticker, p.key);
      const hash = evidenceHash(p.catches.map((c) => c.id));
      if (cache.get(key)?.evidenceHash === hash) {
        console.log(`${ticker} · "${p.claim.slice(0, 50)}" — cache fresh, skip`);
        continue;
      }
      const judged = await judgeMechanisms(
        p.claim,
        p.breaksIf,
        p.catches.map((c) => ({ id: c.id, title: c.title, excerpt: c.excerpt, dateISO: c.dateISO })),
      );
      calls++;
      const ok = await writeMechanismCache(db, key, hash, judged, MECHANISM_MODEL);
      console.log(
        `${ticker} · "${p.claim.slice(0, 50)}" — ${p.catches.length} findings: heuristic ${p.mechanisms.length} -> judged ${judged.length} groups ${ok ? '(cached)' : '(CACHE WRITE FAILED — migration 058 applied?)'}`,
      );
    }
  }
  console.log(`\nDone. ${calls} model call${calls === 1 ? '' : 's'}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
