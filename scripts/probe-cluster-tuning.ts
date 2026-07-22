/** Which generic-entity filter actually compresses without blobbing? Measured on real evidence. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { salientEntities } from '../lib/content/mechanism-cluster';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Same core-intersection clustering, with a tunable generic-entity cutoff. */
function cluster(texts: string[], dfCutoff: number, minShared: number) {
  const ents = texts.map(salientEntities);
  const df = new Map<string, number>();
  for (const e of ents) for (const x of new Set(e)) df.set(x, (df.get(x) ?? 0) + 1);
  const generic = new Set([...df].filter(([, n]) => n / texts.length > dfCutoff).map(([e]) => e));
  const kept = ents.map((e) => e.filter((x) => !generic.has(x)));

  const clusters: { core: Set<string>; n: number }[] = [];
  for (const e of kept) {
    const s = new Set(e);
    let best: { c: (typeof clusters)[number]; ov: number } | null = null;
    for (const c of clusters) {
      if (c.core.size < minShared) continue;
      let ov = 0;
      for (const x of c.core) if (s.has(x)) ov++;
      if (ov >= minShared && (!best || ov > best.ov)) best = { c, ov };
    }
    if (best) {
      best.c.n++;
      for (const x of [...best.c.core]) if (!s.has(x)) best.c.core.delete(x);
    } else clusters.push({ core: s, n: 1 });
  }
  const sizes = clusters.map((c) => c.n).sort((a, b) => b - a);
  return { clusters: clusters.length, largest: sizes[0] ?? 0, singletons: sizes.filter((x) => x === 1).length };
}

async function main() {
  const tickers = ['AMZN', 'JPM', 'NVDA', 'AAPL', 'MU', 'AVGO'];
  const corpus = new Map<string, string[]>();
  for (const tk of tickers) {
    const { data: th } = await db.from('theses').select('id').eq('ticker', tk);
    const { data: pl } = await db.from('thesis_pillars').select('id').in('thesis_id', (th ?? []).map((x) => x.id));
    const { data: ev } = await db.from('pillar_evidence').select('source_title, excerpt, source_key')
      .in('pillar_id', (pl ?? []).map((x) => x.id));
    const seen = new Set<string>();
    const texts: string[] = [];
    for (const e of ev ?? []) {
      const k = `${e.source_key}|${String(e.excerpt).slice(0, 120)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      texts.push(`${e.source_title} ${e.excerpt}`);
    }
    corpus.set(tk, texts);
  }

  for (const minShared of [2, 3]) {
    for (const df of [1.01, 0.8, 0.6, 0.4, 0.25]) {
      const row: string[] = [];
      for (const tk of tickers) {
        const r = cluster(corpus.get(tk)!, df, minShared);
        row.push(`${tk} ${r.clusters}c/${r.largest}max/${r.singletons}s`);
      }
      console.log(`shared>=${minShared} df<=${df === 1.01 ? 'off' : df}  ${row.join('  ')}`);
    }
    console.log('');
  }
  for (const tk of tickers) console.log(`${tk}: ${corpus.get(tk)!.length} findings`);
}
main();
