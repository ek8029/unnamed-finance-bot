/**
 * Send the agent-voiced thesis-breach email to yourself for a visual check.
 * Goes through the REAL sendBreachAlerts path, so the allowlist (evank8029@gmail.com)
 * still applies: nobody else can receive it, even by accident.
 *
 * Usage: tsx scripts/test-breach-email.ts [email=evank8029@gmail.com]
 *
 * Uses a real confirmed pillar of yours when one exists (with its latest
 * contradicting evidence if any); otherwise falls back to a representative sample
 * so the layout is still visible.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { BreachEvent } from '../lib/thesis-breach';

// Load env BEFORE importing thesis-breach: it transitively imports lib/emails/resend,
// which reads RESEND_API_KEY at module-eval time. Static import would run before this
// config() and leave Resend null. So sendBreachAlerts is imported dynamically in main().
config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }

const email = (process.argv[2] || 'evank8029@gmail.com').toLowerCase();
const db = createClient(url, key);

const SAMPLE: Omit<BreachEvent, 'userId'> = {
  ticker: 'TSLA',
  claim: 'Automotive gross margin stays above 25% as scale offsets price cuts.',
  excerpt: 'Automotive gross margin, excluding regulatory credits, fell to 14.6% in the quarter as average selling prices declined faster than per-unit cost.',
  sourceTitle: 'TSLA 10-Q (Q2)',
  sourceUrl: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=TSLA&type=10-Q',
};

async function main() {
  const { data: profile, error: lookErr } = await db
    .from('user_profiles').select('id, email').eq('email', email).maybeSingle();
  if (lookErr || !profile) { console.error(`User not found: ${email}`, lookErr?.message ?? ''); process.exit(1); }
  console.log(`Target: ${profile.email}  id=${profile.id}`);

  let breach: BreachEvent = { userId: profile.id, ...SAMPLE };

  // Prefer a real pillar of theirs so the email reflects their own book.
  const { data: theses } = await db
    .from('theses').select('id, ticker').eq('user_id', profile.id).limit(50);
  const tickerByThesis = new Map<string, string>();
  for (const t of theses ?? []) tickerByThesis.set(t.id, t.ticker);

  if (tickerByThesis.size > 0) {
    const { data: pillar } = await db
      .from('thesis_pillars')
      .select('id, thesis_id, claim')
      .in('thesis_id', [...tickerByThesis.keys()])
      .eq('confirmed', true)
      .limit(1)
      .maybeSingle();

    // Latest contradicting evidence on that pillar, if the scorer has logged any.
    // Only use real data when claim AND evidence come from the SAME pillar, so the
    // email never mixes one position's claim with another's filing (prod always has
    // both, since a breach is built from one evidence row on the broken pillar).
    const { data: ev } = pillar
      ? await db
          .from('pillar_evidence')
          .select('excerpt, source_title, source_url')
          .eq('pillar_id', pillar.id)
          .eq('verdict', 'contradicts')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (pillar && ev) {
      const ticker = tickerByThesis.get(pillar.thesis_id) ?? SAMPLE.ticker;
      breach = {
        userId: profile.id,
        ticker,
        claim: pillar.claim,
        excerpt: ev.excerpt as string,
        sourceTitle: ev.source_title as string,
        sourceUrl: (ev.source_url as string | null) ?? null,
      };
      console.log(`Using your real ${ticker} pillar + its real contradicting evidence (coherent).`);
    } else {
      console.log('No pillar with real contradicting evidence yet; sending the coherent TSLA sample.');
    }
  } else {
    console.log('No theses found for this user; sending the representative sample.');
  }

  // Invariant: a breach must be sourced from ONE place. Either the coherent sample,
  // or a real pillar with its OWN contradicting evidence. The bug to never repeat is
  // grafting sample evidence onto a real claim (mismatched ticker/filing). Catch it loud.
  const isSample = breach.claim === SAMPLE.claim && breach.excerpt === SAMPLE.excerpt;
  const isFullyReal = breach.claim !== SAMPLE.claim && breach.excerpt !== SAMPLE.excerpt;
  if (!isSample && !isFullyReal) {
    throw new Error('Refusing to send: breach mixes real and sample sources (claim and evidence disagree).');
  }

  const { sendBreachAlerts } = await import('../lib/thesis-breach');
  const log: string[] = [];
  const sent = await sendBreachAlerts(db, [breach], log);
  log.forEach((l) => console.log(l));
  console.log(sent > 0 ? `OK — sent ${sent} email to ${email}. Check the inbox.` : `Nothing sent (allowlist or Resend not configured).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
