import { config } from 'dotenv'; config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { isHarvestableLoss } from '../lib/tax-analysis';
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  // Usage: npx tsx scripts/verify-tlh-fix.ts <email> [email...]
  for (const email of process.argv.slice(2)) {
    const u = users?.users.find(x => x.email?.toLowerCase() === email); if (!u) continue;
    const { data: hs } = await sb.from('holdings').select('ticker, unrealised_gain_loss, total_value, account:linked_accounts(account_name, account_subtype)').eq('user_id', u.id);
    let oldPool = 0, newPool = 0, retirementExcluded = 0, unpricedExcluded = 0;
    for (const h of hs ?? []) {
      const ugl = h.unrealised_gain_loss != null ? Number(h.unrealised_gain_loss) : null;
      if (ugl != null && ugl < 0) oldPool += Math.abs(ugl);
      const acct = (h.account ?? null) as any;
      if (isHarvestableLoss({ unrealised_gain_loss: ugl, total_value: h.total_value == null ? null : Number(h.total_value) }, acct)) newPool += Math.abs(ugl as number);
      else if (ugl != null && ugl < 0) { if (Number(h.total_value) <= 0) unpricedExcluded += Math.abs(ugl); else retirementExcluded += Math.abs(ugl); }
    }
    console.log(`${email}\n  OLD pool (all losses): $${Math.round(oldPool).toLocaleString()}  ->  NEW harvestable: $${Math.round(newPool).toLocaleString()}`);
    console.log(`  excluded: retirement $${Math.round(retirementExcluded).toLocaleString()}, unpriced $${Math.round(unpricedExcluded).toLocaleString()}`);
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
