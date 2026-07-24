/**
 * The coverage/speed claim, verified: how long between a source being published
 * and Helm filing it as evidence (live rows only, backfill excluded)?
 *
 * Usage: npx tsx scripts/probe-surfacing-latency.ts [daysBack=120]
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const daysBack = Number(process.argv[2] ?? 120);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data } = await db
    .from('pillar_evidence')
    .select('source_type, source_published_at, created_at')
    .eq('is_backfill', false)
    .not('source_published_at', 'is', null)
    .gte('created_at', since);
  const rows = data ?? [];
  if (!rows.length) return console.log('No live rows with a publish date.');

  const byType = new Map<string, number[]>();
  for (const r of rows) {
    const pub = new Date(String(r.source_published_at)).getTime();
    const caught = new Date(String(r.created_at)).getTime();
    const hours = (caught - pub) / 3600000;
    if (hours < 0 || hours > 24 * 14) continue; // clock skew / stale re-ingests out
    const arr = byType.get(String(r.source_type)) ?? [];
    arr.push(hours);
    byType.set(String(r.source_type), arr);
  }

  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const pct = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };

  console.log(`Live evidence rows with publish dates (last ${daysBack}d): ${rows.length}\n`);
  const all: number[] = [];
  for (const [type, xs] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
    all.push(...xs);
    console.log(
      `  ${type.padEnd(12)} n=${String(xs.length).padStart(4)}  median ${median(xs).toFixed(1)}h  p90 ${pct(xs, 90).toFixed(1)}h  within 24h: ${((xs.filter((x) => x <= 24).length / xs.length) * 100).toFixed(0)}%`,
    );
  }
  console.log(
    `\n  ALL          n=${String(all.length).padStart(4)}  median ${median(all).toFixed(1)}h  p90 ${pct(all, 90).toFixed(1)}h  within 24h: ${((all.filter((x) => x <= 24).length / all.length) * 100).toFixed(0)}%`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
