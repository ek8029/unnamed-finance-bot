// Concrete portfolio facts for outreach emails: top positions, concentration,
// unrealized-loss candidates. Run: npx tsx scripts/probe-outreach-facts.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Usage: npx tsx scripts/probe-outreach-facts.ts <email> [email...]
const EMAILS = process.argv.slice(2);

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });

  for (const email of EMAILS) {
    const u = users?.users.find((x) => x.email?.toLowerCase() === email);
    if (!u) { console.log(`${email}: no user`); continue; }
    const { data: hs } = await sb
      .from('holdings')
      .select('ticker, total_value, unrealised_gain_loss, portfolio_allocation_pct')
      .eq('user_id', u.id);
    if (!hs?.length) { console.log(`${email}: no holdings`); continue; }

    const book = hs.reduce((s, h) => s + (Number(h.total_value) || 0), 0);
    const sorted = [...hs].sort((a, b) => (Number(b.total_value) || 0) - (Number(a.total_value) || 0));
    const top3 = sorted.slice(0, 3).map((h) => `${h.ticker} $${Math.round(Number(h.total_value)).toLocaleString()} (${((Number(h.total_value) / book) * 100).toFixed(1)}%)`);
    const losers = hs.filter((h) => Number(h.unrealised_gain_loss) < 0);
    const lossTotal = losers.reduce((s, h) => s + Number(h.unrealised_gain_loss), 0);
    const big = sorted[0];
    console.log(`${email}`);
    console.log(`  positions ${hs.length} | book $${Math.round(book).toLocaleString()}`);
    console.log(`  top3: ${top3.join(' | ')}`);
    console.log(`  concentration: top position ${((Number(big.total_value) / book) * 100).toFixed(1)}% (${big.ticker})`);
    console.log(`  unrealized losses: ${losers.length} positions, $${Math.round(Math.abs(lossTotal)).toLocaleString()} total\n`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
