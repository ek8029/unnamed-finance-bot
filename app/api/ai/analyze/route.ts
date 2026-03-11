import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Extract ticker symbols from a user query
function extractTickers(query: string): string[] {
  // Match 1-5 uppercase letters that look like tickers
  const explicit = query.match(/\b[A-Z]{1,5}\b/g) || [];
  // Also check for $TICKER pattern
  const dollar = query.match(/\$([A-Za-z]{1,5})/g)?.map(t => t.replace('$', '').toUpperCase()) || [];
  // Common tickers people type in lowercase
  const lower = query.match(/\b(?:aapl|msft|goog|googl|amzn|nvda|tsla|meta|nflx|amd|intc|spy|qqq|voo)\b/gi)?.map(t => t.toUpperCase()) || [];

  const all = [...new Set([...explicit, ...dollar, ...lower])];
  // Filter out common English words that look like tickers
  const stopWords = new Set(['I', 'A', 'IS', 'IT', 'TO', 'IN', 'ON', 'AT', 'BY', 'OR', 'AN', 'OF', 'IF', 'DO', 'MY', 'SO', 'UP', 'AM', 'BE', 'NO', 'VS', 'THE', 'AND', 'FOR', 'BUT', 'NOT', 'ARE', 'WAS', 'HAS', 'CAN', 'HOW', 'WHY', 'ALL', 'NOW', 'ITS', 'LOW', 'HIGH', 'BUY', 'NEW', 'BIG', 'OLD', 'KEY', 'EPS', 'YOY', 'QOQ', 'CEO', 'CFO', 'IPO']);
  return all.filter(t => t.length >= 2 && !stopWords.has(t));
}

// Detect if the query is about the user's portfolio (not a specific ticker)
function isPortfolioQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const portfolioKeywords = [
    'my portfolio', 'my holdings', 'my positions', 'my stocks', 'my investments',
    'portfolio', 'holdings', 'weakspot', 'weak spot', 'improve', 'rebalance',
    'diversif', 'risk', 'exposure', 'overweight', 'underweight', 'concentrated',
    'allocation', 'what do i own', 'what am i holding', 'my account',
    'suggest', 'recommendation for my', 'optimize', 'review my',
  ];
  return portfolioKeywords.some(kw => lowerQuery.includes(kw));
}

// Fetch user's holdings from Supabase
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
      ticker,
      shares,
      current_price,
      total_value,
      average_cost_basis,
      total_cost_basis,
      unrealised_gain_loss,
      unrealised_gain_loss_pct,
      day_change_pct,
      portfolio_allocation_pct,
      security:securities(security_name, asset_class, sector, exchange)
    `)
    .eq('user_id', userId)
    .order('total_value', { ascending: false });

  if (error) {
    console.error('Failed to fetch user holdings:', error);
    return [];
  }

  return (data || []) as unknown as UserHolding[];
}

// Build portfolio context string for the AI
function buildPortfolioContext(holdings: UserHolding[]): string {
  if (holdings.length === 0) return '';

  const totalValue = holdings.reduce((sum, h) => sum + (h.total_value || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.total_cost_basis || 0), 0);
  const totalGainLoss = holdings.reduce((sum, h) => sum + (h.unrealised_gain_loss || 0), 0);

  const lines: string[] = [
    '=== USER PORTFOLIO ===',
    `Total Portfolio Value: $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Cost Basis: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `Total Unrealized P&L: $${totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${totalCost > 0 ? ((totalGainLoss / totalCost) * 100).toFixed(2) : '0.00'}%)`,
    `Number of Positions: ${holdings.length}`,
    '',
    'POSITIONS (sorted by value):',
  ];

  // Sector allocation summary
  const sectorMap = new Map<string, number>();
  const assetClassMap = new Map<string, number>();

  for (const h of holdings) {
    const sector = h.security?.sector || 'Unknown';
    const assetClass = h.security?.asset_class || 'Unknown';
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + (h.total_value || 0));
    assetClassMap.set(assetClass, (assetClassMap.get(assetClass) || 0) + (h.total_value || 0));
  }

  for (const h of holdings) {
    const allocationPct = h.portfolio_allocation_pct ?? (totalValue > 0 ? (h.total_value / totalValue) * 100 : 0);
    const gainLossPct = h.unrealised_gain_loss_pct != null ? (h.unrealised_gain_loss_pct * 100).toFixed(2) : 'N/A';
    const dayChangePct = h.day_change_pct != null ? (h.day_change_pct * 100).toFixed(2) : 'N/A';

    lines.push(
      `  ${h.ticker} (${h.security?.security_name || 'Unknown'})` +
      ` | ${h.shares} shares @ $${h.current_price}` +
      ` | Value: $${h.total_value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}` +
      ` | Allocation: ${allocationPct.toFixed(1)}%` +
      ` | P&L: ${gainLossPct}%` +
      ` | Day: ${dayChangePct}%` +
      ` | Sector: ${h.security?.sector || 'N/A'}` +
      ` | Class: ${h.security?.asset_class || 'N/A'}`
    );
  }

  lines.push('');
  lines.push('SECTOR BREAKDOWN:');
  for (const [sector, value] of [...sectorMap.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
    lines.push(`  ${sector}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`);
  }

  lines.push('');
  lines.push('ASSET CLASS BREAKDOWN:');
  for (const [assetClass, value] of [...assetClassMap.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
    lines.push(`  ${assetClass}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`);
  }

  return lines.join('\n');
}

// Format ticker data into a context string for the AI
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
      const metricLines: string[] = [];
      if (m['peBasicExclExtraTTM'] != null) metricLines.push(`P/E (TTM): ${m['peBasicExclExtraTTM']?.toFixed(2)}`);
      if (m['psTTM'] != null) metricLines.push(`P/S (TTM): ${m['psTTM']?.toFixed(2)}`);
      if (m['pbQuarterly'] != null) metricLines.push(`P/B: ${m['pbQuarterly']?.toFixed(2)}`);
      if (m['epsGrowthTTMYoy'] != null) metricLines.push(`EPS Growth YoY: ${m['epsGrowthTTMYoy']?.toFixed(2)}%`);
      if (m['revenueGrowthTTMYoy'] != null) metricLines.push(`Revenue Growth YoY: ${m['revenueGrowthTTMYoy']?.toFixed(2)}%`);
      if (m['roeTTM'] != null) metricLines.push(`ROE (TTM): ${m['roeTTM']?.toFixed(2)}%`);
      if (m['currentRatioQuarterly'] != null) metricLines.push(`Current Ratio: ${m['currentRatioQuarterly']?.toFixed(2)}`);
      if (m['debtEquityQuarterly'] != null) metricLines.push(`D/E Ratio: ${m['debtEquityQuarterly']?.toFixed(2)}`);
      if (m['dividendYieldIndicatedAnnual'] != null) metricLines.push(`Dividend Yield: ${m['dividendYieldIndicatedAnnual']?.toFixed(2)}%`);
      if (m['52WeekHigh'] != null) metricLines.push(`52W High: $${m['52WeekHigh']}`);
      if (m['52WeekLow'] != null) metricLines.push(`52W Low: $${m['52WeekLow']}`);
      if (m['beta'] != null) metricLines.push(`Beta: ${m['beta']?.toFixed(2)}`);
      if (metricLines.length > 0) {
        lines.push(`Key Metrics:`);
        lines.push(...metricLines.map(l => `  ${l}`));
      }
    }

    if (td.recommendations && td.recommendations.length > 0) {
      const latest = td.recommendations[0];
      lines.push(`Analyst Consensus (${latest.period}): ${latest.strongBuy} Strong Buy, ${latest.buy} Buy, ${latest.hold} Hold, ${latest.sell} Sell, ${latest.strongSell} Strong Sell`);
    }

    if (td.earnings && td.earnings.length > 0) {
      lines.push(`Recent Earnings:`);
      td.earnings.slice(0, 4).forEach(e => {
        const beat = e.surprise != null ? (e.surprise > 0 ? ' (BEAT)' : e.surprise < 0 ? ' (MISS)' : ' (MET)') : '';
        lines.push(`  Q${e.quarter} ${e.year}: Actual $${e.actual ?? 'N/A'} vs Est $${e.estimate ?? 'N/A'}${beat}`);
      });
    }

    if (td.news && td.news.length > 0) {
      lines.push(`Recent Headlines:`);
      td.news.slice(0, 5).forEach(n => {
        const date = new Date(n.datetime * 1000).toISOString().split('T')[0];
        lines.push(`  [${date}] ${n.headline} (${n.source})`);
      });
    }

    return lines.join('\n');
  }).join('\n\n');
}

const SYSTEM_PROMPT = `You are a senior equity research analyst at Helm Intelligence, an institutional-grade financial terminal. You deliver opinionated, data-rich analysis that reads like a Goldman Sachs research note, not a chatbot response.

RULES:
- Always reference SPECIFIC numbers from the data provided. Never say "strong growth" without citing the exact percentage.
- Be opinionated. Take a clear stance: bullish, bearish, or neutral. Wishy-washy analysis is useless.
- Format monetary values with $ and commas (e.g., $2,150,000,000 → $2.15B). Use B for billions, M for millions, T for trillions.
- Keep responses concise but data-dense. Every sentence should contain a number or specific insight.
- Structure your response as valid JSON matching the schema below. Do NOT include markdown code fences.
- If comparing multiple tickers, focus the response on the first/primary ticker but reference comparisons.
- When analyzing a user's portfolio, set ticker to "PORTFOLIO" and companyName to "Portfolio Analysis". Reference their SPECIFIC holdings, allocations, and P&L numbers. Identify concrete weaknesses with exact percentages.
- For general market questions without a specific ticker, set ticker to "MARKET" and companyName to "Market Analysis".
- When data is missing or unavailable, work with what you have and note limitations.

You MUST respond with valid JSON in this exact structure:
{
  "ticker": "SYMBOL",
  "companyName": "Full Company Name",
  "verdict": "bullish" | "bearish" | "neutral",
  "summary": "One concise paragraph with specific numbers and a clear thesis.",
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "vs benchmark" or null }
  ],
  "bullCase": "2-3 sentences with specific data points supporting the bull case.",
  "bearCase": "2-3 sentences with specific data points supporting the bear case.",
  "recommendation": "One decisive sentence. Not 'consider' or 'might want to' — give a clear call.",
  "newsHighlights": [
    { "headline": "...", "sentiment": "positive" | "negative" | "neutral", "date": "YYYY-MM-DD" }
  ]
}

For TICKER ANALYSIS: Include 4-6 metrics. Always include Price, and then select the most relevant from: P/E, P/S, Market Cap, Revenue Growth, EPS Growth, ROE, Dividend Yield, 52W Range, Beta, Analyst Consensus.

For PORTFOLIO ANALYSIS: Include 4-6 metrics about the portfolio itself: Total Value, # Positions, Top Holding %, Sector Concentration, Total P&L, largest single-stock risk, etc. Use newsHighlights to list specific actionable improvements (e.g., "Reduce NVDA from 45% to under 20% — single-stock risk is extreme").

Include 2-4 news highlights if news data is available. If no news, return an empty array.`;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  // Auth check
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

  // Extract tickers from the current query and conversation context
  const allText = [query, ...(conversationHistory || []).map(m => m.content)].join(' ');
  const tickers = extractTickers(allText);

  // Determine if this is a portfolio-level question
  const portfolioMode = isPortfolioQuery(query);

  // Build data context
  let dataContext = '';

  // If portfolio query, fetch user's holdings first
  if (portfolioMode) {
    const holdings = await getUserPortfolio(supabase, user.id);
    const portfolioContext = buildPortfolioContext(holdings);

    if (portfolioContext) {
      dataContext = portfolioContext;

      // Also fetch Finnhub data for their top holdings (max 3) for richer analysis
      const topTickers = holdings.slice(0, 3).map(h => h.ticker).filter(Boolean);
      if (topTickers.length > 0) {
        const tickerDataList = await Promise.all(topTickers.map(getFullTickerData));
        const tickerContext = buildDataContext(tickerDataList);
        if (tickerContext) {
          dataContext += '\n\n' + tickerContext;
        }
      }
    }
  }

  // If specific tickers were mentioned (or no portfolio data found), fetch ticker data
  if (!portfolioMode || !dataContext) {
    const tickersToFetch = tickers.slice(0, 3);
    if (tickersToFetch.length > 0) {
      const tickerDataList = await Promise.all(tickersToFetch.map(getFullTickerData));
      const tickerContext = buildDataContext(tickerDataList);
      dataContext = dataContext ? `${dataContext}\n\n${tickerContext}` : tickerContext;
    }
  }

  // Build messages for OpenAI
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Add conversation history for context
  if (conversationHistory && conversationHistory.length > 0) {
    // Keep last 6 messages for context window management
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current query with data context
  let userMessage: string;
  if (dataContext) {
    userMessage = `FINANCIAL DATA:\n${dataContext}\n\nUSER QUERY: ${query}`;
  } else if (portfolioMode) {
    userMessage = `USER QUERY: ${query}\n\n(User has no linked holdings yet. Advise them to connect their brokerage accounts first via the Accounts page, then come back for portfolio analysis.)`;
  } else {
    userMessage = `USER QUERY: ${query}\n\n(No specific ticker data available. Provide general market analysis based on your knowledge.)`;
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse the JSON response — handle potential markdown code fences
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return a structured fallback
      analysis = {
        ticker: portfolioMode ? 'PORTFOLIO' : (tickers[0] || 'MARKET'),
        companyName: portfolioMode ? 'Portfolio Analysis' : 'Analysis',
        verdict: 'neutral',
        summary: content,
        metrics: [],
        bullCase: '',
        bearCase: '',
        recommendation: '',
        newsHighlights: [],
      };
    }

    return NextResponse.json({ analysis, rawQuery: query });
  } catch (error) {
    console.error('AI analysis failed:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
