/**
 * End-to-end Watch My Tickers: subscribe -> confirm -> digest, against the real
 * table and real Resend. Sends BOTH emails to the address given.
 * Run: npx tsx scripts/e2e-watch.ts evank8029@gmail.com
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const email = (process.argv[2] ?? 'evank8029@gmail.com').toLowerCase();
  const { subscribeWatch, sendWatchDigests } = await import('../lib/watch');

  console.log('1. subscribe (sends the confirm email)…');
  const sub = await subscribeWatch(email, ['NVDA', 'AMD', 'AMZN']);
  console.log('   subscribe:', JSON.stringify(sub));
  if (!sub.ok) process.exit(1);

  // Confirm directly (the emailed link works too and stays valid).
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: row } = await sb.from('watch_subscriptions').select('id, confirm_token, confirmed_at').ilike('email', email).maybeSingle();
  if (!row) { console.error('no row'); process.exit(1); }
  if (!row.confirmed_at) {
    await sb.from('watch_subscriptions').update({ confirmed_at: new Date().toISOString() }).eq('id', row.id);
    console.log('2. confirmed (simulated click).');
  } else {
    console.log('2. already confirmed.');
  }

  console.log('3. digest run…');
  const res = await sendWatchDigests();
  console.log('   digest:', JSON.stringify(res));
}
main().catch((e) => { console.error(e); process.exit(1); });
