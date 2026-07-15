/** Reproduce factor-lens classification for evank8029's real holdings. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getFullTickerData } from '../lib/financial-data';
import { buildFactorReport, type EnrichedHolding } from '../lib/factor-lens';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const me = users.users.find((u) => u.email === 'evank8029@gmail.com');
  if (!me) { console.log('user not found'); return; }
  const { data: holdings } = await db.from('holdings').select('ticker,total_value').eq('user_id', me.id);
  const byTicker = new Map<string, number>();
  for (const h of holdings ?? []) byTicker.set(h.ticker as string, (byTicker.get(h.ticker as string) ?? 0) + Number(h.total_value || 0));
  const tickers = [...byTicker.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${tickers.length} tickers`);

  const enrichOne = async ([ticker, totalValue]: [string, number]): Promise<EnrichedHolding> => {
    try {
      const d = await getFullTickerData(ticker);
      const m = d.financials?.metric ?? {};
      const capM = d.profile?.marketCapitalization;
      return {
        ticker, totalValue,
        marketCapB: capM != null && capM > 0 ? capM / 1000 : null,
        pe: m['peBasicExclExtraTTM'] ?? null,
        pb: m['pbQuarterly'] ?? null,
        ps: m['psTTM'] ?? null,
        roe: m['roeTTM'] ?? null,
        debtToEquity: m['totalDebtToEquityQuarterly'] ?? m['debtEquityQuarterly'] ?? null,
      };
    } catch {
      return { ticker, totalValue };
    }
  };

  const enriched: EnrichedHolding[] = [];
  for (let i = 0; i < tickers.length; i += 5) {
    const chunk = tickers.slice(i, i + 5);
    enriched.push(...(await Promise.all(chunk.map(enrichOne))));
    if (i + 5 < tickers.length) await new Promise((r) => setTimeout(r, 300));
  }

  const report = buildFactorReport(enriched);
  console.log(`coverage: ${report.coverage.classified}/${report.coverage.total} full`);
  for (const h of report.holdings) {
    console.log(`${h.ticker.padEnd(6)} size=${h.size ?? '—'} style=${h.valueGrowth ?? '—'} quality=${h.quality ?? '—'} [${h.coverage}]`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
