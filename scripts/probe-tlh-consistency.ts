/** Compute the unified TLH number for an account from raw DB inputs.
 *  Run: npx tsx scripts/probe-tlh-consistency.ts [email] */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { estimateCappedTlhSavings } from '../lib/tax-analysis';

async function main() {
  const email = (process.argv[2] ?? 'test@helmterminal.dev').toLowerCase();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const uid = users.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id;
  if (!uid) throw new Error('no user');

  const { data: holdings } = await sb.from('holdings').select('ticker, unrealised_gain_loss, acquired_at').eq('user_id', uid);
  const { data: gains } = await sb.from('capital_gains').select('gain_loss, gain_loss_type').eq('user_id', uid).eq('tax_year', new Date().getFullYear()).eq('transaction_type', 'sell');

  let stG = 0, ltG = 0;
  for (const g of gains ?? []) {
    if (g.gain_loss_type === 'short_term') stG += Number(g.gain_loss || 0);
    else ltG += Number(g.gain_loss || 0);
  }
  const yearAgo = Date.now() - 365.25 * 86400000;
  let stL = 0, ltL = 0, uL = 0;
  for (const h of holdings ?? []) {
    const gl = Number(h.unrealised_gain_loss ?? 0);
    if (gl >= 0) continue;
    const l = Math.abs(gl);
    if (!h.acquired_at) uL += l;
    else if (new Date(h.acquired_at).getTime() > yearAgo) stL += l;
    else ltL += l;
  }
  console.log(`inputs: stLoss=${stL.toFixed(0)} ltLoss=${ltL.toFixed(0)} unknown=${uL.toFixed(0)} stGainYtd=${stG.toFixed(0)} ltGainYtd=${ltG.toFixed(0)}`);
  const full = estimateCappedTlhSavings({ stLoss: stL, ltLoss: ltL, unknownLoss: uL, stGainYtd: stG, ltGainYtd: ltG });
  const cron = estimateCappedTlhSavings({ unknownLoss: stL + ltL + uL, stGainYtd: stG, ltGainYtd: ltG });
  console.log('tax-center (character-aware):', JSON.stringify(full));
  console.log('cron surfaces (unknown-loss): ', JSON.stringify(cron));
}
main().catch((e) => { console.error(e); process.exit(1); });
