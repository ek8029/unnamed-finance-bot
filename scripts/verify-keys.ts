/**
 * Verify API Keys Format
 * Shows key format to help debug issues
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 API Key Verification\n');

console.log('URL:');
console.log('  Value:', url);
console.log('  Length:', url?.length || 0);
console.log('  Has whitespace:', url ? /\s/.test(url) : false);
console.log('');

console.log('Anon Key:');
console.log('  First 10 chars:', anonKey?.substring(0, 10));
console.log('  Last 10 chars:', anonKey?.substring(anonKey.length - 10));
console.log('  Length:', anonKey?.length || 0);
console.log('  Has whitespace:', anonKey ? /\s/.test(anonKey) : false);
console.log('');

console.log('Service Role Key:');
console.log('  First 10 chars:', serviceKey?.substring(0, 10));
console.log('  Last 10 chars:', serviceKey?.substring(serviceKey.length - 10));
console.log('  Length:', serviceKey?.length || 0);
console.log('  Has whitespace:', serviceKey ? /\s/.test(serviceKey) : false);
console.log('');

// Check for common issues
const issues = [];

if (url && url.includes(' ')) issues.push('⚠️  URL contains spaces');
if (anonKey && anonKey.includes(' ')) issues.push('⚠️  Anon key contains spaces');
if (serviceKey && serviceKey.includes(' ')) issues.push('⚠️  Service key contains spaces');

if (url && !url.startsWith('https://')) issues.push('⚠️  URL should start with https://');
if (url && !url.includes('supabase.co')) issues.push('⚠️  URL should contain supabase.co');

if (issues.length > 0) {
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log('  ' + issue));
} else {
  console.log('✅ No formatting issues detected');
  console.log('💡 If still getting "Invalid API key", double-check you copied the correct keys from Supabase Dashboard');
}
