/**
 * Export active users as a Resend-ready CSV (email,first_name,last_name).
 * "Active" = signed in within the last N days (default 45). Excludes internal/demo
 * accounts. Import the CSV into a Resend Audience for the weekly founder update.
 *
 * Run: npx tsx scripts/export-active-users.ts [days=45]
 * Output: C:\Users\Evan\Desktop\helm-active-users.csv
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const DAYS = Number(process.argv[2] || 45);
const OUT = 'C:\\Users\\Evan\\Desktop\\helm-active-users.csv';
// Internal / demo accounts to keep off the newsletter.
const EXCLUDE = new Set([
  'evank8029@gmail.com',
  'helmterminal@gmail.com',
  'test@helmterminal.dev',
]);

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // All auth users (paginate).
  const users: any[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000, page });
    if (error) { console.error('listUsers:', error.message); process.exit(1); }
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }

  // Names from user_profiles.
  const { data: profiles } = await sb.from('user_profiles').select('id, full_name');
  const nameById = new Map((profiles ?? []).map((p) => [p.id, (p.full_name ?? '').trim()]));

  const cutoff = Date.now() - DAYS * 86400_000;
  const rows: { email: string; first: string; last: string; seen: string }[] = [];
  let dormant = 0, excluded = 0, noEmail = 0;

  for (const u of users) {
    const email = (u.email ?? '').toLowerCase();
    if (!email) { noEmail++; continue; }
    if (EXCLUDE.has(email)) { excluded++; continue; }
    const seen = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    if (seen < cutoff) { dormant++; continue; }
    const full = nameById.get(u.id) || (u.user_metadata?.full_name ?? '') || '';
    const parts = String(full).split(/\s+/).filter(Boolean);
    rows.push({
      email,
      first: parts[0] ?? '',
      last: parts.slice(1).join(' '),
      seen: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString().slice(0, 10) : '',
    });
  }

  rows.sort((a, b) => b.seen.localeCompare(a.seen));

  const csv = ['email,first_name,last_name']
    .concat(rows.map((r) => `${r.email},${r.first},${r.last}`))
    .join('\n');
  writeFileSync(OUT, csv + '\n', 'utf8');

  console.log(`Total auth users: ${users.length}`);
  console.log(`Active (signed in <= ${DAYS}d): ${rows.length}`);
  console.log(`Dormant (excluded): ${dormant} | internal excluded: ${excluded} | no email: ${noEmail}`);
  console.log(`\nCSV written: ${OUT}\n`);
  console.log('active list (email · last seen):');
  for (const r of rows) console.log(`  ${r.email.padEnd(34)} ${r.seen}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
