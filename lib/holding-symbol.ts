/** Holding identifiers can include share classes and crypto pairs. Never turn
 * punctuation-bearing identifiers into another security's ticker. */
export function parseHoldingSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,15}(?:[.-][A-Z0-9]{1,10})?$/.test(symbol) ? symbol : null;
}
