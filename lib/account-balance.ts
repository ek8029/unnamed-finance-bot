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

/** The only types where `available` means spendable money. See rule 2. */
const DEPOSITORY_TYPES = new Set(['checking', 'savings']);

/**
 * Rule 2, continued: subtypes where `available` does NOT mean what it means on
 * a chequing account.
 *
 * A cash management account is a brokerage sweep, and its `available` is the
 * SETTLED and withdrawable portion, not the amount owned. One account in this
 * database reports current 95,916.88 against available 22,773.88: a 76% gap
 * that is unsettled funds, not pending charges. Preferring `available` there
 * would delete three quarters of a real balance.
 *
 * The tell is scale. Genuine pending charges on the other depository accounts
 * here are 431.93, 10.00 and 10.00. Nothing about a 73k gap is a pending
 * coffee.
 */
const SETTLEMENT_SUBTYPES = new Set(['cash management']);

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
  const usesAvailable =
    DEPOSITORY_TYPES.has(String(a.account_type ?? '')) &&
    !SETTLEMENT_SUBTYPES.has(String(a.account_subtype ?? '').toLowerCase()) &&
    a.available_balance != null;
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
