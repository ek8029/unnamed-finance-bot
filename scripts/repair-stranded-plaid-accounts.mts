/**
 * One-time repair for accounts stranded by the bare item delete.
 *
 * Until 2026-09-21, two code paths deleted a `plaid_items` row without cleaning
 * up after it. `linked_accounts.plaid_item_ref` is ON DELETE SET NULL
 * (migration 067), not a cascade, so the account rows survived with a null
 * reference and kept their positions. Nothing can refresh them (no item) and
 * the stale-position prune in lib/holdings-prune.ts cannot reach them (it only
 * builds keep-lists for accounts present in a Plaid response), so the positions
 * froze at whatever they last were and kept rendering.
 *
 * The creating paths are fixed in lib/plaid-item-purge.ts. This clears what
 * they already left behind.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless you pass --apply.
 *
 * INTERNAL ACCOUNTS ARE SKIPPED BY DEFAULT. The internal account carries Plaid
 * sandbox positions that hang entirely off stranded accounts, so repairing it
 * empties the test book to zero while leaving its snapshot history behind. Pass
 * --include-internal only when you actually want that.
 *
 *   npx tsx scripts/repair-stranded-plaid-accounts.mts
 *   npx tsx scripts/repair-stranded-plaid-accounts.mts --apply
 *   npx tsx scripts/repair-stranded-plaid-accounts.mts --apply --include-internal
 *   npx tsx scripts/repair-stranded-plaid-accounts.mts --apply --user <uuid>
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isStrandedPlaidAccount } from '../lib/plaid-item-purge';

const APPLY = process.argv.includes('--apply');
const INCLUDE_INTERNAL = process.argv.includes('--include-internal');
const ONLY_USER = (() => {
  const i = process.argv.indexOf('--user');
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** Same exclusion every probe in this repo uses. */
const INTERNAL = /evank8029|evank7029|helmterminal@gmail|@helmterminal\.dev|\+appreview/i;

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^([A-Z_0-9]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '').trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
function fatal(label: string, error: { message: string } | null): void {
  if (error) {
    console.error(`FATAL ${label}: ${error.message}`);
    process.exit(1);
  }
}

const { data: authList, error: authError } = await db.auth.admin.listUsers({ perPage: 1000 });
fatal('listUsers', authError as { message: string } | null);
const internalIds = new Set(
  (authList?.users ?? []).filter(u => INTERNAL.test(u.email ?? '')).map(u => u.id),
);

const { data: items, error: itemsError } = await db.from('plaid_items').select('id');
fatal('plaid_items', itemsError);
const liveItems = new Set((items ?? []).map(i => i.id as string));

const { data: accounts, error: accountsError } = await db
  .from('linked_accounts')
  .select('id,user_id,account_name,account_number_last4,source,plaid_item_ref,is_active,last_synced_at');
fatal('linked_accounts', accountsError);

const allStranded = (accounts ?? []).filter(a => a.is_active && isStrandedPlaidAccount(a, liveItems));

const skippedInternal = allStranded.filter(a => internalIds.has(a.user_id as string));
let stranded = INCLUDE_INTERNAL
  ? allStranded
  : allStranded.filter(a => !internalIds.has(a.user_id as string));
if (ONLY_USER) stranded = stranded.filter(a => a.user_id === ONLY_USER);

if (!INCLUDE_INTERNAL && skippedInternal.length > 0) {
  const users = new Set(skippedInternal.map(a => a.user_id as string));
  console.log(
    `skipping ${skippedInternal.length} stranded account(s) on ${users.size} internal account(s). ` +
      `Repairing them would empty the sandbox book. Pass --include-internal to override.\n`,
  );
}

if (stranded.length === 0) {
  console.log('No stranded accounts in scope. Nothing to repair.');
  process.exit(0);
}

const strandedIds = stranded.map(a => a.id as string);
const { data: rows, error: holdingsError } = await db
  .from('holdings')
  .select('id,account_id,ticker,total_value')
  .in('account_id', strandedIds);
fatal('holdings', holdingsError);

const perAccount = new Map<string, { n: number; value: number; tickers: string[] }>();
for (const r of rows ?? []) {
  const e = perAccount.get(r.account_id as string) ?? { n: 0, value: 0, tickers: [] };
  e.n++;
  e.value += Number(r.total_value ?? 0);
  e.tickers.push(String(r.ticker));
  perAccount.set(r.account_id as string, e);
}

const byUser = new Map<string, typeof stranded>();
for (const a of stranded) {
  const list = byUser.get(a.user_id as string) ?? [];
  list.push(a);
  byUser.set(a.user_id as string, list);
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — stranded accounts in scope: ${stranded.length} across ${byUser.size} user(s)\n`);

let totalRows = 0;
let totalValue = 0;
for (const [userId, list] of byUser) {
  console.log(`user ${userId}`);
  for (const a of list) {
    const e = perAccount.get(a.id as string) ?? { n: 0, value: 0, tickers: [] };
    totalRows += e.n;
    totalValue += e.value;
    console.log(
      `  "${a.account_name}"(${a.account_number_last4 ?? 'na'}) ref=${a.plaid_item_ref == null ? 'NULL' : 'DANGLING'} ` +
        `lastSynced=${String(a.last_synced_at ?? '').slice(0, 10)} positions=${e.n} ${usd(e.value)}`,
    );
    if (e.tickers.length) console.log(`      ${e.tickers.join(', ')}`);
  }
  console.log('');
}
console.log(`TOTAL IN SCOPE: ${totalRows} frozen position row(s) worth ${usd(totalValue)}\n`);

if (!APPLY) {
  console.log('Dry run only. Re-run with --apply to delete these positions and deactivate these accounts.');
  process.exit(0);
}

// Positions first: holdings.account_id is NOT NULL and references
// linked_accounts(id), so the rows go before the account is touched.
const { error: deleteError, count } = await db
  .from('holdings')
  .delete({ count: 'exact' })
  .in('account_id', strandedIds);
fatal('holdings delete', deleteError);
console.log(`deleted ${count ?? 0} frozen position row(s)`);

// Deactivate rather than delete the account row. The positions were the defect;
// the account itself records that the user once linked this institution, and a
// `transactions` history may still hang off it.
const { error: deactivateError } = await db
  .from('linked_accounts')
  .update({
    is_active: false,
    sync_status: 'disconnected',
    sync_error: 'Plaid connection removed; account no longer syncs',
  })
  .in('id', strandedIds);
fatal('linked_accounts deactivate', deactivateError);
console.log(`deactivated ${strandedIds.length} stranded account(s)`);

// Verify, rather than assume.
const { data: leftover, error: verifyError } = await db
  .from('holdings')
  .select('id')
  .in('account_id', strandedIds);
fatal('verify', verifyError);
console.log(`verification: ${(leftover ?? []).length} position row(s) remain on stranded accounts (expected 0)`);
