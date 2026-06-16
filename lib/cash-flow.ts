// Cash flow = external money in/out. Bank transactions always count. Investment
// rows count only when they are NOT trades (buys/sells are internal cash<->security
// moves, surfaced separately in Bought/Sold tiles). Amount is app-convention signed
// (positive = money in). One source of this rule so the three call sites can't drift.
const TRADE_TYPES = new Set(['buy', 'sell']);

/** A bank row (no transaction_type) always counts; an investment row counts unless it is a buy/sell. */
export function countsAsCashFlow(transactionType?: string | null): boolean {
  return !transactionType || !TRADE_TYPES.has(transactionType.toLowerCase());
}

export interface CashFlowRow { amount: number | string; transaction_type?: string | null; }
export interface CashFlowSummary { totalIncome: number; totalExpenses: number; netFlow: number; }

export function summarizeCashFlow(rows: CashFlowRow[]): CashFlowSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const r of rows) {
    if (!countsAsCashFlow(r.transaction_type)) continue;
    const amt = Number(r.amount);
    if (!Number.isFinite(amt)) continue;
    if (amt > 0) totalIncome += amt;
    else totalExpenses += Math.abs(amt);
  }
  return { totalIncome, totalExpenses, netFlow: totalIncome - totalExpenses };
}
