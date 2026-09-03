/**
 * The P7 ranked pack — the deterministic half of The Current.
 *
 * Everything the model is allowed to say lives in a numbered item built here. The
 * model narrates the list; it never sees the database. Ported verbatim from the
 * round-6 offline experiment (scripts/digest-lab-r6.ts), which is the evidence for
 * every rule in this file and must stay intact.
 *
 * Two rules that are load-bearing and easy to undo by accident:
 *  - The vs-SPY figures come from the CLEAN POST-CLOSE SERIES built here, never from
 *    portfolio_snapshots. That table has multiple writers at different times of day,
 *    so its spreads pair mismatched timestamps and cannot be stated as fact.
 *  - Every weight is labelled "of your book". Eleven of twelve round-5 digests failed
 *    to say what a bare percentage was, and one narrated a weight move as a price gain.
 */
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getQuote } from '@/lib/financial-data';
import { getVixQuote } from '@/lib/vix';
import { getEdgarEarnings } from '@/lib/earnings-edgar';

// ---------- helpers ----------
export const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** signed fixed-point; a value that rounds to zero prints +0.00, never -0.00 */
const sgn = (n: number, d = 2) => {
  const s = n.toFixed(d);
  return Number(s) === 0 ? `+${(0).toFixed(d)}` : `${n >= 0 ? '+' : ''}${s}`;
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400 * 1000));
const today = () => isoDay(new Date());
const isFund = (assetClass: string, ticker: string) =>
  /etf|fund|mutual|pool|money.?market/i.test(assetClass) || /POOL|\.CL\.|SPAXX/i.test(ticker);
const dirWord = (n: number) => (n >= 0 ? 'up' : 'down');
const normTitle = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createDigestServiceClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Supabase caps a select at 1000 rows; page through. */
async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---------- slices ----------
export interface Slice {
  ticker: string;
  name: string | null;
  securityId: string | null;
  shares: number;
  value: number;
  weightPct: number;
  dayPct: number | null;
  contributionPct: number | null;
  unrealizedPct: number | null;
  sector: string;
  assetClass: string;
}

async function buildSlices(db: SupabaseClient, userId: string) {
  const { data: holdings, error } = await db
    .from('holdings')
    .select(
      'ticker, shares, security_id, total_value, day_change_pct, unrealised_gain_loss_pct, security:securities(sector, asset_class, security_name)',
    )
    .eq('user_id', userId);
  if (error) throw new Error(`holdings: ${error.message}`);

  const byTicker = new Map<string, Slice>();
  let total = 0;
  for (const h of holdings ?? []) {
    const v = Number(h.total_value || 0);
    if (v <= 0) continue;
    total += v;
    const sec = (Array.isArray(h.security) ? h.security[0] : h.security) as
      | { sector?: string; asset_class?: string; security_name?: string }
      | null;
    const cur = byTicker.get(h.ticker) ?? {
      ticker: h.ticker,
      name: sec?.security_name ?? null,
      securityId: null,
      shares: 0,
      value: 0,
      weightPct: 0,
      dayPct: h.day_change_pct != null ? Number(h.day_change_pct) * 100 : null,
      contributionPct: null,
      unrealizedPct: h.unrealised_gain_loss_pct != null ? Number(h.unrealised_gain_loss_pct) : null,
      sector: sec?.sector ?? 'Unknown',
      assetClass: sec?.asset_class ?? 'unknown',
    };
    cur.value += v;
    cur.shares += Number(h.shares || 0);
    cur.securityId = cur.securityId ?? h.security_id ?? null;
    byTicker.set(h.ticker, cur);
  }
  const slices = [...byTicker.values()].sort((a, b) => b.value - a.value);
  for (const s of slices) {
    s.weightPct = total > 0 ? (s.value / total) * 100 : 0;
    s.contributionPct = s.dayPct != null ? (s.weightPct * s.dayPct) / 100 : null;
  }
  const portfolioDayPct = slices.reduce((n, s) => n + (s.contributionPct ?? 0), 0);
  return { slices, total, portfolioDayPct };
}

interface PriceRow {
  security_id: string;
  ticker: string;
  price_date: string;
  close: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
}

/** nearest close on or before `date` for one security's rows (ascending by price_date) */
function closeOnOrBefore(rows: PriceRow[] | undefined, date: string): { close: number; date: string } | null {
  if (!rows?.length) return null;
  let best: PriceRow | null = null;
  for (const r of rows) {
    if (r.price_date <= date) best = r;
    else break;
  }
  return best ? { close: Number(best.close), date: best.price_date } : null;
}

// ---------- structured intermediates ----------
interface Crossing { ticker: string; direction: 'above' | 'below'; threshold: number; priorPct: number; nowPct: number }
interface Driver { rank: number; ticker: string; dayPct: number | null; contributionPct: number; ledCount: number; ledDates: string[]; sessionsCounted: number }
interface WeightMove { ticker: string; fromPct: number; toPct: number; pts: number }
interface WeightChangeRow { ticker: string; weightPct: number; ddPts: number; d30Pts: number }
interface NoNewsMover { ticker: string; dayPct: number; weightPct: number }
interface NewsRow { ticker: string; title: string; source: string; publishedAt: string; matched: boolean }
interface Catch { ticker: string; verdict: string; claim: string; sourceTitle: string; sourceDate: string }
interface PillarChange {
  ticker: string; claim: string; status: string; changedAt: string;
  newest: { verdict: string; sourceTitle: string; sourceDate: string } | null;
}
interface CleanPerfRow { label: '1D' | '5D' | '20D'; sessions: number; portfolioPct: number; spyPct: number; spreadPts: number; from: string; to: string }
export interface CleanSeries {
  dates: string[];
  perf: CleanPerfRow[];
  /** share of total current value held by the positions with daily closes */
  coveragePct: number;
  includedTickers: string[];
  excludedTickers: string[];
}
type EarningsStatus = 'confirmed' | 'estimated' | 'reported' | 'rejected' | 'none' | 'skipped';
interface EarningsRow {
  ticker: string; weightPct: number; status: EarningsStatus;
  date: string | null; hour: string | null; sessionsAway: number | null;
}
interface EarningsBlock { rows: EarningsRow[]; itemWithinSessions: number }

export interface Structured {
  portfolioDayPct: number;
  spy: { c: number; dp: number } | null;
  vix: { value: number; pricedDayPct: number } | null;
  lastCompletedSession: string | null;
  cleanSeries: CleanSeries;
  earnings: EarningsBlock;
  live: { portfolioPct: number; spyPct: number; spreadPts: number } | null;
  crossings: Crossing[];
  drivers: Driver[];
  weightMove10: { growth: WeightMove | null; erosion: WeightMove | null; since: string | null };
  weightChange: WeightChangeRow[];
  noNewsMovers: NoNewsMover[];
  news: NewsRow[];
  catches24h: Catch[];
  pillarChanges24h: PillarChange[];
}

type Cat = 'a' | 'a2' | 'a3' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export interface RankedItem { cat: Cat; cats: Cat[]; tickers: string[]; text: string; headlines: string[]; score: number }

export interface DigestContext {
  userId: string;
  tickers: string[];
  pack: string;
  ranked: RankedItem[];
  /** true when nothing qualified: the brief is templated with no model call */
  quiet: boolean;
  templateText: string;
  /** the closing market sentence, written by code and appended after validation */
  closer: string;
}

// ---------- trading calendar ----------
// MUST BE EXTENDED: this list covers 2026 and 2027 only. Any date outside those years is
// treated as a trading day if it falls on a weekday, so add the NYSE calendar for each new
// year before it starts.
const NYSE_HOLIDAYS: string[] = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
];
const HOLIDAY_SET = new Set(NYSE_HOLIDAYS);
function isTradingDay(dateISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const w = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  if (w === 0 || w === 6) return false;
  return !HOLIDAY_SET.has(dateISO);
}
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

// ---------- forward earnings (EDGAR estimate + Finnhub confirmed date) ----------
const EARNINGS_LOOKAHEAD_DAYS = 21;
const EARNINGS_ITEM_SESSIONS = 10;
const FINNHUB_MIN_GAP_MS = 1100; // free tier is 60 calls/min
const EDGAR_MIN_GAP_MS = 150; // SEC asks for <= 10 req/s
const RECENTLY_REPORTED_DAYS = 7;

interface FinnhubEarningsRow { date: string; hour: string }
type FinnhubResult = { rows: FinnhubEarningsRow[] | null };

// Caches are keyed by day so a long-lived serverless instance cannot serve yesterday's
// calendar tomorrow. Tickers overlap heavily across users, so one cron run makes far
// fewer calls than it has (user x ticker) pairs.
let cacheDay = '';
const finnhubCache = new Map<string, Promise<FinnhubResult>>();
const edgarCache = new Map<string, Promise<{ lastReportDate: string | null; nextEstimatedDate: string | null }>>();
let lastFinnhubAt = 0;
let lastEdgarAt = 0;
function resetCachesIfNewDay() {
  const d = today();
  if (d !== cacheDay) {
    cacheDay = d;
    finnhubCache.clear();
    edgarCache.clear();
  }
}

function finnhubEarnings(ticker: string): Promise<FinnhubResult> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return Promise.resolve({ rows: null });
  if (!finnhubCache.has(ticker)) {
    finnhubCache.set(
      ticker,
      (async () => {
        const wait = lastFinnhubAt + FINNHUB_MIN_GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastFinnhubAt = Date.now();
        const to = isoDay(new Date(Date.now() + EARNINGS_LOOKAHEAD_DAYS * 86400 * 1000));
        const url = `https://finnhub.io/api/v1/calendar/earnings?from=${today()}&to=${to}&symbol=${encodeURIComponent(ticker)}&token=${key}`;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return { rows: null };
          const json = (await res.json()) as { earningsCalendar?: { date?: string; hour?: string }[] };
          return {
            rows: (json.earningsCalendar ?? []).map((r) => ({ date: String(r.date ?? ''), hour: String(r.hour ?? '') })),
          };
        } catch {
          // Never let the calendar take down the brief, and never surface the URL: it carries the key.
          return { rows: null };
        }
      })(),
    );
  }
  return finnhubCache.get(ticker)!;
}

function edgarEarnings(ticker: string) {
  if (!edgarCache.has(ticker)) {
    edgarCache.set(
      ticker,
      (async () => {
        const wait = lastEdgarAt + EDGAR_MIN_GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastEdgarAt = Date.now();
        return getEdgarEarnings(ticker); // never throws: returns nulls on any failure
      })(),
    );
  }
  return edgarCache.get(ticker)!;
}

/** trading sessions strictly after today up to and including `date` */
function weekdaysUntil(date: string): number {
  let n = 0;
  const d = new Date(today() + 'T12:00:00Z');
  const end = new Date(date + 'T12:00:00Z');
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isTradingDay(isoDay(d))) n++;
  }
  return n;
}

const isEquityTicker = (s: Slice) =>
  /^[A-Z][A-Z.]{0,5}$/.test(s.ticker) &&
  !/-USD$/.test(s.ticker) &&
  !/crypto/i.test(s.assetClass) &&
  !/POOL|\.CL\.|SPAXX/i.test(s.ticker);

async function lookupEarnings(slices: Slice[]): Promise<EarningsBlock> {
  resetCachesIfNewDay();
  const TODAY = today();
  const to = isoDay(new Date(Date.now() + EARNINGS_LOOKAHEAD_DAYS * 86400 * 1000));
  const rows: EarningsRow[] = [];
  for (const s of slices.slice(0, 25)) {
    const base = { ticker: s.ticker, weightPct: s.weightPct };
    if (!isEquityTicker(s)) {
      rows.push({ ...base, status: 'skipped', date: null, hour: null, sessionsAway: null });
      continue;
    }
    const edgar = await edgarEarnings(s.ticker);
    const fh = await finnhubEarnings(s.ticker);
    const confirmed =
      (fh.rows ?? []).filter((r) => r.date >= TODAY && r.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ??
      null;

    let candidate: { date: string; hour: string | null; source: 'finnhub' | 'edgar' } | null = confirmed
      ? { date: confirmed.date, hour: confirmed.hour || null, source: 'finnhub' }
      : edgar.nextEstimatedDate && edgar.nextEstimatedDate >= TODAY && edgar.nextEstimatedDate <= to
        ? { date: edgar.nextEstimatedDate, hour: null, source: 'edgar' }
        : null;

    // RULE 1: a date the market is shut on is not an earnings date, and there is no fallback to
    // the other source: a calendar that puts a print on Labor Day has not earned one.
    let rejected = false;
    if (candidate && !isTradingDay(candidate.date)) {
      rejected = true;
      candidate = null;
    }

    // RULES 2 and 3: EDGAR evidence beats the calendar. An 8-K item 2.02 inside the last 7 days
    // means the company has already reported, so any "upcoming" date is stale and the real change
    // is that it reported.
    const last = edgar.lastReportDate;
    const reportedRecently = !!last && last <= TODAY && daysBetween(last, TODAY) <= RECENTLY_REPORTED_DAYS;

    if (reportedRecently) {
      rows.push({ ...base, status: 'reported', date: last, hour: null, sessionsAway: null });
    } else if (candidate) {
      rows.push({
        ...base,
        status: candidate.source === 'finnhub' ? 'confirmed' : 'estimated',
        date: candidate.date,
        hour: candidate.hour,
        sessionsAway: weekdaysUntil(candidate.date),
      });
    } else {
      rows.push({ ...base, status: rejected ? 'rejected' : 'none', date: null, hour: null, sessionsAway: null });
    }
  }
  return { rows, itemWithinSessions: EARNINGS_ITEM_SESSIONS };
}

// ---------- news filters ----------
function nameKey(name: string | null): string | null {
  if (!name) return null;
  const words = name.replace(/[^A-Za-z0-9 .&'-]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let w = words[0] ?? '';
  if (/^the$/i.test(w) && words[1]) w = words[1];
  w = w.replace(/[.,'&-]+$/g, '');
  return w.length >= 3 ? w : null;
}
function titleMentions(title: string, ticker: string, name: string | null) {
  if (ticker.length >= 2 && new RegExp(`\\b${escRe(ticker)}\\b`).test(title)) return true;
  const k = nameKey(name);
  return !!k && new RegExp(`\\b${escRe(k)}\\b`, 'i').test(title);
}

// A headline that teases a read instead of reporting an event is not a fact about the position,
// and a brief that paraphrases one is inventing a claim it cannot source.
const TEASER_OPENERS = /\b(Why|Here's|Here’s|Is|Should|Could|Will|What)\s/i;
const TEASER_PHRASES = /\b(most-held|still the|top 10|top ten)\b/i;
const TEASER_CONTAINS = /could go|points higher|further upside|why I'm|why I’m|reasons to/i;
const isTeaserHeadline = (title: string) =>
  /\?/.test(title) || TEASER_OPENERS.test(title) || TEASER_PHRASES.test(title) || TEASER_CONTAINS.test(title);

// A title that makes a price claim cannot sit one clause from the pack's own figure for the same
// ticker without contradicting it. Round 5 printed "IREN Sinks 4%" under "IREN ... up 7.52% today".
const PRICE_VERB_RE = /\b(sinks?|slips?|soars?|jumps?|plunges?|falls?|drops?|rallies|rallied|surges?|tumbles?|climbs?)\b/i;
const PRICE_PCT_RE = /\d+(\.\d+)?%/;
const makesPriceClaim = (title: string) => PRICE_VERB_RE.test(title) || PRICE_PCT_RE.test(title);

// A headline may not introduce a company the reader does not own.
const CAPS_ALLOWED = new Set([
  'AI', 'AR', 'VR', 'US', 'USA', 'UK', 'EU', 'UN', 'CEO', 'CFO', 'COO', 'CTO', 'CIO', 'IPO', 'ETF', 'EPS', 'GDP', 'CPI', 'PPI',
  'FDA', 'SEC', 'FTC', 'DOJ', 'IRS', 'FCC', 'EPA', 'CDC', 'NHTSA', 'FED', 'GPU', 'CPU', 'API', 'SUV', 'EV', 'LLM', 'SaaS',
  'OPEC', 'NATO', 'WHO', 'NYSE', 'FY', 'YTD', 'TV', 'PC', 'IT', 'ESG', 'MA', 'LLC', 'INC', 'CORP', 'LTD', 'PLC', 'ADR',
  'THE', 'AND', 'OR', 'NEW', 'NOW', 'BUY', 'ALL', 'FOR', 'NOT', 'BUT', 'WHY', 'HOW', 'ONE', 'TWO', 'OFF', 'OUT', 'BIG',
  'ON', 'IN', 'AT', 'TO', 'OF', 'BY', 'UP', 'VS', 'ITS', 'IS', 'AS', 'AN', 'BE', 'DO', 'GO', 'NO', 'SO', 'WE', 'HE', 'IF', 'IT', 'A', 'I',
  'Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'RD', 'ST', 'ND', 'TH',
]);
const COMPANY_WORD_RE = /\b([A-Z][A-Za-z.&'’-]+)\s+(Mining|Systems|Technologies|Technology|Energy|Corp|Corporation|Inc|Holdings|Labs|Laboratories|Networks|Digital|Capital|Partners|Group|Motors|Pharmaceuticals|Pharma|Therapeutics|Semiconductor|Semiconductors|Solutions|Industries|Resources|Enterprises|Financial|Bancorp|Airlines|Communications|Media|Software|Robotics|Dynamics|Sciences|Brands|Foods|Materials)\b/g;
const CAMEL_RE = /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g;
const ENUMERATION_RE = /\b[A-Z][A-Za-z.&'’-]{2,},\s+[A-Z][A-Za-z.&'’-]{2,},\s+[A-Z][A-Za-z.&'’-]{2,}/;
const APPOSITIVE_RE = /\b(?:startup|start-up|rival|rivals|competitor|competitors|peer|peers|maker|owner|unit|subsidiary|acquirer|supplier|partner|challenger)\s+([A-Z][A-Za-z.&'’-]{2,})/gi;
const NAME_HEAD_STOP = new Set([
  'first', 'the', 'new', 'global', 'american', 'united', 'general', 'national', 'international', 'capital',
  'growth', 'income', 'total', 'core', 'select', 'main', 'next', 'prime', 'premier', 'summit', 'pioneer',
  'liberty', 'freedom', 'victory', 'alpha', 'beta', 'delta', 'apex', 'atlas', 'target', 'block', 'match',
  'shell', 'best', 'open', 'live', 'star', 'arch', 'park', 'pool', 'bank', 'trust', 'fund', 'index',
  'class', 'ordinary', 'shares', 'common', 'stock', 'value', 'quality', 'advance', 'discovery', 'frontier',
]);
// The securities table is the app's own ticker and company universe, loaded once per process,
// read-only, so a company the reader does not hold is recognised by name and not only by ticker.
const securitiesUniverse = { tickers: new Set<string>(), nameHeads: new Map<string, string>() };
let universeLoad: Promise<void> | null = null;
function loadSecuritiesUniverse(db: SupabaseClient): Promise<void> {
  return (universeLoad ??= (async () => {
    try {
      const rows = await fetchAll<{ ticker: string; security_name: string | null }>(
        (from, to) => db.from('securities').select('ticker, security_name').range(from, to),
        'securities',
      );
      for (const r of rows) {
        if (r.ticker) securitiesUniverse.tickers.add(r.ticker);
        const k = nameKey(r.security_name);
        if (k && k.length >= 4 && !NAME_HEAD_STOP.has(k.toLowerCase())) {
          securitiesUniverse.nameHeads.set(k.toLowerCase(), r.ticker);
        }
      }
    } catch {
      // The name-based half of the third-party filter degrades; the ticker and CamelCase
      // halves still run. A brief without headlines beats no brief.
      universeLoad = null;
    }
  })());
}

function heldNameWords(slices: Slice[]): Set<string> {
  const out = new Set<string>();
  for (const s of slices) {
    if (!s.name) continue;
    for (const w of s.name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/)) if (w.length >= 3) out.add(w.toLowerCase());
  }
  return out;
}

function namesForeignCompany(title: string, ownTicker: string, heldTickers: Set<string>, heldWords: Set<string>): string | null {
  for (const m of title.matchAll(/\b[A-Z][A-Z0-9]{1,4}\b/g)) {
    const t = m[0];
    if (t === ownTicker || heldTickers.has(t) || CAPS_ALLOWED.has(t) || heldWords.has(t.toLowerCase())) continue;
    return t;
  }
  for (const m of title.matchAll(CAMEL_RE)) {
    if (heldWords.has(m[0].toLowerCase())) continue;
    return m[0];
  }
  for (const m of title.matchAll(COMPANY_WORD_RE)) {
    if (heldWords.has(m[1].toLowerCase())) continue;
    return `${m[1]} ${m[2]}`;
  }
  for (const m of title.matchAll(/\b[A-Z][A-Za-z.&'’-]{3,}\b/g)) {
    const w = m[0].toLowerCase();
    if (heldWords.has(w)) continue;
    const owner = securitiesUniverse.nameHeads.get(w);
    if (owner && owner !== ownTicker && !heldTickers.has(owner)) return `${m[0]} (${owner})`;
  }
  if (ENUMERATION_RE.test(title)) return 'list of names';
  for (const m of title.matchAll(APPOSITIVE_RE)) {
    if (heldWords.has(m[1].toLowerCase())) continue;
    return `named third party: ${m[0]}`;
  }
  return null;
}

// ---------- the ranked list ----------
/** an earnings headline echoing the call the item already states adds nothing */
const ECHOES_EARNINGS = /earnings call|earnings conference call|Q\d/i;
/** items whose whole content is a ticker do not rank on a contribution this small */
const EVENT_CATS = new Set<Cat>(['a', 'a2', 'a3', 'b', 'c', 'e', 'f']);
const MIN_CONTRIBUTION_PTS = 0.05;

/** ONE function feeds both the pack's BUDGET line and the validator's length check. */
export function lengthBand(items: number): { lo: number; hi: number; paraCap: number } {
  return items <= 2
    ? { lo: 40, hi: 100, paraCap: 1 }
    : items <= 4
      ? { lo: 70, hi: 175, paraCap: 2 }
      : { lo: 130, hi: 260, paraCap: 3 };
}
const budgetLine = (items: number) => {
  const b = lengthBand(items);
  return `BUDGET: ${items} item${items === 1 ? '' : 's'}, at most ${b.paraCap} paragraph${b.paraCap === 1 ? '' : 's'}, ${b.lo} to ${b.hi} words.`;
};
const catchVerbIng = (verdict: string) =>
  verdict === 'supports' ? 'supporting' : verdict === 'contradicts' ? 'contradicting' : `${verdict} on`;

// Rank by consequence. Bonus per category, highest first; a merged item takes the highest score
// among its parts. CAT_ORDER only breaks an exact score tie.
const CAT_BONUS: Record<Cat, number> = { a: 3.0, b: 2.0, c: 2.0, a2: 2.0, a3: 2.0, e: 1.5, d: 1.0, f: 1.0, h: 0.5, g: 0.5 };
const CAT_ORDER: Cat[] = ['a', 'b', 'c', 'a2', 'a3', 'e', 'd', 'f', 'h', 'g'];
const catRank = (c: Cat) => CAT_ORDER.indexOf(c);

function buildRanked(s: Structured, slices: Slice[]): RankedItem[] {
  const raw: RankedItem[] = [];
  const push = (cat: Cat, tickers: string[], text: string) =>
    raw.push({ cat, cats: [cat], tickers, text, headlines: [], score: 0 });

  // a. threshold crossing today. All three figures are weights, so they say so.
  for (const c of s.crossings) {
    push(
      'a',
      [c.ticker],
      `${c.ticker} weight crossed ${c.direction} ${c.threshold}% of your book today, ${c.priorPct.toFixed(1)}% of your book at the prior close to ${c.nowPct.toFixed(1)}% now`,
    );
  }
  // Materiality, shared by a2 and a3: a 0.5% holding's calendar entry is not news; a 1% holding
  // down 15% on its print is.
  const material = (e: EarningsRow) => {
    const slice = slices.find((p) => p.ticker === e.ticker);
    const movedHard = slice?.dayPct != null && Math.abs(slice.dayPct) > 5;
    return e.weightPct >= 2 || movedHard;
  };
  // a2. earnings within 10 sessions.
  for (const e of s.earnings.rows) {
    if ((e.status !== 'confirmed' && e.status !== 'estimated') || e.sessionsAway == null || e.sessionsAway > s.earnings.itemWithinSessions) continue;
    if (!material(e)) continue;
    const when = e.hour === 'bmo' ? ' before the open' : e.hour === 'amc' ? ' after the close' : '';
    push(
      'a2',
      [e.ticker],
      e.status === 'confirmed'
        ? `${e.ticker} reports ${e.date}${when}`
        : `${e.ticker} reports around ${e.date}, estimated from its filing history`,
    );
  }
  // a3. ALREADY REPORTED. The move clause is attached only when the filing lands on or after the
  // last completed session, because only then is today's move the reaction to it. The figure sits
  // in its own clause with the session count that produced it.
  const a3StatedMove = new Set<string>();
  const sessionsSinceReport = (reportDate: string) => s.cleanSeries.dates.filter((d) => d > reportDate).length + 1;
  const a3Sessions = new Map<string, number>();
  for (const e of s.earnings.rows) {
    if (e.status !== 'reported' || !e.date || !material(e)) continue;
    const slice = slices.find((p) => p.ticker === e.ticker);
    const adjacent = !s.lastCompletedSession || e.date >= s.lastCompletedSession;
    const n = sessionsSinceReport(e.date);
    a3Sessions.set(e.ticker, n);
    let moveClause = '';
    if (adjacent && slice?.dayPct != null) {
      moveClause = `; ${dirWord(slice.dayPct)} ${Math.abs(slice.dayPct).toFixed(2)}% in the ${n} session${n === 1 ? '' : 's'} since`;
      a3StatedMove.add(e.ticker);
    }
    push('a3', [e.ticker], `${e.ticker} reported on ${e.date}${moveClause}`);
  }
  // b. catches in the last 24 hours as a THESIS EVENT, grouped per ticker and per source; counts
  // first, then the pillars by name.
  const byTicker = new Map<string, Catch[]>();
  for (const c of s.catches24h) byTicker.set(c.ticker, [...(byTicker.get(c.ticker) ?? []), c]);
  for (const [t, cs] of byTicker) {
    const bySource = new Map<string, Catch[]>();
    for (const c of cs) {
      const k = `${c.verdict}|${c.sourceTitle}|${c.sourceDate}`;
      bySource.set(k, [...(bySource.get(k) ?? []), c]);
    }
    const parts = [...bySource.values()].map((g) => {
      const n = g.length;
      const claims = [...new Set(g.map((c) => c.claim))];
      const shown = claims.slice(0, 3).map((c) => `"${c}"`);
      const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
      const more = claims.length - shown.length;
      return `${n} new ${n === 1 ? 'catch' : 'catches'}, ${catchVerbIng(g[0].verdict)} ${list}${more > 0 ? `, and ${more} more pillar${more > 1 ? 's' : ''}` : ''}, from "${g[0].sourceTitle}" (${g[0].sourceDate})`;
    });
    push('b', [t], `${t} thesis: ${parts.join('; ')}`);
  }
  const catchTitles = new Set(s.catches24h.map((c) => `${c.ticker}|${normTitle(c.sourceTitle)}`));
  // c. pillar status changed in the last 24 hours
  for (const p of s.pillarChanges24h) {
    push(
      'c',
      [p.ticker],
      `${p.ticker} pillar "${p.claim}" changed to ${p.status} on ${p.changedAt}${p.newest ? `, newest catch ${p.newest.verdict} via "${p.newest.sourceTitle}" (${p.newest.sourceDate})` : ''}`,
    );
  }
  // d. driver streak
  const d1 = s.drivers[0];
  if (d1 && d1.ledCount >= 3) {
    push('d', [d1.ticker], `${d1.ticker} led ${d1.ledCount} of your last ${d1.sessionsCounted} completed sessions (${d1.ledDates.join(', ')})`);
  }
  // e. CLEAN SERIES: 1D spread beyond the one-sigma band, or 5D/20D beyond twice it.
  // Coverage gate: the series only holds positions with daily closes, so on a book that is half
  // unpriced pools the return is not "your" return. Below 70% the fact is withheld entirely;
  // between 70% and 95% it is stated with the share it was measured on.
  const cov = s.cleanSeries.coveragePct;
  if (s.vix && cov >= 70) {
    const covClause = cov < 95 ? `, measured on the ${cov.toFixed(1)}% of your book with daily prices` : '';
    for (const r of s.cleanSeries.perf) {
      const mult = r.label === '1D' ? 1 : 2;
      if (Math.abs(r.spreadPts) > mult * s.vix.pricedDayPct) {
        const span = r.sessions === 1 ? 'Your last session' : `Your ${r.sessions} sessions`;
        push(
          'e',
          [],
          // "the market", not "SPY": the layer bans the ticker in the body (the code-written
          // closer is the only place it belongs), so emitting it here guaranteed a validator
          // failure and a wasted second call on every account with a spread beyond the band.
          // Same phrasing the live-spread item below already uses.
          `${span} to ${r.to}: your book ${sgn(r.portfolioPct)}% against the market's ${sgn(r.spyPct)}%, spread ${sgn(r.spreadPts)} pts, wider than ${mult === 1 ? '' : 'twice '}the ±${s.vix.pricedDayPct.toFixed(2)}% band${covClause}`,
        );
      }
    }
  }
  // e. LIVE: written without SPY/VIX/sigma because the body may not name them; the closer does.
  if (s.live && s.vix && Math.abs(s.live.spreadPts) > s.vix.pricedDayPct) {
    push(
      'e',
      [],
      `Your day ${sgn(s.live.portfolioPct)}% against the market's ${sgn(s.live.spyPct)}%, spread ${sgn(s.live.spreadPts)} pts, wider than the ±${s.vix.pricedDayPct.toFixed(2)}% band priced for today`,
    );
  }
  // f. 10-session weight move. The pair of percentages says it is a weight.
  for (const m of [s.weightMove10.growth, s.weightMove10.erosion]) {
    if (m && Math.abs(m.pts) >= 0.5 && s.weightMove10.since) {
      push(
        'f',
        [m.ticker],
        `${m.ticker} weight ${m.fromPct.toFixed(1)}% to ${m.toPct.toFixed(1)}% of your book, ${sgn(m.pts)} pts over 10 sessions since ${s.weightMove10.since}`,
      );
    }
  }
  // f (secondary): a 30-day move of >= 1.0 pts on a position >= 10% weight
  for (const r of s.weightChange) {
    if (r.weightPct >= 10 && Math.abs(r.d30Pts) >= 1.0 && !raw.some((it) => it.cat === 'f' && it.tickers.includes(r.ticker))) {
      push(
        'f',
        [r.ticker],
        `${r.ticker} weight ${(r.weightPct - r.d30Pts).toFixed(1)}% to ${r.weightPct.toFixed(1)}% of your book, ${sgn(r.d30Pts)} pts over 30 days`,
      );
    }
  }
  // g. no-news movers, ONE grouped item
  const g = s.noNewsMovers
    .filter((m) => m.weightPct >= 1 && Math.abs(m.dayPct) > 2)
    .sort((x, y) => Math.abs(y.dayPct * y.weightPct) - Math.abs(x.dayPct * x.weightPct))
    .slice(0, 3);

  // nothing under a-g and no lone h at or above 0.15pp: the day templates
  const loneH = !!d1 && Math.abs(d1.contributionPct) >= 0.15;
  if (raw.length === 0 && g.length === 0 && !loneH) return [];

  // h. today's #1 driver, above the no-news group
  if (d1) push('h', [d1.ticker], `${d1.ticker} contributed the top share of your day`);
  // g. worded as a fact, not an absence; the weight says what it is a share of.
  if (g.length) {
    const parts = g.map(
      (m) => `${m.ticker} ${dirWord(m.dayPct)} ${Math.abs(m.dayPct).toFixed(2)}% today (weight ${m.weightPct.toFixed(1)}% of your book)`,
    );
    const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    push('g', g.map((m) => m.ticker), `${joined} moved with no headline behind ${g.length === 1 ? 'it' : 'them'} in the last 48 hours`);
  }

  const byT = new Map(slices.map((p) => [p.ticker, p]));
  // Score every RAW item before the merge, so a merged story takes the highest score among its
  // parts. A contribution under the materiality floor counts as zero: 0.05 pts is already the
  // threshold below which a ticker-only item does not rank, and zeroing it keeps the score a
  // total order, so a 0.029 pt difference cannot outrank a category.
  const contribOf = (tickers: string[]) => Math.max(0, ...tickers.map((t) => Math.abs(byT.get(t)?.contributionPct ?? 0)));
  const bonusOf = (it: RankedItem) => {
    if (it.cat === 'a3') return (a3Sessions.get(it.tickers[0]) ?? 99) <= 2 ? CAT_BONUS.a3 : 0;
    return CAT_BONUS[it.cat];
  };
  for (const it of raw) {
    const c = contribOf(it.tickers);
    it.score = (c >= MIN_CONTRIBUTION_PTS ? c : 0) + bonusOf(it);
  }

  // merge: a later item whose ticker already appears in an earlier item joins that story;
  // tickerless items of the same category are one line too
  const merged: RankedItem[] = [];
  for (const it of raw) {
    const home = it.tickers.length
      ? merged.find((m) => m.tickers.some((t) => it.tickers.includes(t)))
      : merged.find((m) => m.tickers.length === 0 && m.cat === it.cat);
    if (home) {
      home.text += `; ${it.text}`;
      home.cats.push(it.cat);
      for (const t of it.tickers) if (!home.tickers.includes(t)) home.tickers.push(t);
      if (it.score > home.score) home.score = it.score;
    } else {
      merged.push({ ...it, tickers: [...it.tickers], cats: [...it.cats], headlines: [] });
    }
  }
  // an item whose whole content is one ticker does not rank on a contribution under 0.05 pts
  const ranks = merged.filter((it) => {
    if (it.cats.some((c) => EVENT_CATS.has(c))) return true;
    if (it.tickers.length !== 1) return true;
    const p = byT.get(it.tickers[0]);
    if (!p || p.contributionPct == null) return true;
    return Math.abs(p.contributionPct) >= MIN_CONTRIBUTION_PTS;
  });
  // highest score first, then the category order for an exact tie. Array.prototype.sort is stable.
  const top5 = [...ranks].sort((x, y) => y.score - x.score || catRank(x.cat) - catRank(y.cat)).slice(0, 5);

  // a headline may name only tickers and companies this reader holds
  const heldTickers = new Set(slices.map((p) => p.ticker));
  const heldWords = heldNameWords(slices);
  for (const it of top5) {
    const isEarningsItem = it.cats.includes('a2') || it.cats.includes('a3');
    for (const t of it.tickers) {
      const p = byT.get(t);
      if (p && p.dayPct != null && p.contributionPct != null && !it.cats.includes('g')) {
        // an a3 item that carried the move clause already states it; repeating it as "today" in
        // the same item is the same figure twice, so only the contribution is added.
        it.text += a3StatedMove.has(t)
          ? `; ${sgn(p.contributionPct, 3)} pts of your ${sgn(s.portfolioDayPct)}% day`
          : `; position ${dirWord(p.dayPct)} ${Math.abs(p.dayPct).toFixed(2)}% today, ${sgn(p.contributionPct, 3)} pts of your ${sgn(s.portfolioDayPct)}% day`;
      }
      s.news
        .filter((n) => n.matched && n.ticker === t && !catchTitles.has(`${t}|${normTitle(n.title)}`))
        .filter((n) => !isTeaserHeadline(n.title))
        .filter((n) => !(isEarningsItem && ECHOES_EARNINGS.test(n.title)))
        .filter((n) => !makesPriceClaim(n.title))
        .filter((n) => !namesForeignCompany(n.title, t, heldTickers, heldWords))
        .slice(0, 2)
        .forEach((n) => it.headlines.push(`headline: ${n.title} (${n.source})`));
    }
  }
  return top5;
}

/** The closing sentence CODE appends after the model's body; never in the facts the model sees. */
function closerText(s: Structured): string {
  if (s.live && s.vix) {
    const wider = Math.abs(s.live.spreadPts) > s.vix.pricedDayPct;
    return `Your day ${sgn(s.live.portfolioPct)}% against SPY ${sgn(s.live.spyPct)}%, spread ${sgn(s.live.spreadPts)} pts, ${wider ? 'wider than' : 'inside'} the ±${s.vix.pricedDayPct.toFixed(2)}% one-sigma day options are pricing at VIX ${s.vix.value.toFixed(2)}.`;
  }
  if (s.live) return `Your day ${sgn(s.live.portfolioPct)}% against SPY ${sgn(s.live.spyPct)}%, spread ${sgn(s.live.spreadPts)} pts.`;
  return `Your day ${sgn(s.portfolioDayPct)}%.`;
}

/** The quiet day. No model call: nothing qualified, and a quiet day is a valid brief. */
function templateText(s: Structured): string {
  const base = 'Nothing changed today that needs you.';
  if (s.spy && s.vix)
    return `${base} You are ${sgn(s.portfolioDayPct)}% against SPY ${sgn(s.spy.dp)}%, inside the ±${s.vix.pricedDayPct.toFixed(2)}% one-sigma day options are pricing at VIX ${s.vix.value.toFixed(2)}.`;
  if (s.spy) return `${base} You are ${sgn(s.portfolioDayPct)}% against SPY ${sgn(s.spy.dp)}%.`;
  return `${base} You are ${sgn(s.portfolioDayPct)}% on the day.`;
}

/**
 * The ranked list is the whole pack. The closing market sentence is appended by code and shown on
 * the LAST line so its numbers are auditable against the pack. Absent = omitted, never "none".
 * The BUDGET line is printed twice because models drift past the ceiling by the end of a long list.
 */
function buildPack(ranked: RankedItem[], closer: string): string {
  const out: string[] = [];
  out.push('WHAT CHANGED TODAY (narrate in order; items sharing a ticker are one story):');
  out.push(budgetLine(ranked.length));
  if (ranked.length) {
    ranked.forEach((it, i) => {
      out.push(`${i + 1}. ${it.text}`);
      it.headlines.forEach((h) => out.push(`   ${h}`));
    });
  } else out.push('nothing qualified today');
  out.push(budgetLine(ranked.length));
  out.push(`CLOSER (added by code after your text): ${closer}`);
  return out.join('\n');
}

// ---------- the whole context ----------
export async function buildDigestContext(userId: string, db?: SupabaseClient): Promise<DigestContext> {
  const sb = db ?? createDigestServiceClient();
  const TODAY = today();
  const { slices, total, portfolioDayPct } = await buildSlices(sb, userId);
  const sliceTickers = slices.map((s) => s.ticker);
  const nameOf = new Map(slices.map((s) => [s.ticker, s.name]));
  const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // A book with no priced position has no day. Everything below would be computed against a
  // zero portfolio return, and the live-spread item would announce a full-band gap against SPY
  // that is an artefact of holding nothing. Reachable in production: digest-cron routes on
  // holdings ROWS, and a row whose total_value is zero or null makes no slice here.
  if (slices.length === 0) {
    const [spy0, vix0] = await Promise.all([getQuote('SPY'), getVixQuote()]);
    const bare: Structured = {
      portfolioDayPct: 0,
      spy: spy0 ? { c: spy0.c, dp: spy0.dp } : null,
      vix: vix0 ? { value: vix0.value, pricedDayPct: vix0.pricedDayPct } : null,
      lastCompletedSession: null,
      cleanSeries: { dates: [], perf: [], coveragePct: 0, includedTickers: [], excludedTickers: [] },
      earnings: { rows: [], itemWithinSessions: EARNINGS_ITEM_SESSIONS },
      live: null,
      crossings: [], drivers: [], weightMove10: { growth: null, erosion: null, since: null },
      weightChange: [], noNewsMovers: [], news: [], catches24h: [], pillarChanges24h: [],
    };
    return {
      userId,
      tickers: [],
      pack: buildPack([], closerText(bare)),
      ranked: [],
      quiet: true,
      templateText: templateText(bare),
      closer: closerText(bare),
    };
  }

  await loadSecuritiesUniverse(sb);

  type NewsRaw = { title: string; source: string; published_at: string; primary_ticker: string };
  const [newsAll, spy, vix] = await Promise.all([
    sliceTickers.length
      ? fetchAll<NewsRaw>(
          (a, b) =>
            sb
              .from('market_news')
              .select('title, source, published_at, primary_ticker')
              .in('primary_ticker', sliceTickers)
              .gte('published_at', since48h)
              .order('published_at', { ascending: false })
              .range(a, b),
          'market_news',
        )
      : Promise.resolve([] as NewsRaw[]),
    getQuote('SPY'),
    getVixQuote(),
  ]);
  const newsRows: NewsRow[] = newsAll.map((n) => ({
    ticker: n.primary_ticker,
    title: n.title,
    source: n.source,
    publishedAt: n.published_at,
    matched: titleMentions(String(n.title ?? ''), n.primary_ticker, nameOf.get(n.primary_ticker) ?? null),
  }));

  // movers with no news. Crypto is excluded: market_news carries no crypto coverage, so
  // "zero headlines" would be false there.
  const movers = slices.filter(
    (s) => s.dayPct != null && Math.abs(s.dayPct) > 2 && !/crypto/i.test(s.assetClass) && !/-USD$/.test(s.ticker),
  );
  let noNewsMovers: Slice[] = [];
  if (movers.length > 0) {
    const { data: moverNews, error } = await sb
      .from('market_news')
      .select('primary_ticker')
      .in('primary_ticker', movers.map((m) => m.ticker))
      .gte('published_at', since48h);
    if (error) throw new Error(`market_news movers: ${error.message}`);
    const covered = new Set((moverNews ?? []).map((n) => n.primary_ticker));
    noNewsMovers = movers.filter((m) => !covered.has(m.ticker));
  }

  // ---------- SPY session calendar ----------
  const spyRows = await fetchAll<PriceRow>(
    (a, b) =>
      sb
        .from('market_prices')
        .select('security_id, ticker, price_date, close, open, high, low')
        .eq('ticker', 'SPY')
        .gte('price_date', daysAgo(70))
        .lt('price_date', TODAY)
        .order('price_date', { ascending: true })
        .range(a, b),
    'market_prices SPY',
  );
  const sessions = spyRows.filter((r) => {
    const d = new Date(r.price_date + 'T12:00:00Z').getUTCDay();
    return d !== 0 && d !== 6;
  });
  const sessionDates = sessions.map((r) => r.price_date);
  const d0 = sessionDates[sessionDates.length - 1];
  const dN = (n: number) => sessionDates[sessionDates.length - 1 - n];

  // ---------- per-security closes ----------
  const secIds = slices.map((s) => s.securityId).filter((x): x is string => !!x);
  const priceRows = secIds.length
    ? await fetchAll<PriceRow>(
        (a, b) =>
          sb
            .from('market_prices')
            .select('security_id, ticker, price_date, close')
            .in('security_id', secIds)
            .gte('price_date', daysAgo(50))
            .lt('price_date', TODAY)
            .order('price_date', { ascending: true })
            .range(a, b),
        'market_prices holdings',
      )
    : [];
  const bySec = new Map<string, PriceRow[]>();
  for (const r of priceRows) {
    if (!bySec.has(r.security_id)) bySec.set(r.security_id, []);
    bySec.get(r.security_id)!.push(r);
  }
  const hasHistory = (s: Slice) => !!(s.securityId && bySec.get(s.securityId)?.length);

  // Reconstructed weights at a past date: shares x close(on or before date). Assumes no trades in
  // the window, so buys and sells are invisible and all change is price-driven by construction.
  function weightsAt(date: string) {
    const vals = new Map<string, number>();
    let sum = 0;
    for (const s of slices) {
      const c = s.securityId ? closeOnOrBefore(bySec.get(s.securityId), date) : null;
      const v = c && s.shares > 0 ? s.shares * c.close : s.value;
      vals.set(s.ticker, v);
      sum += v;
    }
    const w = new Map<string, number>();
    for (const [t, v] of vals) w.set(t, sum > 0 ? (v / sum) * 100 : 0);
    return w;
  }
  const wY = d0 ? weightsAt(d0) : null;
  const w30 = weightsAt(daysAgo(30));
  const w10 = dN(10) ? weightsAt(dN(10)) : null;

  const weightChangeRows: WeightChangeRow[] = wY
    ? slices.filter(hasHistory).map((s) => ({
        ticker: s.ticker,
        weightPct: s.weightPct,
        ddPts: s.weightPct - (wY.get(s.ticker) ?? s.weightPct),
        d30Pts: s.weightPct - (w30.get(s.ticker) ?? s.weightPct),
      }))
    : [];

  // threshold crossings today (20 / 35, non-fund names only)
  const crossingRows: Crossing[] = [];
  if (wY) {
    for (const s of slices) {
      if (isFund(s.assetClass, s.ticker)) continue;
      const y = wY.get(s.ticker);
      if (y == null) continue;
      for (const th of [20, 35]) {
        if (y < th && s.weightPct >= th)
          crossingRows.push({ ticker: s.ticker, direction: 'above', threshold: th, priorPct: y, nowPct: s.weightPct });
        if (y >= th && s.weightPct < th)
          crossingRows.push({ ticker: s.ticker, direction: 'below', threshold: th, priorPct: y, nowPct: s.weightPct });
      }
    }
  }

  // driver streaks: leader of each of the last 5 completed sessions by |shares x close change|
  const todayDrivers = [...slices]
    .filter((s) => s.contributionPct != null)
    .sort((a, b) => Math.abs(b.contributionPct!) - Math.abs(a.contributionPct!))
    .slice(0, 3);
  const sessionLeaders: { date: string; ticker: string; usd: number }[] = [];
  for (let k = 0; k < 5; k++) {
    const dk = dN(k), dprev = dN(k + 1);
    if (!dk || !dprev) break;
    let lead: { ticker: string; usd: number } | null = null;
    for (const s of slices) {
      if (!s.securityId || s.shares <= 0) continue;
      const a = closeOnOrBefore(bySec.get(s.securityId), dk);
      const b = closeOnOrBefore(bySec.get(s.securityId), dprev);
      if (!a || !b || a.date === b.date || a.date !== dk) continue; // need a real close on dk
      const usd = s.shares * (a.close - b.close);
      if (!lead || Math.abs(usd) > Math.abs(lead.usd)) lead = { ticker: s.ticker, usd };
    }
    if (lead) sessionLeaders.push({ date: dk, ...lead });
  }
  const driverRows: Driver[] = todayDrivers.map((d, i) => {
    const led = sessionLeaders.filter((l) => l.ticker === d.ticker);
    return {
      rank: i + 1,
      ticker: d.ticker,
      dayPct: d.dayPct,
      contributionPct: d.contributionPct!,
      ledCount: led.length,
      ledDates: led.map((l) => l.date).sort(),
      sessionsCounted: sessionLeaders.length,
    };
  });

  // ---------- the clean post-close series ----------
  // What a single post-close snapshot writer would have written, built in code instead of read
  // from portfolio_snapshots. Session dates = weekday SPY rows in the last 30 calendar days that
  // look like a full-day bar. A position is in the series when it has a close on or before the
  // first session date; on a date without its own row it is carried forward.
  const isFullBar = (r: PriceRow) =>
    r.high != null && r.low != null && Number(r.low) <= Number(r.close) && Number(r.close) <= Number(r.high) && Number(r.high) > Number(r.low);
  const cleanFrom = daysAgo(30);
  const cleanDates: string[] = [];
  const spyCleanClose = new Map<string, number>();
  for (const r of spyRows) {
    if (r.price_date < cleanFrom) continue;
    const dow = new Date(r.price_date + 'T12:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (!isFullBar(r)) continue;
    cleanDates.push(r.price_date);
    spyCleanClose.set(r.price_date, Number(r.close));
  }
  const firstClean = cleanDates[0] ?? null;
  const inSeries = firstClean
    ? slices.filter((s) => s.shares > 0 && s.securityId && closeOnOrBefore(bySec.get(s.securityId), firstClean))
    : [];
  const inSeriesSet = new Set(inSeries.map((s) => s.ticker));
  const cleanCoveragePct = total > 0 ? (inSeries.reduce((n, s) => n + s.value, 0) / total) * 100 : 0;
  const cleanPortfolio: number[] = [];
  const cleanSpy: number[] = [];
  for (const date of cleanDates) {
    let v = 0;
    for (const s of inSeries) {
      const c = closeOnOrBefore(bySec.get(s.securityId!), date)!; // exists: a close on or before firstClean <= date
      v += s.shares * c.close;
    }
    cleanPortfolio.push(v);
    cleanSpy.push(spyCleanClose.get(date)!);
  }
  const cleanPerf: CleanPerfRow[] = [];
  const nClean = cleanDates.length;
  if (nClean >= 2 && inSeries.length) {
    let lastBack = 0;
    for (const [label, want] of [['1D', 1], ['5D', 5], ['20D', 20]] as const) {
      const back = Math.min(want, nClean - 1);
      if (back === lastBack) continue; // do not repeat the same span under a second label
      lastBack = back;
      const ia = nClean - 1, ib = nClean - 1 - back;
      if (cleanPortfolio[ib] > 0 && cleanSpy[ib] > 0) {
        const pp = (cleanPortfolio[ia] / cleanPortfolio[ib] - 1) * 100;
        const sp = (cleanSpy[ia] / cleanSpy[ib] - 1) * 100;
        cleanPerf.push({ label, sessions: back, portfolioPct: pp, spyPct: sp, spreadPts: pp - sp, from: cleanDates[ib], to: cleanDates[ia] });
      }
    }
  }
  const cleanSeries: CleanSeries = {
    dates: cleanDates,
    perf: cleanPerf,
    coveragePct: cleanCoveragePct,
    includedTickers: inSeries.map((s) => s.ticker),
    excludedTickers: slices.filter((s) => !inSeriesSet.has(s.ticker)).map((s) => s.ticker),
  };

  const earnings = await lookupEarnings(slices);

  // largest weight erosion / growth over 10 sessions
  let growth: WeightMove | null = null, erosion: WeightMove | null = null;
  if (w10) {
    const deltas = slices
      .filter(hasHistory)
      .map((s) => ({ t: s.ticker, now: s.weightPct, then: w10.get(s.ticker) ?? s.weightPct }))
      .map((x) => ({ ...x, d: x.now - x.then }));
    if (deltas.length) {
      const grow = deltas.reduce((a, b) => (b.d > a.d ? b : a));
      const erode = deltas.reduce((a, b) => (b.d < a.d ? b : a));
      growth = { ticker: grow.t, fromPct: grow.then, toPct: grow.now, pts: grow.d };
      erosion = { ticker: erode.t, fromPct: erode.then, toPct: erode.now, pts: erode.d };
    }
  }

  // ---------- theses: pillars, 24h status changes, 24h catches ----------
  const { data: theses, error: thErr } = await sb
    .from('theses')
    .select('id, ticker, tracked')
    .eq('user_id', userId)
    .eq('tracked', true);
  if (thErr) throw new Error(`theses: ${thErr.message}`);
  const thesisById = new Map((theses ?? []).map((t) => [t.id, t]));
  const thesisIds = [...thesisById.keys()];
  const pillars = thesisIds.length
    ? await fetchAll<{ id: string; thesis_id: string; claim: string; status: string; status_override: string | null; status_changed_at: string | null }>(
        (a, b) =>
          sb
            .from('thesis_pillars')
            .select('id, thesis_id, claim, status, status_override, lifecycle, status_changed_at')
            .in('thesis_id', thesisIds)
            .neq('lifecycle', 'dismissed')
            .range(a, b),
        'thesis_pillars',
      )
    : [];
  const pillarById = new Map(pillars.map((p) => [p.id, p]));
  const pillarIds = pillars.map((p) => p.id);
  const tickerOfPillar = (pid: string) => thesisById.get(pillarById.get(pid)?.thesis_id ?? '')?.ticker ?? '?';

  const ev30 = pillarIds.length
    ? await fetchAll<{ pillar_id: string; verdict: string; source_title: string; source_published_at: string | null; created_at: string }>(
        (a, b) =>
          sb
            .from('pillar_evidence')
            .select('pillar_id, verdict, source_title, source_published_at, created_at')
            .in('pillar_id', pillarIds)
            .gte('created_at', daysAgo(30))
            .order('created_at', { ascending: false })
            .range(a, b),
        'pillar_evidence 30d',
      )
    : [];
  const ev24 = ev30.filter((e) => e.created_at >= since24h);

  const catchRows: Catch[] = ev24.map((e) => ({
    ticker: tickerOfPillar(e.pillar_id),
    verdict: e.verdict.toLowerCase(),
    claim: pillarById.get(e.pillar_id)?.claim ?? '?',
    sourceTitle: e.source_title,
    sourceDate: e.source_published_at?.slice(0, 10) ?? 'undated',
  }));

  const pillarChangeRows: PillarChange[] = pillars
    .filter((p) => p.status_changed_at && p.status_changed_at >= since24h)
    .map((p) => {
      const newest = ev30.find((e) => e.pillar_id === p.id);
      return {
        ticker: tickerOfPillar(p.id),
        claim: p.claim,
        status: String(p.status_override ?? p.status).toLowerCase(),
        changedAt: p.status_changed_at!.slice(0, 10),
        newest: newest
          ? {
              verdict: newest.verdict.toLowerCase(),
              sourceTitle: newest.source_title,
              sourceDate: newest.source_published_at?.slice(0, 10) ?? 'undated',
            }
          : null,
      };
    });

  const structured: Structured = {
    portfolioDayPct,
    spy: spy ? { c: spy.c, dp: spy.dp } : null,
    vix: vix ? { value: vix.value, pricedDayPct: vix.pricedDayPct } : null,
    lastCompletedSession: d0 ?? null,
    cleanSeries,
    earnings,
    live: spy ? { portfolioPct: portfolioDayPct, spyPct: spy.dp, spreadPts: portfolioDayPct - spy.dp } : null,
    crossings: crossingRows,
    drivers: driverRows,
    weightMove10: { growth, erosion, since: dN(10) ?? null },
    weightChange: weightChangeRows,
    noNewsMovers: noNewsMovers.map((m) => ({ ticker: m.ticker, dayPct: m.dayPct!, weightPct: m.weightPct })),
    news: newsRows,
    catches24h: catchRows,
    pillarChanges24h: pillarChangeRows,
  };

  const ranked = buildRanked(structured, slices);
  const closer = closerText(structured);
  return {
    userId,
    tickers: sliceTickers,
    pack: buildPack(ranked, closer),
    ranked,
    quiet: ranked.length === 0,
    templateText: templateText(structured),
    closer,
  };
}
