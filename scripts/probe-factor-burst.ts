/** Concurrent-burst enrichment test: does Promise.all(15) rate-limit like the factor-lens route's Promise.all(30)? */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { getFullTickerData } from '../lib/financial-data';

const TICKERS = ['NVDA', 'AMD', 'GOOGL', 'AMZN', 'META', 'TSLA', 'V', 'JNJ', 'KO', 'MCD', 'NFLX', 'AVGO', 'INTC', 'MU', 'CRM'];

async function main() {
  const results = await Promise.all(TICKERS.map(async (t) => {
    try {
      const d = await getFullTickerData(t);
      const m = d.financials?.metric ?? {};
      const cap = (d.profile?.marketCapitalization ?? 0) > 0 ? 'Y' : '-';
      return `${t.padEnd(6)} cap=${cap} metrics=${Object.keys(m).length}`;
    } catch (e) {
      return `${t.padEnd(6)} ERR ${((e as Error).message || '').slice(0, 80)}`;
    }
  }));
  results.forEach((r) => console.log(r));
}
main().catch((e) => { console.error(e); process.exit(1); });
