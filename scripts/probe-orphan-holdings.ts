/**
 * Positions Plaid has stopped reporting. Read-only.
 *
 * plaid-sync upserts holdings and deletes only rows at zero shares. A security
 * that simply disappears from the Plaid response is never pruned, so it sits in
 * the book forever at its last known value. Detection: within an account that
 * synced recently, any row whose price is much older than its siblings was not
 * written by that sync, which means Plaid did not report it.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const et = (s: unknown) => (s ? new Date(String(s)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'null');
/** A row this far behind its account's freshest write was not in the last sync. */
const STALE_HOURS = 36;

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  let grandTotal = 0;

  for (const u of users?.users ?? []) {
    const { data: h } = await db
      .from('holdings')
      .select('ticker, shares, total_value, account_id, last_updated_at')
      .eq('user_id', u.id);
    if (!h?.length) continue;

    const byAcc = new Map<string, { rows: typeof h; newest: number }>();
    for (const r of h) {
      const k = String(r.account_id);
      const e = byAcc.get(k) ?? { rows: [] as typeof h, newest: 0 };
      e.rows.push(r);
      const t = r.last_updated_at ? new Date(String(r.last_updated_at)).getTime() : 0;
      if (t > e.newest) e.newest = t;
      byAcc.set(k, e);
    }

    const orphans: { ticker: string; value: number; priced: unknown }[] = [];
    for (const [, e] of byAcc) {
      // Only judge accounts that clearly synced recently.
      if (Date.now() - e.newest > 3 * 86400_000) continue;
      for (const r of e.rows) {
        const t = r.last_updated_at ? new Date(String(r.last_updated_at)).getTime() : 0;
        if (e.newest - t > STALE_HOURS * 3600_000) {
          orphans.push({ ticker: String(r.ticker), value: Number(r.total_value ?? 0), priced: r.last_updated_at });
        }
      }
    }
    if (!orphans.length) continue;

    const sum = orphans.reduce((s, o) => s + o.value, 0);
    grandTotal += sum;
    const book = h.reduce((s, r) => s + Number(r.total_value ?? 0), 0);
    console.log(`\n${u.email}  book $${Math.round(book).toLocaleString()}`);
    console.log(`  ${orphans.length} position(s) Plaid no longer reports, worth $${Math.round(sum).toLocaleString()} (${((sum / book) * 100).toFixed(1)}% of the book)`);
    for (const o of orphans.sort((a, b) => b.value - a.value)) {
      console.log(`    ${o.ticker.padEnd(10)} $${Math.round(o.value).toLocaleString().padStart(9)}   last written ${et(o.priced)}`);
    }
  }
  console.log(`\nTOTAL overstated across all users: $${Math.round(grandTotal).toLocaleString()}`);
}
main();
