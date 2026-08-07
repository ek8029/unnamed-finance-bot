/**
 * Portfolio import: turn a brokerage CSV export or a holdings screenshot into
 * rows the user then CONFIRMS before anything is written.
 *
 * Nothing in here writes. Extraction produces candidate rows; the existing
 * manual-entry form is the confirmation step and POST /api/portfolio/manual is
 * still the only write path. A wrong quantity poisons concentration math, TLH
 * and every thesis pillar downstream, so extracted-but-unconfirmed data must
 * never reach the database.
 *
 * COST BASIS IS PER SHARE. The manual API stores `costBasis` as average cost
 * and derives total as shares * costBasis, so a CSV column carrying TOTAL cost
 * has to be divided before it can be used. Brokerages disagree about which one
 * the phrase "cost basis" means, which is exactly how a tax number goes wrong
 * by a factor of the share count.
 */

/** Matches the validation the manual form applies before it will submit. */
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

export const IMPORT_MAX_ROWS = 50;

export interface ImportedRow {
  ticker: string;
  shares: number;
  /** PER SHARE average cost. null when the source did not carry one. */
  costBasis: number | null;
}

export interface ImportSkip {
  raw: string;
  reason: string;
}

export interface ImportResult {
  rows: ImportedRow[];
  /** Rows seen but unusable. Surfaced to the user, never silently dropped. */
  skipped: ImportSkip[];
}

/** Column synonyms, lowercased. Order matters: first match wins. */
const TICKER_KEYS = ['symbol', 'ticker', 'sym', 'security symbol'];
const SHARES_KEYS = ['quantity', 'shares', 'qty', 'share quantity', 'units', 'no. of shares'];
/** Explicitly PER SHARE. */
const UNIT_COST_KEYS = [
  'average cost basis', 'avg cost basis', 'average cost', 'avg cost',
  'cost per share', 'price paid', 'average price paid', 'avg price', 'unit cost',
];
/** Explicitly TOTAL. Divided by shares before use. */
const TOTAL_COST_KEYS = ['cost basis total', 'total cost basis', 'total cost', 'cost basis'];

/** Strip currency, thousands separators and accounting parentheses. */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t || /^(n\/?a|-{1,2}|—|null)$/i.test(t)) return null;
  const negative = /^\(.*\)$/.test(t);
  const cleaned = t.replace(/[()$\s,]/g, '').replace(/[^0-9.\-]/g, '');
  if (!cleaned || !/[0-9]/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Split one delimited line, honouring double-quoted fields. */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  // No trailing dequote here: the loop above already consumed the wrapping
  // quotes, so stripping again ate the closing quote of an escaped `""`.
  return out.map(s => s.trim());
}

function detectDelimiter(line: string): string {
  return line.split('\t').length > line.split(',').length ? '\t' : ',';
}

/** Index of the first header cell whose text matches one of `keys`. */
function findColumn(header: string[], keys: string[]): number {
  const norm = header.map(h => h.toLowerCase().trim());
  for (const key of keys) {
    const i = norm.findIndex(h => h === key);
    if (i >= 0) return i;
  }
  // Fall back to containment so "Quantity (shares)" still resolves.
  for (const key of keys) {
    const i = norm.findIndex(h => h.includes(key));
    if (i >= 0) return i;
  }
  return -1;
}

/** Normalise one candidate into a row, or explain why it cannot be used. */
export function toRow(
  tickerRaw: string,
  sharesRaw: string,
  unitCostRaw: string | null,
  totalCostRaw: string | null,
): ImportedRow | ImportSkip {
  const raw = [tickerRaw, sharesRaw, unitCostRaw ?? totalCostRaw ?? ''].filter(Boolean).join(' · ');
  const ticker = (tickerRaw ?? '').trim().toUpperCase();
  if (!ticker) return { raw, reason: 'no symbol' };
  if (!TICKER_RE.test(ticker)) return { raw, reason: `"${ticker}" is not a US equity symbol Helm can price` };

  const shares = parseNumber(sharesRaw);
  if (shares == null) return { raw, reason: `no quantity for ${ticker}` };
  if (shares <= 0) return { raw, reason: `${ticker} quantity is ${shares}` };

  // Per-share wins outright. Total is only used to derive one.
  let costBasis = parseNumber(unitCostRaw);
  if (costBasis == null) {
    const total = parseNumber(totalCostRaw);
    if (total != null && total > 0) costBasis = total / shares;
  }
  if (costBasis != null && costBasis <= 0) costBasis = null;

  return { ticker, shares, costBasis };
}

function isSkip(v: ImportedRow | ImportSkip): v is ImportSkip {
  return 'reason' in v;
}

/**
 * Parse a brokerage CSV/TSV export. Header names vary by brokerage, so columns
 * are resolved by synonym rather than position, and a file whose header carries
 * no recognisable symbol column is rejected outright instead of guessed at.
 */
export function parseHoldingsCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: [] };

  const delimiter = detectDelimiter(lines[0]);

  // Brokerage exports often lead with title/date/disclaimer lines, so the header
  // is the first row that actually names a symbol column.
  let headerIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitLine(lines[i], delimiter);
    if (findColumn(cells, TICKER_KEYS) >= 0 && findColumn(cells, SHARES_KEYS) >= 0) {
      headerIdx = i;
      header = cells;
      break;
    }
  }
  if (headerIdx < 0) return { rows: [], skipped: [] };

  const tIdx = findColumn(header, TICKER_KEYS);
  const sIdx = findColumn(header, SHARES_KEYS);
  const uIdx = findColumn(header, UNIT_COST_KEYS);
  const cIdx = findColumn(header, TOTAL_COST_KEYS);

  const rows: ImportedRow[] = [];
  const skipped: ImportSkip[] = [];

  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitLine(line, delimiter);
    // Trailing disclaimer rows are shorter than the header; they are noise, not
    // failures, so they are dropped without shouting at the user about them.
    if (cells.length < 2 || !cells[tIdx]?.trim()) continue;

    const out = toRow(
      cells[tIdx],
      cells[sIdx] ?? '',
      uIdx >= 0 ? (cells[uIdx] ?? null) : null,
      cIdx >= 0 && cIdx !== uIdx ? (cells[cIdx] ?? null) : null,
    );
    if (isSkip(out)) skipped.push(out);
    else rows.push(out);
    if (rows.length >= IMPORT_MAX_ROWS) break;
  }

  return { rows, skipped: skipped.slice(0, 20) };
}

/** Fold duplicate symbols (multiple lots of one name) into a single position. */
export function mergeLots(rows: ImportedRow[]): ImportedRow[] {
  const byTicker = new Map<string, ImportedRow>();
  for (const r of rows) {
    const prev = byTicker.get(r.ticker);
    if (!prev) { byTicker.set(r.ticker, { ...r }); continue; }
    const shares = prev.shares + r.shares;
    // Share-weighted average, and only when BOTH lots carried a basis. Averaging
    // a known basis against an unknown one invents a number.
    const costBasis = prev.costBasis != null && r.costBasis != null
      ? (prev.costBasis * prev.shares + r.costBasis * r.shares) / shares
      : null;
    byTicker.set(r.ticker, { ticker: r.ticker, shares, costBasis });
  }
  return [...byTicker.values()];
}
