/**
 * Debug Environment Variables
 * Run this to see what env variables are being loaded
 */

import { config } from 'dotenv';
import path from 'path';

// Try loading .env.local
const result = config({ path: '.env.local' });

console.log('🔍 Environment Variable Debug\n');

if (result.error) {
  console.error('❌ Error loading .env.local:', result.error);
} else {
  console.log('✅ .env.local file found and loaded\n');
}

console.log('📍 Current working directory:', process.cwd());
console.log('📍 .env.local path:', path.resolve('.env.local'));
console.log('\n📊 Environment variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set');

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log('\n🔗 URL value:', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('🔑 Anon key (first 20 chars):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...');
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('🔑 Service key (first 20 chars):', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');
}
