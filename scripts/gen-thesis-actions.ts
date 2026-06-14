/**
 * Run the reasoned-actions pipeline locally against PRODUCTION Supabase, for the
 * demo owner (the user with the most tracked theses). Writes grounded, non-
 * discretionary actions into `insights` so they show in the Actions Inbox and in
 * each thesis view. No deploy, no public surface.
 *
 * Run:  npx tsx scripts/gen-thesis-actions.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Resolve demo owner = user with the most tracked theses.
  const { data: theses } = await sb.from('theses').select('user_id').eq('tracked', true);
  const counts = new Map<string, number>();
  for (const t of theses ?? []) counts.set(t.user_id, (counts.get(t.user_id) ?? 0) + 1);
  const owner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!owner) {
    console.error('No tracked theses found.');
    process.exit(1);
  }

  const { generateThesisActions } = await import('../lib/thesis-actions');
  const { generated, actions } = await generateThesisActions(sb, owner);

  console.log(`owner=${owner.slice(0, 8)} generated=${generated}`);
  for (const a of actions) {
    console.log(`\n[${a.priority}] ${a.kind} :: ${a.title}`);
    console.log(`  ${a.description}`);
    console.log(`  > ${a.recommendedAction}`);
    if (a.estimatedImpact != null) console.log(`  ~impact: $${a.estimatedImpact}`);
    console.log(`  grounding: ${a.explanation}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
