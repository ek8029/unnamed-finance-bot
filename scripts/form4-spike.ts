// scripts/form4-spike.ts — run: npx tsx scripts/form4-spike.ts NVDA
// Pulls 12 months of Form 4s for one real ticker, prints owner/role/value/10b5-1 per filing.
import { getForm4Filings } from '../lib/edgar';

async function main() {
  const ticker = process.argv[2] ?? 'NVDA';
  const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);

  const filings = await getForm4Filings(ticker, since);
  for (const f of filings) {
    console.log(
      `${f.filedAt}  ${f.ownerName} (${f.ownerRole})  sold $${Math.round(f.totalSaleValue).toLocaleString()}  10b5-1: ${f.is10b51 ? 'YES (scheduled)' : 'no'}  ${f.url}`,
    );
  }
  console.log(`\n${filings.length} Form 4s. Scheduled (10b5-1): ${filings.filter((f) => f.is10b51).length}`);
}

main().catch(console.error);
