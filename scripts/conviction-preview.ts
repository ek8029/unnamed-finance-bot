/**
 * READ-ONLY preview of the honest conviction history against the owner's real book.
 * Prints: stored pillar.status counts vs honest as-of-now counts, the 14-day intact
 * trend, and the real status transitions in the last 14 days. No writes, no LLM, no cost.
 *
 * Run: npx tsx scripts/conviction-preview.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import {
  countsAsOf,
  convictionTrend,
  recentTransitions,
  type HistoryPillar,
  type HistoryEvidence,
} from '../lib/thesis-history';
import { effectiveStatus } from '../lib/thesis-summary';
import type { PillarStatus } from '../lib/thesis-status';

const OWNER_EMAIL = 'evank8029@gmail.com';
const LABEL: Record<PillarStatus, string> = {
  intact: 'intact', weakening: 'weakening', broken: 'broken', unverified: 'watching',
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Missing Supabase env in .env.local'); process.exit(1); }
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Resolve owner from the tracked book (demo is owner-only): the user with the most theses.
  const { data: allTheses } = await sb.from('theses').select('id, ticker, user_id');
  const byUser = new Map<string, number>();
  for (const t of allTheses ?? []) byUser.set(t.user_id as string, (byUser.get(t.user_id as string) ?? 0) + 1);
  let ownerId = ''; let best = -1;
  for (const [uid, n] of byUser) if (n > best) { best = n; ownerId = uid; }
  if (!ownerId) { console.error('No theses found for any user'); process.exit(1); }
  void OWNER_EMAIL;

  const tickerById = new Map(
    (allTheses ?? []).filter((t) => t.user_id === ownerId).map((t) => [t.id as string, t.ticker as string]),
  );

  const { data: pillars } = await sb
    .from('thesis_pillars')
    .select('id, thesis_id, claim, confirmed, lifecycle, status, status_override')
    .eq('user_id', ownerId)
    .neq('lifecycle', 'dismissed');

  const pillarRows = pillars ?? [];
  const pillarIds = pillarRows.map((p) => p.id as string);

  const { data: evidence } = await sb
    .from('pillar_evidence')
    .select('pillar_id, verdict, materiality, source_type, source_key, source_published_at, created_at')
    .in('pillar_id', pillarIds);

  const evByPillar = new Map<string, HistoryEvidence[]>();
  for (const e of evidence ?? []) {
    const arr = evByPillar.get(e.pillar_id as string) ?? [];
    arr.push({
      verdict: e.verdict as HistoryEvidence['verdict'],
      materiality: e.materiality as HistoryEvidence['materiality'],
      source_type: e.source_type as HistoryEvidence['source_type'],
      source_key: e.source_key as string,
      source_published_at: (e.source_published_at as string | null) ?? null,
      created_at: e.created_at as string,
    });
    evByPillar.set(e.pillar_id as string, arr);
  }

  const history: HistoryPillar[] = pillarRows.map((p) => ({
    id: p.id as string,
    ticker: tickerById.get(p.thesis_id as string) ?? '?',
    claim: p.claim as string,
    confirmed: p.confirmed as boolean,
    lifecycle: p.lifecycle as string,
    evidence: evByPillar.get(p.id as string) ?? [],
  }));

  // Stored counts (what the board shows today) — from pillar.status (+ override).
  const stored: Record<PillarStatus, number> = { intact: 0, weakening: 0, broken: 0, unverified: 0 };
  for (const p of pillarRows) {
    if (!p.confirmed || p.lifecycle === 'dismissed') continue;
    stored[effectiveStatus({ status: p.status as PillarStatus, status_override: p.status_override as PillarStatus | null })]++;
  }

  const now = new Date();
  const honest = countsAsOf(history, now);
  const trend = convictionTrend(history, now, 14);
  const moves = recentTransitions(history, now, 14);

  const confirmed = history.filter((p) => p.confirmed && p.lifecycle !== 'dismissed').length;
  const order: PillarStatus[] = ['intact', 'weakening', 'broken', 'unverified'];

  console.log(`\nOwner book: ${history.length} pillars (${confirmed} confirmed), ${(evidence ?? []).length} evidence rows\n`);
  console.log('STATUS COUNTS (confirmed pillars)');
  console.log('  status      stored   honest(now)   delta');
  for (const s of order) {
    const d = honest[s] - stored[s];
    console.log(`  ${LABEL[s].padEnd(10)}  ${String(stored[s]).padStart(5)}   ${String(honest[s]).padStart(8)}    ${d > 0 ? '+' : ''}${d}`);
  }

  const max = Math.max(...trend.map((t) => t.intact), 1);
  console.log(`\n14-DAY INTACT TREND (honest replay, max ${max})`);
  for (const pt of trend) {
    const bar = '█'.repeat(Math.round((pt.intact / max) * 28));
    console.log(`  ${pt.date}  ${String(pt.intact).padStart(3)}  ${bar}`);
  }

  console.log(`\nTRANSITIONS IN LAST 14 DAYS: ${moves.length}`);
  for (const m of moves) {
    console.log(`  ${m.ticker.padEnd(6)} ${LABEL[m.from]} -> ${LABEL[m.to]}  (moved ${m.movedOn ?? 'n/a'})`);
    console.log(`         "${m.claim}"`);
  }
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
