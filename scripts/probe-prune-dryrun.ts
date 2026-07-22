/**
 * Dry run of the stale-position prune. READ ONLY: runs the exact filter the
 * delete uses, as a select, so the query mechanics are proven before any row is
 * removed. Usage: npx tsx scripts/probe-prune-dryrun.ts <email>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { planStalePrune } from '../lib/holdings-prune';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const target = (process.argv[2] ?? '').toLowerCase();
  if (!target) return console.log('Usage: npx tsx scripts/probe-prune-dryrun.ts <email>');

  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  const u = (users?.users ?? []).find((x) => (x.email ?? '').toLowerCase() === target);
  if (!u) return console.log(`No user for ${target}`);

  const { data: h } = await db
    .from('holdings')
    .select('ticker, security_id, account_id, total_value, last_updated_at')
    .eq('user_id', u.id);
  const rows = h ?? [];

  // Simulate the next sync: it writes every position the brokerage still
  // reports. Freshest write time per account marks that set; anything older was
  // not in the last response and is what a real sync would omit.
  const newestByAccount = new Map<string, number>();
  for (const r of rows) {
    const t = r.last_updated_at ? new Date(String(r.last_updated_at)).getTime() : 0;
    const k = String(r.account_id);
    if (t > (newestByAccount.get(k) ?? 0)) newestByAccount.set(k, t);
  }
  const STALE_MS = 36 * 3600_000;
  const wouldBeReported = rows.filter((r) => {
    const t = r.last_updated_at ? new Date(String(r.last_updated_at)).getTime() : 0;
    return (newestByAccount.get(String(r.account_id)) ?? 0) - t <= STALE_MS;
  });

  const plan = planStalePrune(
    wouldBeReported.map((r) => ({ account_id: String(r.account_id), security_id: String(r.security_id) })),
    { unmappedHoldings: 0, upsertFailed: false },
  );
  if (!plan.prune) return console.log(`plan says do not prune: ${plan.reason}`);

  console.log(`simulating a sync that reports ${wouldBeReported.length} of ${rows.length} stored positions\n`);

  let totalDropped = 0;
  for (const [accountId, securityIds] of plan.keepByAccount) {
    // EXACTLY the filter the delete uses, issued as a select.
    const { data: doomed, error } = await db
      .from('holdings')
      .select('ticker, total_value, last_updated_at')
      .eq('user_id', u.id)
      .eq('account_id', accountId)
      .not('security_id', 'in', `(${securityIds.join(',')})`);

    if (error) {
      console.log(`  account ${accountId.slice(0, 8)}  QUERY ERROR: ${error.message}`);
      continue;
    }
    const list = (doomed ?? []) as unknown as { ticker: string; total_value: number | null; last_updated_at: string }[];
    console.log(`  account ${accountId.slice(0, 8)}  keep ${securityIds.length}  would delete ${list.length}`);
    for (const d of list) {
      totalDropped += Number(d.total_value ?? 0);
      console.log(`      ${String(d.ticker).padEnd(10)} $${Math.round(Number(d.total_value ?? 0)).toLocaleString().padStart(8)}  last written ${String(d.last_updated_at).slice(0, 10)}`);
    }
  }
  console.log(`\nwould remove $${Math.round(totalDropped).toLocaleString()} of phantom value. NOTHING WAS DELETED.`);
}
main();
