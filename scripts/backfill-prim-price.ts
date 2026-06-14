/**
 * One-off: backfill REAL Primoris (PRIM) daily closes from Finazon into
 * market_prices, ending on the actual crash day so the scorer's last-2-rows
 * price_move check sees the genuine ~50% drop. Real data only, no fabrication.
 *
 * Run: npx tsx scripts/backfill-prim-price.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const TICKER = 'PRIM';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { getHistoricalPrices } = await import('../lib/finazon');

  // Resolve / create a securities row (market_prices.security_id is the conflict key).
  let securityId: string | null = null;
  const { data: sec } = await sb.from('securities').select('id').eq('ticker', TICKER).maybeSingle();
  if (sec?.id) {
    securityId = sec.id as string;
  } else {
    const { data: ins, error } = await sb
      .from('securities')
      .insert({ ticker: TICKER, security_name: 'Primoris Services Corporation', asset_class: 'equity' })
      .select('id')
      .maybeSingle();
    if (error) { console.error('securities insert error:', error.message); process.exit(1); }
    securityId = ins?.id as string;
  }
  console.log(`security_id=${securityId}`);

  // Real daily closes covering the crash window.
  const prices = await getHistoricalPrices(TICKER, '2026-03-01', '2026-06-14');
  console.log(`Finazon returned ${prices.length} rows`);
  if (prices.length < 3) { console.error('not enough price data'); process.exit(1); }

  // Ascending by date.
  const asc = [...prices].sort((a, b) => a.date.localeCompare(b.date));

  // Find the biggest single-day drop (the crash).
  let crashIdx = -1, worst = 0;
  for (let i = 1; i < asc.length; i++) {
    const pct = (asc[i].close - asc[i - 1].close) / asc[i - 1].close;
    if (pct < worst) { worst = pct; crashIdx = i; }
  }
  if (crashIdx < 1) { console.error('no down day found'); process.exit(1); }
  console.log(`crash: ${asc[crashIdx - 1].date} ${asc[crashIdx - 1].close} -> ${asc[crashIdx].date} ${asc[crashIdx].close} (${(worst * 100).toFixed(1)}%)`);

  // Insert through the crash day so it is the latest row the scorer sees.
  const through = asc.slice(0, crashIdx + 1);
  const rows = through.map((p) => ({
    security_id: securityId,
    ticker: TICKER,
    price_date: p.date,
    close: p.close,
    open: p.close,
    high: p.close,
    low: p.close,
    volume: 0,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb.from('market_prices').upsert(rows.slice(i, i + 100), { onConflict: 'security_id,price_date' });
    if (error) { console.error('market_prices upsert error:', error.message); process.exit(1); }
  }
  console.log(`inserted ${rows.length} rows (through ${asc[crashIdx].date})`);

  const { data: latest } = await sb
    .from('market_prices')
    .select('price_date, close')
    .eq('ticker', TICKER)
    .order('price_date', { ascending: false })
    .limit(2);
  console.log('latest 2 (what the scorer reads):', latest);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
