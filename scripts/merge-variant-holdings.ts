/** Merge holdings rows that are the SAME position reported under different
 *  broker symbols (SKHY / SKHYV / the security's full name used as a ticker).
 *
 *  Each duplicate inflates portfolio value. plaid-sync now canonicalises at
 *  ingestion so this cannot recur, but existing books still carry the extras
 *  until they next sync. This removes them.
 *
 *  Rule: within one ACCOUNT, if several rows canonicalise to the same ticker
 *  AND report the same share count, they are one lot reported repeatedly.
 *  Keep the row whose ticker is already canonical (else the first), delete the
 *  rest. Different share counts are genuinely different lots and are kept.
 *
 *  Dry run:  npx tsx --env-file=.env.local scripts/merge-variant-holdings.ts
 *  Apply:    npx tsx --env-file=.env.local scripts/merge-variant-holdings.ts --apply
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { canonicalTicker } from '../lib/ticker-alias';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  const em = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? u.id]));
  const { data: rows } = await db.from('holdings').select('id, user_id, account_id, ticker, shares, total_value');

  // group by account + canonical ticker + share count
  const groups = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const key = `${r.user_id}|${r.account_id}|${canonicalTicker(r.ticker)}|${Number(r.shares)}`;
    groups.set(key, [...(groups.get(key) ?? []), r] as typeof rows);
  }

  const toDelete: { id: string; user: string; ticker: string; value: number }[] = [];
  for (const [key, g] of groups) {
    if (!g || g.length < 2) continue;
    const canonical = key.split('|')[2];
    // Prefer keeping the row already stored under the canonical ticker.
    const keep = g.find((r) => String(r.ticker).toUpperCase() === canonical) ?? g[0];
    for (const r of g) {
      if (r.id === keep.id) continue;
      toDelete.push({
        id: r.id as string,
        user: String(em.get(r.user_id as string)),
        ticker: String(r.ticker),
        value: Number(r.total_value ?? 0),
      });
    }
  }

  if (toDelete.length === 0) { console.log('No duplicate variant rows found.'); return; }

  const byUser = new Map<string, { n: number; value: number }>();
  for (const d of toDelete) {
    const cur = byUser.get(d.user) ?? { n: 0, value: 0 };
    byUser.set(d.user, { n: cur.n + 1, value: cur.value + d.value });
  }

  console.log(`${APPLY ? 'DELETING' : 'DRY RUN — would delete'} ${toDelete.length} duplicate row(s):\n`);
  for (const [u, v] of byUser) {
    console.log(`  ${u.padEnd(32)} ${v.n} row(s), removing $${Math.round(v.value).toLocaleString()} of double-counted value`);
  }
  console.log('\n  detail:');
  for (const d of toDelete) console.log(`    ${d.user.padEnd(30)} "${d.ticker}" $${Math.round(d.value).toLocaleString()}`);

  if (!APPLY) { console.log('\nRe-run with --apply to delete.'); return; }

  const ids = toDelete.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await db.from('holdings').delete().in('id', ids.slice(i, i + 100));
    if (error) console.error('delete failed:', error.message);
  }
  console.log(`\nDeleted ${ids.length} row(s).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
