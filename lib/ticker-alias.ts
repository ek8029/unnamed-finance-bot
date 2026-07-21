// Broker symbol aliasing.
//
// Brokerages report the same economic position under different symbols. Schwab
// PCRA in particular emits variant symbols (SKHYV) and sometimes the full
// security description in place of a ticker. Left alone, one position lands in
// the book as two or three separate holdings that never aggregate, so exposure
// and concentration understate the real position.
//
// This normalizes for AGGREGATION only. It deliberately does not rewrite stored
// rows: each brokerage row stays as reported (auditable against a statement),
// and only the analytics layer collapses them.

/** Variant symbol -> canonical exchange ticker. */
const ALIASES: Record<string, string> = {
  SKHYV: 'SKHY',   // Schwab variant for SK Hynix ADR
  HXSCL: 'SKHY',   // unsponsored SK Hynix ADR, OTC
  HXSCF: 'SKHY',
};

/**
 * Some rows arrive with a full security description instead of a ticker
 * ("Sk Hynix Inc Xxxsponsored Trd Reg Way1 Adr Reps 0.1 Ord Shs"). Match those
 * on a distinctive leading phrase rather than trying to parse the whole string.
 */
const DESCRIPTION_PREFIXES: [RegExp, string][] = [
  [/^sk\s*hynix/i, 'SKHY'],
];

/** True when the value looks like a description rather than a ticker symbol. */
export function looksLikeDescription(raw: string): boolean {
  return raw.trim().length > 12 || /\s/.test(raw.trim());
}

/**
 * Canonical ticker for aggregation. Returns the input (uppercased, trimmed)
 * when no alias applies, so unknown symbols pass through untouched.
 */
export function canonicalTicker(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const upper = trimmed.toUpperCase();

  if (upper in ALIASES) return ALIASES[upper];

  for (const [pattern, canonical] of DESCRIPTION_PREFIXES) {
    if (pattern.test(trimmed)) return canonical;
  }

  return upper;
}

/** Whether two reported symbols represent the same economic position. */
export function isSamePosition(a: string, b: string): boolean {
  return canonicalTicker(a) === canonicalTicker(b);
}
