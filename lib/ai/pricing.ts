// lib/ai/pricing.ts
// List prices for every model the judge paths call, and a ledger that turns a
// provider's usage object into dollars.
//
// The judge queue writes tokens and cost on every job row (migration 072), so
// "what did the watch cost today" is a SUM over judge_jobs rather than a guess
// from a rate card. This file is the rate card those rows are priced from.
//
// Verified 2026-09-05 against the vendor pricing pages:
//   Anthropic https://platform.claude.com/docs/en/about-claude/pricing
//     Sonnet 5  $2 in / $10 out. The $3/$15 increase scheduled for 2026-09-01
//               was cancelled; $2/$10 is the standard price.
//     Haiku 4.5 $1 in / $5 out.
//     Cache reads are 0.1x input, 5-minute cache writes 1.25x input.
//   OpenAI https://developers.openai.com/api/docs/pricing
//     gpt-4o      $2.50 in / $10 out, cached input $1.25
//     gpt-4o-mini $0.15 in / $0.60 out, cached input $0.075
//
// An unknown model prices at zero and is flagged, never silently guessed: the
// ledger's `unpriced` list says which model needs a row here.

/** Per million tokens, USD. */
export interface ModelPrice {
  input: number;
  output: number;
  /** Cache read (Anthropic "cache hits", OpenAI "cached input"). */
  cacheRead: number;
  /** Cache write (Anthropic 5-minute cache creation). OpenAI has no write charge. */
  cacheWrite: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-5': { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0, cacheRead: 1.25, cacheWrite: 0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0 },
};

/** Provider-neutral token counts for one call. `input` excludes cache tokens. */
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const ZERO_USAGE: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export function isPriced(model: string): boolean {
  return model in MODEL_PRICES;
}

/** Dollars for one call. Unknown model returns 0; check isPriced() to tell 0 from free. */
export function costUsd(model: string, u: TokenUsage): number {
  const p = MODEL_PRICES[model];
  if (!p) return 0;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
}

/**
 * Anthropic Messages API usage. `input_tokens` already excludes the cached
 * portions, which arrive as cache_read_input_tokens / cache_creation_input_tokens.
 */
export function usageFromAnthropic(u: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined): TokenUsage {
  return {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}

/**
 * OpenAI Chat Completions usage. `prompt_tokens` INCLUDES the cached tokens
 * reported under prompt_tokens_details.cached_tokens, so they are split out
 * here and priced at the cached rate.
 */
export function usageFromOpenAI(u: {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
} | null | undefined): TokenUsage {
  const prompt = u?.prompt_tokens ?? 0;
  const cached = u?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    input: Math.max(0, prompt - cached),
    output: u?.completion_tokens ?? 0,
    cacheRead: cached,
    cacheWrite: 0,
  };
}

export interface ModelTotals extends TokenUsage {
  calls: number;
  costUsd: number;
}

/**
 * Running totals for one unit of work (a thesis scan, a judge job, a cron run).
 * Callers pass one ledger down through every model call and read the totals
 * back at the end. Mutated in place on purpose: the judge paths are deep and
 * threading a return value through every fallback branch is how usage gets lost.
 */
export interface UsageLedger extends ModelTotals {
  byModel: Record<string, ModelTotals>;
  /** Models that were called but have no row in MODEL_PRICES. */
  unpriced: string[];
}

export function emptyLedger(): UsageLedger {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, byModel: {}, unpriced: [] };
}

export function recordUsage(ledger: UsageLedger, model: string, u: TokenUsage): number {
  const cost = costUsd(model, u);
  const m = (ledger.byModel[model] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 });
  for (const t of [ledger, m]) {
    t.calls += 1;
    t.input += u.input;
    t.output += u.output;
    t.cacheRead += u.cacheRead;
    t.cacheWrite += u.cacheWrite;
    t.costUsd += cost;
  }
  if (!isPriced(model) && !ledger.unpriced.includes(model)) ledger.unpriced.push(model);
  return cost;
}

/** Fold one ledger into another (a job into a run, a run into a day). */
export function mergeLedger(into: UsageLedger, from: UsageLedger): void {
  for (const [model, m] of Object.entries(from.byModel)) {
    const t = (into.byModel[model] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 });
    t.calls += m.calls; t.input += m.input; t.output += m.output;
    t.cacheRead += m.cacheRead; t.cacheWrite += m.cacheWrite; t.costUsd += m.costUsd;
  }
  into.calls += from.calls; into.input += from.input; into.output += from.output;
  into.cacheRead += from.cacheRead; into.cacheWrite += from.cacheWrite; into.costUsd += from.costUsd;
  for (const m of from.unpriced) if (!into.unpriced.includes(m)) into.unpriced.push(m);
}

/** One log line: "3 calls · in 4,120 · out 610 · cache 2,900 · $0.0231 (claude-sonnet-5 $0.02, gpt-4o-mini $0.00)". */
/**
 * Dollars one cron invocation may spend before it stops and leaves the rest
 * for the next run: the hourly scan, one news-watch tick. LLM_RUN_USD, default $1.
 * The judge worker has its own per-day cap (JUDGE_DAILY_USD) because its work
 * is queued, not windowed.
 */
export function readRunCeilingUsd(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.LLM_RUN_USD);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function describeLedger(l: UsageLedger): string {
  const n = (x: number) => x.toLocaleString('en-US');
  const per = Object.entries(l.byModel).map(([m, t]) => `${m} $${t.costUsd.toFixed(4)}`).join(', ');
  const flag = l.unpriced.length ? ` UNPRICED: ${l.unpriced.join(', ')}` : '';
  return `${l.calls} call${l.calls === 1 ? '' : 's'} · in ${n(l.input)} · out ${n(l.output)} · cache ${n(l.cacheRead)} · $${l.costUsd.toFixed(4)}${per ? ` (${per})` : ''}${flag}`;
}
