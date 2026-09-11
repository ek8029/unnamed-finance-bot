// Spec 3.4, plus `brief` added 2026-09-11. Codes are the only thing stored;
// copy lives in v3-copy.ts. The order is the order the cards are offered in:
// the four that always apply first, then `overlap`, which needs two accounts,
// so a single-account reader gets a full grid rather than a hanging card.
// A new code needs a migration widening user_preferences.first_look_known_codes
// (079 did this for `brief`) or the write is rejected and every pick is lost.
export const FIRST_LOOK_CODES = ['exposure', 'receipts', 'changes', 'brief', 'overlap'] as const;
export type FirstLook = (typeof FIRST_LOOK_CODES)[number];
export type RevealCard = 'exposure' | 'receipts' | 'changes';

const KNOWN = new Set<string>(FIRST_LOOK_CODES);

/** null means reject the write. [] means the user skipped. */
export function parseFirstLook(value: unknown): FirstLook[] | null {
  if (!Array.isArray(value)) return null;
  const out: FirstLook[] = [];
  for (const v of value) {
    if (typeof v !== 'string' || !KNOWN.has(v)) return null;
    if (!out.includes(v as FirstLook)) out.push(v as FirstLook);
  }
  return out;
}

/** Card order for Screen 3. `overlap` changes the exposure sentence, not the card
 *  list, and `brief` is about the morning mail rather than a card, so neither
 *  adds one. */
export function orderRevealCards(codes: readonly string[] | null | undefined, accounts: number): RevealCard[] {
  const chosen = (codes ?? []).filter((c): c is RevealCard => c === 'exposure' || c === 'receipts' || c === 'changes');
  const rest: RevealCard[] = ['exposure', 'receipts'].filter((c) => !chosen.includes(c as RevealCard)) as RevealCard[];
  void accounts;
  return [...chosen, ...rest];
}

export function wantsOverlap(codes: readonly string[] | null | undefined, accounts: number): boolean {
  return accounts >= 2 && (codes ?? []).includes('overlap');
}
