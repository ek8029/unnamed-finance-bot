import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getQuote } from '@/lib/financial-data';
import { getSourceTier } from '@/lib/news-quality';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function createCronServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface DigestResult {
  digest: string;
  holdings: string[];
  tokens: number;
}

/**
 * Generate an AI-narrated portfolio digest for a user.
 * Pulls position-relevant + general news from market_news,
 * market snapshot from Finnhub, and writes a 150-250 word brief.
 */
export async function generateDigest(
  userHoldings: string[],
): Promise<DigestResult> {
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
      getQuote('VIXY'),
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
      ? `VIX proxy (VIXY): $${vixQuote.c.toFixed(2)} (${vixQuote.dp >= 0 ? '+' : ''}${vixQuote.dp.toFixed(2)}%)`
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
      getQuote('VIXY'),
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
      ? `VIX proxy (VIXY): $${vixQuote.c.toFixed(2)} (${vixQuote.dp >= 0 ? '+' : ''}${vixQuote.dp.toFixed(2)}%)`
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
  };
}
