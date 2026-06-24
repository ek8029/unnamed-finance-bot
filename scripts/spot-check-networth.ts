/**
 * READ-ONLY spot-check: verify net-worth accuracy across ALL Plaid-connected
 * users. Replicates computeSnapshots' READ logic (never writes / never calls
 * the snapshot writer) and compares live-computed net worth to the latest
 * stored snapshot, plus reports daily-history depth (for the 1W/1M ranges).
 *
 * Usage: tsx scripts/spot-check-networth.ts
 *
 * SELECT-only. Touches: auth.admin.listUsers (read), plaid_items,
 * linked_accounts, holdings, net_worth_snapshots. No upsert/update/delete.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }

const db = createClient(url, key);

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  const v = Number(n);
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Mirror computeSnapshots (lib/plaid-sync.ts) EXACTLY — read-only replica.
function classify(accts: { account_type: string; current_balance: number | null }[], investmentBalance: number) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let cash = 0;
  let crypto = 0;
  for (const a of accts) {
    const bal = Number(a.current_balance);
    const type = a.account_type;
    if (type === 'credit_card') { totalLiabilities += Math.abs(bal); }
    else if (type === 'loan' || type === 'mortgage') { totalLiabilities += Math.abs(bal); }
    else if (type === 'crypto') { crypto += bal; totalAssets += bal; }
    else if (type === 'brokerage') { /* skip — value comes from holdings */ }
    else { cash += bal; totalAssets += bal; }
  }
  totalAssets += investmentBalance;
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, cash, crypto };
}

async function emailMap(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) m.set(u.id, u.email || '(no email)');
    if (data.users.length < 200) break;
  }
  return m;
}

async function main() {
  // All users with a Plaid connection.
  const { data: items, error: itemErr } = await db.from('plaid_items').select('user_id');
  if (itemErr) throw itemErr;
  const userIds = [...new Set((items || []).map((i) => i.user_id))];
  console.log(`\nPlaid-connected users: ${userIds.length}\n${'='.repeat(72)}`);

  const emails = await emailMap();
  let flagged = 0;

  for (const uid of userIds) {
    const [{ data: accts }, { data: holdings }, { data: snaps }] = await Promise.all([
      db.from('linked_accounts').select('account_type, current_balance, account_name, is_active').eq('user_id', uid).eq('is_active', true),
      db.from('holdings').select('total_value').eq('user_id', uid),
      db.from('net_worth_snapshots').select('snapshot_date, net_worth, total_assets, total_liabilities').eq('user_id', uid).order('snapshot_date', { ascending: true }),
    ]);

    const acctList = accts || [];
    const holdingList = holdings || [];
    const snapList = snaps || [];

    const investmentBalance = holdingList.reduce((s, h) => s + Number(h.total_value), 0);
    const live = classify(acctList, investmentBalance);

    const latest = snapList[snapList.length - 1];
    const storedNW = latest ? Number(latest.net_worth) : null;
    const drift = storedNW != null ? live.netWorth - storedNW : null;
    // Drift is expected (prices move after the daily snapshot). Flag only large gaps.
    const bigDrift = drift != null && Math.abs(drift) > Math.max(50, live.netWorth * 0.05);

    const acctTypes = acctList.reduce<Record<string, number>>((m, a) => {
      m[a.account_type] = (m[a.account_type] || 0) + 1; return m;
    }, {});

    console.log(`\n${emails.get(uid) || uid}`);
    console.log(`  accounts (active): ${acctList.length}  [${Object.entries(acctTypes).map(([t, n]) => `${t}:${n}`).join(', ') || 'none'}]`);
    console.log(`  holdings: ${holdingList.length}  invested=${fmt(investmentBalance)}`);
    console.log(`  LIVE net worth: ${fmt(live.netWorth)}  (assets ${fmt(live.totalAssets)} - liab ${fmt(live.totalLiabilities)})`);
    console.log(`  stored snapshot: ${latest ? `${fmt(storedNW)} @ ${latest.snapshot_date}` : 'NONE'}  drift=${drift != null ? fmt(drift) : '—'}${bigDrift ? '  <== CHECK' : ''}`);
    console.log(`  snapshot history: ${snapList.length} days${snapList.length ? `  (${snapList[0].snapshot_date} -> ${latest!.snapshot_date})` : ''}  ranges: ${snapList.length >= 2 ? '1W/1M usable' : 'too few for 1W/1M'}`);

    if (bigDrift || acctList.length === 0 || (holdingList.length === 0 && investmentBalance === 0 && acctList.some(a => a.account_type === 'brokerage'))) flagged++;
  }

  console.log(`\n${'='.repeat(72)}\nDone. ${userIds.length} users checked, ${flagged} flagged for review.`);
  console.log('Note: small drift = normal (prices moved since the daily snapshot). Large drift / 0 accounts / brokerage-with-no-holdings = worth a look.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
