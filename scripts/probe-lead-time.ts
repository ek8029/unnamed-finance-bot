/**
 * The honest quantifiable-value number for thesis findings: of the material
 * contradicting catches Helm surfaced LIVE (not backfill), how many preceded a
 * real adverse price move, and by how many trading days?
 *
 * Claims lead time and coverage, never alpha. Misses are counted and printed.
 *
 * Usage: npx tsx scripts/probe-lead-time.ts [daysBack=120] [horizon=10] [thresholdPct=5]
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getHistoricalPrices } from '@/lib/finazon';
import { forwardMove, summarizeLeadTimes, baseRate, type ForwardMove } from '@/lib/research/lead-time';

async function main() {
  const daysBack = Number(process.argv[2] ?? 120);
  const horizon = Number(process.argv[3] ?? 10);
  const threshold = Number(process.argv[4] ?? 5);

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  // pillar_evidence -> pillar -> thesis.ticker (two hops, same as the engine)
  // price_move rows are excluded: they REPORT a move that already happened, so
  // scoring them for lead time would be claiming credit for a reaction.
  const { data: ev } = await db
    .from('pillar_evidence')
    .select('id, pillar_id, source_key, source_title, source_type, created_at, materiality, verdict, is_backfill')
    .eq('verdict', 'contradicts')
    .eq('materiality', 'material')
    .eq('is_backfill', false)
    .neq('source_type', 'price_move')
    .gte('created_at', since);
  if (!ev?.length) return console.log('No live material contradicting catches in window.');

  const pillarIds = [...new Set(ev.map((e) => String(e.pillar_id)))];
  const { data: pillars } = await db.from('thesis_pillars').select('id, thesis_id').in('id', pillarIds);
  const thesisIds = [...new Set((pillars ?? []).map((p) => String(p.thesis_id)))];
  const { data: theses } = await db.from('theses').select('id, ticker').in('id', thesisIds);
  const tickerOfThesis = new Map((theses ?? []).map((t) => [String(t.id), String(t.ticker).toUpperCase()]));
  const tickerOfPillar = new Map((pillars ?? []).map((p) => [String(p.id), tickerOfThesis.get(String(p.thesis_id)) ?? null]));

  // Fold per-user copies: same ticker + same source = one catch, earliest surfacing.
  const catches = new Map<string, { ticker: string; date: string; title: string }>();
  for (const e of ev) {
    const ticker = tickerOfPillar.get(String(e.pillar_id));
    if (!ticker) continue;
    const key = `${ticker}|${e.source_key}`;
    const date = String(e.created_at).slice(0, 10);
    const seen = catches.get(key);
    if (!seen || date < seen.date) catches.set(key, { ticker, date, title: String(e.source_title) });
  }
  console.log(`${ev.length} rows -> ${catches.size} distinct live catches. Fetching prices…`);

  const tickers = [...new Set([...catches.values()].map((c) => c.ticker))];
  const minDate = [...catches.values()].reduce((m, c) => (c.date < m ? c.date : m), '9999');
  const from = new Date(new Date(minDate).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const series = new Map<string, { date: string; close: number }[]>();
  for (const t of tickers) {
    try {
      series.set(t, await getHistoricalPrices(t, from, to));
    } catch {
      series.set(t, []);
    }
  }

  const moves: ForwardMove[] = [];
  const rows: { ticker: string; date: string; title: string; m: ForwardMove | null }[] = [];
  // Null model: expected hits if the same catches had been randomly timed on
  // the same tickers. Sum of per-ticker base rates over the scored catches.
  let expectedHits = 0;
  let scoredWithBase = 0;
  for (const c of catches.values()) {
    const s = series.get(c.ticker) ?? [];
    const m = s.length ? forwardMove(s, c.date, horizon, threshold, 'down') : null;
    rows.push({ ...c, m });
    if (m) {
      moves.push(m);
      const br = baseRate(s, horizon, threshold, 'down');
      if (br !== null) {
        expectedHits += br;
        scoredWithBase++;
      }
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`\nCATCH -> what the price did next (${horizon} trading days, ${threshold}% threshold):`);
  for (const r of rows) {
    if (!r.m) {
      console.log(`  ${r.date} ${r.ticker.padEnd(6)} [no price data / window open] ${r.title.slice(0, 60)}`);
      continue;
    }
    const hit = r.m.daysToThreshold !== null ? `CONFIRMED in ${r.m.daysToThreshold}d` : 'no move (miss)';
    console.log(
      `  ${r.date} ${r.ticker.padEnd(6)} worst ${r.m.maxAdversePct.toFixed(1)}% | ${hit} | ${r.title.slice(0, 55)}`,
    );
  }

  const stats = summarizeLeadTimes(moves);
  const hitRate = stats.catches ? stats.confirmed / stats.catches : 0;
  const nullRate = scoredWithBase ? expectedHits / scoredWithBase : null;
  console.log(`\nSUMMARY (live catches with a full price window):`);
  console.log(`  catches: ${stats.catches}  confirmed: ${stats.confirmed}  missed: ${stats.missed}`);
  console.log(`  hit rate: ${(hitRate * 100).toFixed(0)}%`);
  if (nullRate !== null) {
    console.log(
      `  base rate (randomly timed, same tickers/period): ${(nullRate * 100).toFixed(0)}% -> lift ${(hitRate / nullRate).toFixed(2)}x`,
    );
  }
  console.log(`  median lead time: ${stats.medianLeadDays ?? 'n/a'} trading days`);
  console.log(`  median confirmed move: ${stats.medianConfirmedMovePct?.toFixed(1) ?? 'n/a'}%`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
