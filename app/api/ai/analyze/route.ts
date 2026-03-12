import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Query type detection ──

type QueryType = 'stock_analysis' | 'portfolio_review' | 'general';

function detectQueryType(query: string, hasTickers: boolean): QueryType {
  const lower = query.toLowerCase();
  const portfolioKeywords = [
    'my portfolio', 'my holdings', 'my positions', 'my stocks', 'my investments',
    'portfolio', 'holdings', 'weakspot', 'weak spot', 'improve', 'rebalance',
    'diversif', 'exposure', 'overweight', 'underweight', 'concentrated',
    'allocation', 'what do i own', 'what am i holding', 'my account',
    'optimize', 'review my', 'analyze my', 'how is my', 'how are my',
    'risk in my', 'suggest changes', 'what should i',
  ];

  if (portfolioKeywords.some(kw => lower.includes(kw))) return 'portfolio_review';
  if (hasTickers) return 'stock_analysis';
  return 'general';
}

// ── Ticker extraction ──

function extractTickers(query: string): string[] {
  const explicit = query.match(/\b[A-Z]{1,5}\b/g) || [];
  const dollar = query.match(/\$([A-Za-z]{1,5})/g)?.map(t => t.replace('$', '').toUpperCase()) || [];
  const lower = query.match(/\b(?:aapl|msft|goog|googl|amzn|nvda|tsla|meta|nflx|amd|intc|spy|qqq|voo)\b/gi)?.map(t => t.toUpperCase()) || [];

  const all = [...new Set([...explicit, ...dollar, ...lower])];
  const stopWords = new Set(['I', 'A', 'IS', 'IT', 'TO', 'IN', 'ON', 'AT', 'BY', 'OR', 'AN', 'OF', 'IF', 'DO', 'MY', 'SO', 'UP', 'AM', 'BE', 'NO', 'VS', 'THE', 'AND', 'FOR', 'BUT', 'NOT', 'ARE', 'WAS', 'HAS', 'CAN', 'HOW', 'WHY', 'ALL', 'NOW', 'ITS', 'LOW', 'HIGH', 'BUY', 'NEW', 'BIG', 'OLD', 'KEY', 'EPS', 'YOY', 'QOQ', 'CEO', 'CFO', 'IPO']);
  return all.filter(t => t.length >= 2 && !stopWords.has(t));
}

// ── Portfolio data fetching ──

interface UserHolding {
  ticker: string;
  shares: number;
  current_price: number;
  total_value: number;
  average_cost_basis: number | null;
  total_cost_basis: number | null;
  unrealised_gain_loss: number | null;
  unrealised_gain_loss_pct: number | null;
  day_change_pct: number | null;
  portfolio_allocation_pct: number | null;
  security: {
    security_name: string | null;
    asset_class: string | null;
    sector: string | null;
    exchange: string | null;
  } | null;
}

async function getUserPortfolio(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<UserHolding[]> {
  const { data, error } = await supabase
    .from('holdings')
    .select(`
      ticker, shares, current_price, total_value,
      average_cost_basis, total_cost_basis,
      unrealised_gain_loss, unrealised_gain_loss_pct,
      day_change_pct, portfolio_allocation_pct,
      security:securities(security_name, asset_class, sector, exchange)
    `)
    .eq('user_id', userId)
    .order('total_value', { ascending: false });

  if (error) {
    console.error('Failed to fetch holdings:', error);
    return [];
  }
  return (data || []) as unknown as UserHolding[];
}

function buildPortfolioContext(holdings: UserHolding[]): string {
  if (holdings.length === 0) return '';

  const totalValue = holdings.reduce((sum, h) => sum + (h.total_value || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.total_cost_basis || 0), 0);
  const totalGainLoss = holdings.reduce((sum, h) => sum + (h.unrealised_gain_loss || 0), 0);

  const lines: string[] = [
    '=== USER PORTFOLIO ===',
    `Total Value: $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Cost Basis: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Unrealized P&L: $${totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${totalCost > 0 ? ((totalGainLoss / totalCost) * 100).toFixed(2) : '0.00'}%)`,
    `Positions: ${holdings.length}`,
    '',
    'HOLDINGS:',
  ];

  const sectorMap = new Map<string, number>();
  const assetClassMap = new Map<string, number>();

  for (const h of holdings) {
    sectorMap.set(h.security?.sector || 'Unknown', (sectorMap.get(h.security?.sector || 'Unknown') || 0) + (h.total_value || 0));
    assetClassMap.set(h.security?.asset_class || 'Unknown', (assetClassMap.get(h.security?.asset_class || 'Unknown') || 0) + (h.total_value || 0));

    const alloc = h.portfolio_allocation_pct ?? (totalValue > 0 ? (h.total_value / totalValue) * 100 : 0);
    const pl = h.unrealised_gain_loss_pct != null ? `${(h.unrealised_gain_loss_pct * 100).toFixed(2)}%` : 'N/A';

    lines.push(`  ${h.ticker} | ${h.security?.security_name || '?'} | ${h.shares} shares @ $${h.current_price} | Value: $${h.total_value?.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${alloc.toFixed(1)}% of portfolio | P&L: ${pl} | Sector: ${h.security?.sector || 'N/A'} | Class: ${h.security?.asset_class || 'N/A'}`);
  }

  lines.push('', 'SECTOR BREAKDOWN:');
  for (const [sector, value] of [...sectorMap.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${sector}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0'}%)`);
  }

  lines.push('', 'ASSET CLASS BREAKDOWN:');
  for (const [cls, value] of [...assetClassMap.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${cls}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0'}%)`);
  }

  return lines.join('\n');
}

// ── Ticker data formatting ──

function buildDataContext(tickerDataList: TickerData[]): string {
  return tickerDataList.map(td => {
    const lines: string[] = [`=== ${td.symbol} ===`];

    if (td.profile) {
      lines.push(`Company: ${td.profile.name}`);
      lines.push(`Industry: ${td.profile.finnhubIndustry}`);
      lines.push(`Market Cap: $${(td.profile.marketCapitalization * 1_000_000).toLocaleString()}`);
      lines.push(`Exchange: ${td.profile.exchange}`);
    }

    if (td.quote) {
      lines.push(`Current Price: $${td.quote.c}`);
      lines.push(`Change: ${td.quote.d >= 0 ? '+' : ''}${td.quote.d} (${td.quote.dp >= 0 ? '+' : ''}${td.quote.dp}%)`);
      lines.push(`Day Range: $${td.quote.l} - $${td.quote.h}`);
      lines.push(`Previous Close: $${td.quote.pc}`);
    }

    if (td.financials?.metric) {
      const m = td.financials.metric;
      const ml: string[] = [];
      if (m['peBasicExclExtraTTM'] != null) ml.push(`P/E (TTM): ${m['peBasicExclExtraTTM']?.toFixed(2)}`);
      if (m['psTTM'] != null) ml.push(`P/S (TTM): ${m['psTTM']?.toFixed(2)}`);
      if (m['pbQuarterly'] != null) ml.push(`P/B: ${m['pbQuarterly']?.toFixed(2)}`);
      if (m['epsGrowthTTMYoy'] != null) ml.push(`EPS Growth YoY: ${m['epsGrowthTTMYoy']?.toFixed(2)}%`);
      if (m['revenueGrowthTTMYoy'] != null) ml.push(`Revenue Growth YoY: ${m['revenueGrowthTTMYoy']?.toFixed(2)}%`);
      if (m['roeTTM'] != null) ml.push(`ROE (TTM): ${m['roeTTM']?.toFixed(2)}%`);
      if (m['currentRatioQuarterly'] != null) ml.push(`Current Ratio: ${m['currentRatioQuarterly']?.toFixed(2)}`);
      if (m['debtEquityQuarterly'] != null) ml.push(`D/E Ratio: ${m['debtEquityQuarterly']?.toFixed(2)}`);
      if (m['dividendYieldIndicatedAnnual'] != null) ml.push(`Dividend Yield: ${m['dividendYieldIndicatedAnnual']?.toFixed(2)}%`);
      if (m['52WeekHigh'] != null) ml.push(`52W High: $${m['52WeekHigh']}`);
      if (m['52WeekLow'] != null) ml.push(`52W Low: $${m['52WeekLow']}`);
      if (m['beta'] != null) ml.push(`Beta: ${m['beta']?.toFixed(2)}`);
      if (ml.length > 0) {
        lines.push('Key Metrics:');
        lines.push(...ml.map(l => `  ${l}`));
      }
    }

    if (td.recommendations?.length) {
      const r = td.recommendations[0];
      lines.push(`Analyst Consensus (${r.period}): ${r.strongBuy} Strong Buy, ${r.buy} Buy, ${r.hold} Hold, ${r.sell} Sell, ${r.strongSell} Strong Sell`);
    }

    if (td.earnings?.length) {
      lines.push('Recent Earnings:');
      td.earnings.slice(0, 4).forEach(e => {
        const beat = e.surprise != null ? (e.surprise > 0 ? ' (BEAT)' : e.surprise < 0 ? ' (MISS)' : ' (MET)') : '';
        lines.push(`  Q${e.quarter} ${e.year}: Actual $${e.actual ?? 'N/A'} vs Est $${e.estimate ?? 'N/A'}${beat}`);
      });
    }

    if (td.news?.length) {
      lines.push('Recent Headlines:');
      td.news.slice(0, 5).forEach(n => {
        const date = new Date(n.datetime * 1000).toISOString().split('T')[0];
        lines.push(`  [${date}] ${n.headline} (${n.source})`);
      });
    }

    return lines.join('\n');
  }).join('\n\n');
}

// ── System prompts per query type ──

const BASE_RULES = `You are a senior equity research analyst at Helm Intelligence, an institutional-grade financial terminal. You deliver opinionated, data-rich analysis that reads like a Goldman Sachs research note, not a chatbot response.

CORE RULES:
- Always reference SPECIFIC numbers from the data provided. Never say "strong growth" without the exact percentage.
- Be opinionated and direct. No hedging, no "it depends."
- Format monetary values: $2,150,000,000 → $2.15B. Use B/M/T suffixes.
- Every sentence should contain a number or specific insight.
- Respond with valid JSON matching the schema. Do NOT include markdown code fences.`;

const PROMPTS: Record<QueryType, string> = {
  stock_analysis: `${BASE_RULES}

RESPONSE TYPE: Stock Analysis
Take a clear bullish, bearish, or neutral stance.

Respond with this JSON structure:
{
  "type": "stock_analysis",
  "ticker": "SYMBOL",
  "companyName": "Full Company Name",
  "verdict": "bullish" | "bearish" | "neutral",
  "summary": "One concise paragraph with specific numbers and a clear thesis.",
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "vs benchmark" or null }
  ],
  "bullCase": "2-3 sentences with specific data points.",
  "bearCase": "2-3 sentences with specific data points.",
  "recommendation": "One decisive sentence.",
  "newsHighlights": [
    { "headline": "...", "sentiment": "positive" | "negative" | "neutral", "date": "YYYY-MM-DD" }
  ]
}

Include 4-6 metrics (always include Price). Include 2-4 news highlights if available, otherwise empty array.`,

  portfolio_review: `${BASE_RULES}

RESPONSE TYPE: Portfolio Review
You are reviewing the user's ACTUAL portfolio. Reference their SPECIFIC holdings by ticker, allocation percentages, and P&L numbers. Identify concrete problems — don't be generic.

Respond with this JSON structure:
{
  "type": "portfolio_review",
  "title": "Brief descriptive title (e.g., 'Portfolio Health Assessment', 'Concentration Risk Alert')",
  "summary": "One paragraph assessing the portfolio's overall state with specific numbers from their holdings.",
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "context note" or null }
  ],
  "strengths": ["Each string is one specific strength with a number. e.g. 'AAPL position up 34% — strong performer.'"],
  "weaknesses": ["Each string is one specific weakness. e.g. 'NVDA at 45% allocation is extreme concentration risk.'"],
  "recommendations": [
    { "action": "Specific action to take", "rationale": "Why, with numbers", "priority": "high" | "medium" | "low" }
  ],
  "riskFactors": ["Specific risk with context. e.g. '78% tech exposure leaves portfolio vulnerable to sector rotation.'"]
}

Include 4-6 portfolio-level metrics (Total Value, # Positions, Top Holding %, Sector Concentration, Total P&L, etc.).
Include 2-4 strengths, 2-4 weaknesses, 2-5 recommendations, and 2-4 risk factors. Be specific to their holdings.`,

  general: `${BASE_RULES}

RESPONSE TYPE: General Market Analysis
Answer the user's question with data-backed analysis.

Respond with this JSON structure:
{
  "type": "general",
  "title": "Brief descriptive title",
  "summary": "2-3 paragraph analysis with specific numbers and clear thesis.",
  "keyPoints": [
    { "point": "Key insight headline", "detail": "1-2 sentence explanation with specific data." }
  ],
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "context note" or null }
  ]
}

Include 3-5 key points and 3-6 relevant metrics. If the question is too vague to give numbers, provide the best available context.`,
};

// ── API handler ──

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { query, conversationHistory } = body as {
    query: string;
    conversationHistory?: ConversationMessage[];
  };

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  // Extract tickers and determine query type
  const allText = [query, ...(conversationHistory || []).map(m => m.content)].join(' ');
  const tickers = extractTickers(allText);
  const queryType = detectQueryType(query, tickers.length > 0);

  // Build data context based on query type
  let dataContext = '';

  if (queryType === 'portfolio_review') {
    const holdings = await getUserPortfolio(supabase, user.id);
    const portfolioContext = buildPortfolioContext(holdings);

    if (portfolioContext) {
      dataContext = portfolioContext;
      // Enrich top holdings with market data
      const topTickers = holdings.slice(0, 3).map(h => h.ticker).filter(Boolean);
      if (topTickers.length > 0) {
        const tickerDataList = await Promise.all(topTickers.map(getFullTickerData));
        const tickerContext = buildDataContext(tickerDataList);
        if (tickerContext) dataContext += '\n\n' + tickerContext;
      }
    }
  }

  // Always fetch ticker data if tickers were mentioned
  if (tickers.length > 0 && queryType !== 'portfolio_review') {
    const tickerDataList = await Promise.all(tickers.slice(0, 3).map(getFullTickerData));
    const tickerContext = buildDataContext(tickerDataList);
    dataContext = dataContext ? `${dataContext}\n\n${tickerContext}` : tickerContext;
  }

  // Build messages
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: PROMPTS[queryType] },
  ];

  if (conversationHistory?.length) {
    for (const msg of conversationHistory.slice(-6)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  let userMessage: string;
  if (dataContext) {
    userMessage = `FINANCIAL DATA:\n${dataContext}\n\nUSER QUERY: ${query}`;
  } else if (queryType === 'portfolio_review') {
    userMessage = `USER QUERY: ${query}\n\n(User has no linked holdings yet. Advise them to connect brokerage accounts via the Accounts page first.)`;
  } else {
    userMessage = `USER QUERY: ${query}\n\n(No specific ticker data available. Provide analysis based on your knowledge.)`;
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
      // Ensure type field is set
      if (!analysis.type) analysis.type = queryType;
    } catch {
      analysis = {
        type: 'general',
        title: 'Analysis',
        summary: content,
        keyPoints: [],
        metrics: [],
      };
    }

    return NextResponse.json({ analysis, queryType, rawQuery: query });
  } catch (error) {
    console.error('AI analysis failed:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
