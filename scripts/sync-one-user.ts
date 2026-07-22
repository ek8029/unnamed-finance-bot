/**
 * Sync one user's Plaid connections, and nothing else.
 *
 * The daily cron also sends drip emails and regenerates digests for everyone,
 * which is far too wide a blast radius when the goal is to repair one account.
 * This calls syncPlaidItem directly: balances, transactions, holdings. No email
 * is sent from this path.
 *
 * Usage: npx tsx scripts/sync-one-user.ts <email>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import type { PlaidItemForSync } from '../lib/plaid-sync';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  // lib/plaid builds its API client at module load. A static import is hoisted
  // above the dotenv call at the top of this file, so the client would be
  // constructed with empty credentials and every call fails MISSING_FIELDS.
  // Import it here, once the environment is actually loaded.
  const { syncPlaidItem } = await import('../lib/plaid-sync');

  const target = (process.argv[2] ?? '').toLowerCase();
  if (!target) return console.log('Usage: npx tsx scripts/sync-one-user.ts <email>');
  if (process.env.PLAID_ENV !== 'production') {
    return console.log(`Refusing to run: PLAID_ENV is "${process.env.PLAID_ENV}", not production.`);
  }

  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  const u = (users?.users ?? []).find((x) => (x.email ?? '').toLowerCase() === target);
  if (!u) return console.log(`No user for ${target}`);

  const { data: items } = await db
    .from('plaid_items')
    .select('id, plaid_access_token, transactions_cursor, institution_name, available_products, billed_products, consented_products, status')
    .eq('user_id', u.id)
    .eq('status', 'active');
  if (!items?.length) return console.log('No active Plaid items');

  const before = await db.from('holdings').select('ticker, total_value').eq('user_id', u.id);
  const beforeRows = before.data ?? [];
  const beforeValue = beforeRows.reduce((s, r) => s + Number(r.total_value ?? 0), 0);
  console.log(`before: ${beforeRows.length} holdings, $${Math.round(beforeValue).toLocaleString()}\n`);

  for (const item of items) {
    const forSync: PlaidItemForSync = {
      id: item.id as string,
      plaid_access_token: item.plaid_access_token as string,
      transactions_cursor: (item.transactions_cursor as string) ?? null,
      institution_name: (item.institution_name as string) ?? null,
      available_products: (item.available_products as string[]) ?? [],
      billed_products: (item.billed_products as string[]) ?? [],
      consented_products: (item.consented_products as string[]) ?? [],
    };
    try {
      const r = await syncPlaidItem(db, u.id, forSync);
      console.log(`  ${String(item.institution_name).slice(0, 24).padEnd(26)} ok=${r.success} holdings=${r.holdings_synced ?? 0} tx=${JSON.stringify(r.transactions ?? {})}`);
    } catch (err) {
      console.log(`  ${String(item.institution_name).slice(0, 24).padEnd(26)} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const after = await db.from('holdings').select('ticker, total_value').eq('user_id', u.id);
  const afterRows = after.data ?? [];
  const afterValue = afterRows.reduce((s, r) => s + Number(r.total_value ?? 0), 0);
  console.log(`\nafter: ${afterRows.length} holdings, $${Math.round(afterValue).toLocaleString()}`);

  const beforeSet = new Set(beforeRows.map((r) => String(r.ticker)));
  const afterSet = new Set(afterRows.map((r) => String(r.ticker)));
  const removed = [...beforeSet].filter((t) => !afterSet.has(t));
  const added = [...afterSet].filter((t) => !beforeSet.has(t));
  if (removed.length) console.log(`removed: ${removed.join(', ')}`);
  if (added.length) console.log(`added:   ${added.join(', ')}`);
  if (!removed.length && !added.length) console.log('no positions added or removed');
}
main();
