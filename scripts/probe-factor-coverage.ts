/** Which factor inputs resolve per ticker (size/style/quality coverage debug). */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { getFullTickerData } from '../lib/financial-data';

const TICKERS = ['AAPL', 'MSFT', 'PLTR', 'PRIM', 'LULU', 'EMBC', 'QCOM', 'SPY', 'JPM', 'WMT'];

async function main() {
  for (const t of TICKERS) {
    try {
      const d = await getFullTickerData(t);
      const m = d.financials?.metric ?? {};
      const capM = d.profile?.marketCapitalization ?? null;
      const row = {
        cap: capM != null && capM > 0 ? 'Y' : '-',
        pe: m['peBasicExclExtraTTM'] != null ? 'Y' : '-',
        pb: m['pbQuarterly'] != null ? 'Y' : '-',
        roe: m['roeTTM'] != null ? 'Y' : '-',
        de: m['totalDebtToEquityQuarterly'] != null ? 'Y' : '-',
        metricCount: Object.keys(m).length,
      };
      console.log(`${t.padEnd(5)} cap=${row.cap} pe=${row.pe} pb=${row.pb} roe=${row.roe} de=${row.de}  (metrics: ${row.metricCount})`);
    } catch (e) {
      console.log(`${t.padEnd(5)} ERROR ${(e as Error).message}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
