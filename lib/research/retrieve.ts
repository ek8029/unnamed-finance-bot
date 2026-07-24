// Assemble everything a question needs to be answered from real ground: the
// agent's own findings, a full read of the user's book (holdings, cost basis,
// sector allocation), realized + harvestable tax context, the value ledger, and
// (best effort) live market data for any ticker the question names.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getFullTickerData } from '@/lib/financial-data';
import { getAgentFindings } from './findings';
import { getPortfolioBrief, getTaxContext, getValueLedger } from './account';
import { extractTickers, detectTopics } from './query-parse';
import type { ResearchContext } from './types';

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
      if (td.news?.length) {
        lines.push('Recent headlines:');
        td.news.slice(0, 3).forEach((n) => {
          const d = new Date(n.datetime * 1000).toISOString().slice(0, 10);
          lines.push(`  [${d}] ${n.headline} (${n.source})`);
        });
      }
      blocks.push(lines.join('\n'));
    }
    return blocks.join('\n\n');
  } catch {
    return '';
  }
}

export async function retrieveContext(
  db: SupabaseClient,
  userId: string,
  query: string,
): Promise<ResearchContext> {
  const tickers = extractTickers(query);
  const topics = detectTopics(query);

  // Book first — tax and ledger both read off it.
  const [portfolio, findings, marketData] = await Promise.all([
    getPortfolioBrief(db, userId),
    getAgentFindings(db, userId, tickers, topics),
    getMarketData(tickers),
  ]);

  const [tax, ledger] = await Promise.all([
    getTaxContext(db, userId, portfolio, new Date().getFullYear()),
    getValueLedger(db, userId, portfolio),
  ]);

  return { query, tickers, topics, findings, portfolio, tax, ledger, marketData };
}
