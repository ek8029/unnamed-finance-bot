// Pure driver-term matching for shared-driver overlap. No I/O, no server deps —
// fully unit-testable. A candidate claim shares a cluster driver only when it
// overlaps on a DISTINCTIVE (non-generic) driver term. Filler words like
// "revenue"/"growth"/"demand" alone must never manufacture a match — that loose
// bag-of-words rule tied SPCX's Starlink pillar to an "Advertising revenue
// growth" cluster (GOOGL/META) on the two words "revenue" + "growth".

/** Lowercased word set for driver-term matching against free-text claims. */
export function termSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4), // skip stopword-ish short tokens
  );
}

// Generic finance filler (>=4 chars) that shows up across nearly all bullish
// theses and therefore carries no thematic signal on its own. A driver term in
// this set can corroborate a match but can never be the sole basis for one.
const GENERIC_DRIVER_TERMS = new Set<string>([
  'revenue', 'revenues', 'growth', 'growing', 'demand', 'margin', 'margins',
  'sales', 'earnings', 'profit', 'profits', 'market', 'markets', 'spending',
  'trend', 'trends', 'guidance', 'outlook', 'quarter', 'quarterly', 'annual',
  'strong', 'stronger', 'rising', 'increase', 'increases', 'increasing',
  'higher', 'lower', 'expansion', 'expanding', 'momentum', 'adoption',
  'pricing', 'share', 'shares', 'value', 'business', 'company', 'companies',
  'driver', 'drivers', 'continue', 'continued', 'overall', 'total', 'data',
]);

/** Driver terms with the generic filler removed — the words that actually carry the theme. */
export function distinctiveTerms(terms: Set<string>): Set<string> {
  return new Set([...terms].filter((t) => !GENERIC_DRIVER_TERMS.has(t)));
}

/**
 * Does a candidate claim genuinely lean on this cluster driver?
 * Requires at least one DISTINCTIVE (non-filler) shared term, plus enough total
 * overlap to corroborate (relaxed for very short driver phrases). A driver made
 * up entirely of generic words can match nothing — safer than matching everything.
 */
export function claimSharesDriver(driver: string, claim: string): boolean {
  const driverTerms = termSet(driver);
  if (driverTerms.size === 0) return false;
  const claimTerms = termSet(claim);
  const distinct = distinctiveTerms(driverTerms);

  let sharedTotal = 0;
  for (const t of driverTerms) if (claimTerms.has(t)) sharedTotal++;
  let sharedDistinct = 0;
  for (const t of distinct) if (claimTerms.has(t)) sharedDistinct++;

  const need = Math.min(2, driverTerms.size);
  return sharedDistinct >= 1 && sharedTotal >= need;
}
