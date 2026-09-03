// lib/score-theses.ts
// Batch thesis evidence scoring: gather candidates, LLM judge, insert evidence,
// recompute pillar status.

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getRecentFilings,
  BUSINESS_FORMS,
  getForm4Filings,
  getReportedFinancialsEdgar,
  fetchEx99Html,
  type Form4Summary,
} from '@/lib/edgar';
import { excerptFoundInSource, TEXT_SOURCES } from '@/lib/thesis-evidence';
import { citationDefect } from '@/lib/content/citation-quality';
import { extractFilingSection, stripFilingHtml } from '@/lib/filing-extract';
import { derivePillarStatus, type EvidenceForStatus, type PillarStatus } from '@/lib/thesis-status';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import { entitledToMonitoring, selectMonitored } from '@/lib/thesis-entitlement';
import { filingSinceDate } from '@/lib/filing-window';
import type { BreachEvent } from '@/lib/thesis-breach';
import { isComparisonHeadline } from '@/lib/news-quality';
import { isHedgedConnection } from '@/lib/evidence-quality';
import { reviewEscalations, needsEscalation, ESCALATION_MODEL, ESCALATION_CAP } from '@/lib/judge-escalation';
import { runInvestigation, classifyTrigger, type InvestigationTrigger } from '@/lib/investigation-memo';
import { buildJudgeSteering } from '@/lib/judge-steering';
import { detectInsiderCluster, clusterText } from '@/lib/insider-cluster';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SCORE_MODEL = 'gpt-4o-mini';
const MAX_CANDIDATES = 12;
const SEC_FETCH_TRUNCATE = 8000;
const CANDIDATE_TEXT_TRUNCATE = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Thesis {
  id: string;
  user_id: string;
  ticker: string;
  tracked: boolean;
  last_scanned_at: string | null;
}

interface Pillar {
  id: string;
  thesis_id: string;
  user_id: string;
  claim: string;
  /** The pillar's own kill criterion, drafted at seed time (migration 053). */
  breaks_if?: string | null;
  confirmed: boolean;
  status: PillarStatus;
  status_override: PillarStatus | null;
}

interface Candidate {
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  source_key: string;
  source_title: string;
  source_url: string | null;
  source_published_at: string | null;
  sourceText: string; // text sent to LLM
  excerpt_override?: string; // for price_move/xbrl: overwrite LLM excerpt with this
  form4Meta?: Form4Summary; // for is10b5-1 guard
  filingForm?: string; // form type (10-K/10-Q/8-K), drives MD&A extraction
  filingItems?: string[]; // 8-K item numbers; 2.02 drives EX-99 exhibit enrichment
}

interface LLMEvidenceRow {
  pillar_index: number;
  source_index: number;
  verdict: string;
  materiality: string;
  /** 'reported_event' | 'opinion', news only — drives source_class (migration 057). */
  claim_type?: string;
  confidence?: string; // 'high' | 'low' — E2 escalation trigger
  why: string;
  what_it_means: string;
  consider?: string;
  excerpt: string;
}

interface LLMResponse {
  evidence: LLMEvidenceRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchFilingText(url: string, form = ''): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Helm Terminal hello@helmterminal.dev' },
    });
    if (!res.ok) return '';
    const raw = await res.text();
    const stripped = stripFilingHtml(raw);
    // Pull the MD&A / substantive section, not the cover-page boilerplate.
    return extractFilingSection(stripped, form, SEC_FETCH_TRUNCATE);
  } catch {
    return '';
  }
}

function buildForm4Text(f: Form4Summary): string {
  const txLines = f.transactions
    .map(
      (t) =>
        `  ${t.isDisposition ? 'Sold' : 'Acquired'} ${t.shares.toLocaleString('en-US')} shares` +
        (t.pricePerShare != null ? ` at $${t.pricePerShare.toFixed(2)}` : '') +
        ` on ${t.date} (code: ${t.code})`
    )
    .join('\n');
  const saleNote =
    f.totalSaleValue > 0
      ? `Total sale value: $${f.totalSaleValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : '';
  const planNote = f.is10b51 ? 'Filed under 10b5-1 trading plan.' : '';
  return [
    `Form 4 insider transaction`,
    `Owner: ${f.ownerName} (${f.ownerRole})`,
    saleNote,
    planNote,
    `Transactions:\n${txLines}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function sinceDate(lastScannedAt: string | null): string {
  if (lastScannedAt) return lastScannedAt.split('T')[0];
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function scoreAllTheses(
  serviceClient: SupabaseClient,
  tickerScope?: string
): Promise<{
  scanned: number;
  evidenceAdded: number;
  statusChanges: number;
  breaches: BreachEvent[];
  log: string[];
}> {
  const log: string[] = [];
  let scanned = 0;
  let evidenceAdded = 0;
  let statusChanges = 0;
  const breaches: BreachEvent[] = [];

  // Fetch theses
  let query = serviceClient
    .from('theses')
    .select('id, user_id, ticker, tracked, last_scanned_at, created_at')
    .eq('tracked', true);
  if (tickerScope) {
    query = query.eq('ticker', tickerScope);
  }
  const { data: allTheses, error: thesesErr } = await query;

  // Error first, so the fatal path reports the real cause rather than depending
  // on supabase-js returning data: null alongside it.
  if (thesesErr) {
    log.push(`Fatal: failed to fetch theses: ${thesesErr.message}`);
    return { scanned, evidenceAdded, statusChanges, breaches, log };
  }

  // A free user keeps one thesis under watch, their oldest tracked one; Pro
  // keeps every position. Without this the cron would score every tracked
  // thesis regardless of tier, which was harmless only while thesis creation
  // was itself Pro-gated.
  let theses = allTheses;
  if (allTheses && allTheses.length > 0) {
    const owners = [...new Set(allTheses.map((t: { user_id: string }) => t.user_id))];
    const entitled = await entitledToMonitoring(serviceClient, owners);
    const picked = selectMonitored(allTheses as Array<{ id: string; user_id: string; created_at?: string | null }>, entitled);
    theses = picked.kept as typeof allTheses;
    if (picked.skipped > 0) {
      log.push(`Skipped ${picked.skipped} tracked thesis/theses beyond the free allowance of one per user.`);
    }
  }

  if (!theses || theses.length === 0) {
    log.push('No tracked theses found.');
    return { scanned, evidenceAdded, statusChanges, breaches, log };
  }

  for (const thesis of theses as Thesis[]) {
    try {
      const result = await scoreOneThesis(serviceClient, thesis, log);
      evidenceAdded += result.evidenceAdded;
      statusChanges += result.statusChanges;
      breaches.push(...result.breaches);
      scanned++;
    } catch (err) {
      log.push(`[${thesis.ticker}] Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scanned, evidenceAdded, statusChanges, breaches, log };
}

// ---------------------------------------------------------------------------
// Per-thesis scoring
// ---------------------------------------------------------------------------

export async function scoreOneThesis(
  db: SupabaseClient,
  thesis: Thesis,
  log: string[],
  options?: { since?: string; isBackfill?: boolean; maxCandidates?: number; model?: string; liveCutoff?: string }
): Promise<{ evidenceAdded: number; statusChanges: number; breaches: BreachEvent[] }> {
  const { ticker, id: thesisId, user_id, last_scanned_at } = thesis;
  const since = options?.since ?? sinceDate(last_scanned_at);
  const filingSince = filingSinceDate(since);
  const isBackfill = options?.isBackfill ?? false;
  // When set, evidence dated on/after liveCutoff is LIVE (reflects the current
  // state), older is backfill. Grounds the live/historical split in the quarterly
  // reporting cycle instead of a flat per-call flag. See seed for the 90-day value.
  const liveCutoff = options?.liveCutoff;
  const maxCandidates = options?.maxCandidates ?? MAX_CANDIDATES;
  const model = options?.model ?? SCORE_MODEL;
  let evidenceAdded = 0;
  let statusChanges = 0;
  const breaches: BreachEvent[] = [];

  // Fetch confirmed pillars for this thesis
  const { data: pillarsRaw, error: pillarsErr } = await db
    .from('thesis_pillars')
    .select('*')
    .eq('thesis_id', thesisId)
    .eq('confirmed', true);

  if (pillarsErr) {
    log.push(`[${ticker}] Failed to fetch pillars: ${pillarsErr.message}`);
    await bumpLastScanned(db, thesisId);
    return { evidenceAdded, statusChanges, breaches };
  }

  const pillars: Pillar[] = (pillarsRaw ?? []) as Pillar[];

  // Pre-fetch existing source_keys for dedup
  const pillarIds = pillars.map((p) => p.id);
  let existingSourceKeys = new Set<string>();
  if (pillarIds.length > 0) {
    const { data: existing } = await db
      .from('pillar_evidence')
      .select('source_key')
      .in('pillar_id', pillarIds);
    if (existing) {
      for (const row of existing) existingSourceKeys.add(row.source_key as string);
    }
  }

  // Gather candidates
  const candidates: Candidate[] = [];

  // 1. Recent SEC filings
  try {
    const filings = await getRecentFilings(ticker, filingSince, BUSINESS_FORMS);
    for (const f of filings) {
      // source_key = filing URL: EdgarFiling exposes no accession number; URL is stable + unique per filing
      const sourceKey = f.url;
      if (existingSourceKeys.has(sourceKey)) continue;
      candidates.push({
        source_type: 'filing',
        source_key: sourceKey,
        source_title: `${f.form} filed ${f.filingDate}`,
        source_url: f.url,
        source_published_at: f.filingDate,
        sourceText: '', // filled lazily below
        filingForm: f.form,
        filingItems: f.items,
      });
    }
  } catch (err) {
    log.push(`[${ticker}] getRecentFilings error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Form 4 filings
  try {
    const form4s = await getForm4Filings(ticker, since);
    for (const f of form4s) {
      const sourceKey = f.accessionNumber;
      if (existingSourceKeys.has(sourceKey)) continue;
      candidates.push({
        source_type: 'form4',
        source_key: sourceKey,
        source_title: `Form 4: ${f.ownerName}`,
        source_url: f.url,
        source_published_at: f.filedAt,
        sourceText: buildForm4Text(f).slice(0, CANDIDATE_TEXT_TRUNCATE),
        form4Meta: f,
      });
    }
    // E6.2: many insiders selling in the same window is a signal no single
    // Form 4 carries (and 10b5-1 muting hides). One synthetic candidate
    // carries the pattern; its text doubles as the verbatim excerpt.
    const cluster = detectInsiderCluster(form4s);
    if (cluster) {
      const clusterKey = `form4-cluster:${ticker}:${cluster.lastDate}`;
      if (!existingSourceKeys.has(clusterKey)) {
        const text = clusterText(ticker, cluster);
        candidates.push({
          source_type: 'form4',
          source_key: clusterKey,
          source_title: `Insider selling cluster (${cluster.sellerCount} insiders)`,
          source_url: null,
          source_published_at: cluster.lastDate,
          sourceText: text,
          excerpt_override: text,
        });
        log.push(`[${ticker}] insider cluster detected: ${cluster.sellerCount} sellers`);
      }
    }
  } catch (err) {
    log.push(`[${ticker}] getForm4Filings error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Market news
  try {
    const { data: newsRows } = await db
      .from('market_news')
      .select('title, summary, url, source, published_at, primary_ticker')
      .eq('primary_ticker', ticker)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(50);
    for (const n of newsRows ?? []) {
      const sourceKey = n.url as string;
      if (existingSourceKeys.has(sourceKey)) continue;
      // Skip head-to-head "X vs Y / better buy" comparison clickbait — it's
      // opinion, not primary thesis evidence, and the scorer mis-signs it.
      if (isComparisonHeadline(n.title as string)) {
        log.push(`[${ticker}] skipped comparison headline: ${(n.title as string) ?? ''}`);
        continue;
      }
      candidates.push({
        source_type: 'news',
        source_key: sourceKey,
        source_title: n.title as string,
        source_url: n.url as string,
        source_published_at: n.published_at as string,
        sourceText: `${n.title}\n${n.summary ?? ''}`.trim().slice(0, CANDIDATE_TEXT_TRUNCATE),
      });
    }
  } catch (err) {
    log.push(`[${ticker}] market_news query error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Price move
  try {
    const { data: prices } = await db
      .from('market_prices')
      .select('ticker, price_date, close')
      .eq('ticker', ticker)
      .order('price_date', { ascending: false })
      .limit(2);
    if (prices && prices.length === 2) {
      const latest = prices[0];
      const prior = prices[1];
      const latestClose = Number(latest.close);
      const priorClose = Number(prior.close);
      if (priorClose > 0) {
        const pct = (latestClose - priorClose) / priorClose;
        if (Math.abs(pct) > 0.05) {
          const direction = pct > 0 ? 'rose' : 'fell';
          const priceDate = String(latest.price_date).split('T')[0];
          const sourceKey = `price:${ticker}:${priceDate}`;
          if (!existingSourceKeys.has(sourceKey)) {
            const excerpt = `${ticker} ${direction} ${(Math.abs(pct) * 100).toFixed(1)}% on ${priceDate}`;
            candidates.push({
              source_type: 'price_move',
              source_key: sourceKey,
              source_title: `Price move: ${excerpt}`,
              source_url: null,
              source_published_at: latest.price_date as string,
              sourceText: excerpt,
              excerpt_override: excerpt,
            });
          }
        }
      }
    }
  } catch (err) {
    log.push(`[${ticker}] price_move query error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. XBRL financials
  try {
    const financials = await getReportedFinancialsEdgar(ticker);
    if (financials.length >= 2) {
      // Periods newer than `since`
      const newPeriods = financials.filter((f) => f.endDate >= since);
      for (const period of newPeriods) {
        // Find prior period for comparison
        const prior = financials.find((f) => f.endDate < period.endDate);
        if (!prior) continue;
        // Only revenue and net income from income statement
        const metricsOfInterest = ['Revenue', 'NetIncomeLoss', 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'];
        for (const item of period.ic) {
          const matchesByLabel = item.label.toLowerCase().includes('revenue') || item.label.toLowerCase().includes('net income');
          const matchesByConcept = metricsOfInterest.includes(item.concept);
          if (!matchesByLabel && !matchesByConcept) continue;

          // Find matching prior item by concept
          const priorItem = prior.ic.find((pi) => pi.concept === item.concept);
          if (!priorItem) continue;

          const sourceKey = `xbrl:${ticker}:${period.endDate}:${item.concept}`;
          if (existingSourceKeys.has(sourceKey)) continue;

          const formatVal = (v: number, unit: string): string => {
            if (unit === 'USD' || unit === 'usd') {
              if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
              if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
              return `$${v.toLocaleString('en-US')}`;
            }
            return String(v);
          };

          const periodLabel = period.form.includes('10-K') ? `FY${period.year}` : `${period.form} ${period.endDate}`;
          const excerpt = `${periodLabel} ${item.label}: ${formatVal(item.value, item.unit)} vs ${formatVal(priorItem.value, priorItem.unit)} prior year`;

          candidates.push({
            source_type: 'xbrl',
            source_key: sourceKey,
            source_title: `XBRL: ${item.label} (${periodLabel})`,
            source_url: null,
            source_published_at: period.endDate,
            sourceText: excerpt,
            excerpt_override: excerpt,
          });
        }
      }
    }
  } catch (err) {
    log.push(`[${ticker}] XBRL error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Sort by published date desc, then cap. Reserve slots for filings so the rare
  // but high-value 10-K/10-Q/8-K are not crowded out of the cap by far more
  // frequent news items.
  const byDateDesc = (a: Candidate, b: Candidate) =>
    (b.source_published_at ?? '').localeCompare(a.source_published_at ?? '');
  const filingReserve = Math.min(6, Math.ceil(maxCandidates / 4));
  const reservedFilings = candidates
    .filter((c) => c.source_type === 'filing')
    // 10-K/10-Q carry the quotable MD&A narrative; 8-K primary docs are XBRL cover
    // boilerplate (their substance lives in exhibits). Reserve periodic reports first.
    .sort((a, b) => {
      const pa = /10-?[KQ]/i.test(a.filingForm ?? '') ? 0 : 1;
      const pb = /10-?[KQ]/i.test(b.filingForm ?? '') ? 0 : 1;
      return pa !== pb ? pa - pb : byDateDesc(a, b);
    })
    .slice(0, filingReserve);
  const reservedKeys = new Set(reservedFilings.map((c) => c.source_key));
  const rest = candidates
    .filter((c) => !reservedKeys.has(c.source_key))
    .sort(byDateDesc)
    .slice(0, Math.max(0, maxCandidates - reservedFilings.length));
  const sortedCandidates = [...reservedFilings, ...rest].sort(byDateDesc);

  // Lazily fetch filing text for filings
  for (const c of sortedCandidates) {
    if (c.source_type === 'filing' && c.sourceText === '') {
      c.sourceText = await fetchFilingText(c.source_url!, c.filingForm);
      // E6.1: earnings 8-Ks (item 2.02) carry the press release as EX-99 —
      // the guidance language lives there, not in the skeletal primary doc.
      if (c.filingForm === '8-K' && c.filingItems?.includes('2.02')) {
        const ex99 = await fetchEx99Html(c.source_url!);
        if (ex99) {
          c.sourceText += `\nEARNINGS PRESS RELEASE (EX-99):\n${stripFilingHtml(ex99).slice(0, 4000)}`;
          log.push(`[${ticker}] EX-99 exhibit attached to ${c.source_title}`);
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Bump last_scanned_at even if we skip LLM
  if (pillars.length === 0 || sortedCandidates.length === 0) {
    log.push(`[${ticker}] Skipping LLM (0 pillars or 0 candidates). pillars=${pillars.length} candidates=${sortedCandidates.length}`);
    await bumpLastScanned(db, thesisId);
    return { evidenceAdded, statusChanges, breaches };
  }

  // Build LLM prompt
  const pillarLines = pillars
    // Include each pillar's own kill criterion so the judge knows exactly what
    // evidence the user considers falsifying — sharper contradicts verdicts.
    .map((p, i) => `Pillar ${i + 1}: ${p.claim}${p.breaks_if ? ` (breaks if: ${p.breaks_if})` : ''}`)
    .join('\n');

  const sourceLines = sortedCandidates
    .map((c, i) => `Source ${i + 1} [${c.source_type}]: ${c.sourceText}`)
    .join('\n\n');

  const systemPrompt = `${INJECTION_GUARD}
You are a senior equity analyst judging whether each source bears on each thesis pillar.
A single source can bear on more than one pillar. For each pillar a source genuinely relates to, produce a separate evidence row.
Rules:
- Only emit rows where the source clearly bears on the pillar's MECHANISM, the causal claim itself, not merely a brand, product, or segment the pillar covers. A pillar about growth drivers or consumer demand is NOT affected by every event at a covered brand. Emitting no row for a source is the correct output when nothing clearly bears.
- If connecting the source to the pillar requires hedging ("may affect", "could impact", "underscores potential"), the connection is too weak: OMIT the row.
- Operational incidents (cybersecurity events, ransomware, recalls, lawsuits, outages) bear only on pillars explicitly about operations, execution, supply chain, costs, or margins, and only when the disclosed impact is concrete. They do not bear on demand, growth-driver, or market-position pillars unless the filing itself quantifies or links the incident to those outcomes.
- Assign each source to the pillar it most DIRECTLY affects. A change to a specific contract, customer, segment, or revenue stream bears on the pillar about THAT revenue (e.g. a government contract win or loss bears on a "government revenue" pillar), not merely a downstream "margin" or "valuation" pillar. Only also tag a downstream pillar when the source genuinely speaks to it too.
- Filings (10-K, 10-Q) are authoritative primary sources. When a filing supports or contradicts a pillar, cite the filing, even if a news item makes a similar point. Use news for points the filings do not cover. Sources are tagged [filing], [form4], [xbrl], [news], [price_move].
- excerpt must be copied verbatim from the source text. Do not paraphrase or invent.
- No invented numbers. No em dashes.
- verdict: "supports", "contradicts", or "neutral". Neutral is RARE: only when the source speaks directly to the pillar's mechanism and confirms the status quo. Never use neutral to file a loose thematic association; omit instead.
- A forward-looking risk statement that would appear whether or not the pillar is true ("may materially adversely affect revenue, gross margin, results of operations") is not evidence for either side. Omit it. If it must be filed, the verdict is "neutral", never "supports".
- materiality: "material" (changes the thesis outlook) or "context" (informative background).
- claim_type: for [news] sources ONLY, "reported_event" if the excerpt reports something that has actually happened or been formally announced (a contract ended, a plant shut, results published, a price changed), or "opinion" if it is a view, forecast, rating, price target or argument about what may happen. A rating change IS an opinion however factually it is written up. Where it was published is irrelevant; judge the claim itself. Omit for non-news sources.
- confidence: "high" or "low". Use "low" when the connection or the materiality call required judgment you are not certain of.
- why: one concise sentence explaining the connection.
- what_it_means: one concise sentence, addressed to the holder in second person ("your"), on what this does to the pillar's standing. Describe state only, never recommend an action (no buy, sell, trim, or consider). Do not introduce facts absent from the cited source.
- consider: optional, only if there is a meaningful counterpoint.
- If a HOLDER_CONTEXT section is present, use it to calibrate relevance and materiality for THIS holder (e.g. kinds of evidence they have rejected before). It never overrides the facts in the sources.
Respond with JSON exactly in this shape:
{ "evidence": [ { "pillar_index": <1-based pillar number>, "source_index": <1-based source number>, "verdict": "...", "materiality": "...", "claim_type": "...", "confidence": "...", "excerpt": "...", "why": "...", "what_it_means": "...", "consider": "..." } ] }`;

  // E5: per-thesis steering from the holder's own overrides + dismissed drafts.
  const { data: dismissedRaw } = await db
    .from('thesis_pillars')
    .select('claim')
    .eq('thesis_id', thesisId)
    .eq('lifecycle', 'dismissed')
    .order('updated_at', { ascending: false })
    .limit(3);
  const steering = buildJudgeSteering(
    pillars.map((p) => ({
      claim: p.claim,
      status_override: p.status_override,
      status_changed_at: (p as Pillar & { status_changed_at?: string | null }).status_changed_at ?? null,
    })),
    (dismissedRaw ?? []) as { claim: string }[],
  );

  const userPrompt = `Thesis pillars:\n${fence(pillarLines, 'PILLARS')}\n\nSources:\n${fence(sourceLines, 'SOURCES')}${steering ? `\n\nHolder context:\n${fence(steering, 'HOLDER_CONTEXT')}` : ''}`;

  let llmRows: LLMEvidenceRow[] = [];
  try {
    const response = await openai.chat.completions.create({
      model,
      // A classifier must not sample. This call's verdict enum feeds derivePillarStatus,
      // which is a pure function, so a pillar's status (and the breach that follows) was
      // riding on the default temperature of 1.0. thesis-synthesis.ts pins 0 for the same
      // reason. Deterministic also makes model comparisons measurable instead of noisy.
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as LLMResponse;
    llmRows = Array.isArray(parsed.evidence) ? parsed.evidence : [];
    log.push(`[${ticker}] LLM returned ${llmRows.length} rows for ${sortedCandidates.length} candidates x ${pillars.length} pillars`);
  } catch (err) {
    // DO NOT ADVANCE THE WATERMARK ON AN INFRASTRUCTURE FAILURE.
    //
    // `since` comes from last_scanned_at, so bumping it after a failed judge
    // call tells the next run that everything in this batch was considered.
    // Nothing re-reads it. The documents are not retried, not logged as
    // skipped, and not counted anywhere — they simply never happened, and the
    // hole is invisible because the pillar still shows evidence from before it.
    //
    // The window truncates to a DATE, so a failure and a recovery inside the
    // same day are harmless. The expensive case is a failure on a day AFTER the
    // last success: the OpenAI key ran dry mid-Friday 2026-08-14, and had the
    // Monday 09:00 run also failed it would have stamped Monday's date and
    // dropped Friday, Saturday and Sunday's filings and news for every tracked
    // thesis, permanently.
    //
    // Only a 4xx that is a fact about THIS REQUEST justifies giving up on the
    // batch — a malformed payload or one too large to send will fail the same
    // way every hour forever. Auth, quota, rate limits, timeouts and 5xx are
    // facts about the account or the network, and those get retried, which is
    // what the hourly schedule is for.
    const status = (err as { status?: number } | null)?.status;
    const requestIsTheProblem = status === 400 || status === 404 || status === 413 || status === 422;
    log.push(`[${ticker}] LLM error${status ? ` (${status})` : ''}: ${err instanceof Error ? err.message : String(err)}`
      + (requestIsTheProblem ? ' — giving up on this batch' : ' — leaving the scan window open for a retry'));
    if (requestIsTheProblem) await bumpLastScanned(db, thesisId);
    return { evidenceAdded, statusChanges, breaches };
  }

  // Validate and build insert rows
  const toInsert: Record<string, unknown>[] = [];
  // E2: per-row metadata that never reaches the DB, aligned with toInsert by index.
  const rowMeta: { confidence?: string; pillarClaim: string }[] = [];
  const validVerdicts = new Set(['supports', 'contradicts', 'neutral']);
  const validMaterialities = new Set(['material', 'context']);

  for (const row of llmRows) {
    // Validate indices
    const pi = row.pillar_index;
    const si = row.source_index;
    if (
      typeof pi !== 'number' ||
      typeof si !== 'number' ||
      pi < 1 || pi > pillars.length ||
      si < 1 || si > sortedCandidates.length
    ) {
      log.push(`[${ticker}] Dropping row: invalid indices pillar_index=${JSON.stringify(pi)} source_index=${JSON.stringify(si)}`);
      continue;
    }

    const pillar = pillars[pi - 1];
    const candidate = sortedCandidates[si - 1];

    // Validate enum values
    if (!validVerdicts.has(row.verdict)) continue;
    if (!validMaterialities.has(row.materiality)) continue;

    // Validate required strings
    if (!row.why || !row.what_it_means || !row.excerpt) continue;

    // Guard: hedged connection = loose thematic match, not evidence (KO fairlife case).
    if (isHedgedConnection(row.why, row.verdict as 'supports' | 'contradicts' | 'neutral')) {
      log.push(`[${ticker}] Dropping row: hedged connection "${row.why.slice(0, 90)}" for ${candidate?.source_key ?? `source ${si}`}`);
      continue;
    }

    let verdict = row.verdict as 'supports' | 'contradicts' | 'neutral';
    let materiality = row.materiality as 'material' | 'context';
    let excerpt = row.excerpt;

    // Guard: text sources must have excerpt found in source
    if (TEXT_SOURCES.has(candidate.source_type)) {
      if (!excerptFoundInSource(excerpt, candidate.sourceText)) {
        log.push(`[${ticker}] Dropping row: excerpt not found in source for ${candidate.source_key}`);
        continue;
      }
    }

    // Guard: price_move/xbrl overwrite excerpt with system string
    if (candidate.excerpt_override) {
      excerpt = candidate.excerpt_override;
    }

    // Guard: the citation has to be evidence, not a sentence that happened to
    // sit near the subject. The judge scores relevance, and a 10-Q's safe-harbor
    // paragraph is extremely relevant-looking — one was filed as CONTRADICTING a
    // MSTR pillar because it mentions "fluctuations in the price of Bitcoin".
    // Runs after the override so system-generated strings are judged as what
    // they actually are.
    const defect = citationDefect(excerpt, verdict, candidate.source_type);
    if (defect) {
      log.push(`[${ticker}] Dropping row: ${defect.code} (${defect.detail}) "${excerpt.slice(0, 70)}"`);
      continue;
    }

    // Guard: Form 4 with is10b5-1 => force context materiality
    if (candidate.source_type === 'form4' && candidate.form4Meta?.is10b51 === true) {
      materiality = 'context';
    }

    rowMeta.push({ confidence: typeof row.confidence === 'string' ? row.confidence : undefined, pillarClaim: pillar.claim });
    toInsert.push({
      pillar_id: pillar.id,
      user_id: user_id,
      verdict,
      materiality,
      source_class: sourceClassOf(candidate.source_type, row.claim_type),
      source_type: candidate.source_type,
      source_key: candidate.source_key,
      source_title: candidate.source_title,
      source_url: candidate.source_url ?? null,
      source_published_at: candidate.source_published_at ?? null,
      excerpt,
      why: row.why,
      what_it_means: row.what_it_means,
      consider: row.consider ?? null,
      is_backfill: liveCutoff
        ? !(candidate.source_published_at != null && candidate.source_published_at >= liveCutoff)
        : isBackfill,
    });
  }

  // E2: two-speed judge. Material or low-confidence rows get a senior review
  // from the stronger model before they can touch status math. Reviewer can
  // keep, downgrade to context, or reject; failures keep the original verdict.
  const escalationIdx = toInsert
    .map((r, i) => (needsEscalation({ materiality: r.materiality as string, confidence: rowMeta[i]?.confidence }) ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, ESCALATION_CAP);
  for (const r of toInsert) r.judged_by = model;
  if (escalationIdx.length > 0) {
    const { actions, reviewed } = await reviewEscalations(
      openai,
      escalationIdx.map((i) => ({
        pillarClaim: rowMeta[i].pillarClaim,
        verdict: toInsert[i].verdict as 'supports' | 'contradicts' | 'neutral',
        materiality: toInsert[i].materiality as 'material' | 'context',
        excerpt: toInsert[i].excerpt as string,
        why: toInsert[i].why as string,
      })),
      log,
    );
    const rejected = new Set<number>();
    actions.forEach((action, k) => {
      const i = escalationIdx[k];
      if (action === 'reject') {
        rejected.add(i);
        log.push(`[${ticker}] Escalation rejected row for ${toInsert[i].source_key}`);
      } else if (reviewed) {
        // Only attribute to the escalation model when it actually ran; on failure
        // the row keeps its original (mini) judged_by stamp set above.
        toInsert[i].judged_by = ESCALATION_MODEL;
        if (action === 'downgrade') toInsert[i].materiality = 'context';
      }
    });
    if (rejected.size > 0) {
      for (let i = toInsert.length - 1; i >= 0; i--) {
        if (rejected.has(i)) toInsert.splice(i, 1);
      }
    }
  }

  // Migration-056 tolerance: if judged_by does not exist yet, strip it so the
  // upsert cannot fail on an unapplied migration.
  if (toInsert.length > 0 && !(await hasJudgedByColumn(db))) {
    for (const r of toInsert) delete r.judged_by;
  }
  // Same tolerance for migration 057. Until it is applied the read layer infers
  // source class from the claim text instead.
  if (toInsert.length > 0 && !(await hasSourceClassColumn(db))) {
    for (const r of toInsert) delete r.source_class;
  }

  // Upsert evidence
  if (toInsert.length > 0) {
    const { error: upsertErr } = await db
      .from('pillar_evidence')
      .upsert(toInsert, { onConflict: 'pillar_id,source_key', ignoreDuplicates: true });
    if (upsertErr) {
      log.push(`[${ticker}] Upsert error: ${upsertErr.message}`);
    } else {
      evidenceAdded += toInsert.length;
      log.push(`[${ticker}] Upserted up to ${toInsert.length} evidence rows (duplicates skipped)`);
    }
  } else {
    log.push(`[${ticker}] No evidence rows to insert`);
  }

  // A price_move excerpt is system-generated ("TICKER fell 28.7% on DATE"); pull the
  // magnitude back out to flag severe adverse moves that break a pillar on their own.
  const SEVERE_MOVE_PCT = 20;
  const priceMovePct = (excerpt: string | null): number => {
    const m = (excerpt ?? '').match(/(\d+(?:\.\d+)?)%/);
    return m ? parseFloat(m[1]) : 0;
  };

  // Recompute status per confirmed pillar
  const investigationTriggers: InvestigationTrigger[] = [];
  for (const pillar of pillars) {
    try {
      const { data: evidenceRows } = await db
        .from('pillar_evidence')
        .select('verdict, materiality, source_type, source_key, is_backfill, created_at, excerpt, source_title, source_url')
        .eq('pillar_id', pillar.id);

      const evidence: EvidenceForStatus[] = (evidenceRows ?? []).map((e) => ({
        verdict: e.verdict as EvidenceForStatus['verdict'],
        materiality: e.materiality as EvidenceForStatus['materiality'],
        source_type: e.source_type as EvidenceForStatus['source_type'],
        source_key: e.source_key as string,
        is_backfill: e.is_backfill as boolean,
        created_at: e.created_at as string,
        severe: e.source_type === 'price_move' && priceMovePct(e.excerpt as string | null) >= SEVERE_MOVE_PCT,
      }));

      const newStatus = derivePillarStatus(evidence, pillar.status_override);

      // E1: a live, derived move to weakening/broken triggers a bounded
      // investigation after the pillar loop (never on backfill or override).
      if (
        (newStatus === 'weakening' || newStatus === 'broken') &&
        newStatus !== pillar.status &&
        !pillar.status_override &&
        !isBackfill
      ) {
        const recentContra = (evidenceRows ?? [])
          .filter((e) => !e.is_backfill)
          .map((e) => ({ source_type: e.source_type as string, verdict: e.verdict as string }));
        investigationTriggers.push({
          userId: user_id,
          thesisId,
          pillarId: pillar.id,
          ticker,
          pillarClaim: pillar.claim,
          breaksIf: pillar.breaks_if ?? null,
          newStatus,
          triggerKind: classifyTrigger(recentContra),
        });
      }

      if (newStatus !== pillar.status) {
        const { error: statusErr } = await db
          .from('thesis_pillars')
          .update({ status: newStatus, status_changed_at: new Date().toISOString() })
          .eq('id', pillar.id);
        if (statusErr) {
          log.push(`[${ticker}] Status update error for pillar ${pillar.id}: ${statusErr.message}`);
        } else {
          statusChanges++;
          log.push(`[${ticker}] Pillar ${pillar.id} status: ${pillar.status} -> ${newStatus}`);

          // Collect breach event: derived (not user-overridden) flip to broken
          // on a live scoring run. Backfill runs never alert.
          if (
            newStatus === 'broken' &&
            pillar.status !== 'broken' &&
            !pillar.status_override &&
            !isBackfill
          ) {
            const contradicting = (evidenceRows ?? [])
              .filter((e) => e.verdict === 'contradicts' && !e.is_backfill)
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
            if (contradicting) {
              breaches.push({
                userId: thesis.user_id,
                ticker,
                claim: pillar.claim,
                excerpt: contradicting.excerpt as string,
                sourceTitle: contradicting.source_title as string,
                sourceUrl: (contradicting.source_url as string | null) ?? null,
              });
            }
          }
        }
      }
    } catch (err) {
      log.push(`[${ticker}] Status recompute error for pillar ${pillar.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // E1: run bounded investigations for this scan's live status moves. Caps and
  // failures are handled inside runInvestigation; a memo error never fails a scan.
  for (const trigger of investigationTriggers) {
    await runInvestigation(db, openai, trigger, log);
  }

  // Always bump last_scanned_at
  await bumpLastScanned(db, thesisId);

  return { evidenceAdded, statusChanges, breaches };
}

// Migration-056 runtime detection, cached per process: one cheap probe select
// decides whether judged_by can be written. Deploy-before-migration stays safe.
let judgedByColumnKnown: boolean | null = null;
/**
 * What kind of independent confirmation this evidence is (migration 057).
 *
 * Everything except news is settled by the source type. For news the judge
 * answers the only question that matters, which is whether the excerpt reports
 * something that happened or argues a view. An unrecognised or missing answer
 * falls back to opinion, so a row can never escalate a pillar by default.
 */
function sourceClassOf(sourceType: string, claimType: unknown): string {
  switch (sourceType) {
    case 'filing': return 'company_filing';
    case 'xbrl': return 'xbrl';
    case 'form4': return 'insider';
    case 'price_move': return 'price';
    default: return claimType === 'reported_event' ? 'primary_news' : 'analyst_opinion';
  }
}

let sourceClassColumnKnown: boolean | null = null;

/**
 * Whether pillar_evidence.source_class exists.
 *
 * FAILS TOWARDS KEEPING THE DATA. An unknown answer used to resolve to `false`,
 * and the caller reads `false` as "strip the column and insert anyway" — so a
 * pooler blip or a timeout on this probe silently wrote a whole batch with no
 * source class at all. That is what happened in the week of 2026-08-10: 889 of
 * 1,278 rows lost their classification permanently, and source_class cannot be
 * recomputed afterwards because it is derived from a claim_type the row does
 * not store.
 *
 * On a genuinely unapplied migration the column really is absent, Postgres
 * answers 42703, and stripping is correct. On anything else the right move is
 * to keep the field: if the column is missing after all, the upsert fails
 * loudly and gets logged, which is a far better outcome than quietly degrading
 * the evidence the status engine will later be asked to weigh.
 */
async function hasSourceClassColumn(db: SupabaseClient): Promise<boolean> {
  if (sourceClassColumnKnown !== null) return sourceClassColumnKnown;
  const { error } = await db.from('pillar_evidence').select('source_class').limit(1);
  if (!error) sourceClassColumnKnown = true;
  else if (error.code === '42703') sourceClassColumnKnown = false; // undefined_column
  // Deliberately NOT `?? false`: unknown means keep the column, not drop it.
  return sourceClassColumnKnown ?? true;
}

async function hasJudgedByColumn(db: SupabaseClient): Promise<boolean> {
  if (judgedByColumnKnown !== null) return judgedByColumnKnown;
  const { error } = await db.from('pillar_evidence').select('judged_by').limit(1);
  // Only cache a definitive answer. A transient error (timeout, pooler blip) must
  // NOT poison the cache for the instance lifetime — re-probe next call instead.
  if (!error) judgedByColumnKnown = true;
  else if (error.code === '42703') judgedByColumnKnown = false; // undefined_column
  // Same reasoning as hasSourceClassColumn: unknown keeps the field. Losing
  // provenance silently is worse than an upsert that fails where we can see it.
  return judgedByColumnKnown ?? true;
}

async function bumpLastScanned(db: SupabaseClient, thesisId: string): Promise<void> {
  await db
    .from('theses')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', thesisId);
}
