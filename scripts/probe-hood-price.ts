// HOOD price freshness across securities + market_prices.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: sec, error: e1 } = await sb.from('securities').select('*').eq('ticker', 'HOOD').maybeSingle();
  if (e1) console.log('securities err:', e1.message);
  console.log('securities HOOD:', JSON.stringify(sec, null, 1));
  const { data: mp } = await sb.from('market_prices').select('price_date, close').eq('ticker', 'HOOD').order('price_date', { ascending: false }).limit(5);
  console.log('market_prices HOOD (latest 5):', JSON.stringify(mp));
}
main().catch((e) => { console.error(e); process.exit(1); });
