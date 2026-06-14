/**
 * Seed demo theses for the OWNER account (evank8029@gmail.com) ONLY, then run the
 * REAL 12-month evidence backfill so every citation is a genuine sourced row.
 *
 * - Never fabricates evidence. Pillar claims are inserted verbatim from the approved
 *   SEEDS as origin 'user' / confirmed / lifecycle 'confirmed'. Evidence is produced
 *   exclusively by the production scorer (lib/score-theses.ts -> EDGAR/news/price/XBRL
 *   candidates + LLM judge + verbatim-excerpt guard).
 * - Rerun-safe: thesis upsert finds the existing row, only not-yet-present claims are
 *   appended (case-insensitive compare), and the scorer dedupes evidence by source_key
 *   via the unique (pillar_id, source_key) constraint.
 *
 * Run with: npx tsx scripts/seed-demo-theses.ts
 *
 * IMPORTANT: dotenv must load BEFORE importing lib/score-theses.ts. That module builds
 * an OpenAI client at top level (`new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`),
 * and static ESM imports hoist above config(). So score-theses + thesis-evidence are
 * imported DYNAMICALLY inside main(), after config() has run.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'evank8029@gmail.com';
// Pass --reset to wipe each demo thesis's existing pillars + their evidence before
// seeding, so changed claim wording fully replaces the old pillars instead of the
// default rerun-safe append (which would leave stale pillars alongside new ones).
const RESET = process.argv.includes('--reset');
// --only=TICKER seeds just that ticker (leaves the rest of the demo book untouched).
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

// Approved claims — final wording, inserted verbatim. No em dashes.
const SEEDS: Record<string, string[]> = {
  AMD: [
    "AMD keeps taking server CPU share from Intel as EPYC wins hyperscaler sockets.",
    "MI300 establishes AMD as a credible second source to NVIDIA in data center AI accelerators.",
    "Data center grows into AMD's largest segment and pulls gross margin higher.",
    "Client and gaming hold up well enough to fund data center R&D through the cycle.",
  ],
  AAPL: [
    "Services keeps compounding at double digit growth and lifts company gross margin.",
    "The iPhone installed base keeps growing even as upgrade cycles stretch longer.",
    "Apple silicon keeps the Mac and iPad differentiated without relying on Intel.",
    "Buybacks keep shrinking the share count and support earnings per share.",
  ],
  NVDA: [
    "Data center GPU demand stays supply constrained as hyperscalers raise AI capex.",
    "CUDA and the software stack keep switching costs high and protect pricing power.",
    "Networking with InfiniBand and Spectrum becomes a real second growth engine.",
    "Gross margin holds above 70 percent as Blackwell ramps into volume.",
  ],
  META: [
    "AI driven ranking keeps lifting engagement and ad price across Instagram and Facebook.",
    "Reality Labs losses stay bounded and do not derail company operating margin.",
    "Reels and click to message ads offset any weakness in brand advertising.",
    "Spending on AI infrastructure shows up as ad revenue, not just rising cost.",
  ],
  TSLA: [
    "Tesla defends EV gross margin leadership even while cutting prices to hold volume.",
    "Energy generation and storage grows into a higher margin second business.",
    "Full self driving and robotaxi optionality turns into real revenue, not just narrative.",
    "Gigafactory scale keeps unit cost falling faster than average selling price.",
  ],
  MSFT: [
    "Azure growth stays strong as enterprises move AI workloads to the cloud.",
    "Copilot and AI features lift Microsoft 365 revenue per seat.",
    "Operating margin holds even as Microsoft ramps capital spending on AI data centers.",
    "Gaming revenue grows after the Activision deal without derailing margins.",
  ],
  GOOGL: [
    "Search advertising keeps growing despite competition from AI chat assistants.",
    "Google Cloud turns durably profitable and gains share on AWS and Azure.",
    "YouTube advertising and subscriptions become a larger share of revenue.",
    "Antitrust rulings do not force a breakup that breaks the advertising business.",
  ],
  AMZN: [
    "AWS reaccelerates as AI demand lifts cloud spending.",
    "North America retail operating margin expands as fulfillment costs come down.",
    "Advertising becomes a high margin third business behind AWS and retail.",
    "Capital spending on AI infrastructure converts into AWS revenue.",
  ],
  INTC: [
    "Intel Foundry wins external customers and narrows the gap with TSMC.",
    "The 18A process node ships on schedule and restores manufacturing credibility.",
    "Data center share stabilizes against AMD instead of eroding further.",
    "Cost cuts restore gross margin back toward 50 percent.",
  ],
  PLTR: [
    "Commercial AIP adoption drives US commercial revenue growth above 50 percent.",
    "Government revenue stays sticky and funds the commercial expansion.",
    "Operating margin keeps expanding as revenue scales.",
    "The valuation is supported by durable growth, not just AI enthusiasm.",
  ],
  NFLX: [
    "The ad supported tier adds members and lifts average revenue per member.",
    "The paid sharing crackdown keeps converting shared accounts to paying ones.",
    "Operating margin expands as content spend grows slower than revenue.",
    "Live events and games deepen engagement without large new losses.",
  ],
  LULU: [
    "Lululemon's North America revenue reaccelerates as the brand wins back core customers.",
    "Full year revenue guidance holds as new categories offset any softness.",
    "International growth, led by China, becomes the main engine of the story.",
    "Premium pricing keeps gross margin resilient through the slowdown.",
  ],
  // Deliberate "broken" candidates: real 2026 blowups whose actual filings/XBRL
  // should contradict these bullish pillars at the primary-source level.
  EMBC: [
    "Embecta grows revenue as the standalone leader in insulin delivery devices.",
    "Operating margin expands as Embecta finishes separating its systems from BD.",
    "Full year guidance holds as the patch pump pipeline moves toward launch.",
    "Cash flow stays strong enough to service the spinoff debt load.",
  ],
  PRIM: [
    "Primoris's share price holds up, reflecting market confidence in the 2026 plan.",
    "The record renewables backlog converts to profit without execution stumbles.",
    "Full year adjusted EPS guidance holds as utility and solar demand scales.",
    "Multi year backlog gives durable revenue visibility through the cycle.",
  ],
};

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in .env.local (scorer needs it)');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Dynamic imports AFTER config() so module-top-level OpenAI client picks up the key.
  const { scoreOneThesis } = await import('../lib/score-theses');
  const { excerptFoundInSource } = await import('../lib/thesis-evidence');

  // 1. Resolve owner user id by email (case-insensitive).
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) {
    console.error('Failed to list users:', usersErr.message);
    process.exit(1);
  }
  const owner = usersData.users.find((u) => (u.email ?? '').toLowerCase() === OWNER_EMAIL.toLowerCase());
  if (!owner) {
    console.error(`Owner ${OWNER_EMAIL} not found among ${usersData.users.length} users. Aborting.`);
    process.exit(1);
  }
  console.log(`Owner: ${OWNER_EMAIL} -> ${owner.id}`);

  // 12 months back, date-only string (matches app/api/thesis/backfill/route.ts exactly).
  const sinceDateObj = new Date();
  sinceDateObj.setFullYear(sinceDateObj.getFullYear() - 1);
  const since = sinceDateObj.toISOString().split('T')[0];
  // Latest ~quarter is scored as LIVE (the current state of the business); older
  // evidence is historical backfill. This is what lets recent supporting filings
  // move pillars to intact, instead of every pillar sitting at 'unverified'.
  const liveSinceObj = new Date();
  liveSinceObj.setDate(liveSinceObj.getDate() - 90);
  const liveSince = liveSinceObj.toISOString().split('T')[0];
  console.log(`Backfill window since: ${since} | live window since: ${liveSince}\n`);

  const log: string[] = [];
  const summary: Array<{ ticker: string; inserted: number; skipped: number; evidence: number }> = [];

  for (const ticker of Object.keys(SEEDS)) {
    if (ONLY && ticker !== ONLY) continue;
    console.log(`=== ${ticker} ===`);
    const claims = SEEDS[ticker];

    // 2a. Find-or-create thesis (rerun-safe; unique constraint is (user_id, ticker)).
    let thesisId: string;
    {
      const { data: existingThesis, error: selErr } = await supabase
        .from('theses')
        .select('id, tracked')
        .eq('user_id', owner.id)
        .eq('ticker', ticker)
        .maybeSingle();
      if (selErr) {
        console.error(`[${ticker}] thesis select error: ${selErr.message}`);
        process.exit(1);
      }
      if (existingThesis) {
        thesisId = existingThesis.id as string;
        if (existingThesis.tracked !== true) {
          await supabase.from('theses').update({ tracked: true }).eq('id', thesisId);
        }
        console.log(`[${ticker}] thesis exists: ${thesisId}`);
      } else {
        const { data: created, error: insErr } = await supabase
          .from('theses')
          .insert({ user_id: owner.id, ticker, tracked: true })
          .select('id')
          .single();
        if (insErr || !created) {
          console.error(`[${ticker}] thesis insert error: ${insErr?.message}`);
          process.exit(1);
        }
        thesisId = created.id as string;
        console.log(`[${ticker}] thesis created: ${thesisId}`);
      }
    }

    // 2a-reset. With --reset, clear this thesis's pillars + their evidence first so
    // updated claim wording replaces the old pillars (default behavior only appends).
    if (RESET) {
      const { data: oldPillars } = await supabase
        .from('thesis_pillars')
        .select('id')
        .eq('thesis_id', thesisId);
      const oldIds = (oldPillars ?? []).map((p) => p.id as string);
      if (oldIds.length > 0) {
        await supabase.from('pillar_evidence').delete().in('pillar_id', oldIds);
        await supabase.from('thesis_pillars').delete().eq('thesis_id', thesisId);
      }
      console.log(`[${ticker}] reset: cleared ${oldIds.length} existing pillars`);
    }

    // 2b. Append only claims not already present (case-insensitive) so reruns don't dup.
    const { data: existingPillars, error: pillErr } = await supabase
      .from('thesis_pillars')
      .select('claim')
      .eq('thesis_id', thesisId);
    if (pillErr) {
      console.error(`[${ticker}] pillar select error: ${pillErr.message}`);
      process.exit(1);
    }
    const existingNorm = new Set((existingPillars ?? []).map((p) => norm(p.claim as string)));

    let inserted = 0;
    let skipped = 0;
    // Backdate confirmation ~3 months so the thesis reads as established and the
    // latest-quarter live evidence is coherent ("Helm has watched for a quarter").
    const lifecycleAt = liveSinceObj.toISOString();
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      if (existingNorm.has(norm(claim))) {
        skipped++;
        continue;
      }
      const { error: rowErr } = await supabase.from('thesis_pillars').insert({
        thesis_id: thesisId,
        user_id: owner.id,
        claim,
        origin: 'user',
        confirmed: true,
        lifecycle: 'confirmed',
        lifecycle_at: lifecycleAt,
        sort_order: i,
        // status intentionally omitted -> DB default 'unverified'
      });
      if (rowErr) {
        console.error(`[${ticker}] pillar insert error: ${rowErr.message}`);
        process.exit(1);
      }
      inserted++;
    }
    console.log(`[${ticker}] pillars inserted=${inserted} skipped(existing)=${skipped}`);

    // 2c. Run the REAL backfill scorer over this thesis.
    const thesisObj: import('../lib/score-theses').Thesis = {
      id: thesisId,
      user_id: owner.id,
      ticker,
      tracked: true,
      last_scanned_at: null,
    };
    // Single scan: liveCutoff dates the live/backfill split. Evidence from the last
    // ~quarter (>= liveSince) is LIVE (reflects current state, can verify a pillar);
    // older is historical backfill. 90d is grounded in the quarterly reporting cycle
    // + post-earnings drift (~60-90 trading days), not a flat per-call flag.
    console.log(`[${ticker}] scoring (single scan, live >= ${liveSince}, since ${since})...`);
    const { evidenceAdded, statusChanges } = await scoreOneThesis(supabase, thesisObj, log, {
      since,
      liveCutoff: liveSince,
      // 24 keeps the prompt under the org's gpt-4o TPM cap; filings still reserved,
      // and candidates are date-sorted so the most recent (most relevant) survive.
      maxCandidates: 24,
      // gpt-4o quotes verbatim far better than the cron's gpt-4o-mini. Demo seed only.
      model: 'gpt-4o',
    });
    console.log(`[${ticker}] scoreOneThesis: evidenceAdded=${evidenceAdded} statusChanges=${statusChanges}`);

    // 2d. Count evidence rows across this thesis's pillars (authoritative DB count).
    const { data: pillarRows } = await supabase
      .from('thesis_pillars')
      .select('id')
      .eq('thesis_id', thesisId)
      .eq('confirmed', true);
    const pids = (pillarRows ?? []).map((p) => p.id as string);
    let evidence = 0;
    if (pids.length > 0) {
      const { count } = await supabase
        .from('pillar_evidence')
        .select('id', { count: 'exact', head: true })
        .in('pillar_id', pids);
      evidence = count ?? 0;
    }
    console.log(`${ticker}: ${evidence} evidence rows\n`);
    summary.push({ ticker, inserted, skipped, evidence });
  }

  // 3. Print accumulated scorer log.
  console.log('--- scorer log ---');
  for (const line of log) console.log(line);

  // 4. Verification spot-check. Prefer text sources we can re-derive cheaply: `news`
  //    excerpts can be checked against title+summary from market_news. Fall back to
  //    printing excerpt + source_title/url for manual eyeballing if no checkable rows.
  console.log('\n--- verification spot-check (verbatim excerpt) ---');
  const allPids: string[] = [];
  {
    const { data: allPillars } = await supabase
      .from('thesis_pillars')
      .select('id')
      .eq('user_id', owner.id);
    for (const p of allPillars ?? []) allPids.push(p.id as string);
  }

  let checks = 0;
  if (allPids.length > 0) {
    // Try news rows first (re-derivable source text).
    const { data: newsEv } = await supabase
      .from('pillar_evidence')
      .select('excerpt, source_type, source_key, source_title, source_url')
      .in('pillar_id', allPids)
      .eq('source_type', 'news')
      .limit(2);

    for (const ev of newsEv ?? []) {
      const { data: newsRow } = await supabase
        .from('market_news')
        .select('title, summary')
        .eq('url', ev.source_key as string)
        .maybeSingle();
      if (newsRow) {
        const sourceText = `${newsRow.title}\n${newsRow.summary ?? ''}`.trim();
        const ok = excerptFoundInSource(ev.excerpt as string, sourceText);
        console.log(`[${ok ? 'PASS' : 'FAIL'}] news excerptFoundInSource :: "${(ev.excerpt as string).slice(0, 90)}"`);
        console.log(`        source: ${ev.source_title} | ${ev.source_url ?? '(no url)'}`);
        checks++;
      }
    }

    // If we could not run any real checks, fall back to eyeball print of any 2 text-source rows.
    if (checks === 0) {
      const { data: anyEv } = await supabase
        .from('pillar_evidence')
        .select('excerpt, source_type, source_title, source_url')
        .in('pillar_id', allPids)
        .in('source_type', ['filing', 'form4', 'news'])
        .limit(2);
      if ((anyEv ?? []).length === 0) {
        console.log('No text-source (filing/form4/news) evidence rows to spot-check.');
      } else {
        console.log('No re-derivable source text available; printing 2 excerpts for manual eyeballing:');
        for (const ev of anyEv ?? []) {
          console.log(`  [${ev.source_type}] "${(ev.excerpt as string).slice(0, 120)}"`);
          console.log(`     source: ${ev.source_title} | ${ev.source_url ?? '(no url)'}`);
        }
      }
    }
  } else {
    console.log('No pillars found for owner; nothing to spot-check.');
  }

  // 5. Final summary table.
  console.log('\n--- summary ---');
  for (const s of summary) {
    console.log(`${s.ticker}: pillars +${s.inserted} (skipped ${s.skipped}), ${s.evidence} evidence rows`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
