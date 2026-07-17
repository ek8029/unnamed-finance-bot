import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function main() {
  const { error, count } = await db.from('watch_subscriptions').select('id', { count: 'exact', head: true });
  console.log(error ? `TABLE MISSING: ${error.message}` : `table exists, ${count} rows`);
}
main();
