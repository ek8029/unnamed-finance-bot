import Anthropic from '@anthropic-ai/sdk';

// Lazy-init, for the same reason lib/free-news.ts and lib/content/generate.ts are:
// a module-scope `new Anthropic()` throws at import time on any deploy where the key
// is not set, which takes down every route that transitively imports this file. A
// missing key must fail at the call site, where the caller can fall back.
let _client: Anthropic | null = null;

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  return (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}

/** The brief writer. Sonnet 5 takes output_config.effort and NO temperature. */
export const DIGEST_MODEL = 'claude-sonnet-5';

/** Anthropic list price per 1M tokens, for the cost line in the cron log. */
export const DIGEST_PRICING = { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 };

export function anthropicCostUsd(u: {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}): number {
  const p = DIGEST_PRICING;
  return (
    (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) /
    1_000_000
  );
}
