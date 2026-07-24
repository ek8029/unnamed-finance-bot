/**
 * How much performance history do we actually have? Snapshot density per real
 * user, date range, and whether holdings_snapshot is populated (needed to
 * detect contribution days for an honest return calc).
 *
 * Usage: npx tsx scripts/probe-snapshots.ts <email> [email2 ...]
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const emails = process.argv.slice(2).map((e) => e.toLowerCase());
  if (!emails.length) return console.log('Usage: npx tsx scripts/probe-snapshots.ts <email> [...]');

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  for (const email of emails) {
    const { data: profile } = await db.from('user_profiles').select('id, email').eq('email', email).maybeSingle();
    if (!profile) {
      console.log(`\n${email}: no account`);
      continue;
    }
    const { data: snaps } = await db
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value, total_cost_basis, holdings_snapshot')
      .eq('user_id', profile.id)
      .order('snapshot_date', { ascending: true });
    const rows = snaps ?? [];
    console.log(`\n=== ${email} ===`);
    if (!rows.length) {
      console.log('  0 snapshots');
      continue;
    }
    const withHoldings = rows.filter((r) => Array.isArray(r.holdings_snapshot) && (r.holdings_snapshot as unknown[]).length > 0).length;
    console.log(`  ${rows.length} snapshots, ${rows[0].snapshot_date} -> ${rows[rows.length - 1].snapshot_date}`);
    console.log(`  holdings_snapshot populated on ${withHoldings}/${rows.length}`);
    // gaps > 3 days
    let gaps = 0;
    for (let i = 1; i < rows.length; i++) {
      const d = (new Date(rows[i].snapshot_date as string).getTime() - new Date(rows[i - 1].snapshot_date as string).getTime()) / 86400000;
      if (d > 3) gaps++;
    }
    console.log(`  gaps >3d: ${gaps}`);
    console.log(`  first $${Math.round(Number(rows[0].total_value)).toLocaleString()} -> last $${Math.round(Number(rows[rows.length - 1].total_value)).toLocaleString()}`);
    // biggest single-day value jumps (likely contributions, not returns)
    const jumps = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = Number(rows[i - 1].total_value);
      const cur = Number(rows[i].total_value);
      if (prev > 0) jumps.push({ date: rows[i].snapshot_date, pct: ((cur - prev) / prev) * 100 });
    }
    jumps.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    console.log('  biggest day moves:', jumps.slice(0, 5).map((j) => `${j.date} ${j.pct >= 0 ? '+' : ''}${j.pct.toFixed(1)}%`).join(', '));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
