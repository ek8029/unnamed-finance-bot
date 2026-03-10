/**
 * Auto-verify a Supabase auth user by UUID
 * Usage: tsx scripts/verify-user.ts <uuid>
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: tsx scripts/verify-user.ts <uuid>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log(`Verifying user ${userId}...`);

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    console.error('Failed to verify user:', error.message);
    process.exit(1);
  }

  console.log(`Verified: ${data.user.email} (${data.user.id})`);
  console.log(`email_confirmed_at: ${data.user.email_confirmed_at}`);
}

main();
