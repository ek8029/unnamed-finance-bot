/**
 * News Source Quality Tiers
 *
 * Static classification of financial news sources into quality tiers.
 * Used to surface a "source quality badge" on news items so users can
 * quickly gauge the credibility of a headline.
 *
 * Tier 1: Major wire services, national papers, premier financial outlets
 * Tier 2: Well-known financial media, respected but more opinion-driven
 * Other:  Everything else (blogs, press releases, aggregators)
 */

const TIER_1_SOURCES = new Set([
  'Reuters',
  'Bloomberg',
  'Wall Street Journal',
  'WSJ',
  'Financial Times',
  'FT',
  'CNBC',
  'The New York Times',
  'Associated Press',
  'AP',
  "Barron's",
  'MarketWatch',
  'Seeking Alpha',
  'The Economist',
  'Forbes',
]);

const TIER_2_SOURCES = new Set([
  'Yahoo Finance',
  'Investopedia',
  'Motley Fool',
  'The Motley Fool',
  'TechCrunch',
  'Business Insider',
  'Benzinga',
  'Zacks',
  'TheStreet',
  "Investor's Business Daily",
]);

export type SourceTier = 'tier1' | 'tier2' | 'other';

/**
 * Classify a news source into a quality tier.
 *
 * Does an exact match first, then a case-insensitive substring match
 * to handle variations like "Reuters via Yahoo" or "bloomberg.com".
 */
export function getSourceTier(source: string | null): SourceTier {
  if (!source) return 'other';

  // Exact match (fastest path)
  if (TIER_1_SOURCES.has(source)) return 'tier1';
  if (TIER_2_SOURCES.has(source)) return 'tier2';

  // Fuzzy match for variations (e.g. "Bloomberg.com", "CNBC Television")
  const lower = source.toLowerCase();
  for (const s of TIER_1_SOURCES) {
    if (lower.includes(s.toLowerCase())) return 'tier1';
  }
  for (const s of TIER_2_SOURCES) {
    if (lower.includes(s.toLowerCase())) return 'tier2';
  }

  return 'other';
}
