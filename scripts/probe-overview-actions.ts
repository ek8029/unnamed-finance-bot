/**
 * READ ONLY. Counts only, never emails or row content.
 *
 * Sizes the choice between pointing the overview's "Actions inbox" at the
 * persistent `insights` table (route a) and persisting what the ephemeral feed
 * in lib/intelligence-feed.ts produces (route b).
 *
 *  1. Which insight_type values the table actually carries, and which of the
 *     nine the CHECK constraint allows (migration 029) have never been written.
 *  2. Which source_type values exist.
 *  3. How many positions sit in the 10-25% concentration band that the feed
 *     flags (CONCENTRATION_THRESHOLDS.medium) and the persistent engine does
 *     not (it writes above .critical only).
 *  4. How loud the feed's cash_flow lane is, and whether the transactions it
 *     reads are brokerage rows (in which case a stock purchase reads as a
 *     "Large charge").
 *
 * Run: npx tsx scripts/probe-overview-actions.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await sb
    .from('insights')
    .select('insight_type, source_type, is_dismissed, is_archived')
    .limit(20000);
  if (error) throw error;
  const byType = new Map<string, number>();
  const openByType = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of rows ?? []) {
    byType.set(r.insight_type, (byType.get(r.insight_type) ?? 0) + 1);
    bySource.set(String(r.source_type), (bySource.get(String(r.source_type)) ?? 0) + 1);
    if (!r.is_dismissed && !r.is_archived) openByType.set(r.insight_type, (openByType.get(r.insight_type) ?? 0) + 1);
  }
  console.log('insights rows scanned:', rows?.length ?? 0);
  console.log('by insight_type (all / open):');
  for (const t of [...byType.keys()].sort()) console.log(`  ${t}: ${byType.get(t)} / ${openByType.get(t) ?? 0}`);
  const allowed = ['spending', 'portfolio', 'market', 'tax', 'credit', 'subscription', 'cash_flow', 'performance', 'concentration'];
  console.log('allowed by CHECK but never written:', allowed.filter((t) => !byType.has(t)).join(', ') || '(none)');
  console.log('by source_type:');
  for (const s of [...bySource.keys()].sort()) console.log(`  ${s}: ${bySource.get(s)}`);

  // How much the dismissal suppression holds down today, and how much it
  // deliberately leaves alone (rows dismissed before anything stamped an expiry).
  const nowIso = new Date().toISOString();
  const counts = async (build: (q: ReturnType<typeof sb.from>) => unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = build(sb.from('insights') as never);
    const { count } = await q;
    return count ?? 0;
  };
  const dismissedTotal = await counts((t) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t as any).select('id', { count: 'exact', head: true }).eq('is_dismissed', true));
  const dismissedLive = await counts((t) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t as any).select('id', { count: 'exact', head: true }).eq('is_dismissed', true).gt('expires_at', nowIso));
  const openTotal = await counts((t) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t as any).select('id', { count: 'exact', head: true }).eq('is_dismissed', false).eq('is_archived', false));
  console.log(`dismissed rows: ${dismissedTotal}, of which still inside their expiry (these now suppress): ${dismissedLive}`);
  console.log(`open rows: ${openTotal}`);

  // Exact per-type counts. The scan above is capped at 1000 rows by PostgREST,
  // which is not enough to claim a type has never been written.
  console.log('exact count by insight_type (all / open):');
  for (const t of allowed) {
    const all = await counts((q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).select('id', { count: 'exact', head: true }).eq('insight_type', t));
    const open = await counts((q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).select('id', { count: 'exact', head: true }).eq('insight_type', t)
        .eq('is_dismissed', false).eq('is_archived', false));
    console.log(`  ${t}: ${all} / ${open}`);
  }

  const { data: holdings } = await sb.from('holdings').select('user_id, ticker, total_value').limit(20000);
  const totals = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const h of holdings ?? []) {
    const v = Number(h.total_value || 0);
    totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + v);
    const k = `${h.user_id}|${String(h.ticker).toUpperCase()}`;
    positions.set(k, (positions.get(k) ?? 0) + v);
  }
  let band = 0;
  let critical = 0;
  const bandUsers = new Set<string>();
  for (const [k, v] of positions) {
    const uid = k.split('|')[0];
    const tot = totals.get(uid) ?? 0;
    if (tot <= 0) continue;
    const pct = (v / tot) * 100;
    if (pct >= 25) critical++;
    else if (pct >= 10) {
      band++;
      bandUsers.add(uid);
    }
  }
  console.log(`positions >=25% (engine writes these): ${critical}`);
  console.log(`positions 10-25% (feed only): ${band} across ${bandUsers.size} users`);

  const since = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const { data: tx } = await sb
    .from('transactions')
    .select('user_id, amount, account_id, merchant_name')
    .gte('transaction_date', since)
    .limit(20000);
  const big = (tx ?? []).filter((t) => Number(t.amount) < -500);
  const dep = (tx ?? []).filter((t) => Number(t.amount) > 1000);
  console.log(`transactions in last 7d: ${tx?.length ?? 0}`);
  console.log(`  would fire "Large charge" (< -500): ${big.length} across ${new Set(big.map((t) => t.user_id)).size} users`);
  console.log(`  would fire "deposits" (> 1000): ${dep.length} across ${new Set(dep.map((t) => t.user_id)).size} users`);
  console.log(`  of the "Large charge" rows, no merchant_name: ${big.filter((t) => !t.merchant_name).length}`);
  const acctIds = [...new Set([...big, ...dep].map((t) => t.account_id).filter(Boolean))];
  if (acctIds.length > 0) {
    const { data: accts } = await sb.from('linked_accounts').select('id, account_type').in('id', acctIds);
    const kinds = new Map<string, number>();
    for (const a of accts ?? []) kinds.set(String(a.account_type), (kinds.get(String(a.account_type)) ?? 0) + 1);
    console.log('  account_type behind those rows:', [...kinds].map(([k, v]) => `${k}=${v}`).join(', ') || '(none)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
