// One-off: grant a 14-day Pro trial to specific users (pre-trial-feature connectors).
// Requires migration 049 (user_subscriptions.trial_ends_at) applied first.
// Run: npx tsx scripts/grant-trial.ts <email> [email...]
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const emails = process.argv.slice(2).map((e) => e.toLowerCase());
  if (!emails.length) { console.error('usage: npx tsx scripts/grant-trial.ts <email> [email...]'); process.exit(1); }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });

  for (const email of emails) {
    const u = users?.users.find((x) => x.email?.toLowerCase() === email);
    if (!u) { console.log(`SKIP ${email}: no user`); continue; }

    const { data: sub, error: readErr } = await sb
      .from('user_subscriptions')
      .select('tier, trial_ends_at, stripe_subscription_id')
      .eq('user_id', u.id)
      .maybeSingle();
    if (readErr) { console.log(`SKIP ${email}: read failed (${readErr.message}) — migration 049 applied?`); continue; }
    if (sub && sub.tier !== 'free') { console.log(`SKIP ${email}: already tier=${sub.tier}`); continue; }
    if (sub?.trial_ends_at) { console.log(`SKIP ${email}: already trialed (ends ${sub.trial_ends_at})`); continue; }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await sb
      .from('user_subscriptions')
      .upsert({ user_id: u.id, tier: 'pro', trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    console.log(error ? `FAIL ${email}: ${error.message}` : `OK   ${email}: Pro until ${trialEndsAt.slice(0, 10)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
