/** §0 measurement: scoring pipeline (pillar_evidence) vs social pipeline (content_events). */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function pageAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const theses = await pageAll<Record<string, unknown>>('theses', 'id, user_id, ticker, tracked, source, last_scanned_at');
  const pillars = await pageAll<Record<string, unknown>>('thesis_pillars', 'id, thesis_id, breaks_if, origin, status, confirmed');
  const ev = await pageAll<Record<string, unknown>>('pillar_evidence', 'id, pillar_id, verdict, materiality, source_type, created_at');
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const emailOf = new Map(users.users.map((u) => [u.id, u.email ?? u.id.slice(0, 8)]));

  const thesisById = new Map(theses.map((t) => [t.id as string, t]));
  const pillarById = new Map(pillars.map((p) => [p.id as string, p]));

  console.log(`theses: ${theses.length} | pillars: ${pillars.length} | evidence: ${ev.length}\n`);

  console.log('--- generation rate by week (all users) ---');
  const byWeek = new Map<string, number>();
  for (const e of ev) {
    const d = new Date(String(e.created_at));
    d.setDate(d.getDate() - d.getDay());
    const k = d.toISOString().slice(0, 10);
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
  }
  for (const [w, n] of [...byWeek].sort()) console.log(`  wk ${w}  ${String(n).padStart(4)}  ${(n / 7).toFixed(1)}/day`);

  console.log('\n--- evidence per ticker, DISTINCT-BY-SOURCE (what one house scan would yield) ---');
  const byTicker = new Map<string, { rows: number; last: string }>();
  for (const e of ev) {
    const p = pillarById.get(e.pillar_id as string);
    const t = p ? thesisById.get(p.thesis_id as string) : undefined;
    if (!t) continue;
    const k = t.ticker as string;
    const cur = byTicker.get(k) ?? { rows: 0, last: '' };
    cur.rows++;
    const d = String(e.created_at).slice(0, 10);
    if (d > cur.last) cur.last = d;
    byTicker.set(k, cur);
  }
  for (const [tk, v] of [...byTicker].sort((a, b) => b[1].rows - a[1].rows)) {
    console.log(`  ${tk.padEnd(7)} ${String(v.rows).padStart(4)} rows  last=${v.last}`);
  }

  const mix = (key: string) => {
    const m = new Map<string, number>();
    for (const e of ev) m.set(String(e[key]), (m.get(String(e[key])) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v} (${((v / ev.length) * 100).toFixed(0)}%)`).join('  ');
  };
  console.log('\nsource_type :', mix('source_type'));
  console.log('materiality :', mix('materiality'));
  console.log('verdict     :', mix('verdict'));

  console.log('\n--- breaks_if coverage by origin ---');
  const byOrigin = new Map<string, { total: number; withBreak: number }>();
  for (const p of pillars) {
    const o = String(p.origin);
    const c = byOrigin.get(o) ?? { total: 0, withBreak: 0 };
    c.total++;
    if (p.breaks_if) c.withBreak++;
    byOrigin.set(o, c);
  }
  for (const [o, c] of byOrigin) console.log(`  ${o.padEnd(9)} ${c.withBreak}/${c.total} have breaks_if`);

  console.log('\n--- theses by source ---');
  const bySource = new Map<string, number>();
  for (const t of theses) bySource.set(String(t.source), (bySource.get(String(t.source)) ?? 0) + 1);
  console.log('  ' + [...bySource].map(([k, v]) => `${k}=${v}`).join('  '));

  const { count: ceCount } = await db.from('content_events').select('id', { count: 'exact', head: true });
  console.log(`\ncontent_events all time: ${ceCount}   (public /thesis pages read THIS)`);
}
main();
