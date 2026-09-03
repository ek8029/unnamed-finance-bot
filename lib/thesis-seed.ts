import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getCompanyProfileEdgar } from '@/lib/edgar';
import { analyzeStock } from '@/lib/analyze-stock';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The drafting model. Measured offline on 12 held tickers, two independent runs,
// a blind arbiter panel that never sees which model wrote which set: haiku scores
// 7.98 overall against gpt-4o-mini's 3.46, and 97.6% of its kill criteria name a
// real observable against gpt-4o-mini's 46.7%. That second number is the one that
// matters: lib/score-theses.ts can only return `contradicts` when breaks_if names
// something a source can advance, so a vague kill criterion is an unfalsifiable
// pillar. At the measured rate of 56 drafts per 30 days this costs $0.14/month.
//
// Quality still comes from GROUNDING as much as from the model: we feed the
// cached /analyze analysis (summary + bull/bear case) so pillars rest on current
// data instead of the model's training-set memory of the company.
const SEED_MODEL = 'claude-haiku-4-5';

// Haiku 4.5 takes NO thinking parameter and NO effort parameter; sending either
// is an error. Observed output across 12 tickers topped out at 431 tokens with
// every call ending `end_turn`, so 900 was never actually hit — but haiku writes
// ~45% longer claims than gpt-4o-mini did, a four-pillar set on a multi-segment
// company is the tail, and a truncated response is unparseable JSON that falls
// all the way through to OpenAI. 1400 is ~3x the observed max and costs nothing
// unless it is used (output is billed per token, not per ceiling).
const SEED_MAX_TOKENS = 1400;

// The fallback. Kept exactly as it shipped so a bad Anthropic day degrades to
// the old behaviour rather than to an empty pillar set.
const FALLBACK_MODEL = 'gpt-4o-mini';
const FALLBACK_MAX_TOKENS = 900;

// Anthropic has no `response_format: json_object`. Both system prompts already
// end with the exact JSON shape; this only forbids the wrapper prose that would
// otherwise need stripping.
const JSON_ONLY = '\nReturn ONLY that JSON object. No preamble, no commentary, no markdown code fence.';

export interface SeededPillar {
  claim: string;
  /** One sentence naming the checkable evidence that would falsify the claim. */
  breaksIf: string | null;
}

export interface DraftOptions {
  /** Existing (non-dismissed) pillar claims — the model must not duplicate these. */
  existingClaims?: string[];
  /** From the securities table, when known. Used to detect funds/ETFs. */
  assetClass?: string | null;
  securityName?: string | null;
}

/** ETFs and funds have no business thesis — they get a vehicle-level prompt. */
function isFund(opts: DraftOptions, edgarName: string | null): boolean {
  const ac = (opts.assetClass ?? '').toLowerCase();
  if (/(^|\b)(etf|etn|mutual fund|fund|index)($|\b)/.test(ac)) return true;
  const name = opts.securityName ?? edgarName ?? '';
  return /\bETF\b|\bIndex Fund\b|\bETN\b/i.test(name);
}

const COMPANY_SYSTEM = `You are a fundamental equity analyst. Draft 2-4 short thesis pillars: the core reasons a long-term investor would own this stock.

Rules:
- Each pillar is a single declarative sentence about the BUSINESS: demand drivers, competitive position, product cycles, market share, margins, or capital allocation.
- Each pillar must rest on a DIFFERENT driver. No two pillars may lean on the same underlying driver (e.g. two flavors of "AI demand" count as one driver).
- Each pillar must be checkable against future SEC filings or news: a specific filing or headline could clearly support or contradict it.
- When an ANALYSIS block is provided, ground the pillars in it. Do not contradict it. Prefer its named segments, moats, and growth drivers over generic claims.
- If EXISTING pillars are provided, do not duplicate or paraphrase them; propose distinct drivers.
- NEVER write pillars about SEC filing activity itself. Filing frequency, form types (8-K, 10-K, 13F, Form 144), or insider transaction filings are evidence sources, not reasons to own a stock.
- No hedging words: no "may", "could", "might", "potentially", "perhaps", "suggests".
- Do not invent specific numbers.
- No em dashes.
- For each pillar also write "breaks_if": ONE short sentence naming the concrete, checkable evidence that would falsify the claim (a filing disclosure, guidance change, contract loss, margin print, or comparable headline event). Same rules: declarative, no hedging.
- Respond with JSON matching exactly: { "pillars": [{ "claim": "...", "breaks_if": "..." }] }`;

const FUND_SYSTEM = `You are a fundamental analyst. The ticker is a FUND or ETF, not an operating company. Draft 2-3 short thesis pillars: the core reasons a long-term investor would hold this vehicle.

Rules:
- Pillars are about the VEHICLE and what it holds: the exposure or index it delivers, the durability of the theme or factor it tracks, cost/structure advantages, or the health of the underlying driver its holdings lean on.
- Each pillar rests on a DIFFERENT driver.
- Each pillar must be checkable against future filings, index data, or news about the fund or its major holdings.
- If EXISTING pillars are provided, do not duplicate or paraphrase them.
- No hedging words, no invented numbers, no em dashes.
- For each pillar also write "breaks_if": ONE short sentence naming the concrete evidence that would falsify it.
- Respond with JSON matching exactly: { "pillars": [{ "claim": "...", "breaks_if": "..." }] }`;

let anthropicClient: Anthropic | null = null;

/**
 * Lazy-init. A module-scope `new Anthropic()` throws at import time wherever the
 * key is absent, which would take down every route that transitively imports
 * this file. A missing key has to fail here, at the call site, so the OpenAI
 * fallback can run.
 */
function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  return (anthropicClient ??= new Anthropic({ apiKey: key }));
}

/**
 * Defensive parse. Anthropic can prepend prose or wrap the object in a fence
 * despite the instruction, so take the outermost braces rather than trusting the
 * whole string to be JSON. Returns [] on anything unusable; the caller treats
 * that as a failed lane and falls back.
 */
function parsePillars(raw: string): SeededPillar[] {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('pillars' in parsed) ||
    !Array.isArray((parsed as Record<string, unknown>).pillars)
  ) {
    return [];
  }

  return (parsed as { pillars: unknown[] }).pillars
    .filter(
      (p): p is { claim: string; breaks_if?: unknown } =>
        typeof p === 'object' &&
        p !== null &&
        'claim' in p &&
        typeof (p as Record<string, unknown>).claim === 'string' &&
        ((p as Record<string, unknown>).claim as string).trim().length > 0
    )
    .map((p) => ({
      claim: p.claim.trim(),
      breaksIf:
        typeof p.breaks_if === 'string' && p.breaks_if.trim().length > 0
          ? p.breaks_if.trim()
          : null,
    }))
    .slice(0, 4);
}

async function draftViaAnthropic(system: string, userPrompt: string): Promise<SeededPillar[]> {
  const res = await getAnthropicClient().messages.create({
    model: SEED_MODEL,
    max_tokens: SEED_MAX_TOKENS,
    system: `${system}${JSON_ONLY}`,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const pillars = parsePillars(text);
  if (pillars.length === 0) {
    throw new Error(`unusable response (stop=${res.stop_reason ?? 'unknown'})`);
  }
  return pillars;
}

async function draftViaOpenAI(system: string, userPrompt: string): Promise<SeededPillar[]> {
  const response = await openai.chat.completions.create({
    model: FALLBACK_MODEL,
    response_format: { type: 'json_object' },
    max_tokens: FALLBACK_MAX_TOKENS,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
  });
  return parsePillars(response.choices[0]?.message?.content ?? '');
}

export async function draftPillars(ticker: string, opts: DraftOptions = {}): Promise<SeededPillar[]> {
  try {
    // Grounding context, all cached/cheap: EDGAR profile (name/industry) plus the
    // cached /analyze analysis (allowGenerate=false — never bills a new analysis).
    const [profile, analyzed] = await Promise.all([
      getCompanyProfileEdgar(ticker),
      analyzeStock(ticker, false).catch(() => null),
    ]);

    const profileContext = profile
      ? `Company: ${profile.name}\nIndustry: ${profile.sicDescription ?? 'Unknown'}\nExchange: ${profile.exchange ?? 'Unknown'}`
      : `Ticker: ${ticker}`;

    const analysis = analyzed?.analysis;
    const analysisContext = analysis
      ? [
          analysis.summary ? `Summary: ${analysis.summary}` : null,
          analysis.bullCase ? `Bull case: ${analysis.bullCase}` : null,
          analysis.bearCase ? `Bear case: ${analysis.bearCase}` : null,
        ].filter(Boolean).join('\n')
      : '';

    const existing = (opts.existingClaims ?? []).filter((c) => c.trim().length > 0);

    const userPrompt = [
      fence(profileContext, 'PROFILE'),
      analysisContext ? fence(analysisContext, 'ANALYSIS') : null,
      existing.length > 0 ? fence(existing.map((c, i) => `${i + 1}. ${c}`).join('\n'), 'EXISTING') : null,
      `\nDraft thesis pillars for ${ticker}.`,
    ].filter(Boolean).join('\n\n');

    const system = `${INJECTION_GUARD}\n${isFund(opts, profile?.name ?? null) ? FUND_SYSTEM : COMPANY_SYSTEM}`;

    // Anthropic first, OpenAI second. A missing key, a failed call, a truncated
    // response and unparseable JSON all land in the same place: the fallback.
    // Never return an empty set while the other lane could still produce one.
    try {
      const pillars = await draftViaAnthropic(system, userPrompt);
      console.log(`[thesis-seed] drafted ${pillars.length} pillars for ${ticker} via ${SEED_MODEL}`);
      return pillars;
    } catch (anthropicError) {
      console.error(
        `[thesis-seed] draftPillars failed: ${SEED_MODEL} lane for ${ticker}, falling back to ${FALLBACK_MODEL}:`,
        anthropicError,
      );
    }

    const pillars = await draftViaOpenAI(system, userPrompt);
    console.log(`[thesis-seed] drafted ${pillars.length} pillars for ${ticker} via ${FALLBACK_MODEL} (fallback)`);
    return pillars;
  } catch (error) {
    console.error('[thesis-seed] draftPillars failed: both lanes:', error);
    return [];
  }
}
