/**
 * Is Ben's report actually fixed, in production, right now? Read-only.
 *
 * The data was cleaned by hand, so "no ghosts" proves nothing on its own: if
 * prod is still running the old plaid-sync, the next sync recreates them. The
 * real test is whether any zero-share row has appeared SINCE the cleanup.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { computePortfolioLookthrough } from '../lib/etf-holdings';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Passed in, never hardcoded: this repository is public.
// Usage: npx tsx scripts/probe-ben-status.ts <email> [TICKER,TICKER,...]
const TARGET_EMAIL = process.argv[2];
const REPORTED_MISSING = (process.argv[3] ?? 'BE,LLY,NBIS,SPCX,WDC,HYNX').split(',').map((t) => t.trim().toUpperCase());

async function main() {
  if (!TARGET_EMAIL) {
    return console.log('Usage: npx tsx scripts/probe-ben-status.ts <email> [TICKER,TICKER,...]');
  }
  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  const ben = (users?.users ?? []).find((u) => (u.email ?? '') === TARGET_EMAIL);
  if (!ben) return console.log(`No user for ${TARGET_EMAIL}`);

  // ---- 1. ghosts, globally and since the cleanup -------------------------
  const { data: allZero } = await db
    .from('holdings')
    .select('user_id, ticker, shares, last_updated_at, created_at')
    .eq('shares', 0);
  console.log(`\n1. ZERO-SHARE ROWS`);
  console.log(`   across all users right now: ${(allZero ?? []).length} (want 0)`);
  for (const r of allZero ?? []) console.log(`     ${r.ticker} user=${String(r.user_id).slice(0, 8)} updated=${r.last_updated_at}`);

  // ---- 2. has a sync run since the cleanup? ------------------------------
  const { data: items } = await db
    .from('plaid_items')
    .select('user_id, institution_name, status, last_holdings_sync, updated_at')
    .eq('user_id', ben.id);
  console.log(`\n2. BEN'S PLAID CONNECTIONS`);
  for (const i of items ?? []) {
    console.log(`   ${String(i.institution_name).padEnd(22)} status=${i.status} last_holdings_sync=${i.last_holdings_sync}`);
  }

  // ---- 3. the tickers he named --------------------------------------------
  const { data: h } = await db
    .from('holdings')
    .select('ticker, shares, total_value, last_updated_at, account_id')
    .eq('user_id', ben.id);
  const rows = h ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total_value ?? 0), 0);

  console.log(`\n3. THE POSITIONS HE SAID WERE MISSING`);
  for (const t of REPORTED_MISSING) {
    const found = rows.filter((r) => String(r.ticker).toUpperCase() === t);
    if (!found.length) { console.log(`   ${t.padEnd(6)} NOT HELD`); continue; }
    for (const f of found) {
      console.log(`   ${t.padEnd(6)} ${String(f.shares).padStart(9)} sh  $${Math.round(Number(f.total_value)).toLocaleString().padStart(9)}  priced ${String(f.last_updated_at).slice(0, 10)}`);
    }
  }

  // ---- 4. do they reach the exposure view? --------------------------------
  const look = computePortfolioLookthrough(
    rows.map((r) => ({ ticker: String(r.ticker), totalValue: Number(r.total_value ?? 0) })),
    total,
  );
  console.log(`\n4. TRUE EXPOSURE (${look.size} rows from ${rows.length} holdings)`);
  for (const t of [...REPORTED_MISSING, 'SKHY']) {
    const e = look.get(t);
    console.log(`   ${t.padEnd(6)} ${e ? `${e.totalWeight.toFixed(3)}%  via ${e.sources.join(', ')}` : 'ABSENT'}`);
  }

  // ---- 5. duplicates and staleness ---------------------------------------
  const byKey = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.account_id}|${String(r.ticker).toUpperCase()}`;
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }
  const dupes = [...byKey].filter(([, n]) => n > 1);
  console.log(`\n5. DATA HEALTH`);
  console.log(`   duplicate (account, ticker) rows: ${dupes.length}${dupes.length ? ` -> ${dupes.map(([k]) => k.split('|')[1]).join(', ')}` : ''}`);
  const noPrice = rows.filter((r) => !r.last_updated_at);
  console.log(`   holdings with no last_updated_at: ${noPrice.length}${noPrice.length ? ` -> ${noPrice.map((r) => r.ticker).join(', ')}` : ''}`);
  const stale = rows.filter((r) => r.last_updated_at && Date.now() - new Date(String(r.last_updated_at)).getTime() > 5 * 86400_000);
  console.log(`   priced more than 5 days ago: ${stale.length}${stale.length ? ` -> ${stale.map((r) => `${r.ticker}(${String(r.last_updated_at).slice(0, 10)})`).join(', ')}` : ''}`);
  console.log(`   total book: $${Math.round(total).toLocaleString()} across ${rows.length} rows`);
}
main();
