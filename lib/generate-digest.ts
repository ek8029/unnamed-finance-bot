import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getQuote } from '@/lib/financial-data';
import { getVixQuote } from '@/lib/vix';
import { getSourceTier } from '@/lib/news-quality';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import { getAnthropic, hasAnthropicKey, DIGEST_MODEL, anthropicCostUsd } from '@/lib/anthropic';
import { buildDigestContext } from '@/lib/digest/pack';
import { L7, validate, retryLine } from '@/lib/digest/validate';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function createCronServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface DigestResult {
  digest: string;
  holdings: string[];
  tokens: number;
  /** Which generator actually produced this brief. Logged by the cron on every user. */
  path: 'claude' | 'template' | 'openai-fallback';
  costUsd: number;
}

// ---------- the ranked brief (round-6 design, claude-sonnet-5) ----------

const MAX_TOKENS = 1500;
/** only used when a thinking model spends the whole budget and returns no text */
const MAX_TOKENS_RETRY = 4000;

interface ClaudeCall { text: string; tokens: number; costUsd: number }

async function callClaude(system: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<ClaudeCall> {
  const anthropic = getAnthropic();
  let maxTokens = MAX_TOKENS;
  for (;;) {
    const res = await anthropic.messages.create({
      model: DIGEST_MODEL,
      max_tokens: maxTokens,
      // The layer is identical for every user in a run, so it is the cache prefix. The facts
      // vary per user and sit after it, in the messages.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
      // Sonnet 5 takes output_config.effort and rejects temperature.
      output_config: { effort: 'low' },
    });
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const usage = {
      input: res.usage.input_tokens ?? 0,
      output: res.usage.output_tokens ?? 0,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
      cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
    };
    const call: ClaudeCall = {
      text,
      tokens: usage.input + usage.output + usage.cacheRead + usage.cacheWrite,
      costUsd: anthropicCostUsd(usage),
    };
    if (res.stop_reason === 'refusal') throw new Error('claude refused the brief');
    if (!text.trim()) {
      if (res.stop_reason === 'max_tokens' && maxTokens === MAX_TOKENS) {
        maxTokens = MAX_TOKENS_RETRY; // thinking consumed the budget; one retry with room
        continue;
      }
      throw new Error(`empty completion (stop_reason ${res.stop_reason})`);
    }
    return call;
  }
}

/**
 * The round-6 brief: a deterministic ranked pack, a model that only narrates it, a
 * deterministic validator with one retry, and a closing sentence written by code.
 * Throws on any model failure so the caller can fall back.
 */
async function generateRankedDigest(userId: string, userHoldings: string[]): Promise<DigestResult> {
  const ctx = await buildDigestContext(userId);

  // Quiet day: nothing qualified, so there is nothing to narrate and no model call to pay for.
  if (ctx.quiet) {
    return { digest: ctx.templateText, holdings: userHoldings, tokens: 0, path: 'template', costUsd: 0 };
  }

  if (!hasAnthropicKey()) throw new Error('ANTHROPIC_API_KEY missing');

  const system = `${INJECTION_GUARD}\n${L7}`;
  const user = fence(ctx.pack, 'FACTS');

  const first = await callClaude(system, [{ role: 'user', content: user }]);
  let body = first.text;
  let tokens = first.tokens;
  let costUsd = first.costUsd;

  let val = validate(body, ctx.pack);
  if (!val.passed) {
    // One rewrite: the failed draft goes back as an assistant turn, the check list as the
    // next user line, same system and facts otherwise.
    const second = await callClaude(system, [
      { role: 'user', content: user },
      { role: 'assistant', content: body },
      { role: 'user', content: retryLine(val.violations) },
    ]);
    body = second.text;
    tokens += second.tokens;
    costUsd += second.costUsd;
    val = validate(body, ctx.pack);
    if (!val.passed) {
      console.warn(`[digest] validator failed twice for ${userId.slice(0, 8)}: ${val.violations.join(' | ')}`);
    }
  }

  return {
    digest: `${body.trim()}\n\n${ctx.closer}`,
    holdings: userHoldings,
    tokens,
    path: 'claude',
    costUsd,
  };
}

/**
 * Generate the morning brief for one user.
 *
 * With a `userId` this runs the round-6 ranked-pack generator on claude-sonnet-5. Without
 * one it can only run the legacy path, because the ranked pack is built per account.
 * Any failure of the ranked path (missing key, refusal, API error, a database read that
 * throws) falls back to gpt-4o-mini rather than leaving somebody with no brief: a silent
 * zero balance on one provider already took this feature down once.
 */
export async function generateDigest(userHoldings: string[], userId?: string): Promise<DigestResult> {
  if (userId) {
    try {
      const r = await generateRankedDigest(userId, userHoldings);
      console.log(`[digest] ${userId.slice(0, 8)} path=${r.path} tokens=${r.tokens} cost=$${r.costUsd.toFixed(5)}`);
      return r;
    } catch (err) {
      console.error(
        `[digest] ${userId.slice(0, 8)} ranked path failed, falling back to gpt-4o-mini: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
  const r = await generateLegacyDigest(userHoldings);
  console.log(`[digest] ${userId ? `${userId.slice(0, 8)} ` : ''}path=${r.path} tokens=${r.tokens}`);
  return r;
}

// ---------- the fallback: the previous gpt-4o-mini generator, unchanged ----------

/**
 * Generate an AI-narrated portfolio digest for a user.
 * Pulls position-relevant + general news from market_news,
 * market snapshot from Finnhub, and writes a 150-250 word brief.
 */
async function generateLegacyDigest(userHoldings: string[]): Promise<DigestResult> {
  const supabase = createCronServiceClient();
  const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [positionNewsResult, generalNewsResult, spyQuote, vixQuote] =
    await Promise.all([
      userHoldings.length > 0
        ? supabase
            .from('market_news')
            .select(
              'title, summary, source, published_at, primary_ticker, sentiment',
            )
            .in('primary_ticker', userHoldings)
            .gte('published_at', oneDayAgo)
            .order('published_at', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('market_news')
        .select(
          'title, summary, source, published_at, primary_ticker, sentiment',
        )
        .gte('published_at', oneDayAgo)
        .order('published_at', { ascending: false })
        .limit(10),
      getQuote('SPY'),
      getVixQuote(),
    ]);

  // Deduplicate
  const seenTitles = new Set<string>();
  const positionNews = (positionNewsResult.data || []).filter((n) => {
    if (seenTitles.has(n.title)) return false;
    seenTitles.add(n.title);
    return true;
  });

  const generalNews = (generalNewsResult.data || [])
    .filter((n) => !seenTitles.has(n.title))
    .filter((n) => {
      if (seenTitles.has(n.title)) return false;
      seenTitles.add(n.title);
      return true;
    })
    .slice(0, 6);

  // Build prompt context
  const marketContext = [
    spyQuote
      ? `SPY: $${spyQuote.c.toFixed(2)} (${spyQuote.dp >= 0 ? '+' : ''}${spyQuote.dp.toFixed(2)}%)`
      : null,
    vixQuote
      ? `VIX: ${vixQuote.value.toFixed(2)} (${vixQuote.changePct >= 0 ? '+' : ''}${vixQuote.changePct.toFixed(2)}% today). Options are pricing a ±${vixQuote.pricedDayPct.toFixed(2)}% one-sigma day for the S&P; two days in three close inside that band. Cite the ±% band, not a fear label.`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const holdingsStr =
    userHoldings.length > 0
      ? userHoldings.join(', ')
      : 'No holdings connected';

  const positionNewsStr =
    positionNews
      .map(
        (n) =>
          `- [${n.primary_ticker}] ${n.title} (${getSourceTier(n.source) === 'tier1' ? 'Major' : 'Standard'} source: ${n.source}, sentiment: ${n.sentiment ?? 'neutral'})`,
      )
      .join('\n') || 'No position-specific news';

  const generalNewsStr =
    generalNews
      .map(
        (n) =>
          `- ${n.title} (${n.source}, sentiment: ${n.sentiment ?? 'neutral'})`,
      )
      .join('\n') || 'No general news';

  const prompt = `${INJECTION_GUARD}
You are writing the morning brief for an individual investor's financial intelligence terminal called "The Current" by Helm Terminal. The tone is concise, direct, and informed — like a sharp analyst note, not a chatbot. No greetings, no sign-offs. Write in second person ("your portfolio").

MARKET SNAPSHOT:
${marketContext || 'Market data unavailable'}

USER HOLDS: ${holdingsStr}

NEWS AFFECTING HOLDINGS (last 48 hours):
${fence(positionNewsStr, 'NEWS')}

GENERAL MARKET NEWS:
${fence(generalNewsStr, 'NEWS')}

Write a 3-4 paragraph digest (150-250 words total):

1. LEAD: What's the single most important thing affecting this portfolio right now? Start with it. No throat-clearing.

2. HOLDINGS IMPACT: Connect 2-3 news stories to specific holdings. Use ticker symbols. Mention sentiment direction. Be specific about what happened, not vague ("NVDA supply chain concerns in Reuters report" not "some stocks had news").

3. BROADER CONTEXT: One paragraph on market conditions — what's the VIX saying, where is SPY trending, any macro themes from the general news.

4. WATCHLIST (optional, only if warranted): One sentence on something to watch today — an earnings report, a Fed speaker, a technical level.

Rules:
- No bullet points. Flowing prose paragraphs only.
- No hedging language ("could potentially", "may or may not"). Be direct.
- Cite specific sources when quality is high (WSJ, Reuters, Bloomberg).
- If news is thin, say so honestly — "Light news day for your holdings."
- Never give financial advice. You are summarizing and connecting dots, not recommending action.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const digest =
    completion.choices[0]?.message?.content ?? 'Digest generation failed.';

  return {
    digest,
    holdings: userHoldings,
    tokens: completion.usage?.total_tokens ?? 0,
    path: 'openai-fallback',
    costUsd: 0,
  };
}

/**
 * Generate a market-level digest for users who haven't connected accounts.
 * Frames content as a general market brief, never referencing "your portfolio."
 */
export async function generateGenericDigest(): Promise<DigestResult> {
  const supabase = createCronServiceClient();
  const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const keyTickers = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'GOOGL', 'META'];

  const [tickerNewsResult, generalNewsResult, spyQuote, vixQuote] =
    await Promise.all([
      supabase
        .from('market_news')
        .select(
          'title, summary, source, published_at, primary_ticker, sentiment',
        )
        .in('primary_ticker', keyTickers)
        .gte('published_at', oneDayAgo)
        .order('published_at', { ascending: false })
        .limit(10),
      supabase
        .from('market_news')
        .select(
          'title, summary, source, published_at, primary_ticker, sentiment',
        )
        .gte('published_at', oneDayAgo)
        .order('published_at', { ascending: false })
        .limit(10),
      getQuote('SPY'),
      getVixQuote(),
    ]);

  // Deduplicate
  const seenTitles = new Set<string>();
  const tickerNews = (tickerNewsResult.data || []).filter((n) => {
    if (seenTitles.has(n.title)) return false;
    seenTitles.add(n.title);
    return true;
  });

  const generalNews = (generalNewsResult.data || [])
    .filter((n) => !seenTitles.has(n.title))
    .filter((n) => {
      if (seenTitles.has(n.title)) return false;
      seenTitles.add(n.title);
      return true;
    })
    .slice(0, 6);

  const marketContext = [
    spyQuote
      ? `SPY: $${spyQuote.c.toFixed(2)} (${spyQuote.dp >= 0 ? '+' : ''}${spyQuote.dp.toFixed(2)}%)`
      : null,
    vixQuote
      ? `VIX: ${vixQuote.value.toFixed(2)} (${vixQuote.changePct >= 0 ? '+' : ''}${vixQuote.changePct.toFixed(2)}% today). Options are pricing a ±${vixQuote.pricedDayPct.toFixed(2)}% one-sigma day for the S&P; two days in three close inside that band. Cite the ±% band, not a fear label.`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const tickerNewsStr =
    tickerNews
      .map(
        (n) =>
          `- [${n.primary_ticker}] ${n.title} (${getSourceTier(n.source) === 'tier1' ? 'Major' : 'Standard'} source: ${n.source}, sentiment: ${n.sentiment ?? 'neutral'})`,
      )
      .join('\n') || 'No ticker-specific news';

  const generalNewsStr =
    generalNews
      .map(
        (n) =>
          `- ${n.title} (${n.source}, sentiment: ${n.sentiment ?? 'neutral'})`,
      )
      .join('\n') || 'No general news';

  const prompt = `${INJECTION_GUARD}
You are writing a daily market brief for Helm Terminal's "The Current." This goes to users who have not yet connected a brokerage account, so this is a general market overview — not a portfolio brief. Never say "your portfolio," "your holdings," or "your positions." The tone is concise, direct, and informed — like a sharp analyst note. No greetings, no sign-offs.

MARKET SNAPSHOT:
${marketContext || 'Market data unavailable'}

KEY MARKET MOVERS (${keyTickers.join(', ')}):
${fence(tickerNewsStr, 'NEWS')}

GENERAL MARKET NEWS:
${fence(generalNewsStr, 'NEWS')}

Write a 3-4 paragraph market brief (150-250 words total):

1. LEAD: What is the single most important market story right now? Start with it. No throat-clearing.

2. KEY MOVERS: Cover 2-3 of the biggest names moving today. Use ticker symbols. Mention sentiment direction. Be specific about what happened ("NVDA supply chain concerns per Reuters report" not "some stocks had news").

3. BROADER CONTEXT: One paragraph on market conditions — what the VIX is signaling, where SPY is trending, any macro themes from the news.

4. WATCHLIST (optional, only if warranted): One sentence on something to watch today — an earnings report, a Fed speaker, a technical level.

Rules:
- No bullet points. Flowing prose paragraphs only.
- No hedging language ("could potentially", "may or may not"). Be direct.
- Cite specific sources when quality is high (WSJ, Reuters, Bloomberg).
- If news is thin, say so honestly — "Light news day across major names."
- Never give financial advice. You are summarizing and connecting dots, not recommending action.
- Never reference a user's portfolio, holdings, or positions. This is a market brief.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const digest =
    completion.choices[0]?.message?.content ?? 'Digest generation failed.';

  return {
    digest,
    holdings: [],
    tokens: completion.usage?.total_tokens ?? 0,
    path: 'openai-fallback',
    costUsd: 0,
  };
}
