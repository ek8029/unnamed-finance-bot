// Price history for suspicious tickers — is the feed flapping?
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const TICKERS = ['MU', 'AMD', 'SNDK', 'WDC', 'MSFT', 'NVDA'];

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // discover columns
  const { data: sample } = await sb.from('market_prices').select('*').limit(1);
  console.log('market_prices columns:', sample?.[0] ? Object.keys(sample[0]).join(', ') : 'empty');

  for (const t of TICKERS) {
    const { data } = await sb
      .from('market_prices')
      .select('*')
      .eq('ticker', t)
      .order('price_date', { ascending: false })
      .limit(8);
    if (!data?.length) { console.log(`${t}: no rows`); continue; }
    const line = data.map((r) => `${String(r.price_date).slice(5)}=${r.close ?? '?'}`).join('  ');
    console.log(`${t}: ${line}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
