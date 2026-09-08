export interface ManualHoldingRow {
  id: string;
  ticker: string;
  shares: string;
  costBasis: string;
}

export interface ManualSaveRequest {
  requestId: string;
  rows: ManualHoldingRow[];
  holdings: { ticker: string; shares: number; costBasis?: number }[];
}

/** Keep row order and values fixed until the server accounts for every lot. */
export function prepareManualSave(rows: ManualHoldingRow[], requestId: string): ManualSaveRequest {
  const entered = rows.filter(row => row.ticker.trim() || row.shares.trim() || row.costBasis.trim());
  if (entered.length === 0) throw new Error('Add a ticker and the number of shares for at least one position.');
  if (entered.length > 50) throw new Error('Save up to 50 positions at a time.');
  const tickers = new Set<string>();

  const holdings = entered.map(row => {
    const ticker = row.ticker.trim().toUpperCase();
    const position = rows.indexOf(row) + 1;
    if (!ticker || !row.shares.trim()) {
      throw new Error(`Complete the ticker and shares for position ${position}, or remove that row.`);
    }
    if (!/^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker)) throw new Error(`Check the ticker for position ${position}: ${ticker}.`);
    if (tickers.has(ticker)) throw new Error(`Enter ${ticker} once. A manual account keeps one position per ticker.`);
    tickers.add(ticker);
    const shares = Number(row.shares);
    if (!Number.isFinite(shares) || shares <= 0) throw new Error(`Enter a share count greater than zero for ${ticker}.`);
    const costBasis = row.costBasis.trim() ? Number(row.costBasis) : undefined;
    if (costBasis !== undefined && (!Number.isFinite(costBasis) || costBasis < 0)) {
      throw new Error(`Enter a cost per share of zero or more for ${ticker}, or leave it blank.`);
    }
    return { ticker, shares, ...(costBasis === undefined ? {} : { costBasis }) };
  });

  return { requestId, rows: entered.map(row => ({ ...row })), holdings };
}

/** A malformed/partial acknowledgement is uncertain, so the same request must be replayed. */
export function reconcileManualSave(request: ManualSaveRequest, response: unknown): {
  added: number;
  failedRows: ManualHoldingRow[];
  conflicts: string[];
  duplicates: string[];
} {
  const uncertain = () => new Error('We could not confirm every position in this save.');
  if (!response || typeof response !== 'object') throw uncertain();
  const data = response as { success?: unknown; added?: unknown; failed?: unknown };
  if (data.success !== true || typeof data.added !== 'number' || !Number.isInteger(data.added) || data.added < 0 || !Array.isArray(data.failed)) {
    throw uncertain();
  }
  const failedIndexes = new Set<number>();
  const conflicts = new Set<string>();
  const duplicates = new Set<string>();
  for (const failure of data.failed) {
    if (!failure || typeof failure !== 'object') throw uncertain();
    const { rowIndex, ticker, code } = failure as { rowIndex?: unknown; ticker?: unknown; code?: unknown };
    if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= request.rows.length || failedIndexes.has(rowIndex)) {
      throw uncertain();
    }
    if (ticker !== request.holdings[rowIndex].ticker) throw uncertain();
    failedIndexes.add(rowIndex);
    if (code === 'EXISTING_POSITION') conflicts.add(request.holdings[rowIndex].ticker);
    if (code === 'DUPLICATE_TICKER') duplicates.add(request.holdings[rowIndex].ticker);
  }
  if (data.added + failedIndexes.size !== request.rows.length) throw uncertain();
  return {
    added: data.added,
    failedRows: request.rows.filter((_, index) => failedIndexes.has(index)).map(row => ({ ...row })),
    conflicts: [...conflicts],
    duplicates: [...duplicates],
  };
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const draftKey = (userId: string) => `helm.manual-save.pending.v1:${userId}`;

/** Called only after the authenticated user's identity has been verified. */
export function persistManualSave(storage: DraftStorage, userId: string, request: ManualSaveRequest): void {
  if (!userId) throw new Error('Sign in before saving positions.');
  storage.setItem(draftKey(userId), JSON.stringify({ version: 1, userId, request }));
}

export function restoreManualSave(storage: DraftStorage, userId: string): ManualSaveRequest | null {
  if (!userId) return null;
  const raw = storage.getItem(draftKey(userId));
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const request = saved?.request;
    if (saved?.version !== 1 || saved.userId !== userId || typeof request?.requestId !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(request.requestId) || !Array.isArray(request.rows)) throw new Error();
    if (!request.rows.every((row: ManualHoldingRow) => row && ['id', 'ticker', 'shares', 'costBasis'].every(key => typeof row[key as keyof ManualHoldingRow] === 'string'))) throw new Error();
    const validated = prepareManualSave(request.rows, request.requestId);
    if (JSON.stringify(validated.holdings) !== JSON.stringify(request.holdings)) throw new Error();
    return validated;
  } catch {
    throw new Error('The saved recovery record could not be read. Review your existing positions before starting again.');
  }
}

export function clearManualSave(storage: DraftStorage, userId: string): void {
  storage.removeItem(draftKey(userId));
}

export const MANUAL_SAVE_LOGIN_URL = '/login?redirect=%2Fdashboard%2Fportfolio%2Fadd';
