/**
 * Recompute pillar statuses from stored evidence with the CURRENT derive rule
 * (FIX B: weakening needs convergence). No LLM, no new evidence — pure replay.
 * Run: npx tsx scripts/rescore-pillar-status.ts <email>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { statusAsOf, type HistoryEvidence } from '../lib/thesis-history';
import type { PillarStatus } from '../lib/thesis-status';

async function main() {
  const email = (process.argv[2] ?? 'test@helmterminal.dev').toLowerCase();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const uid = users.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id;
  if (!uid) { console.error('no user'); process.exit(1); }

  const { data: pillars } = await sb
    .from('thesis_pillars')
    .select('id, status, status_override, confirmed')
    .eq('user_id', uid);
  const evidence: (HistoryEvidence & { pillar_id: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('pillar_evidence')
      .select('pillar_id, verdict, materiality, source_type, source_key, source_published_at, created_at')
      .eq('user_id', uid)
      .range(from, from + 999);
    evidence.push(...((data ?? []) as (HistoryEvidence & { pillar_id: string })[]));
    if (!data || data.length < 1000) break;
  }

  const byPillar = new Map<string, HistoryEvidence[]>();
  for (const e of evidence) {
    const arr = byPillar.get(e.pillar_id) ?? [];
    arr.push(e);
    byPillar.set(e.pillar_id, arr);
  }

  const now = new Date();
  let changed = 0;
  const counts: Record<string, number> = {};
  for (const p of pillars ?? []) {
    const next: PillarStatus = (p.status_override as PillarStatus | null) ?? statusAsOf(byPillar.get(p.id) ?? [], now);
    counts[next] = (counts[next] ?? 0) + 1;
    if (next !== p.status) {
      const { error } = await sb
        .from('thesis_pillars')
        .update({ status: next, status_changed_at: new Date().toISOString() })
        .eq('id', p.id);
      if (error) console.error('update failed', p.id, error.message);
      else changed++;
    }
  }
  console.log(`${email}: ${pillars?.length ?? 0} pillars, ${changed} status changes`);
  console.log('new distribution:', counts);
}
main().catch((e) => { console.error(e); process.exit(1); });
