/** Live test: find a recent 8-K item 2.02 and fetch its EX-99 press release. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { getRecentFilings, fetchEx99Html } from '../lib/edgar';
import { stripFilingHtml } from '../lib/filing-extract';

async function main() {
  for (const ticker of ['JPM', 'WFC', 'C', 'PEP']) {
    const filings = await getRecentFilings(ticker, '2026-06-15');
    const earnings8k = filings.find((f) => f.form === '8-K' && f.items.includes('2.02'));
    if (!earnings8k) { console.log(`${ticker}: no recent 8-K 2.02`); continue; }
    console.log(`${ticker}: 8-K ${earnings8k.filingDate} items=[${earnings8k.items.join(',')}]`);
    const html = await fetchEx99Html(earnings8k.url);
    if (!html) { console.log('  EX-99: not found'); continue; }
    const text = stripFilingHtml(html).slice(0, 350);
    console.log(`  EX-99 fetched: ${html.length} chars raw; preview:\n  ${text.replace(/\n/g, ' ').slice(0, 300)}`);
    return;
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
