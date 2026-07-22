/** The actual contradicting evidence behind each status disagreement. Reads only. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { getScoringThesisData } from '../lib/content/scoring-thesis';
import { comparePillar } from '../lib/content/status-compare';

async function main() {
  for (const t of (process.argv[2] ?? 'NVDA,PRIM,AAPL').split(',')) {
    const d = await getScoringThesisData(t);
    for (const p of d.pillars) {
      const c = comparePillar(p.catches, p.mechanisms);
      if (!c.changed) continue;
      console.log(`\n${'='.repeat(90)}\n${t} · ${p.claim}`);
      console.log(`shipped=${c.shipped} -> v2=${c.v2} · ${c.reason}`);
      const against = p.catches.filter(
        (x) => x.verdict === 'contradicts' && x.materiality === 'material' && !x.isBackfill,
      );
      for (const x of against) {
        console.log(`\n  [${x.sourceClass}] ${x.dateISO}  ${x.title}`);
        console.log(`    ${x.excerpt.slice(0, 190)}`);
        console.log(`    ${x.url ?? '(no url)'}`);
      }
    }
  }
}
main();
