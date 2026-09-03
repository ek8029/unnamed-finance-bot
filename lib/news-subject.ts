/**
 * Is a news article ABOUT its primary ticker, or does it only MENTION the company?
 *
 * Measured 2026-09-03 on 160 production rows: 45% of what the market
 * intelligence feed served were mentions, not articles about the company
 * ("ex-Nvidia engineer raises $30M", "Job cuts are at a four-year low"
 * tagged AMZN, "Top Analyst Reports for Amazon, AbbVie & Alibaba").
 *
 * This module holds the FREE half of the answer: shapes that are never a
 * company story, whatever the model would say. It runs in two places:
 *   - at ingest, to save a model call on the obvious cases
 *   - on the read path, so the 153k rows written before any of this existed
 *     get the same treatment without a backfill
 *
 * The ambiguous remainder goes to `lib/news-subject-model.ts`. Anything this
 * file is unsure about returns null, never 'about': a false 'about' here would
 * skip the model that could have caught it.
 */

import { isComparisonHeadline } from '@/lib/news-quality';
import { isTickerRoundup } from '@/lib/news-primary-ticker';

/** Market-wide wrappers and live blogs. The company is an example inside a
 *  market story, not its subject. */
const WRAPPER =
  /^\s*(stock market today|market chatter|markets? (today|wrap|recap|close|open)|live coverage|pre-?market|after-?hours|before the bell|closing bell|opening bell|morning brief|what to watch|us stock futures|stock futures|dow jones (futures|today)|s&p 500|nasdaq)\b/i;

/** Aggregator list posts: "Top Analyst Reports for Amazon, AbbVie & Alibaba",
 *  "The Zacks Analyst Blog Highlights AMD, Costco, AstraZeneca...". These name
 *  the company in a series, which every name-matching rule reads as a hit. */
const LIST_PREFIX =
  /^\s*(top (analyst|stock) reports?|the zacks analyst blog|zacks analyst blog|analyst blog highlights|top stock picks|stocks? to watch|best stocks?|\d+\s+(top|best|great|no-brainer)\b)/i;

/** A series of three or more proper names is a list, not a story:
 *  "Microsoft, Amazon, Google Circle $50B", "DYNF, CRM, ALL, O: ETF Alert".
 *
 *  Commas only. Splitting on "&" as well cost two real articles in the
 *  2026-09-03 sample, because plenty of companies have one in their name
 *  ("Procter & Gamble Fabric & Home Care Trends Mixed"). */
function isNameSeries(title: string): boolean {
  const head = title.split(/[:–—]/)[0] ?? title;
  const parts = head.split(/,\s*/).filter(Boolean);
  if (parts.length < 3) return false;
  const namey = parts.filter((p) => /^[A-Z][A-Za-z.&']*$/.test(p.trim().split(/\s+/)[0] ?? ''));
  return namey.length >= 3;
}

/** "ex-Nvidia engineer", "former Amazon exec". The company is where someone
 *  used to work. Only fires immediately before the name, so "Former CEO
 *  returns to Disney" is left for the model. */
function isExEmployerMention(title: string, names: string[]): boolean {
  for (const n of names) {
    if (n.length < 2) continue;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b(ex|former)[-\\s]+${esc}\\b`, 'i').test(title)) return true;
  }
  return false;
}

export type SubjectVerdict = 'about' | 'mention';

/**
 * The free pass. Returns 'mention' when the headline's shape rules the company
 * out as the subject, and null when it cannot tell (send those to the model).
 * Never returns 'about'.
 */
export function subjectPrefilter(input: {
  title: string;
  ticker: string;
  companyName?: string | null;
  tickers?: string[];
}): { verdict: 'mention'; reason: string } | null {
  const title = input.title ?? '';
  if (!title) return { verdict: 'mention', reason: 'no title' };

  if (WRAPPER.test(title)) return { verdict: 'mention', reason: 'market wrapper' };
  if (LIST_PREFIX.test(title)) return { verdict: 'mention', reason: 'aggregator list' };
  if (isNameSeries(title)) return { verdict: 'mention', reason: 'name series' };
  if (isComparisonHeadline(title)) return { verdict: 'mention', reason: 'comparison headline' };
  if (input.tickers && isTickerRoundup(title, input.tickers)) {
    return { verdict: 'mention', reason: 'ticker roundup' };
  }

  const names = [input.ticker, ...(input.companyName ? [input.companyName.split(/[\s,.]+/)[0]] : [])]
    .filter((n): n is string => !!n);
  if (isExEmployerMention(title, names)) return { verdict: 'mention', reason: 'ex-employer' };

  return null;
}
