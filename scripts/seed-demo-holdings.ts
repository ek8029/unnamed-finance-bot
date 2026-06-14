/**
 * Seed demo PORTFOLIO holdings for the demo theses tickers that are tracked but
 * not yet held (PLTR, LULU, EMBC, PRIM). Closes the demo-holdings gap so each
 * thesis maps to a real position and the reasoned-actions pipeline can produce a
 * tax-loss-harvest action on the broken PRIM thesis (it is at a real loss).
 *
 * Prices are REAL (market_prices latest close, else Finazon). Share counts and
 * cost basis are demo values chosen to be plausible (a pre-crash PRIM buyer is
 * underwater; PLTR is up). This seeds DEMO POSITIONS only; it fabricates no
 * evidence and touches no thesis scoring.
 *
 * Run:  npx tsx scripts/seed-demo-holdings.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

interface Plan {
  ticker: string;
  name: string;
  shares: number;
  // multiplier on current price to derive average cost basis (>1 = at a loss)
  costMult: number;
}

// Demo intent: PRIM underwater (broken thesis -> harvest_loss), LULU/EMBC mild
// losses (weakening), PLTR up (gain).
const PLANS: Record<string, Plan> = {
  PRIM: { ticker: 'PRIM', name: 'Primoris Services Corporation', shares: 60, costMult: 1.402 }, // ~143 cost vs ~102 now
  LULU: { ticker: 'LULU', name: 'Lululemon Athletica Inc.', shares: 0, costMult: 1.2 },
  EMBC: { ticker: 'EMBC', name: 'Embecta Corp.', shares: 0, costMult: 1.15 },
  PLTR: { ticker: 'PLTR', name: 'Palantir Technologies Inc.', shares: 0, costMult: 0.55 },
};
// Target position dollar size when shares aren't pinned (PRIM is pinned at 60).
const TARGET_VALUE: Record<string, number> = { LULU: 9000, EMBC: 4000, PLTR: 12000 };

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { getHistoricalPrices } = await import('../lib/finazon');

  // Owner = user with the most tracked theses.
  const { data: theses } = await sb.from('theses').select('user_id, ticker').eq('tracked', true);
  const counts = new Map<string, number>();
  for (const t of theses ?? []) counts.set(t.user_id, (counts.get(t.user_id) ?? 0) + 1);
  const owner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const thesisTickers = [...new Set((theses ?? []).filter((t) => t.user_id === owner).map((t) => t.ticker.toUpperCase()))];

  // Existing holdings + a valid account_id to attach to.
  const { data: holdings } = await sb.from('holdings').select('ticker, account_id').eq('user_id', owner);
  const held = new Set((holdings ?? []).map((h) => h.ticker.toUpperCase()));
  const accountId = (holdings ?? [])[0]?.account_id as string | undefined;
  if (!accountId) { console.error('No existing holding/account to attach to.'); process.exit(1); }

  const diff = thesisTickers.filter((t) => !held.has(t));
  console.log(`owner=${owner.slice(0, 8)} account=${accountId.slice(0, 8)} diff=${diff.join(', ')}`);

  async function currentPrice(ticker: string): Promise<number | null> {
    const { data: px } = await sb
      .from('market_prices')
      .select('close')
      .ilike('ticker', ticker)
      .order('price_date', { ascending: false })
      .limit(1);
    if (px?.[0]?.close != null) return Number(px[0].close);
    const hist = await getHistoricalPrices(ticker, '2026-04-01', '2026-06-14');
    if (hist.length === 0) return null;
    return hist.sort((a, b) => a.date.localeCompare(b.date))[hist.length - 1].close;
  }

  async function securityId(ticker: string, name: string): Promise<string | null> {
    const { data: sec } = await sb.from('securities').select('id').ilike('ticker', ticker).limit(1);
    if (sec?.[0]?.id) return sec[0].id as string;
    const { data: ins, error } = await sb
      .from('securities')
      .insert({ ticker, security_name: name, asset_class: 'equity' })
      .select('id')
      .maybeSingle();
    if (error) { console.error(`securities insert ${ticker}:`, error.message); return null; }
    return ins?.id as string;
  }

  for (const ticker of diff) {
    const plan = PLANS[ticker];
    if (!plan) { console.log(`  ${ticker}: no plan, skipping`); continue; }

    const price = await currentPrice(ticker);
    if (price == null) { console.log(`  ${ticker}: no price, skipping`); continue; }
    const secId = await securityId(ticker, plan.name);
    if (!secId) { console.log(`  ${ticker}: no security, skipping`); continue; }

    const shares = plan.shares > 0 ? plan.shares : Math.max(1, Math.round((TARGET_VALUE[ticker] ?? 5000) / price));
    const avgCost = Math.round(price * plan.costMult * 100) / 100;
    const totalValue = Math.round(shares * price * 100) / 100;
    const totalCost = Math.round(shares * avgCost * 100) / 100;
    const ugl = Math.round((totalValue - totalCost) * 100) / 100;
    const uglPct = Math.round((ugl / totalCost) * 10000) / 100;

    const { error } = await sb.from('holdings').upsert(
      {
        user_id: owner,
        account_id: accountId,
        security_id: secId,
        ticker,
        shares,
        average_cost_basis: avgCost,
        total_cost_basis: totalCost,
        current_price: price,
        total_value: totalValue,
        unrealised_gain_loss: ugl,
        unrealised_gain_loss_pct: uglPct,
        day_change_pct: 0,
        last_updated_at: '2026-06-14T12:00:00Z',
      },
      { onConflict: 'user_id,account_id,security_id' },
    );
    if (error) { console.error(`  ${ticker} upsert error:`, error.message); continue; }
    console.log(`  ${ticker}: ${shares} sh @ ${price} (cost ${avgCost}) value=${totalValue} ugl=${ugl} (${uglPct}%)`);
  }

  // Recompute portfolio_allocation_pct across ALL of the owner's holdings.
  const { data: all } = await sb.from('holdings').select('id, total_value').eq('user_id', owner);
  const total = (all ?? []).reduce((s, h) => s + Number(h.total_value), 0);
  if (total > 0) {
    for (const h of all ?? []) {
      const pct = Math.round((Number(h.total_value) / total) * 10000) / 100;
      await sb.from('holdings').update({ portfolio_allocation_pct: pct }).eq('id', h.id);
    }
    console.log(`recomputed allocation across ${all?.length} holdings (book total ~$${Math.round(total).toLocaleString()})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
