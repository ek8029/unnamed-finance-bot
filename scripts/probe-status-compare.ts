/**
 * How often do the shipped status engine and the v2 ladder disagree, on the
 * real book? Reads only. Run: npx tsx scripts/probe-status-compare.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { getScoringThesisData } from '../lib/content/scoring-thesis';
import { comparePillar } from '../lib/content/status-compare';

const TICKERS = [
  'JPM', 'AMZN', 'AMD', 'AAPL', 'META', 'AVGO', 'PLTR', 'MSFT', 'NVDA', 'V', 'WMT',
  'GOOGL', 'TSLA', 'MU', 'NFLX', 'SPY', 'PRIM', 'INTC', 'LULU', 'JNJ', 'KO', 'MCD',
];

async function main() {
  let pillars = 0;
  let findings = 0;
  let mechanisms = 0;
  let changed = 0;
  const shippedMix = new Map<string, number>();
  const v2Mix = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const rows: string[] = [];

  for (const t of TICKERS) {
    const d = await getScoringThesisData(t);
    for (const p of d.pillars) {
      const c = comparePillar(p.catches, p.mechanisms);
      pillars++;
      findings += p.catches.length;
      mechanisms += p.mechanisms.length;
      bump(shippedMix, c.shipped);
      bump(v2Mix, c.v2);
      if (c.changed) {
        changed++;
        rows.push(
          `${t.padEnd(6)} ${c.shipped.padEnd(10)} -> ${c.v2.padEnd(10)} ` +
            `urls=${String(c.shippedIndependent).padStart(2)} classes=${c.v2Confirmations}  ${p.claim.slice(0, 66)}`,
        );
      }
    }
  }

  const pct = (n: number) => `${((n / pillars) * 100).toFixed(0)}%`;
  console.log(`\npillars ${pillars} · findings ${findings} · mechanisms ${mechanisms}`);
  console.log(`\nshipped: ${[...shippedMix].sort().map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.log(`v2     : ${[...v2Mix].sort().map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.log(`\nstatus changes: ${changed} of ${pillars} pillars (${pct(changed)})\n`);
  for (const r of rows) console.log(r);
}
main();
