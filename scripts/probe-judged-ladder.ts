/**
 * After judging: what does the ladder say per pillar, and how many mechanisms
 * can move it? Reads the same cache-first path the pages use.
 * Usage: npx tsx scripts/probe-judged-ladder.ts <TICKER...>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { getScoringThesisData } = await import('@/lib/content/scoring-thesis');
  const tickers = process.argv.slice(2).map((t) => t.toUpperCase());
  if (!tickers.length) return console.log('Usage: npx tsx scripts/probe-judged-ladder.ts <TICKER...>');

  for (const t of tickers) {
    const d = await getScoringThesisData(t);
    console.log(`\n=== ${t} ===`);
    for (const p of d.pillars) {
      const movers = p.mechanisms.filter((m) => m.maxStatus !== 'watch');
      const worst = p.mechanisms.reduce((w, m) => {
        const rank = { watch: 0, weakening: 1, broken: 2 } as const;
        return rank[m.maxStatus] > rank[w] ? m.maxStatus : w;
      }, 'watch' as 'watch' | 'weakening' | 'broken');
      console.log(`  [${worst.toUpperCase().padEnd(9)}] ${p.claim.slice(0, 60)}`);
      console.log(`     ${p.catches.length} findings -> ${p.mechanisms.length} mechanisms, ${movers.length} can move it`);
      for (const m of movers) {
        console.log(`       · ${m.maxStatus}: ${m.label.slice(0, 70)} (${m.mentions} mentions, ${m.sourceClasses.join('+')})`);
      }
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
