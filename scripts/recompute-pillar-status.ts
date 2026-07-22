/**
 * Recompute every pillar's status from stored evidence, using the same rule the
 * cron uses. No LLM, no new evidence, pure replay.
 *
 * Needed after evidence is removed: statuses are written at scan time, so
 * deleting rows leaves a status that was computed from evidence which no longer
 * exists. Purging the offering paperwork without this would leave pillars
 * flagged on the strength of prospectus boilerplate that is now gone.
 *
 * Dry run by default. Pass --apply to write.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { derivePillarStatus, type EvidenceForStatus, type PillarStatus } from '../lib/thesis-status';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Identical to the rule in score-theses.ts.
const SEVERE_MOVE_PCT = 20;
const pctOf = (excerpt: string | null) => Number(String(excerpt ?? '').match(/(\d+(?:\.\d+)?)\s?%/)?.[1] ?? 0);

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
  const apply = process.argv.includes('--apply');

  type Pillar = { id: string; status: PillarStatus; status_override: PillarStatus | null; confirmed: boolean; claim: string };
  type Ev = { pillar_id: string; verdict: string; materiality: string; source_type: string; source_key: string; is_backfill: boolean; created_at: string; excerpt: string };

  const pillars = await pageAll<Pillar>('thesis_pillars', 'id, status, status_override, confirmed, claim');
  const evidence = await pageAll<Ev>('pillar_evidence', 'pillar_id, verdict, materiality, source_type, source_key, is_backfill, created_at, excerpt');

  const byPillar = new Map<string, EvidenceForStatus[]>();
  for (const e of evidence) {
    const list = byPillar.get(e.pillar_id) ?? [];
    list.push({
      verdict: e.verdict as EvidenceForStatus['verdict'],
      materiality: e.materiality as EvidenceForStatus['materiality'],
      source_type: e.source_type as EvidenceForStatus['source_type'],
      source_key: e.source_key,
      is_backfill: e.is_backfill,
      created_at: e.created_at,
      severe: e.source_type === 'price_move' && pctOf(e.excerpt) >= SEVERE_MOVE_PCT,
    });
    byPillar.set(e.pillar_id, list);
  }

  const changes: { id: string; from: PillarStatus; to: PillarStatus; claim: string }[] = [];
  for (const p of pillars) {
    if (!p.confirmed || p.status_override) continue;
    const next = derivePillarStatus(byPillar.get(p.id) ?? [], null);
    if (next !== p.status) changes.push({ id: p.id, from: p.status, to: next, claim: p.claim });
  }

  console.log(`${pillars.length} pillars, ${evidence.length} evidence rows`);
  console.log(`${changes.length} status change(s)\n`);
  const tally = new Map<string, number>();
  for (const c of changes) tally.set(`${c.from} -> ${c.to}`, (tally.get(`${c.from} -> ${c.to}`) ?? 0) + 1);
  for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}x  ${k}`);
  console.log('');
  for (const c of changes.slice(0, 12)) console.log(`  ${c.from.padEnd(10)} -> ${c.to.padEnd(10)} ${c.claim.slice(0, 62)}`);
  if (changes.length > 12) console.log(`  ... ${changes.length - 12} more`);

  if (!apply) return console.log(`\nDRY RUN. Nothing written. Re-run with --apply.`);

  let written = 0;
  for (const c of changes) {
    const { error } = await db
      .from('thesis_pillars')
      .update({ status: c.to, status_changed_at: new Date().toISOString() })
      .eq('id', c.id);
    if (error) console.log(`  update failed for ${c.id}: ${error.message}`);
    else written++;
  }
  console.log(`\nUpdated ${written} pillar(s).`);
}
main();
