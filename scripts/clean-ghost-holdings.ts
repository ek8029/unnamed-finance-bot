/** Remove zero-share "ghost" holdings left by earlier syncs.
 *
 *  These render in the positions list but carry no value, so they are excluded
 *  from exposure, allocation and concentration. That mismatch is what Ben
 *  reported. plaid-sync no longer writes them and now clears them on each run,
 *  so this is a one-off catch-up for books that have not synced since the fix.
 *
 *  Negative share counts are SHORT positions and are never touched.
 *  Nothing is lost: if the brokerage still reports the position, the next sync
 *  recreates it with the correct quantity.
 *
 *  Dry run:  npx tsx --env-file=.env.local scripts/clean-ghost-holdings.ts
 *  Apply:    npx tsx --env-file=.env.local scripts/clean-ghost-holdings.ts --apply
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  const email = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  const { data: ghosts, error } = await db
    .from('holdings')
    .select('id, user_id, ticker, shares, total_value')
    .eq('shares', 0);
  if (error) { console.error(error); process.exit(1); }

  if (!ghosts?.length) { console.log('No ghost holdings found.'); return; }

  // Safety: never delete a row that somehow carries value.
  const withValue = ghosts.filter((g) => Math.abs(Number(g.total_value ?? 0)) > 0.01);
  const safe = ghosts.filter((g) => Math.abs(Number(g.total_value ?? 0)) <= 0.01);

  const byUser = new Map<string, string[]>();
  for (const g of safe) {
    const k = String(email.get(g.user_id as string));
    byUser.set(k, [...(byUser.get(k) ?? []), g.ticker]);
  }

  console.log(`${APPLY ? 'DELETING' : 'DRY RUN — would delete'} ${safe.length} zero-share holding(s):\n`);
  for (const [u, tickers] of byUser) {
    console.log(`  ${u} (${tickers.length}): ${tickers.join(', ')}`);
  }
  if (withValue.length) {
    console.log(`\n  SKIPPED ${withValue.length} zero-share row(s) that carry value (needs manual review):`);
    for (const g of withValue) console.log(`    ${email.get(g.user_id as string)} ${g.ticker} value=${g.total_value}`);
  }

  if (!APPLY) { console.log('\nRe-run with --apply to delete.'); return; }

  const ids = safe.map((g) => g.id as string);
  for (let i = 0; i < ids.length; i += 100) {
    const { error: delErr } = await db.from('holdings').delete().in('id', ids.slice(i, i + 100));
    if (delErr) console.error('delete failed:', delErr.message);
  }
  console.log(`\nDeleted ${ids.length} row(s).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
