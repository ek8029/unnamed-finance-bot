import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPortfolioSummary, formatPortfolioContext } from '@/lib/portfolio-analysis';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { NO_ADVICE_GUARDRAIL } from '@/lib/ai-guardrail';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return new OpenAI({ apiKey });
}

// ── Ticker extraction ──

function extractTickers(text: string): string[] {
  const explicit = text.match(/\b[A-Z]{1,5}\b/g) || [];
  const dollar = text.match(/\$([A-Za-z]{1,5})/g)?.map((t) => t.replace('$', '').toUpperCase()) || [];
  const all = [...new Set([...explicit, ...dollar])];
  const stopWords = new Set([
    'I', 'A', 'IS', 'IT', 'TO', 'IN', 'ON', 'AT', 'BY', 'OR', 'AN', 'OF', 'IF',
    'DO', 'MY', 'SO', 'UP', 'AM', 'BE', 'NO', 'VS', 'THE', 'AND', 'FOR', 'BUT',
    'NOT', 'ARE', 'WAS', 'HAS', 'CAN', 'HOW', 'WHY', 'ALL', 'NOW', 'ITS', 'LOW',
    'HIGH', 'BUY', 'NEW', 'BIG', 'OLD', 'KEY', 'EPS', 'YOY', 'QOQ', 'CEO', 'CFO',
    'IPO', 'TAX', 'ANY', 'GET', 'PUT', 'GOT', 'LET', 'SAY', 'SET',
  ]);
  return all.filter((t) => t.length >= 2 && !stopWords.has(t));
}

// ── Format ticker market data ──

function buildTickerContext(dataList: TickerData[]): string {
  return dataList
    .map((td) => {
      const lines: string[] = [`=== ${td.symbol} MARKET DATA ===`];
      if (td.profile) {
        lines.push(`Company: ${td.profile.name}`);
        lines.push(`Industry: ${td.profile.industry}`);
        lines.push(`Market Cap: $${(td.profile.marketCapitalization * 1_000_000).toLocaleString('en-US')}`);
      }
      if (td.quote) {
        lines.push(`Current Price: $${td.quote.c}`);
        if (td.quote.d != null && td.quote.dp != null) {
          lines.push(`Change: ${td.quote.d >= 0 ? '+' : ''}${td.quote.d} (${td.quote.dp >= 0 ? '+' : ''}${td.quote.dp}%)`);
        }
      }
      if (td.financials?.metric) {
        const m = td.financials.metric;
        if (m['peBasicExclExtraTTM'] != null) lines.push(`P/E: ${m['peBasicExclExtraTTM'].toFixed(2)}`);
        if (m['beta'] != null) lines.push(`Beta: ${m['beta'].toFixed(2)}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

// ── Follow-up suggestion generation ──

function generateFollowUps(question: string, hasAlerts: boolean): string[] {
  const lower = question.toLowerCase();
  const suggestions: string[] = [];

  if (lower.includes('risk') || lower.includes('concentrat')) {
    suggestions.push('How would a 20% market correction affect me?');
    suggestions.push('How concentrated is my largest position?');
  } else if (lower.includes('diversif')) {
    suggestions.push("What is my sector allocation?");
    suggestions.push("How concentrated is my largest position?");
  } else if (lower.includes('tax') || lower.includes('sell') || lower.includes('harvest')) {
    suggestions.push('What are my largest unrealized losses?');
    suggestions.push("How does tax-loss harvesting work?");
  } else if (lower.includes('crash') || lower.includes('drop') || lower.includes('decline')) {
    suggestions.push("What's my biggest single-stock exposure?");
    suggestions.push('What is my total tech sector exposure?');
  } else {
    if (hasAlerts) suggestions.push("What's my biggest single-position exposure?");
    suggestions.push('How diversified am I?');
    suggestions.push('Which positions have the largest unrealized gains?');
  }

  return suggestions.slice(0, 3);
}

// ── System prompt ──

const SYSTEM_PROMPT = `${INJECTION_GUARD}
${NO_ADVICE_GUARDRAIL}

You are a senior portfolio analyst at Helm Intelligence. You have access to the user's ACTUAL portfolio data, every number is real, from their linked brokerage accounts.

ABSOLUTE RULES:
1. ALWAYS use SPECIFIC dollar amounts and percentages from the portfolio data. Never say "significant" or "large", say "$47,200" or "34.2%".
2. Every sentence must contain a real number from their data.
3. For hypothetical scenarios (e.g. "what if tech crashes 20%"), CALCULATE the exact dollar impact on their specific holdings.
4. Be direct and factual. State the numbers and what they mean. Do not tell the user what to do or recommend transactions.
5. Reference positions by ticker AND dollar value (e.g. "NVDA, $47,200 or 34% of your portfolio").
6. Format monetary values cleanly: $2,150,000 → $2.15M. Use M/B/T for large numbers, exact dollars for position-level amounts.
7. Respond with valid JSON. Do NOT include markdown code fences.

RESPONSE FORMAT:
{
  "type": "portfolio_qa",
  "title": "Brief, specific title (include a dollar amount or percentage)",
  "summary": "2-3 sentences answering the question with SPECIFIC numbers from their portfolio. Lead with the most important number.",
  "highlights": [
    {
      "label": "Description of the metric",
      "value": "$XX,XXX or XX.X%",
      "sentiment": "positive" | "negative" | "neutral" | "warning",
      "detail": "One sentence of context with another specific number"
    }
  ],
  "recommendation": "One neutral factual observation with a specific number (e.g. 'NVDA is $47,200, 34% of your portfolio'). No buy/sell/trim, no advisability judgment.",
  "followUpQuestions": ["Suggested follow-up question 1", "Question 2", "Question 3"]
}

Include 3-6 highlights. Each highlight MUST have a real dollar amount or percentage. The highlights are the centerpiece of the response, they should be scannable and data-rich.`;

// ── API handler ──

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  // Rate limit: 20 requests per IP per hour
  const ip = getClientIP(req);
  const limit = rateLimit(`portfolio-qa:${ip}`, 20, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { question, conversationHistory } = body as {
    question: string;
    conversationHistory?: ConversationMessage[];
  };

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json({ error: 'Question too long (max 500 characters)' }, { status: 400 });
  }

  // Get portfolio summary (cached 5 min)
  const portfolio = await getPortfolioSummary(user.id);

  if (portfolio.positionCount === 0) {
    return NextResponse.json({
      analysis: {
        type: 'portfolio_qa',
        title: 'No portfolio data found',
        summary:
          "You don't have any holdings linked yet. Connect your brokerage account on the Accounts page to get AI-powered portfolio analysis with real dollar amounts.",
        highlights: [],
        recommendation: 'Go to Connected Accounts and link your brokerage via Plaid.',
        followUpQuestions: [],
      },
    });
  }

  const portfolioContext = formatPortfolioContext(portfolio);

  // Enrich mentioned tickers with market data
  const allText = [question, ...(conversationHistory || []).map((m) => m.content)].join(' ');
  const mentionedTickers = extractTickers(allText);
  // Also include tickers from top holdings for richer context
  const portfolioTickers = portfolio.holdings.slice(0, 5).map((h) => h.ticker);
  const uniqueTickers = [...new Set([...mentionedTickers, ...portfolioTickers])].slice(0, 5);

  let tickerContext = '';
  if (uniqueTickers.length > 0) {
    const tickerDataList = await Promise.all(uniqueTickers.map(getFullTickerData));
    tickerContext = buildTickerContext(tickerDataList.filter((td) => td.quote || td.profile));
  }

  // Build messages
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-6)) {
      if (msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: fence(msg.content, 'HISTORY') });
      }
    }
  }

  let userContent = `PORTFOLIO DATA:\n${portfolioContext}`;
  if (tickerContext) userContent += `\n\n${fence(tickerContext, 'MARKET_DATA')}`;
  userContent += `\n\nUSER QUESTION: ${fence(question, 'USER_QUESTION')}`;

  messages.push({ role: 'user', content: userContent });

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.6,
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
      analysis.type = 'portfolio_qa';
      // Validate required fields
      if (!analysis.summary && !analysis.title) {
        throw new Error('Missing required fields');
      }
      // Ensure arrays are actually arrays
      if (!Array.isArray(analysis.highlights)) analysis.highlights = [];
      // Inject follow-up suggestions if the LLM didn't provide them
      if (!analysis.followUpQuestions?.length) {
        analysis.followUpQuestions = generateFollowUps(
          question,
          portfolio.concentrationAlerts.length > 0,
        );
      }
    } catch {
      analysis = {
        type: 'portfolio_qa',
        title: 'Portfolio Analysis',
        summary: content,
        highlights: [],
        recommendation: '',
        followUpQuestions: generateFollowUps(question, portfolio.concentrationAlerts.length > 0),
      };
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Portfolio Q&A failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
