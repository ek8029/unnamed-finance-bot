// Pure query parsing for the research engine: which tickers a question names,
// which topics it touches, and (for the eventual prod graft) whether it wants a
// templated card or a grounded prose answer.
//
// No IO here on purpose — this is the part that has to be exactly right and is
// cheap to test.

import type { Topic } from './types';

// A moderate stopword set: ALL-CAPS English words that are not tickers. Kept
// deliberately smaller than the analyze route's exhaustive list — the research
// engine leans on the well-known list and the topic router, so a rare false
// positive here just means one extra (empty) market lookup, not a wrong answer.
const STOP_WORDS = new Set([
  'I', 'A', 'MY', 'ME', 'WE', 'IT', 'AN', 'TO', 'IN', 'ON', 'AT', 'BY', 'OR',
  'OF', 'IF', 'SO', 'AS', 'UP', 'NO', 'VS', 'AND', 'FOR', 'BUT', 'NOT', 'THE',
  'IS', 'AM', 'BE', 'DO', 'HAS', 'CAN', 'WAS', 'ARE', 'GOT', 'GET', 'OWN',
  'HOW', 'WHY', 'WHO', 'WHAT', 'WHEN', 'ALL', 'NOW', 'ITS', 'ANY', 'OUT',
  'TAX', 'ETF', 'EPS', 'YOY', 'QOQ', 'CEO', 'CFO', 'IPO', 'SEC', 'FED', 'ATH',
  'YTD', 'ROI', 'RISK', 'SELL', 'HOLD', 'GAIN', 'LOSS', 'DOWN', 'THIS', 'THAT',
  'WITH', 'FROM', 'HAVE', 'DOES', 'YEAR', 'TLH', 'DID', 'SEE', 'BUY', 'TERM',
]);

// Common tickers that show up in lowercase in natural questions.
const WELL_KNOWN =
  /\b(?:aapl|msft|goog|googl|amzn|nvda|tsla|meta|nflx|amd|intc|spy|qqq|voo|vti|jpm|dis|ba|nke|pypl|pfe|crm|adbe|cost|wmt|hd|ko|pep|abnb|uber|sofi|pltr|coin|snap|mu|avgo|jnj|unh)\b/gi;

/** Tickers named in a question (explicit caps, $TICKER, or well-known lowercase). */
export function extractTickers(query: string): string[] {
  const explicit = query.match(/\b[A-Z]{1,5}\b/g) ?? [];
  const dollar =
    query.match(/\$([A-Za-z]{1,5})/g)?.map((t) => t.replace('$', '').toUpperCase()) ?? [];
  const wellKnown = query.match(WELL_KNOWN)?.map((t) => t.toUpperCase()) ?? [];
  const all = [...new Set([...explicit, ...dollar, ...wellKnown])];
  return all.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

// Trailing \b is deliberately omitted: these are stems (concentrat -> concentrated,
// harvest -> harvesting, earning -> earnings). A rare over-match just pulls a few
// extra findings, which is cheap; a missed stem loses the whole topic.
const TOPIC_PATTERNS: Record<Topic, RegExp> = {
  tax: /\b(tax|harvest|wash sale|capital gain|cost basis|write.?off|deduct|realized|unrealized|tlh)/i,
  risk: /\b(risk|hedge|drawdown|crash|correction|downturn|bear market|exposure|volatil)/i,
  concentration: /\b(concentrat|overweight|underweight|biggest (position|holding)|single.?stock|allocation|diversif)/i,
  earnings: /\b(earning|eps|revenue|guidance|report|quarter|beat|miss|top.?line|bottom.?line)/i,
  performance: /\b(perform|return|benchmark|vs the market|beat the market|up or down|how much (am|have) i)/i,
};

/** Topics a question touches, used to pull the right agent findings. */
export function detectTopics(query: string): Topic[] {
  return (Object.keys(TOPIC_PATTERNS) as Topic[]).filter((t) => TOPIC_PATTERNS[t].test(query));
}

// Actions inbox (`insights`) uses its own type enum. Map research topics onto it
// so a "tax" question pulls the tax insights, a risk/concentration question the
// portfolio ones, and so on.
const TOPIC_TO_INSIGHT_TYPES: Record<Topic, string[]> = {
  tax: ['tax'],
  risk: ['portfolio', 'market'],
  concentration: ['portfolio'],
  earnings: ['market', 'portfolio'],
  performance: ['portfolio'],
};

export function topicToInsightTypes(topics: Topic[]): string[] {
  return [...new Set(topics.flatMap((t) => TOPIC_TO_INSIGHT_TYPES[t]))];
}

/**
 * True when the question is about the user's own book / the agent's own work
 * (as opposed to a cold "analyze NVDA"). These are the questions the grounded
 * engine exists for: they should pull findings, not fill a stock card.
 */
export function wantsGroundedAnswer(query: string, topics: Topic[]): boolean {
  if (topics.length > 0) return true;
  if (/\b(my|mine|i own|i hold|why is|what did you|what changed|what have you|should i worry|am i)\b/i.test(query)) {
    return true;
  }
  // Findings vocabulary: questions about what the agent has surfaced are
  // own-book by construction, even with no pronoun ("which ticker is
  // challenged?", "any theses breaking?"). Stems, same as the topic patterns.
  if (/\b(challeng|weaken|breaking|broken|under pressure|in trouble|thes[ie]s|flagged|surfaced|finding)/i.test(query)) {
    return true;
  }
  // "which ticker/position/holding ..." has no referent except the user's own
  // book — a cold analysis question names its ticker instead of asking which.
  return /\bwhich (ticker|position|holding|stock)s?\b/i.test(query);
}
