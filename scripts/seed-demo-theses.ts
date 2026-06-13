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

// Approved claims — final wording, inserted verbatim. No em dashes.
const SEEDS: Record<string, string[]> = {
  AMD: [
    "AMD's innovation in CPU and GPU technology drives market share gains against Intel and NVIDIA.",
    "AMD's partnerships and customer relationships in data center and gaming fuel revenue growth.",
    "AMD's financial strength and capital allocation support continued R&D investment.",
    "AMD's diversified portfolio across PC, data center, and embedded markets captures broad semiconductor growth.",
  ],
  AAPL: [
    "Apple's brand loyalty and ecosystem integration drive sustained demand across iPhone, iPad, and Mac.",
    "Apple's services segment (App Store, Music, iCloud) provides recurring revenue that enhances profitability.",
    "Apple's custom silicon (M-series chips) strengthens its competitive position and product performance.",
    "Apple maintains strong gross margins through premium pricing and supply chain efficiency.",
  ],
  NVDA: [
    "NVIDIA's GPU dominance is driven by AI and data center expansion, maintaining an edge over rivals.",
    "NVIDIA capitalizes on high-performance computing demand across gaming, autonomous vehicles, and cloud.",
    "NVIDIA's investments in AI and machine learning position it to benefit from the shift to AI-powered solutions.",
    "NVIDIA's high margins and revenue growth support strong financial performance.",
  ],
  META: [
    "Meta leads social media with strong engagement across Facebook, Instagram, and WhatsApp, driving ad revenue.",
    "Meta's investment in virtual and augmented reality, including Meta Quest, positions it for the metaverse market.",
    "Meta's AI and machine learning improve user experience and ad precision, lifting monetization.",
    "Meta's financial strength and capital allocation fund continued R&D investment.",
  ],
  TSLA: [
    "Tesla's leadership in electric vehicle technology drives demand as consumers and governments prioritize sustainable transport.",
    "Tesla's Gigafactory expansion increases production capacity and lowers manufacturing cost.",
    "Tesla's autonomous driving development positions it to capture future transportation revenue.",
    "Tesla's brand and direct-to-consumer model support customer loyalty and margin.",
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
  console.log(`Backfill window since: ${since}\n`);

  const log: string[] = [];
  const summary: Array<{ ticker: string; inserted: number; skipped: number; evidence: number }> = [];

  for (const ticker of Object.keys(SEEDS)) {
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
    const nowIso = new Date().toISOString();
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
        lifecycle_at: nowIso,
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
    console.log(`[${ticker}] scoring (12-month backfill, maxCandidates=40)...`);
    const { evidenceAdded, statusChanges } = await scoreOneThesis(supabase, thesisObj, log, {
      since,
      isBackfill: true,
      maxCandidates: 40,
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
