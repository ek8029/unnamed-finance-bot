// Ben's snapshot series + top holdings — is the swing real or a data artifact?
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const ben = users?.users.find((u) => u.email === 'benjaminlpittman@gmail.com');
  if (!ben) return;

  const { data: snaps } = await sb
    .from('portfolio_snapshots')
    .select('snapshot_date, total_value, total_cost_basis, total_gain_loss')
    .eq('user_id', ben.id)
    .order('snapshot_date', { ascending: true });
  console.log('date        total_value   cost_basis    gain_loss');
  for (const s of snaps ?? []) {
    console.log(
      `${s.snapshot_date}  ${String(Math.round(Number(s.total_value ?? 0)).toLocaleString()).padStart(11)}  ${String(Math.round(Number(s.total_cost_basis ?? 0)).toLocaleString()).padStart(11)}  ${String(Math.round(Number(s.total_gain_loss ?? 0)).toLocaleString()).padStart(11)}`,
    );
  }

  const { data: hs } = await sb
    .from('holdings')
    .select('ticker, total_value, current_price, last_updated_at')
    .eq('user_id', ben.id)
    .order('total_value', { ascending: false });
  console.log('\ntop 10 holdings:');
  for (const h of (hs ?? []).slice(0, 10)) {
    console.log(`  ${h.ticker}  $${Math.round(Number(h.total_value)).toLocaleString()}  px=${h.current_price}  updated=${String(h.last_updated_at).slice(0, 10)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
