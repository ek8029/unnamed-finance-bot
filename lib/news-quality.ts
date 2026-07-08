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

/**
 * Head-to-head "Stock A vs Stock B — which is the better buy" comparison /
 * listicle clickbait. These are opinion pieces, not primary evidence about a
 * thesis pillar, and the scorer was labeling them "supports" for whichever
 * ticker they attached to regardless of which side the article favored (e.g.
 * "Nvidia vs AMD: Which Is the Better Buy" scored as SUPPORTING AMD; "Micron vs
 * Apple: MU Is the Better Buy" scored as supporting an Apple-silicon pillar).
 * Used to exclude such headlines from thesis scoring entirely.
 */
export function isComparisonHeadline(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();

  // "vs / versus", but NOT the legitimate earnings framing "beat vs estimates".
  const hasVs =
    /\bvs\.?\b|\bversus\b/.test(t) &&
    !/\bvs\.?\s+(estimates?|consensus|expectations?|forecasts?|street|guidance|prior|last year|year[- ]ago)\b/.test(t);

  // A "which one wins / better buy" judgment — the clickbait tell.
  const verdict =
    /\b(better buy|better than|better positioned?|the better\b|is the better|one winner|wins the\b|crush\w*|dominat\w*|which\b[^.?!]*\b(buy|win|reward|better|to own)|better\b[^.?!]{0,24}\bstock\b)\b/.test(t);

  if (hasVs && verdict) return true;
  // "A Better Buy Than B" style without an explicit "vs".
  if (/\bbetter buy\b|\bbetter than\b/.test(t)) return true;
  return false;
}
