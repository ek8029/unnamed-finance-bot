/**
 * Runtime smoke check for the 2026-08-04 tax rebuild, against a real book.
 *
 * Exercises the paths tests cannot: the embedded linked_accounts join in the
 * wash-sale query, the per-user tax profile read, the per-lot character split,
 * and the §1211(b) ladder fields. A silent failure in any of them looks exactly
 * like "this user has nothing to harvest", which is why this has to run against
 * real rows rather than fixtures.
 *
 * Usage: npx tsx scripts/probe-tax-runtime.ts <email>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const email = process.argv[2];
  if (!email) return console.log('Usage: npx tsx scripts/probe-tax-runtime.ts <email>');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Accept a raw user id (or id prefix), or resolve an email through auth —
  // there is no public.profiles table in this schema.
  let userId = email;
  if (email.includes('@')) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return console.log(`auth lookup failed: ${error.message}`);
    const match = (data?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!match) return console.log(`No auth user for ${email}`);
    userId = match.id;
  } else if (email.length < 36) {
    // uuid columns cannot LIKE without a cast; match client-side instead.
    const { data: someHoldings } = await db.from('holdings').select('user_id').limit(5000);
    const hit = (someHoldings ?? []).map((r) => String(r.user_id)).find((u) => u.startsWith(email));
    if (!hit) return console.log(`No user matching ${email}`);
    userId = hit;
  }
  console.log(`\nuser ${userId.slice(0, 8)}...`);

  // ── 1. The embedded join the wash-sale engine depends on ──
  const windowStart = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const { data: acqRows, error: acqError } = await db
    .from('investment_transactions')
    .select(`
      ticker, name, transaction_type, transaction_date,
      account:linked_accounts(account_name, account_subtype)
    `)
    .eq('user_id', userId)
    .gte('transaction_date', windowStart)
    .limit(5);

  console.log('\n[1] wash-sale query (embedded linked_accounts join)');
  if (acqError) {
    console.log(`  ✗ FAILED: ${acqError.message}`);
    console.log('  Every position would silently report "No conflict". Do not push.');
  } else {
    console.log(`  ✓ resolves — ${acqRows?.length ?? 0} row(s) in the last 30 days`);
    for (const r of acqRows ?? []) {
      const rel = (r as { account?: unknown }).account;
      const acc = (Array.isArray(rel) ? rel[0] : rel) as { account_name?: string } | null;
      console.log(`    ${r.transaction_date} ${r.transaction_type} ${r.ticker ?? '—'} · ${acc?.account_name ?? 'NO ACCOUNT JOIN'}`);
    }
    if ((acqRows?.length ?? 0) === 0) {
      // Prove the join itself works even with no rows in the window.
      const { error: wideError } = await db
        .from('investment_transactions')
        .select('ticker, account:linked_accounts(account_name)')
        .eq('user_id', userId)
        .limit(1);
      console.log(wideError
        ? `  ✗ join is broken (no date filter): ${wideError.message}`
        : '  ✓ join verified against the full table (window is just empty)');
    }
  }

  // ── 2. Per-user tax profile ──
  const { data: prefs, error: prefError } = await db
    .from('user_preferences')
    .select('filing_status, tax_bracket')
    .eq('user_id', userId)
    .maybeSingle();
  console.log('\n[2] tax profile (settings-driven rates + §1211(b) cap)');
  if (prefError) console.log(`  ✗ ${prefError.message}`);
  else console.log(`  filing_status=${prefs?.filing_status ?? 'unset'} tax_bracket=${prefs?.tax_bracket ?? 'unset'}`
    + ` → ${prefs?.filing_status === 'Married Filing Separately' ? 'cap $1,500' : 'cap $3,000'}`);

  // ── 3. Holdings: basis completeness and lot-level character ──
  const { data: holdings, error: hError } = await db
    .from('holdings')
    .select('ticker, shares, total_value, total_cost_basis, average_cost_basis, unrealised_gain_loss, acquired_at, account:linked_accounts(account_name, account_subtype)')
    .eq('user_id', userId);
  console.log('\n[3] holdings');
  if (hError) return console.log(`  ✗ ${hError.message}`);

  const rows = holdings ?? [];
  const noBasis = rows.filter(h => h.total_cost_basis == null && h.average_cost_basis == null);
  const noAcquired = rows.filter(h => h.acquired_at == null);
  const inconsistent = rows.filter(h => {
    const shares = Number(h.shares ?? 0);
    const val = Number(h.total_value ?? 0);
    if (!shares || !val) return false;
    return false; // current_price not selected; see [4]
  });
  console.log(`  ${rows.length} rows · ${noBasis.length} with NO cost basis · ${noAcquired.length} with no acquired_at`);
  if (noBasis.length > 0) {
    console.log(`  → those positions now report P/L as unknown (a dash), not $0:`);
    for (const h of noBasis.slice(0, 5)) console.log(`     ${h.ticker}`);
  }
  void inconsistent;

  // ── 4. price × shares == total_value, the invariant plaid-sync now keeps ──
  const { data: priced } = await db
    .from('holdings')
    .select('ticker, shares, current_price, total_value')
    .eq('user_id', userId);
  console.log('\n[4] stored price/value consistency');
  const drift = (priced ?? []).map(h => {
    const shares = Number(h.shares ?? 0);
    const price = Number(h.current_price ?? 0);
    const val = Number(h.total_value ?? 0);
    if (!shares || !price || !val) return null;
    const implied = shares * price;
    const pct = Math.abs(implied - val) / val * 100;
    return pct > 1 ? { ticker: h.ticker, implied, val, pct } : null;
  }).filter(Boolean) as { ticker: string; implied: number; val: number; pct: number }[];
  if (drift.length === 0) console.log('  ✓ every row multiplies out within 1%');
  else {
    console.log(`  ${drift.length} row(s) still drifting (pre-existing data; next sync repairs them):`);
    for (const d of drift.slice(0, 8)) {
      console.log(`     ${d.ticker}: shares×price $${Math.round(d.implied).toLocaleString()} vs stored $${Math.round(d.val).toLocaleString()} (${d.pct.toFixed(1)}%)`);
    }
  }

  // ── 5. Realized side — expected to be empty, confirming the ladder's $0 row ──
  const { count: cgCount } = await db
    .from('capital_gains')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  console.log(`\n[5] capital_gains rows: ${cgCount ?? 0} (0 is expected — nothing writes this table)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
