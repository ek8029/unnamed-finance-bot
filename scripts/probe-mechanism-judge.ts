/**
 * Entity-overlap grouping vs model grouping, on the same real evidence.
 * Read only, one model call per pillar.
 *
 * Usage: npx tsx scripts/probe-mechanism-judge.ts JPM [PLTR ...]
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const SHOW_LIMIT = 8;

async function main() {
  // lib/content modules pull in clients that read env at import time.
  const { getScoringThesisData } = await import('../lib/content/scoring-thesis');
  const { judgeMechanisms, toMechanisms } = await import('../lib/content/mechanism-judge');
  const { ladderCeilingForPillar } = await import('../lib/content/status-compare');

  const tickers = process.argv.slice(2);
  if (!tickers.length) return console.log('Usage: npx tsx scripts/probe-mechanism-judge.ts TICKER [TICKER...]');

  for (const t of tickers) {
    const data = await getScoringThesisData(t);
    console.log(`\n${'='.repeat(92)}\n${data.ticker}  ${data.pillars.length} pillars, ${data.dedupedRows} findings`);

    for (const p of data.pillars) {
      const judged = await judgeMechanisms(
        p.claim,
        p.breaksIf,
        p.catches.map((c) => ({ id: c.id, title: c.title, excerpt: c.excerpt, dateISO: c.dateISO })),
      );
      const modelMechs = toMechanisms(judged, p.catches);

      const regexBiggest = Math.max(0, ...p.mechanisms.map((m) => m.mentions));
      const modelBiggest = Math.max(0, ...modelMechs.map((m) => m.mentions));
      const regexCeiling = ladderCeilingForPillar(p.mechanisms);
      const modelCeiling = ladderCeilingForPillar(modelMechs);

      console.log(`\n  PILLAR: ${p.claim.slice(0, 84)}`);
      console.log(`    findings ${p.catches.length}`);
      console.log(`    entity overlap : ${String(p.mechanisms.length).padStart(3)} groups, biggest ${regexBiggest}, ceiling ${regexCeiling.ceiling}`);
      console.log(`    model          : ${String(modelMechs.length).padStart(3)} groups, biggest ${modelBiggest}, ceiling ${modelCeiling.ceiling}`);
      if (regexCeiling.ceiling !== modelCeiling.ceiling) {
        console.log(`    ** the grouping alone changes the pillar ceiling **`);
      }

      console.log(`    model groups:`);
      for (const m of modelMechs.slice(0, SHOW_LIMIT)) {
        console.log(`      ${String(m.mentions).padStart(2)}x  ${m.label}`);
        console.log(`           ${m.sourceClasses.join(', ')} -> ${m.maxStatus}`);
      }
      if (modelMechs.length > SHOW_LIMIT) console.log(`      ... ${modelMechs.length - SHOW_LIMIT} more`);
    }
  }
}
main();
