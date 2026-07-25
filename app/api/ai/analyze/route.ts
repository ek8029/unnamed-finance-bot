import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPortfolioSummary, formatPortfolioContext, type PortfolioSummary } from '@/lib/portfolio-analysis';
import { generateTaxReport, type TaxHarvestReport } from '@/lib/tax-analysis';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { checkAnalysisQuota, recordAnalysisUsage } from '@/lib/tier';
import { TAX_RATE } from '@/lib/financial-config';
import { NO_ADVICE_GUARDRAIL } from '@/lib/ai-guardrail';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import { getAgentFindings } from '@/lib/research/findings';
import { detectTopics, wantsGroundedAnswer } from '@/lib/research/query-parse';
import { retrieveContext } from '@/lib/research/retrieve';
import { composeAnswer } from '@/lib/research/compose';
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return new OpenAI({ apiKey });
}

// ── Query Classification ──

type QueryType = 'stock_analysis' | 'portfolio_review' | 'tax_planning' | 'personal_finance' | 'general';

// Maps internal query type → card component type (reuses existing UI components)
type ResponseType = 'stock_analysis' | 'portfolio_qa' | 'general';

const RESPONSE_TYPE_MAP: Record<QueryType, ResponseType> = {
  stock_analysis: 'stock_analysis',
  portfolio_review: 'portfolio_qa',
  tax_planning: 'portfolio_qa',
  personal_finance: 'general',
  general: 'general',
};

/**
 * Intent-based query classifier.
 * Priority: tax → portfolio → stock (with intent) → personal finance → stock (ticker fallback) → general.
 *
 * Uses regex patterns rather than substring matching for precision.
 * Tax is checked first because tax queries often contain portfolio-like words.
 */
function classifyQuery(query: string, tickers: string[]): QueryType {
  const lower = query.toLowerCase();

  // ── 1. Tax planning ──
  const TAX_PATTERNS = [
    /\btax(es|able|ation|ed)?\b/,
    /\bcapital gain/,
    /\bharvest(ing|able)?\b/,
    /\bwash sale/,
    /\b(short|long)[- ]term (gain|loss)/,
    /\btax[- ]loss/,
    /\bdeduct(ion|ible|ions)/,
    /\b1099\b/,
    /\bschedule d\b/,
    /\brealized (gain|loss)/,
    /\bunrealized (gain|loss)/,
    /\bcost basis\b/,
    /\bcarryover loss/,
    /\b(offset|reduce).{0,20}(gain|tax)/,
    /\b(pay|owe|save|expect).{0,20}tax/,
    /\btax.{0,20}(pay|owe|save|bill|liability|burden|obligation|rate|bracket|strategy|planning|optimi|shelter|defer|efficient|benefit|saving|implication|impact|purpose)/,
  ];
  if (TAX_PATTERNS.some(p => p.test(lower))) return 'tax_planning';

  // ── 2. Portfolio review (user's specific holdings) ──
  const PORTFOLIO_PATTERNS = [
    /\bmy (portfolio|holdings|positions|stocks|investments|account|money|assets|net worth)\b/,
    /\b(review|analyze|assess|evaluate|check|look at|audit|examine) my\b/,
    /\bhow('s| is| are| does) my\b/,
    /\bam i (diversified|overweight|underweight|concentrated|exposed|balanced)/,
    /\b(should i|do i need to) (sell|buy|trim|reduce|rebalance|add|increase|hold)/,
    /\bwhat do i (own|hold|have)\b/,
    /\bwhat am i (holding|invested in)\b/,
    /\bmy (risk|exposure|allocation|diversification|concentration|returns?|performance)\b/,
    /\b(crash|drop|correction|recession|downturn|bear market).{0,25}(affect|impact|hit|do to) (me|my)\b/,
    /\b(affect|impact|hit) my (portfolio|holdings|positions)/,
    /\bbiggest (risk|position|holding|winner|loser|gainer)\b/,
    /\bweak\s?spot/,
    /\brebalance\b/,
    /\b(over|under)weight/,
    /\bconcentrat(ed|ion)\b/,
    /\bsector (exposure|allocation|breakdown)\b/,
    /\bportfolio (health|performance|risk|allocation|review|analysis|summary|overview)\b/,
    /\b(trim|reduce|sell|cut) .{0,20}(position|holding|exposure)/,
    /\bwhat('s| is) my .{0,20}(worth|value|performance|return)\b/,
    /\bhow much (am i|have i) (up|down|made|lost|gained)\b/,
    /\bhow would a\b/,
    /\bsuggest changes\b/,
    /\bportfolio\b/,
  ];
  if (PORTFOLIO_PATTERNS.some(p => p.test(lower))) return 'portfolio_review';

  // ── 3. Stock analysis (only if tickers + analysis intent) ──
  if (tickers.length > 0) {
    const STOCK_INTENT = [
      /\banalyze\b/, /\b(bull|bear) case\b/,
      /\bwhat.{0,20}think/, /\bwhat.{0,10}about\b/,
      /\b(price target|valuation|fair value|upside|downside)\b/,
      /\b(compare|vs|versus)\b/,
      /\b(research|deep dive|breakdown|overview)\b/,
      /\b(earnings|revenue|growth|margin|fundamentals)\b/,
      /\b(buy|sell|hold)\b/,
      /\b(p\/e|pe ratio|p\/s|p\/b)\b/,
    ];
    // If there's clear stock-analysis intent, route there
    if (STOCK_INTENT.some(p => p.test(lower))) return 'stock_analysis';
    // If tickers are present and nothing else matched, assume stock analysis
    return 'stock_analysis';
  }

  // ── 4. Personal finance education ──
  const PERSONAL_FINANCE_PATTERNS = [
    /\b(what is|what's|explain|how does|how do|tell me about|define).{0,40}\b(roth|ira|401k|403b|hsa|fsa|529|sep ira)\b/,
    /\b(roth|traditional) (ira|401k|conversion)\b/,
    /\bretire(ment|e)?\b/,
    /\bcompound(ing)? (interest|growth|returns)\b/,
    /\bdollar cost averag/,
    /\bemergency fund\b/,
    /\b(mortgage|student loan|debt payoff|credit score|credit card debt)\b/,
    /\b(financial plan|financial advisor|financial goal|financial independence)\b/,
    /\b(inflation|purchasing power|real return)\b/,
    /\b(asset allocation|modern portfolio theory|efficient frontier)\b/,
    /\b(index fund|mutual fund|bond fund|fixed income|treasury|money market)\b/,
    /\b(backdoor roth|mega backdoor|contribution limit|required minimum|rmd)\b/,
    /\b(social security|medicare|pension)\b/,
    /\bshould i .{0,30}(invest|save|pay off|contribute|open|start|max out)\b/,
    /\bhow much (should|do) i (need|save|invest|contribute|put|set aside)\b/,
    /\bam i (on track|behind|ahead|saving enough|investing enough)\b/,
    /\b(fire|early retirement)\b/i,
    /\b(estate plan|will|trust|beneficiar)\b/,
    /\b(life insurance|disability insurance|umbrella policy)\b/,
    /\bnet worth\b/,
    /\bsaving rate\b/,
    /\b(budget|budgeting)\b/,
  ];
  if (PERSONAL_FINANCE_PATTERNS.some(p => p.test(lower))) return 'personal_finance';

  return 'general';
}

// ── Ticker extraction (CURRENT query only) ──

const STOP_WORDS = new Set([
  // Pronouns, articles, prepositions, conjunctions
  'I', 'A', 'MY', 'ME', 'WE', 'HE', 'IT', 'AN', 'TO', 'IN', 'ON', 'AT', 'BY',
  'OR', 'OF', 'IF', 'SO', 'AS', 'UP', 'NO', 'VS', 'AND', 'FOR', 'BUT', 'NOT',
  'NOR', 'YET', 'THE',
  // Verbs
  'IS', 'AM', 'BE', 'DO', 'HAS', 'CAN', 'WAS', 'ARE', 'GOT', 'GET', 'LET',
  'SAY', 'SET', 'PUT', 'RUN', 'USE', 'TRY', 'ASK', 'OWN', 'PAY', 'CUT',
  'ADD', 'HIT', 'MAY', 'WIN', 'DID', 'SEE', 'BUY',
  // Question words
  'HOW', 'WHY', 'WHO', 'WHAT', 'WHEN',
  // Common modifiers
  'ALL', 'NOW', 'ITS', 'LOW', 'HIGH', 'BIG', 'OLD', 'NEW', 'TOP', 'BEST',
  'MOST', 'MORE', 'LESS', 'GOOD', 'WELL', 'LONG', 'SOME', 'EACH', 'BOTH',
  'NEXT', 'LAST', 'JUST', 'ONLY', 'VERY', 'MUCH', 'MANY', 'ALSO', 'EVEN',
  'WILL', 'BEEN', 'INTO', 'OVER', 'LIKE', 'THAN', 'THEM', 'THEN', 'THAT',
  'THIS', 'SAME', 'SUCH', 'WITH', 'FROM', 'HAVE', 'WERE', 'DOES', 'DONE',
  'BACK', 'YEAR', 'TERM',
  // Finance terms that aren't tickers
  'TAX', 'FEE', 'ETF', 'APR', 'APY', 'ROI', 'EPS', 'YOY', 'QOQ',
  'CEO', 'CFO', 'IPO', 'SEC', 'FED', 'GDP', 'CPI', 'NAV', 'AUM',
  'YTD', 'ATH', 'ATL', 'AVG', 'MAX', 'MIN', 'PCT', 'KEY', 'WAY',
  'ANY', 'END', 'OUT', 'OUR', 'DAY', 'TWO', 'RATE', 'PLAN', 'REIT',
  'TIPS', 'BOND', 'SAVE', 'RISK', 'SELL', 'HOLD', 'DROP', 'MOVE',
  'LOSS', 'GAIN', 'CALL', 'LOOK', 'COME', 'FIND', 'WANT', 'NEED',
  'SHOW', 'HELP', 'PICK', 'GIVE', 'KEEP', 'MAKE', 'TAKE', 'TELL',
  'MISS', 'LOSE', 'WORK', 'KNOW', 'MEAN', 'FEEL', 'REAL', 'FULL',
  'FREE', 'SAFE', 'SURE', 'OPEN', 'NEAR', 'LATE', 'ABLE', 'ELSE',
  'HERE', 'ONCE', 'UPON', 'WENT', 'LEFT', 'SAID', 'AWAY', 'TURN',
  'PART', 'MADE', 'CASE', 'STAY', 'GOES', 'SEEM', 'SENT', 'PLAY',
  'PAID', 'WENT', 'WORD', 'FACT', 'IDEA', 'SORT', 'KIND', 'TYPE',
  'LINE', 'FORM', 'LINK', 'RULE', 'NOTE', 'AREA', 'SIDE', 'HEAD',
  'HAND', 'VIEW', 'HOME', 'COST', 'ZERO', 'HALF', 'SIZE',
  // 5-letter common words
  'ABOUT', 'AFTER', 'COULD', 'THINK', 'WOULD', 'WHICH', 'THEIR', 'THESE',
  'THOSE', 'WHERE', 'STILL', 'BEING', 'FIRST', 'GOING', 'GREAT', 'MIGHT',
  'MONEY', 'STOCK', 'SHARE', 'POINT', 'PRICE', 'VALUE', 'TOTAL', 'SMART',
  'WORTH', 'SPEND', 'CRASH', 'NEVER', 'EVERY', 'UNDER', 'ABOVE', 'SINCE',
  'WHILE', 'OTHER', 'WORLD', 'PLACE', 'RIGHT', 'SMALL', 'LARGE', 'EARLY',
  'YOUNG', 'LATER', 'GIVEN', 'TAKEN', 'TRACK', 'BASED', 'CHECK',
]);

function extractTickers(query: string): string[] {
  // Match explicit ALL-CAPS tokens (1-5 letters)
  const explicit = query.match(/\b[A-Z]{1,5}\b/g) || [];
  // Match $TICKER format
  const dollar = query.match(/\$([A-Za-z]{1,5})/g)?.map(t => t.replace('$', '').toUpperCase()) || [];
  // Match well-known tickers even in lowercase
  const wellKnown = query.match(
    /\b(?:aapl|msft|goog|googl|amzn|nvda|tsla|meta|nflx|amd|intc|spy|qqq|voo|vti|brk|jpm|dis|ba|nke|pypl|pfe|crm|adbe|cost|wmt|hd|ko|pep|abnb|uber|sofi|pltr|coin|snap|pins|sq|shop|roku|rivn|lcid)\b/gi
  )?.map(t => t.toUpperCase()) || [];

  const all = [...new Set([...explicit, ...dollar, ...wellKnown])];
  return all.filter(t => t.length >= 2 && !STOP_WORDS.has(t));
}

// ── Data formatting ──

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildTickerContext(dataList: TickerData[]): string {
  return dataList.map(td => {
    const lines: string[] = [`=== ${td.symbol} ===`];
    if (td.profile) {
      lines.push(`Company: ${td.profile.name}`);
      lines.push(`Industry: ${td.profile.industry}`);
      lines.push(`Market Cap: $${(td.profile.marketCapitalization * 1_000_000).toLocaleString()}`);
      lines.push(`Exchange: ${td.profile.exchange}`);
    }
    if (td.quote) {
      lines.push(`Current Price: $${td.quote.c}`);
      if (td.quote.d != null && td.quote.dp != null) {
        lines.push(`Change: ${td.quote.d >= 0 ? '+' : ''}${td.quote.d} (${td.quote.dp >= 0 ? '+' : ''}${td.quote.dp}%)`);
      }
      if (td.quote.l != null && td.quote.h != null) {
        lines.push(`Day Range: $${td.quote.l} - $${td.quote.h}`);
      }
    }
    if (td.financials?.metric) {
      const m = td.financials.metric;
      const ml: string[] = [];
      if (m['peBasicExclExtraTTM'] != null) ml.push(`P/E: ${m['peBasicExclExtraTTM']?.toFixed(2)}`);
      if (m['psTTM'] != null) ml.push(`P/S: ${m['psTTM']?.toFixed(2)}`);
      if (m['epsGrowthTTMYoy'] != null) ml.push(`EPS Growth YoY: ${m['epsGrowthTTMYoy']?.toFixed(2)}%`);
      if (m['revenueGrowthTTMYoy'] != null) ml.push(`Revenue Growth YoY: ${m['revenueGrowthTTMYoy']?.toFixed(2)}%`);
      if (m['roeTTM'] != null) ml.push(`ROE: ${m['roeTTM']?.toFixed(2)}%`);
      if (m['dividendYieldIndicatedAnnual'] != null) ml.push(`Dividend Yield: ${m['dividendYieldIndicatedAnnual']?.toFixed(2)}%`);
      if (m['52WeekHigh'] != null) ml.push(`52W High: $${m['52WeekHigh']}`);
      if (m['52WeekLow'] != null) ml.push(`52W Low: $${m['52WeekLow']}`);
      if (m['beta'] != null) ml.push(`Beta: ${m['beta']?.toFixed(2)}`);
      if (ml.length > 0) lines.push('Key Metrics:', ...ml.map(l => `  ${l}`));
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

interface CapitalGainRow {
  ticker: string;
  transaction_type: string;
  transaction_date: string;
  shares: number;
  price_per_share: number;
  cost_basis: number;
  proceeds: number;
  gain_loss: number;
  gain_loss_type: string;
}

function buildTaxContext(
  portfolio: PortfolioSummary,
  capitalGains: CapitalGainRow[],
  taxReport: TaxHarvestReport,
): string {
  const lines: string[] = [];

  if (portfolio.positionCount > 0) {
    lines.push('=== PORTFOLIO UNREALIZED P&L ===');
    lines.push(`Total Value: $${fmt(portfolio.totalValue)} | Cost Basis: $${fmt(portfolio.totalCostBasis)} | Unrealized P&L: $${fmt(portfolio.totalUnrealizedGainLoss)}`);

    const gainers = portfolio.holdings.filter(h => (h.unrealizedGainLoss ?? 0) > 0);
    const losers = portfolio.holdings.filter(h => (h.unrealizedGainLoss ?? 0) < 0);
    const totalGains = gainers.reduce((s, h) => s + (h.unrealizedGainLoss ?? 0), 0);
    const totalLosses = losers.reduce((s, h) => s + (h.unrealizedGainLoss ?? 0), 0);

    lines.push(`Unrealized Gains: +$${fmt(totalGains)} across ${gainers.length} positions`);
    lines.push(`Unrealized Losses: -$${fmt(Math.abs(totalLosses))} across ${losers.length} positions`);
    lines.push('');

    lines.push('POSITIONS (sorted by P&L):');
    const sorted = [...portfolio.holdings].sort((a, b) => (a.unrealizedGainLoss ?? 0) - (b.unrealizedGainLoss ?? 0));
    for (const h of sorted) {
      if (h.unrealizedGainLoss == null) continue;
      const pct = h.unrealizedGainLossPct != null ? `${(h.unrealizedGainLossPct * 100).toFixed(1)}%` : 'N/A';
      lines.push(`  ${h.ticker}: ${h.unrealizedGainLoss >= 0 ? '+' : ''}$${fmt(h.unrealizedGainLoss)} (${pct}) | Value: $${fmt(h.totalValue)} | Cost: $${fmt(h.totalCostBasis ?? 0)} | Sector: ${h.sector}`);
    }
  }

  const sells = capitalGains.filter(g => g.transaction_type === 'sell');
  if (sells.length > 0) {
    const stGains = sells.filter(g => g.gain_loss_type === 'short_term' && g.gain_loss > 0).reduce((s, g) => s + Number(g.gain_loss), 0);
    const stLosses = sells.filter(g => g.gain_loss_type === 'short_term' && g.gain_loss < 0).reduce((s, g) => s + Number(g.gain_loss), 0);
    const ltGains = sells.filter(g => g.gain_loss_type === 'long_term' && g.gain_loss > 0).reduce((s, g) => s + Number(g.gain_loss), 0);
    const ltLosses = sells.filter(g => g.gain_loss_type === 'long_term' && g.gain_loss < 0).reduce((s, g) => s + Number(g.gain_loss), 0);
    const net = stGains + stLosses + ltGains + ltLosses;

    lines.push('', `=== REALIZED CAPITAL GAINS (${new Date().getFullYear()} YTD) ===`);
    lines.push(`Short-term gains: +$${fmt(stGains)} | Short-term losses: -$${fmt(Math.abs(stLosses))}`);
    lines.push(`Long-term gains: +$${fmt(ltGains)} | Long-term losses: -$${fmt(Math.abs(ltLosses))}`);
    lines.push(`Net realized: $${fmt(net)}`);
    lines.push(`Estimated tax on realized gains (${(TAX_RATE * 100).toFixed(0)}% blended): $${fmt(Math.max(0, net) * TAX_RATE)}`);
    lines.push('', 'TRANSACTIONS:');
    for (const g of sells) {
      lines.push(`  ${g.ticker} | ${g.transaction_date} | ${g.shares} shares | Proceeds: $${fmt(g.proceeds)} | Cost: $${fmt(g.cost_basis)} | ${Number(g.gain_loss) >= 0 ? '+' : ''}$${fmt(Number(g.gain_loss))} (${g.gain_loss_type})`);
    }
  }

  if (taxReport.opportunityCount > 0) {
    lines.push('', '=== TAX-LOSS HARVESTING OPPORTUNITIES ===');
    lines.push(`Total harvestable losses: $${fmt(Math.abs(taxReport.totalHarvestableLoss))}`);
    lines.push(`Estimated tax savings (at ${(taxReport.taxRate * 100).toFixed(0)}% rate): $${fmt(taxReport.totalEstimatedSavings)}`);
    for (const opp of taxReport.opportunities) {
      let line = `  ${opp.ticker} (${opp.securityName}): Loss $${fmt(Math.abs(opp.unrealizedLoss))} (${opp.lossPct.toFixed(1)}%) → Savings: $${fmt(opp.estimatedSavings)}`;
      if (opp.replacement) line += ` | Replace with: ${opp.replacement.ticker} (${opp.replacement.reason})`;
      if (opp.washSaleRisk) line += ` | WASH SALE RISK: ${opp.washSaleDetail}`;
      lines.push(line);
    }
  }

  return lines.join('\n');
}

// ── System prompts ──

const BASE_RULES = `${INJECTION_GUARD}
${NO_ADVICE_GUARDRAIL}

You are a senior analyst at Helm Intelligence, an institutional-grade financial terminal. You deliver neutral, data-rich analysis that reads like a research note, not a chatbot response.

CORE RULES:
- Always reference SPECIFIC numbers from the data provided. Never say "strong growth" without the exact percentage.
- Be precise and direct with facts. State what the data shows, not what the user should do.
- Format monetary values: $2,150,000,000 → $2.15B. Use B/M/T suffixes for large numbers, exact dollars for position-level.
- Every sentence should contain a number or specific factual insight.
- Respond with valid JSON matching the schema. Do NOT include markdown code fences.`;

const PROMPTS: Record<QueryType, string> = {
  stock_analysis: `${BASE_RULES}

RESPONSE TYPE: Stock Analysis
Present the factual picture. Do NOT take a buy/sell/hold stance or judge advisability.

IMPORTANT: If the user's position data is provided (showing they hold this stock), reference their specific shares, cost basis, unrealized P&L, and portfolio allocation as factual context (e.g. "Your 15 shares of AAPL at $182 cost basis are up $425..."). If they don't hold the stock, simply note that. Do not tell them whether to open, add to, or change a position.

Respond with this JSON structure:
{
  "type": "stock_analysis",
  "ticker": "SYMBOL",
  "companyName": "Full Company Name",
  "verdict": "neutral",
  "summary": "One concise paragraph with specific numbers and a neutral factual synthesis. No thesis on advisability.",
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "vs benchmark" or null }
  ],
  "bullCase": "2-3 sentences stating the data points cited by those who are optimistic. Attribute to market participants, do not endorse.",
  "bearCase": "2-3 sentences stating the data points cited by those who are cautious. Attribute to market participants, do not endorse.",
  "recommendation": "A neutral one-sentence summary of the key facts. No buy/sell/hold, no price target, no advisability judgment.",
  "newsHighlights": [
    { "headline": "...", "sentiment": "positive" | "negative" | "neutral", "date": "YYYY-MM-DD" }
  ]
}

For "verdict", always use "neutral" (this field is legacy; do not issue a directional bullish/bearish rating). Include 4-6 metrics (always include Price). Include 2-4 news highlights if available.`,

  portfolio_review: `${BASE_RULES}

RESPONSE TYPE: Portfolio Analysis
You are reviewing the user's ACTUAL portfolio. Every number is real, from their linked brokerage accounts. Reference their SPECIFIC holdings by ticker, allocation percentages, and P&L numbers.

Respond with this JSON structure:
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
  "recommendation": "One neutral factual observation with a specific number (e.g. 'NVDA is $47,200, 34% of your portfolio'). No buy/sell/trim, no advisability.",
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}

Include 3-6 highlights. Each MUST have a real dollar amount or percentage from their data. Be specific to their holdings, reference tickers and exact values. State facts; do not tell the user what to do.

IMPORTANT: followUpQuestions are clickable buttons the USER will use to ask YOU a follow-up. Write them as informational queries the user would type, NOT directives and NOT questions you would ask them. Good: "How concentrated is my largest position?" Bad: "Are you comfortable with your allocations?" Bad: "Which positions should I trim?"`,

  tax_planning: `${BASE_RULES}

RESPONSE TYPE: Tax Analysis
You are a tax-aware portfolio analyst reviewing the user's ACTUAL positions, realized gains, and harvesting opportunities. Every number comes from their linked accounts.

ADDITIONAL TAX RULES:
- Use a ${(TAX_RATE * 100).toFixed(0)}% blended federal+state rate for estimates unless the user specifies otherwise.
- Distinguish short-term (ordinary income rates, up to 37%) vs long-term (0/15/20%) clearly.
- Explain the $3,000/year capital loss deduction limit and carryover rules when relevant.
- Explain wash sale mechanics neutrally (repurchasing a substantially identical security within 30 days disallows the loss).
- State which positions are at an unrealized loss and the dollar amounts. Do NOT instruct the user to harvest, sell, or trim. Tax-loss harvesting is a strategy some investors use to offset gains; present it as neutral education, not a directive.

Respond with this JSON structure:
{
  "type": "portfolio_qa",
  "title": "Brief title with a dollar amount (e.g. 'Tax Liability: ~$4,200 on $13,750 Net Gains')",
  "summary": "2-3 sentences answering the tax question with SPECIFIC dollar amounts. Lead with the bottom-line number.",
  "highlights": [
    {
      "label": "Description",
      "value": "$XX,XXX or XX.X%",
      "sentiment": "positive" | "negative" | "neutral" | "warning",
      "detail": "One sentence of context"
    }
  ],
  "recommendation": "One neutral factual sentence summarizing the tax picture (e.g. dollar amount at unrealized loss). Append 'Not tax advice, consult a professional.' Do NOT instruct any transaction.",
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}

Include 4-6 highlights covering: realized gains/losses YTD, unrealized positions, harvestable savings (as a factual figure), estimated tax liability. Each MUST have a dollar amount. This is not tax advice.

IMPORTANT: followUpQuestions are clickable buttons the USER will use to ask YOU a follow-up. Write them as informational queries the user would type, NOT directives. Good: "Which of my positions are at an unrealized loss?" Bad: "Which positions should I harvest?" Bad: "Have you considered your tax bracket?"`,

  personal_finance: `${BASE_RULES}

RESPONSE TYPE: Personal Finance Education
You are a financial educator who explains personal finance concepts and tradeoffs clearly and neutrally.

ADDITIONAL RULES:
- Use current tax brackets, contribution limits, and regulations (2024-2025 figures).
- CRITICAL: If the user's portfolio data is provided in the FINANCIAL DATA section, reference their specific holdings, dollar amounts, allocations, and P&L as factual context. Do NOT give generic information when you have their real data. For example, if they ask about retirement, reference their actual portfolio value and holdings. If they ask about investing, reference what they already own.
- Give concrete numbers, contribution limits, tax brackets, historical return ranges, not vague generalities.
- Explain the concepts and the tradeoffs between options. Do NOT tell the user which option to choose or recommend a transaction; lay out how each works and let them decide.
- When portfolio data is available, frame factual context in terms of the user's actual situation (e.g. "With your $45,000 portfolio weighted 35% in tech..." not "Generally, investors should...").

Respond with this JSON structure:
{
  "type": "general",
  "title": "Brief descriptive title",
  "summary": "2-3 paragraph answer with specific numbers, current limits, and clear guidance. ALWAYS reference the user's actual portfolio numbers when available.",
  "keyPoints": [
    { "point": "Key insight headline", "detail": "1-2 sentence explanation with specific data from their portfolio or current rates." }
  ],
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": null, "context": "context note" or null }
  ],
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}

Include 3-5 key points and 3-6 relevant metrics (contribution limits, tax brackets, rates, benchmarks, etc.). If portfolio data is available, include metrics from their portfolio too.

IMPORTANT: followUpQuestions are clickable buttons the USER will use to ask YOU a follow-up. Write them as informational queries the user would type, NOT directives and NOT questions you would ask them. Good: "How does a 401k contribution limit work?" Bad: "What are your retirement goals?"`,

  general: `${BASE_RULES}

RESPONSE TYPE: General Financial Analysis
Answer the user's question with data-backed analysis.

CRITICAL: If the user's portfolio data is provided in the FINANCIAL DATA section, you MUST tie your answer back to their specific holdings, dollar amounts, and allocations. Do NOT give generic advice or benchmarks when you have their real data. For example, if they ask about market conditions, explain how it specifically affects their holdings. If they ask about a strategy, evaluate it against what they actually own.

Respond with this JSON structure:
{
  "type": "general",
  "title": "Brief descriptive title",
  "summary": "2-3 paragraph analysis with specific numbers and clear thesis. When portfolio data is available, reference the user's actual positions and dollar amounts.",
  "keyPoints": [
    { "point": "Key insight headline", "detail": "1-2 sentence explanation referencing the user's actual data when available." }
  ],
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "context note" or null }
  ],
  "followUpQuestions": ["Question 1", "Question 2", "Question 3"]
}

Include 3-5 key points and 3-6 relevant metrics. When portfolio data is available, include at least 2 metrics from their actual portfolio.

IMPORTANT: followUpQuestions are clickable buttons the USER will use to ask YOU a follow-up. Write them as queries the user would type, NOT questions you would ask them. Good: "How would a recession affect my portfolio?" Bad: "What is your risk tolerance?"`,
};

// ── Follow-up suggestions ──

function generateFollowUps(query: string, queryType: QueryType): string[] {
  const lower = query.toLowerCase();

  switch (queryType) {
    case 'tax_planning':
      return [
        'Which of my positions are at an unrealized loss?',
        'What are my short-term vs long-term gains?',
        'How does tax-loss harvesting work?',
      ];
    case 'portfolio_review':
      if (lower.includes('risk') || lower.includes('concentrat') || lower.includes('crash'))
        return ['How would a 20% correction affect me?', 'How concentrated is my largest position?', 'What sectors am I most exposed to?'];
      if (lower.includes('diversif'))
        return ['What is my sector allocation?', 'How concentrated is my largest position?', 'How does international exposure work?'];
      if (lower.includes('sell') || lower.includes('trim'))
        return ['What are the tax implications of selling?', 'Which positions carry the most concentration risk?', 'How does a wash sale work?'];
      return ['What is my largest single-position risk?', 'How diversified am I?', 'Which of my positions are at an unrealized loss?'];
    case 'personal_finance':
      if (lower.includes('retire'))
        return ['How do retirement account contribution limits work?', 'How does 401k allocation work?', 'How is compound growth calculated?'];
      if (lower.includes('save') || lower.includes('invest'))
        return ['How does my current portfolio break down?', 'What is my sector allocation?', 'How does dollar-cost averaging work?'];
      return ['How does this apply to my portfolio?', 'How do my current holdings break down?', 'Break down my portfolio allocation'];
    case 'general':
      return ['How does this affect my portfolio?', 'How do my holdings break down?', 'Show me my portfolio breakdown'];
    case 'stock_analysis':
      return [];
  }
}

// ── API handler ──

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  // Rate limit: 20 requests per IP per hour
  const ip = getClientIP(req);
  const limit = rateLimit(`ai-analyze:${ip}`, 20, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check daily analysis quota (free: 3/day, pro: unlimited)
  const quota = await checkAnalysisQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: 'Daily analysis limit reached. Upgrade to Pro for unlimited analyses.',
        code: 'QUOTA_EXCEEDED',
        quota: { used: quota.used, limit: quota.limit, remaining: 0 },
      },
      { status: 429 },
    );
  }

  const body = await req.json();
  // Accept both 'query' and 'question' for compatibility
  const userQuery: string = body.query || body.question;
  const conversationHistory: ConversationMessage[] | undefined = body.conversationHistory;

  if (!userQuery || typeof userQuery !== 'string') {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  // Cap query length to prevent abuse
  if (userQuery.length > 500) {
    return NextResponse.json({ error: 'Query too long (max 500 characters)' }, { status: 400 });
  }

  // Extract tickers from CURRENT query only — not conversation history
  const tickers = extractTickers(userQuery);
  const queryType = classifyQuery(userQuery, tickers);
  const responseType = RESPONSE_TYPE_MAP[queryType];

  // ── Grounded conversational path (2026-07-25) ──
  // Own-book, topic and finding-seeded questions get the grounded engine:
  // retrieve the agent's real findings + the whole book + tax context, compose
  // prose that cites findings by id, drop any citation that wasn't retrieved.
  // Clean single-ticker analysis keeps its card — that template earns its keep.
  // This is what makes the chat a conversation instead of a form.
  const groundedTopics = detectTopics(userQuery);
  if (queryType !== 'stock_analysis' && wantsGroundedAnswer(userQuery, groundedTopics)) {
    try {
      const context = await retrieveContext(supabase, user.id, userQuery);
      const history = Array.isArray(conversationHistory)
        ? conversationHistory
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-6)
        : [];
      const grounded = await composeAnswer(context, history);
      if (grounded.answer) {
        await recordAnalysisUsage(user.id);
        return NextResponse.json({
          analysis: grounded,
          queryType,
          rawQuery: userQuery,
          quota: quota.limit != null
            ? { used: quota.used + 1, limit: quota.limit, remaining: Math.max(0, (quota.remaining ?? 0) - 1) }
            : undefined,
        });
      }
    } catch (err) {
      // Grounded path is additive: any failure falls through to the card flow.
      console.error('grounded path failed, falling back:', err instanceof Error ? err.message : err);
    }
  }

  // ── Fetch data based on query type ──
  let dataContext = '';

  if (queryType === 'portfolio_review') {
    const portfolio = await getPortfolioSummary(user.id);
    if (portfolio.positionCount === 0) {
      return NextResponse.json({
        analysis: {
          type: 'portfolio_qa',
          title: 'No portfolio data found',
          summary: "You don't have any holdings linked yet. Connect your brokerage account on the Accounts page to get AI-powered portfolio analysis with real dollar amounts.",
          highlights: [],
          recommendation: 'Go to Connected Accounts and link your brokerage via Plaid.',
          followUpQuestions: [],
        },
      });
    }
    dataContext = formatPortfolioContext(portfolio);
    // Enrich top holdings with live market data
    const topTickers = portfolio.holdings.slice(0, 5).map(h => h.ticker).filter(Boolean);
    if (topTickers.length > 0) {
      const tickerDataList = await Promise.all(topTickers.map(getFullTickerData));
      const marketCtx = buildTickerContext(tickerDataList.filter(td => td.quote || td.profile));
      if (marketCtx) dataContext += '\n\n' + marketCtx;
    }
  } else if (queryType === 'tax_planning') {
    const currentYear = new Date().getFullYear();
    const [portfolio, capitalGainsResult, taxReport] = await Promise.all([
      getPortfolioSummary(user.id),
      supabase
        .from('capital_gains')
        .select('ticker, transaction_type, transaction_date, shares, price_per_share, cost_basis, proceeds, gain_loss, gain_loss_type')
        .eq('user_id', user.id)
        .eq('tax_year', currentYear)
        .order('transaction_date', { ascending: false }),
      generateTaxReport(user.id),
    ]);
    if (portfolio.positionCount === 0 && (capitalGainsResult.data || []).length === 0) {
      return NextResponse.json({
        analysis: {
          type: 'portfolio_qa',
          title: 'No tax data available',
          summary: 'Connect your brokerage account to get tax analysis based on your actual holdings and realized gains.',
          highlights: [],
          recommendation: 'Link your brokerage on the Accounts page to get started.',
          followUpQuestions: [],
        },
      });
    }
    dataContext = buildTaxContext(portfolio, (capitalGainsResult.data || []) as CapitalGainRow[], taxReport);
  } else if (queryType === 'stock_analysis' && tickers.length > 0) {
    // Fetch ticker data + portfolio context so we can reference user's position
    const [tickerDataList, portfolio] = await Promise.all([
      Promise.all(tickers.slice(0, 3).map(getFullTickerData)),
      getPortfolioSummary(user.id),
    ]);
    dataContext = buildTickerContext(tickerDataList.filter(td => td.quote || td.profile));
    // Add user's position context if they hold any of these stocks
    if (portfolio.positionCount > 0) {
      const heldTickers = tickers.filter(t => portfolio.holdings.some(h => h.ticker === t));
      if (heldTickers.length > 0) {
        const positionLines = heldTickers.map(t => {
          const h = portfolio.holdings.find(h => h.ticker === t)!;
          const gl = h.unrealizedGainLoss != null ? `$${fmt(h.unrealizedGainLoss)}` : 'N/A';
          const glPct = h.unrealizedGainLossPct != null ? `${(h.unrealizedGainLossPct * 100).toFixed(2)}%` : '';
          return `  ${h.ticker}: ${h.shares} shares @ $${h.currentPrice} = $${fmt(h.totalValue)} (${h.allocationPct.toFixed(1)}% of portfolio) | Unrealized P&L: ${gl} (${glPct}) | Cost basis: $${h.totalCostBasis != null ? fmt(h.totalCostBasis) : 'N/A'}`;
        });
        dataContext += `\n\n=== USER'S POSITION IN THESE STOCKS ===\nTotal Portfolio Value: $${fmt(portfolio.totalValue)}\n${positionLines.join('\n')}`;
      } else {
        dataContext += `\n\n=== USER DOES NOT HOLD ${tickers.join(', ')} ===\nTotal Portfolio Value: $${fmt(portfolio.totalValue)} across ${portfolio.positionCount} positions.`;
      }
    }
  } else if (queryType === 'personal_finance') {
    // Include FULL portfolio context for personalized advice
    const portfolio = await getPortfolioSummary(user.id);
    if (portfolio.positionCount > 0) {
      dataContext = formatPortfolioContext(portfolio);
    }
  } else if (queryType === 'general') {
    // Include full portfolio context so general answers can reference real data
    const portfolio = await getPortfolioSummary(user.id);
    if (portfolio.positionCount > 0) {
      dataContext = formatPortfolioContext(portfolio);
    }
  }

  // What the agent already surfaced (A-shape, 2026-07-24): give the model
  // Helm's own findings so answers reference real catches — with their dates
  // and sources — instead of re-deriving from market data. The session client
  // scopes every read to the user's own rows under RLS. Additive: any failure
  // here must never break the answer.
  try {
    const topics = detectTopics(userQuery);
    if (tickers.length > 0 || topics.length > 0 || queryType === 'portfolio_review') {
      const findings = await getAgentFindings(supabase, user.id, tickers, topics);
      if (findings.length > 0) {
        const lines = findings.slice(0, 8).map((f) => {
          let line = `- [${f.ticker ?? 'portfolio'} · ${f.date ?? 'n/a'}] ${f.summary}`;
          if (f.quote) line += ` — "${f.quote.slice(0, 180)}"`;
          line += ` (${f.source})`;
          return line;
        });
        dataContext +=
          `${dataContext ? '\n\n' : ''}=== WHAT HELM ALREADY FOUND (the agent's own findings on this user's book; ` +
          `reference the date and source when you use one, and NEVER invent a finding) ===\n${lines.join('\n')}`;
      }
    }
  } catch {
    /* findings are additive — the answer proceeds without them */
  }

  // ── Build LLM messages ──
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: PROMPTS[queryType] },
  ];

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-6)) {
      if (msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: fence(msg.content, 'HISTORY') });
      }
    }
  }

  let userMessage: string;
  if (dataContext) {
    userMessage = `FINANCIAL DATA:\n${fence(dataContext, 'MARKET_DATA')}\n\nUSER QUERY: ${fence(userQuery, 'USER_QUERY')}`;
  } else if (queryType === 'portfolio_review' || queryType === 'tax_planning') {
    userMessage = `USER QUERY: ${fence(userQuery, 'USER_QUERY')}\n\n(User has no linked holdings. Advise them to connect accounts on the Accounts page.)`;
  } else {
    userMessage = `USER QUERY: ${fence(userQuery, 'USER_QUERY')}\n\n(User has no linked portfolio. If the question would benefit from portfolio data, mention that connecting accounts on the Accounts page would allow personalized analysis.)`;
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: queryType === 'stock_analysis' ? 0.7 : 0.6,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content?.trim();
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
      // Ensure the response type matches what our cards expect
      if (!analysis.type || analysis.type !== responseType) {
        analysis.type = responseType;
      }
      // Validate required fields exist — fall through to fallback if not
      if (!analysis.summary && !analysis.title) {
        throw new Error('Missing required fields in AI response');
      }
      // Ensure arrays are actually arrays (AI sometimes returns null)
      if (responseType === 'general') {
        if (!Array.isArray(analysis.keyPoints)) analysis.keyPoints = [];
        if (!Array.isArray(analysis.metrics)) analysis.metrics = [];
      } else if (responseType === 'portfolio_qa') {
        if (!Array.isArray(analysis.highlights)) analysis.highlights = [];
      } else if (responseType === 'stock_analysis') {
        if (!Array.isArray(analysis.metrics)) analysis.metrics = [];
        if (!Array.isArray(analysis.newsHighlights)) analysis.newsHighlights = [];
      }
      // Add follow-up questions if missing
      if (!analysis.followUpQuestions?.length) {
        const followUps = generateFollowUps(userQuery, queryType);
        if (followUps.length > 0) {
          analysis.followUpQuestions = followUps;
        }
      }
    } catch {
      // Fallback: wrap raw text in the appropriate card structure
      if (responseType === 'portfolio_qa') {
        analysis = {
          type: 'portfolio_qa',
          title: 'Analysis',
          summary: content,
          highlights: [],
          recommendation: '',
          followUpQuestions: generateFollowUps(userQuery, queryType),
        };
      } else {
        analysis = {
          type: 'general',
          title: 'Analysis',
          summary: content,
          keyPoints: [],
          metrics: [],
          followUpQuestions: generateFollowUps(userQuery, queryType),
        };
      }
    }

    // Record usage after successful analysis
    await recordAnalysisUsage(user.id);

    return NextResponse.json({
      analysis,
      queryType,
      rawQuery: userQuery,
      quota: quota.limit != null
        ? { used: quota.used + 1, limit: quota.limit, remaining: Math.max(0, (quota.remaining ?? 0) - 1) }
        : undefined,
    });
  } catch (error) {
    console.error('AI analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
