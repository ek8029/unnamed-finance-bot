// Deciding which stored positions a Plaid response has stopped reporting.
//
// plaid-sync used to delete only rows at zero shares, so a security that simply
// disappeared from the response sat in the book forever at its last known
// value. Measured 2026-07-22: $23,010 of phantom positions across five users,
// including a $4,200 row that was 1.9% of one user's net worth.
//
// This deletes real positions, so the decision to prune is pure and tested
// separately from the I/O that carries it out. Every guard here exists because
// a row we failed to write looks identical, from the database, to a row the
// brokerage stopped reporting, and only one of those is safe to delete.

export interface PrunableRow {
  account_id: string;
  security_id: string;
}

export type PrunePlan =
  | { prune: false; reason: string }
  | { prune: true; keepByAccount: Map<string, string[]>; skippedAccounts: string[] };

/**
 * The keep-list travels in the query string, so a book past this size is not
 * pruned at all. The alternative is truncating the keep-list, which would
 * delete real holdings from precisely the largest accounts.
 */
export const MAX_KEEP_LIST = 300;

export function planStalePrune(
  rows: PrunableRow[],
  opts: { unmappedHoldings: number; upsertFailed: boolean },
): PrunePlan {
  if (opts.upsertFailed) return { prune: false, reason: 'the holdings upsert failed' };
  if (opts.unmappedHoldings > 0) {
    return { prune: false, reason: `${opts.unmappedHoldings} holding(s) could not be mapped to a security or account` };
  }
  if (rows.length === 0) return { prune: false, reason: 'the response contained no holdings' };

  const keepByAccount = new Map<string, string[]>();
  for (const r of rows) {
    const ids = keepByAccount.get(r.account_id);
    if (ids) {
      if (!ids.includes(r.security_id)) ids.push(r.security_id);
    } else {
      keepByAccount.set(r.account_id, [r.security_id]);
    }
  }

  // An account that returned nothing is indistinguishable from one that failed,
  // so it never appears here: only accounts present in this response are keys.
  const skippedAccounts: string[] = [];
  for (const [accountId, ids] of [...keepByAccount]) {
    if (ids.length > MAX_KEEP_LIST) {
      keepByAccount.delete(accountId);
      skippedAccounts.push(accountId);
    }
  }

  if (keepByAccount.size === 0) return { prune: false, reason: 'every account was too large to prune safely' };
  return { prune: true, keepByAccount, skippedAccounts };
}
