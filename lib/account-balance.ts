/**
 * What an account balance MEANS, in one place.
 *
 * Six call sites computed net worth from linked_accounts and they did not
 * agree with each other. Two treated a credit card balance as signed, two
 * wrapped it in Math.abs(), one clamped assets at zero, and every one of them
 * read current_balance for cash. This module is the single answer so the
 * dashboard, the summary, the snapshot writer and Wrapped cannot drift again.
 *
 * THE THREE RULES, and why each is what it is:
 *
 * 1. CASH IS `available`, NOT `current`. Plaid returns both. `current` is the
 *    posted balance; `available` subtracts pending charges and holds, and is
 *    the number the bank's own app shows. Reading `current` made Helm disagree
 *    with Wells Fargo by exactly the pending transactions, which reads as Helm
 *    being wrong. It is also the conservative figure, which is the rule for
 *    anything shown to a user. Not every institution reports it, so `current`
 *    remains the fallback.
 *
 * 2. `available` IS ONLY MEANINGFUL ON DEPOSITORY ACCOUNTS. On a credit card
 *    `available` is the REMAINING CREDIT LINE. Reading it as cash would turn an
 *    unused $8k limit into an $8k asset. On a brokerage it is the uninvested
 *    cash, not the account value. So the preference is scoped to checking and
 *    savings, and everything else keeps `current`.
 *
 * 3. LIABILITIES ARE SIGNED, NEVER abs(). Plaid's convention is positive means
 *    owed and negative means the balance is in the user's favour. abs() turns a
 *    statement credit into debt. Four of the thirteen credit cards in this
 *    database are currently negative, so this was subtracting real money from
 *    real people's net worth.
 *
 * Brokerage and crypto accounts holding synced positions are deliberately NOT
 * handled here: their value comes from holdings rows, and callers skip them to
 * avoid double-counting. That decision needs the holdings list, which is the
 * caller's to know.
 */

export interface BalanceRow {
  account_type: string | null;
  account_subtype?: string | null;
  current_balance: number | string | null;
  available_balance?: number | string | null;
}

/** Balance means "owed" on these, not "held". */
const LIABILITY_TYPES = new Set(['credit_card', 'loan', 'mortgage']);

/**
 * Rule 2, continued: an ALLOWLIST of `type/subtype` pairs where `available`
 * has been verified to mean spendable cash. Anything not listed uses
 * `current`.
 *
 * This is deliberately an allowlist rather than a denylist, because the two
 * ways of being wrong are not the same size:
 *
 *   - Wrong with `current` on a chequing account overstates by the pending
 *     amount. Bounded, and small: the real gaps in this database are 431.93,
 *     10.00 and 10.00.
 *   - Wrong with `available` on a settlement-style account understates by the
 *     WHOLE balance. One cash management account here reports current
 *     95,916.88 against available 22,773.88, because on a brokerage sweep
 *     `available` means settled and withdrawable, not owned. Preferring it
 *     would have deleted 73,143.00 from a real person's net worth, silently.
 *
 * A denylist gets that second case wrong by default every time a new
 * institution or subtype appears. An allowlist gets the first case wrong
 * instead, which is a rounding error by comparison.
 *
 * A percentage guard was considered and rejected: on a small balance a
 * perfectly ordinary pending charge is a large percentage (40 on 50 is 80%),
 * so it would misfire on exactly the accounts it was meant to protect.
 *
 * Adding a pair here is a deliberate act: confirm against real rows that
 * `available` tracks pending activity rather than settlement or lock-up.
 * Deposit subtypes NOT listed, and why: `cd` and `hsa` can restrict
 * withdrawal, `money market` can settle, `cash management` does the above.
 * All four report available == current in this database today, so they read
 * identically either way — they are excluded because that equality is not
 * guaranteed at another institution.
 */
const AVAILABLE_MEANS_SPENDABLE = new Set(['checking/checking', 'savings/savings']);

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function isLiabilityType(type: string | null | undefined): boolean {
  return LIABILITY_TYPES.has(String(type ?? ''));
}

/**
 * What this account is worth as an asset.
 *
 * Returns 0 for liabilities so a caller that forgets to branch understates
 * rather than counting a debt as money. Negative is returned as-is: an
 * overdrawn account really does reduce net worth, and clamping it at zero
 * would hide the overdraft.
 */
export function assetBalance(a: BalanceRow): number {
  if (isLiabilityType(a.account_type)) return 0;
  const pair = `${String(a.account_type ?? '').toLowerCase()}/${String(a.account_subtype ?? '').toLowerCase()}`;
  const usesAvailable = AVAILABLE_MEANS_SPENDABLE.has(pair) && a.available_balance != null;
  return num(usesAvailable ? a.available_balance : a.current_balance);
}

/**
 * What this account owes, signed per Plaid: positive is owed, negative is a
 * credit in the user's favour. Returns 0 for anything that is not a liability.
 */
export function liabilityBalance(a: BalanceRow): number {
  if (!isLiabilityType(a.account_type)) return 0;
  return num(a.current_balance);
}

/** The columns every caller needs to select for the above to be correct. */
export const BALANCE_COLUMNS = 'account_type, account_subtype, current_balance, available_balance';
