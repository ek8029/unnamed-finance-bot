/**
 * Dry-run audit: which stored pillar_evidence rows fail the new relevance gate?
 * Flags: (a) hedged connection in why, (b) operational incident filed on a
 * non-operations pillar. Pass --delete to remove flagged rows (default: report only).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { isHedgedConnection, isOperationsPillar, OPERATIONAL_INCIDENT, type EvidenceVerdict } from '../lib/evidence-quality';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DELETE = process.argv.includes('--delete');

interface FlaggedRow {
  id: string;
  user_id: string;
  verdict: EvidenceVerdict;
  materiality: string;
  source_title: string;
  excerpt: string;
  why: string;
  is_backfill: boolean;
  flags: string[];
  ticker: string;
  claim: string;
}

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const emailOf = new Map(users.users.map((u) => [u.id, u.email ?? '?']));

  const PAGE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await db
      .from('pillar_evidence')
      .select('id, user_id, verdict, materiality, source_title, excerpt, why, is_backfill, thesis_pillars(claim, theses(ticker))')
      .range(from, from + PAGE - 1);
    if (error) { console.log('ERR', error.message); return; }
    data.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }

  const flagged: FlaggedRow[] = [];
  let total = 0;

  for (const r of data ?? []) {
    total++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = r.thesis_pillars as any;
    const claim: string = p?.claim ?? '';
    const ticker: string = p?.theses?.ticker ?? '?';
    const flags: string[] = [];
    if (isHedgedConnection(r.why as string, r.verdict as EvidenceVerdict)) flags.push('hedged-why');
    if (OPERATIONAL_INCIDENT.test(`${r.source_title} ${r.excerpt}`) && !isOperationsPillar(claim)) flags.push('ops-incident-on-nonops-pillar');
    if (flags.length) flagged.push({ ...(r as unknown as Omit<FlaggedRow, 'flags' | 'ticker' | 'claim'>), flags, ticker, claim });
  }

  const byUser = new Map<string, FlaggedRow[]>();
  for (const f of flagged) {
    const key = emailOf.get(f.user_id) ?? f.user_id;
    const arr = byUser.get(key) ?? [];
    arr.push(f);
    byUser.set(key, arr);
  }

  console.log(`total evidence rows: ${total}; flagged: ${flagged.length}\n`);
  for (const [email, rows] of byUser.entries()) {
    console.log(`== ${email} (${rows.length}) ==`);
    for (const f of rows) {
      console.log(`  [${f.ticker}] ${f.verdict}/${f.materiality}${f.is_backfill ? ' (backfill)' : ''} flags=${f.flags.join(',')}`);
      console.log(`    pillar: ${f.claim.slice(0, 90)}`);
      console.log(`    why:    ${f.why.slice(0, 110)}`);
    }
  }

  if (DELETE && flagged.length) {
    const ids = flagged.map((f) => f.id);
    const { error: delErr } = await db.from('pillar_evidence').delete().in('id', ids);
    console.log(delErr ? `DELETE ERR ${delErr.message}` : `\nDELETED ${ids.length} rows`);
  } else {
    console.log('\n(dry run; pass --delete to remove flagged rows)');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
