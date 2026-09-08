import { companyAliases, detectPrimaryTicker, titleTargetsTicker } from '@/lib/news-primary-ticker';
import { lowValueShape, subjectPrefilter } from '@/lib/news-subject';

export interface NewsSubjectRow {
  title: string;
  primary_ticker?: string | null;
  tickers?: string[] | null;
  subject_verdict?: string | null;
  subject_ticker?: string | null;
  url?: string | null;
}

export type NewsDisposition =
  | { kind: 'subject'; ticker: string; evidence: 'classifier' | 'headline' }
  | { kind: 'context' | 'excluded'; ticker: null };

/** One subject decision for storage/read boundaries. Uncertainty is context,
 * not a reason to delete coverage or attach it to a held company. Classifier
 * verdicts and validated re-aims take precedence over weaker text heuristics. */
export function newsDisposition(row: NewsSubjectRow, names: ReadonlyMap<string, string> = new Map()): NewsDisposition {
  const title = row.title ?? '';
  if (!title.trim() || lowValueShape(title)) return { kind: 'excluded', ticker: null };
  const primary = row.primary_ticker?.toUpperCase() || null;
  if (row.subject_verdict === 'about' && primary) return { kind: 'subject', ticker: primary, evidence: 'classifier' };
  if (row.subject_verdict === 'mention' && row.subject_ticker) return { kind: 'subject', ticker: row.subject_ticker.toUpperCase(), evidence: 'classifier' };

  const candidates = [...new Set([...(primary ? [primary] : []), ...(row.tickers ?? []).map(t => t.toUpperCase())])];
  const candidate = primary ?? candidates[0] ?? '';
  if (subjectPrefilter({ title, ticker: candidate, companyName: names.get(candidate) || companyAliases(candidate)[0], tickers: candidates })) {
    return { kind: 'excluded', ticker: null };
  }
  if (row.subject_verdict === 'mention') return { kind: 'context', ticker: null };
  const ticker = primary && titleTargetsTicker(title, primary, names.get(primary))
    ? primary
    : detectPrimaryTicker(title, null, candidates, new Map(names));
  return ticker ? { kind: 'subject', ticker, evidence: 'headline' } : { kind: 'context', ticker: null };
}

/** Subject rows are returned under their resolved ticker, including classifier
 * re-aims. Non-subject/other-company rows remain available as unlinked context. */
export function partitionNewsForReader<T extends NewsSubjectRow>(rows: T[], tickers: readonly string[], names: ReadonlyMap<string, string> = new Map()) {
  const wanted = new Set(tickers.map(t => t.toUpperCase()));
  const subjects: (T & { primary_ticker: string })[] = [];
  const context: T[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const result = newsDisposition(row, names);
    if (result.kind === 'excluded') continue;
    const key = row.url || row.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    if (result.kind === 'subject' && wanted.has(result.ticker)) subjects.push({ ...row, primary_ticker: result.ticker });
    else context.push(row);
  }
  return { subjects, context };
}

export function isDirectHoldingNews(
  article: { title: string; primaryTicker?: string | null; tickers?: string[]; subjectVerdict?: string | null; subjectTicker?: string | null },
  holding?: { ticker: string; asset_name?: string | null },
): boolean {
  if (!holding) return false;
  const result = newsDisposition({ title: article.title, primary_ticker: article.primaryTicker, tickers: article.tickers, subject_verdict: article.subjectVerdict, subject_ticker: article.subjectTicker }, new Map([[holding.ticker.toUpperCase(), holding.asset_name ?? '']]));
  return result.kind === 'subject' && result.ticker === holding.ticker.toUpperCase();
}
