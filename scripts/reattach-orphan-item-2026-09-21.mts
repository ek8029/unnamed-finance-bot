/**
 * Recover an orphaned linked_account whose legacy access token is still valid.
 *
 * Account 8440 was stranded on 2026-06-03 when a duplicate link superseded its
 * plaid_items row (see lib/plaid-item-purge.ts). Unlike every other account it
 * kept its own pre-migration-067 access token, and that token still works: the
 * live Plaid API returns a real "ROTH 401K" account with 8 current positions
 * worth $28,827, none of which match the June 3 snapshot we were displaying.
 *
 * Deleting the stale rows was only half the job. This rebuilds the plaid_items
 * row from the surviving token and points the account at it, so the account
 * syncs again instead of being invisible.
 *
 * DRY RUN BY DEFAULT. Pass --apply to write.
 */
import { readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^([A-Z_0-9]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '').trim()]),
);
for (const [k, v] of Object.entries(env)) process.env[k] = v as string;
process.env.PLAID_ENV = 'production';

const { createClient } = await import('@supabase/supabase-js');
const { plaidClient } = await import('../lib/plaid');
const { openToken } = await import('../lib/plaid/token-crypto');

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const USER = '7d97df91-9050-4c59-9d2f-c255fb324b66';
const LAST4 = '8440';

const { data: accts, error: ae } = await db.from('linked_accounts')
  .select('id,account_name,account_number_last4,plaid_account_id,plaid_item_ref,plaid_access_token,institution_id,is_active')
  .eq('user_id', USER);
if (ae) { console.error('FATAL linked_accounts:', ae.message); process.exit(1); }

const target = accts.find(a => a.account_number_last4 === LAST4);
if (!target) { console.error(`no account ending ${LAST4}`); process.exit(1); }
if (!target.plaid_access_token) { console.error(`account ${LAST4} has no legacy token to recover from`); process.exit(1); }
if (target.plaid_item_ref) { console.log(`account ${LAST4} already points at item ${target.plaid_item_ref}. Nothing to do.`); process.exit(0); }

const token = openToken(target.plaid_access_token);

// What does Plaid say this token is?
const itemRes = await plaidClient.itemGet({ access_token: token });
const item = itemRes.data.item;
const acctRes = await plaidClient.accountsGet({ access_token: token });

console.log(`token is valid. plaid item_id=${String(item.item_id).slice(0, 12)}...  institution=${item.institution_id}`);
console.log(`accounts on this token: ${acctRes.data.accounts.length}`);
for (const a of acctRes.data.accounts) {
  console.log(`  "${a.name}"(${a.mask ?? 'na'}) ${a.type}/${a.subtype} current=${a.balances.current}`);
}
const plaidAccount = acctRes.data.accounts.find(a => a.mask === LAST4);
if (!plaidAccount) { console.error(`Plaid does not return an account masked ${LAST4} for this token`); process.exit(1); }

// Is this item already in our table under another row?
const { data: existing, error: ee } = await db.from('plaid_items')
  .select('id,institution_name,status').eq('user_id', USER).eq('plaid_item_id', item.item_id).maybeSingle();
if (ee) { console.error('FATAL plaid_items lookup:', ee.message); process.exit(1); }
if (existing) {
  console.log(`\nthis plaid item already exists as ${String(existing.id).slice(0, 8)} (${existing.institution_name}); will just repoint the account`);
}

// Reuse the institution row the live Schwab item already uses.
const { data: schwab, error: se } = await db.from('plaid_items')
  .select('institution_id,plaid_institution_id,institution_name')
  .eq('user_id', USER).ilike('institution_name', '%schwab%').limit(1).maybeSingle();
if (se) { console.error('FATAL schwab lookup:', se.message); process.exit(1); }

console.log(`\nplanned changes for account ${String(target.id).slice(0, 8)} ("${target.account_name}" -> "${plaidAccount.name}"):`);
console.log(`  create plaid_items row (or reuse existing) for item ${String(item.item_id).slice(0, 12)}...`);
console.log(`  set plaid_item_ref, is_active=true, sync_status=healthy`);
console.log(`  correct account_name to "${plaidAccount.name}", subtype "${plaidAccount.subtype}"`);
console.log(`  clear the legacy plaid_access_token from linked_accounts (token lives on the item, per migration 067)`);

if (!APPLY) {
  console.log('\nDRY RUN. Re-run with --apply to write.');
  process.exit(0);
}

let itemRowId = existing?.id as string | undefined;
if (!itemRowId) {
  const { sealToken } = await import('../lib/plaid/token-crypto');
  const { data: created, error: ce } = await db.from('plaid_items').insert({
    user_id: USER,
    plaid_item_id: item.item_id,
    plaid_access_token: sealToken(token),
    institution_id: schwab?.institution_id ?? target.institution_id,
    plaid_institution_id: item.institution_id,
    institution_name: schwab?.institution_name ?? 'Charles Schwab',
    status: 'active',
    available_products: item.available_products ?? [],
    billed_products: item.billed_products ?? [],
    consented_products: item.consented_products ?? [],
  }).select('id').single();
  if (ce || !created) { console.error('FATAL item insert:', ce?.message); process.exit(1); }
  itemRowId = created.id;
  console.log(`created plaid_items row ${String(itemRowId).slice(0, 8)}`);
}

const { error: ue } = await db.from('linked_accounts').update({
  plaid_item_ref: itemRowId,
  plaid_access_token: null,
  plaid_account_id: plaidAccount.account_id,
  account_name: plaidAccount.name,
  account_subtype: plaidAccount.subtype ?? null,
  current_balance: plaidAccount.balances.current ?? null,
  is_active: true,
  sync_status: 'healthy',
  sync_error: null,
}).eq('id', target.id);
if (ue) { console.error('FATAL account update:', ue.message); process.exit(1); }
console.log(`repointed account ${LAST4} at item ${String(itemRowId).slice(0, 8)} and reactivated it`);

// Verify
const { data: after, error: ve } = await db.from('linked_accounts')
  .select('account_name,account_number_last4,plaid_item_ref,is_active,sync_status,plaid_access_token')
  .eq('id', target.id).single();
if (ve) { console.error('verify failed:', ve.message); process.exit(1); }
console.log(`\nafter: "${after.account_name}"(${after.account_number_last4}) ref=${String(after.plaid_item_ref).slice(0, 8)} active=${after.is_active} status=${after.sync_status} legacyToken=${after.plaid_access_token ? 'STILL SET' : 'cleared'}`);
console.log('\nNext: run the holdings sync for this item so its 8 live positions land.');
