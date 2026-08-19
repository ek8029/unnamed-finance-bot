// Assemble everything a question needs to be answered from real ground: the
// agent's own findings, a full read of the user's book (holdings, cost basis,
// sector allocation), realized + harvestable tax context, the value ledger, and
// (best effort) live market data for any ticker the question names.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getFullTickerData } from '@/lib/financial-data';
import { getAgentFindings } from './findings';
import { newsFindings } from './news-findings';
import { getPortfolioBrief, getTaxContext, getValueLedger } from './account';
import { extractTickers, detectTopics } from './query-parse';
import type { Finding, PortfolioBrief, ResearchContext } from './types';

const MAX_MARKET_TICKERS = 2; // Finnhub free tier — keep the fan-out small.

async function getMarketData(tickers: string[]): Promise<string> {
  const picks = tickers.slice(0, MAX_MARKET_TICKERS);
  if (picks.length === 0) return '';
  try {
    const list = await Promise.all(picks.map((t) => getFullTickerData(t).catch(() => null)));
    const blocks: string[] = [];
    for (const td of list) {
      if (!td || (!td.quote && !td.profile)) continue;
      const lines: string[] = [`=== ${td.symbol} ===`];
      if (td.profile) lines.push(`${td.profile.name} · ${td.profile.industry}`);
      if (td.quote) {
        lines.push(`Price $${td.quote.c}`);
        if (td.quote.dp != null) lines.push(`Day change ${td.quote.dp >= 0 ? '+' : ''}${td.quote.dp}%`);
      }
      const m = td.financials?.metric;
      if (m) {
        const metrics: string[] = [];
        if (m['peBasicExclExtraTTM'] != null) metrics.push(`P/E ${Number(m['peBasicExclExtraTTM']).toFixed(1)}`);
        if (m['52WeekHigh'] != null && m['52WeekLow'] != null) metrics.push(`52w $${m['52WeekLow']}–$${m['52WeekHigh']}`);
        if (metrics.length) lines.push(metrics.join(' · '));
      }
      // Headlines are NOT written here any more. They are minted as findings
      // by getNewsForTickers so the model can cite them; leaving a second,
      // uncitable copy in this block is what taught it to paraphrase without
      // a receipt.
      blocks.push(lines.join('\n'));
    }
    return blocks.join('\n\n');
  } catch {
    return '';
  }
}

/** Headlines for the tickers in play, as citable findings. */
async function getNewsForTickers(tickers: string[]): Promise<Finding[]> {
  const picks = tickers.slice(0, MAX_MARKET_TICKERS);
  if (picks.length === 0) return [];
  try {
    const lists = await Promise.all(
      picks.map(async (t) => {
        const td = await getFullTickerData(t).catch(() => null);
        return td?.news?.length ? newsFindings(t, td.news) : [];
      }),
    );
    return lists.flat();
  } catch {
    return [];
  }
}

/**
 * Positions that actually moved today, biggest absolute move first.
 *
 * "Why is PLTR up" could not be answered from ground before this: the context
 * carried what the agent found weeks ago and what the book is worth, but never
 * today's tape. Without the move in context the model either hedged or made a
 * number up, and the grounding gate could only catch the second one.
 */
function formatMovers(brief: PortfolioBrief | null): string {
  if (!brief) return '';
  const movers = brief.holdings
    .filter((h) => h.dayChangePct != null && Math.abs(h.dayChangePct) >= 1)
    .sort((a, b) => Math.abs(b.dayChangePct ?? 0) - Math.abs(a.dayChangePct ?? 0))
    .slice(0, 8);
  if (movers.length === 0) return '';
  const lines = movers.map((h) => {
    const pct = h.dayChangePct as number;
    const dollars = (h.value * pct) / (100 + pct);
    return `  ${h.ticker}: ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% today`
      + ` (${dollars >= 0 ? '+' : '-'}$${Math.round(Math.abs(dollars)).toLocaleString('en-US')} on a $${Math.round(h.value).toLocaleString('en-US')} position)`;
  });
  return `=== MOVERS ON THEIR BOOK TODAY ===\n${lines.join('\n')}`;
}

export async function retrieveContext(
  db: SupabaseClient,
  userId: string,
  query: string,
): Promise<ResearchContext> {
  const tickers = extractTickers(query);
  const topics = detectTopics(query);

  // Book first — tax and ledger both read off it.
  const [portfolio, agentFindings, marketData, news] = await Promise.all([
    getPortfolioBrief(db, userId),
    getAgentFindings(db, userId, tickers, topics),
    getMarketData(tickers),
    getNewsForTickers(tickers),
  ]);

  const [tax, ledger] = await Promise.all([
    getTaxContext(db, userId, portfolio, new Date().getFullYear()),
    getValueLedger(db, userId, portfolio),
  ]);

  // The agent's own findings lead; headlines follow as supporting receipts, so
  // a question about today has something to cite without displacing the work
  // the agent actually did.
  const findings = [...agentFindings, ...news];
  const movers = formatMovers(portfolio);

  return {
    query,
    tickers,
    topics,
    findings,
    portfolio,
    tax,
    ledger,
    marketData: [movers, marketData].filter(Boolean).join('\n\n'),
  };
}
