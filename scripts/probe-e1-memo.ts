/** Live local test of the E1 investigation agent: run it directly against a
 *  real weakening/broken pillar (evank8029's PLTR government pillar) and print
 *  the memo. Safe: caps, receipts-or-drop, and migration tolerance all apply. */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { runInvestigation, classifyTrigger } from '../lib/investigation-memo';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const evan = users.users.find((u) => u.email === 'evank8029@gmail.com');
  if (!evan) { console.log('no user'); return; }

  const { data: thesis } = await db.from('theses').select('id, ticker').eq('user_id', evan.id).eq('ticker', 'PLTR').maybeSingle();
  if (!thesis) { console.log('no PLTR thesis'); return; }

  const { data: pillars } = await db
    .from('thesis_pillars')
    .select('id, claim, breaks_if, status, status_override')
    .eq('thesis_id', thesis.id)
    .eq('confirmed', true);
  const target = (pillars ?? []).find((p) => (p.status_override ?? p.status) === 'weakening' || (p.status_override ?? p.status) === 'broken')
    ?? (pillars ?? [])[0];
  if (!target) { console.log('no pillar'); return; }
  console.log('pillar:', target.claim, '| status:', target.status);

  const { data: ev } = await db
    .from('pillar_evidence')
    .select('source_type, verdict')
    .eq('pillar_id', target.id);
  const kind = classifyTrigger((ev ?? []) as { source_type: string; verdict: string }[]);
  console.log('trigger kind:', kind);

  const log: string[] = [];
  const id = await runInvestigation(db, openai, {
    userId: evan.id,
    thesisId: thesis.id,
    pillarId: target.id,
    ticker: thesis.ticker,
    pillarClaim: target.claim,
    breaksIf: (target.breaks_if as string | null) ?? null,
    newStatus: (target.status === 'broken' ? 'broken' : 'weakening'),
    triggerKind: kind,
  }, log);

  console.log('\n--- log ---');
  for (const l of log) console.log(l);
  console.log('\nmemo id:', id);

  if (id) {
    const { data: memo } = await db.from('thesis_investigations').select('memo, model, trigger_kind').eq('id', id).maybeSingle();
    console.log('\n--- MEMO ---');
    console.log(JSON.stringify(memo, null, 2));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
