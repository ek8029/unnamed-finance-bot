/**
 * Verify the research engine's DETERMINISTIC numbers on a real book before any
 * of it ships: portfolio brief, tax context, and value ledger. One wrong number
 * kills trust, so eyeball these against reality.
 *
 * Usage: npx tsx scripts/probe-research-ledger.ts <email>
 * (email via argv only — never hardcode a real address in this public repo.)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getPortfolioBrief, getTaxContext, getValueLedger } from '@/lib/research/account';

async function main() {
  const email = (process.argv[2] ?? '').toLowerCase();
  if (!email) return console.log('Usage: npx tsx scripts/probe-research-ledger.ts <email>');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (!profile) return console.log(`No account for ${email}`);
  const userId = profile.id as string;

  console.log(`\n=== ${profile.email} ===`);

  const brief = await getPortfolioBrief(db, userId);
  if (!brief) {
    console.log('No holdings.');
    return;
  }
  console.log(
    `\nBOOK: $${Math.round(brief.totalValue).toLocaleString()} value | ` +
      `$${Math.round(brief.totalCostBasis).toLocaleString()} cost | ` +
      `${brief.totalUnrealized >= 0 ? '+' : ''}$${Math.round(brief.totalUnrealized).toLocaleString()} unrealized | ` +
      `${brief.positionCount} positions`,
  );
  console.log('\nTOP 8 HOLDINGS:');
  for (const h of brief.holdings.slice(0, 8)) {
    console.log(
      `  ${h.ticker.padEnd(8)} $${Math.round(h.value).toLocaleString().padStart(10)} ` +
        `${h.pct.toFixed(1).padStart(5)}%  ` +
        `unreal ${h.unrealizedGainLoss != null ? (h.unrealizedGainLoss >= 0 ? '+' : '') + '$' + Math.round(h.unrealizedGainLoss).toLocaleString() : 'n/a'}  ` +
        `[${h.sector ?? 'Unclassified'}]`,
    );
  }
  const losers = brief.holdings.filter((h) => (h.unrealizedGainLoss ?? 0) < 0);
  console.log(`\nLOSERS: ${losers.length} positions in the red`);

  console.log('\nSECTOR ALLOCATION:');
  for (const s of brief.sectorAllocation.filter((s) => s.pct >= 1)) {
    console.log(`  ${s.sector.padEnd(24)} ${s.pct.toFixed(1)}%`);
  }

  console.log('\nTAX CONTEXT:');
  const tax = await getTaxContext(db, userId, brief, new Date().getFullYear());
  console.log(tax || '  (none)');

  console.log('\nVALUE LEDGER:');
  const ledger = await getValueLedger(db, userId, brief);
  console.log(`  SURFACED TOTAL: $${ledger.surfacedTotal.toLocaleString()}`);
  for (const l of ledger.lines) {
    console.log(`  [${l.kind}] ${l.label}: $${l.amount.toLocaleString()}${l.detail ? ` (${l.detail})` : ''}`);
  }
  console.log('');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
