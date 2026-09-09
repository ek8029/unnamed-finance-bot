// Spec 3.4. Codes are the only thing stored; copy lives in v3-copy.ts.
export const FIRST_LOOK_CODES = ['exposure', 'receipts', 'changes', 'overlap'] as const;
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

/** Card order for Screen 3. `overlap` changes the exposure sentence, not the card list. */
export function orderRevealCards(codes: readonly string[] | null | undefined, accounts: number): RevealCard[] {
  const chosen = (codes ?? []).filter((c): c is RevealCard => c === 'exposure' || c === 'receipts' || c === 'changes');
  const rest: RevealCard[] = ['exposure', 'receipts'].filter((c) => !chosen.includes(c as RevealCard)) as RevealCard[];
  void accounts;
  return [...chosen, ...rest];
}

export function wantsOverlap(codes: readonly string[] | null | undefined, accounts: number): boolean {
  return accounts >= 2 && (codes ?? []).includes('overlap');
}
