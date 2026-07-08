import OpenAI from 'openai';
import { getCompanyProfileEdgar } from '@/lib/edgar';
import { analyzeStock } from '@/lib/analyze-stock';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Drafts are user-reviewed and edited before they ever count, so mini is sufficient
// here and ~16x cheaper than gpt-4o. Quality comes from GROUNDING, not model size:
// we feed the cached /analyze analysis (summary + bull/bear case) so pillars rest
// on current data instead of the model's training-set memory of the company.
const SEED_MODEL = 'gpt-4o-mini';

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

    const response = await openai.chat.completions.create({
      model: SEED_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `${INJECTION_GUARD}\n${isFund(opts, profile?.name ?? null) ? FUND_SYSTEM : COMPANY_SYSTEM}`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('pillars' in parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).pillars)
    ) {
      console.error('[thesis-seed] Unexpected response shape:', raw);
      return [];
    }

    const pillars = (parsed as { pillars: unknown[] }).pillars
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

    return pillars;
  } catch (error) {
    console.error('[thesis-seed] draftPillars failed:', error);
    return [];
  }
}
