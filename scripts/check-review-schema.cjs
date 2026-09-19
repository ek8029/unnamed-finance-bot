// Read-only rollout check. Never print account identifiers or credentials.
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  for (const [table, columns] of [
    ['user_subscriptions', 'user_id,source,store_product_id,permanent_access,updated_at'],
    ['user_ai_consents', 'user_id,version,granted_at,revoked_at'],
    ['user_preferences', 'user_id,analytics_enabled,crash_reporting_enabled'],
    ['push_tokens', 'user_id,token,disabled_at'],
  ]) {
    const { error } = await db.from(table).select(columns).limit(0);
    console.log(JSON.stringify({ table, readable: !error, error: error?.message }));
  }
  const { count, error } = await db.from('user_subscriptions').select('user_id', { count: 'exact', head: true })
    .is('permanent_access', null).in('tier', ['pro', 'max']).eq('source', 'stripe')
    .is('stripe_subscription_id', null).or('billing_period.eq.lifetime,trial_ends_at.is.null');
  console.log(JSON.stringify({ migration076BackfillCount: count, error: error?.message }));
})().catch(() => { console.error('Schema check could not connect'); process.exitCode = 1; });
