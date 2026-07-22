// Honor Brett's intent (he clicked every notification toggle off): stop all
// marketing/digest email to his account. Sets the daily-brief + market-alert
// prefs to false. REQUIRES migration 050 (notification_daily_brief) applied.
// Run: npx tsx scripts/suppress-brett-emails.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Usage: npx tsx scripts/suppress-brett-emails.ts <email>
const EMAIL = process.argv[2] ?? '';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const u = users?.users.find((x) => x.email?.toLowerCase() === EMAIL);
  if (!u) { console.error('no user for', EMAIL); process.exit(1); }

  const { error } = await sb
    .from('user_preferences')
    .upsert(
      {
        user_id: u.id,
        notification_daily_brief: false,
        notification_market_alerts: false,
        notification_email: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('FAILED:', error.message);
    if (/notification_daily_brief/.test(error.message)) {
      console.error('→ migration 050 not applied yet. Apply it, then rerun.');
    }
    process.exit(1);
  }

  const { data: check } = await sb
    .from('user_preferences')
    .select('notification_daily_brief, notification_market_alerts, notification_email')
    .eq('user_id', u.id)
    .maybeSingle();
  console.log('OK — Brett prefs now:', JSON.stringify(check));
}
main().catch((e) => { console.error(e); process.exit(1); });
