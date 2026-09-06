// lib/edgar-watch.ts
// The filing poller (perpetual watch, section 2).
//
// Do NOT poll per ticker: 319 held names every minute is 19k EDGAR requests an
// hour. EDGAR publishes one global "latest filings" feed per form type, so the
// poller reads four feeds a minute (8-K, 10-Q, 10-K, 4), filters the entries to
// the CIKs Helm watches, records each new one in filing_events (idempotent on
// the accession number, because the feed repeats), and enqueues a judge job for
// every tracked thesis on the name. The model is never called from here.
//
// The orchestration (watchOnce) takes its collaborators as arguments so the
// tests can run it against fixtures and in-memory fakes; runEdgarWatch wires the
// real feed, database and queue.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getTickerCikMap } from '@/lib/edgar';
import { filingTier } from '@/lib/filing-tiers';
import { monitoredThesisIds } from '@/lib/agent/monitored';
import { enqueueJudgeJobs, type NewJudgeJob } from '@/lib/agent/judge-queue';
import { beat } from '@/lib/agent/heartbeat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** Feeds read every tick. Form 4 is recorded but read at the hourly scan (see enqueueForEvents). */
export const WATCH_FORMS = ['8-K', '10-Q', '10-K', '4'] as const;
export type WatchForm = (typeof WATCH_FORMS)[number];

const UA = process.env.EDGAR_USER_AGENT || 'Helm Terminal hello@helmterminal.dev';
const PAGE = 100;
const MAX_PAGES = 3;

export interface FeedEntry {
  accessionNo: string; // dashed, as EDGAR prints it: 0001140361-26-035809
  cik: string; // 10 digits, zero padded
  form: string;
  entityName: string;
  /** Filer for company filings; Form 4 lists the same accession once as Issuer and once per Reporting person. */
  role: string;
  filedDate: string; // YYYY-MM-DD
  acceptedAt: string; // ISO instant of EDGAR acceptance (the feed's <updated>)
  url: string; // the filing index page
  items: string[]; // 8-K item numbers
}

function decode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
}

function attr(block: string, tagName: string, attrName: string): string {
  const m = block.match(new RegExp(`<${tagName}\\b[^>]*\\s${attrName}="([^"]*)"`));
  return m ? m[1] : '';
}

/** Parse EDGAR's getcurrent atom feed. Tolerant: an entry missing its accession or CIK is dropped. */
export function parseEdgarFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = m[1];
    const title = decode(tag(block, 'title'));
    // "8-K - PDS Biotechnology Corp (0001472091) (Filer)"
    const t = title.match(/^(\S+)\s+-\s+(.+?)\s+\((\d{10})\)\s+\((\w+)\)\s*$/);
    if (!t) continue;
    const summary = decode(tag(block, 'summary'));
    const acc = summary.match(/AccNo:<\/b>\s*([\d-]{20})/)?.[1]
      ?? tag(block, 'id').match(/accession-number=([\d-]{20})/)?.[1];
    if (!acc) continue;
    const filedDate = summary.match(/Filed:<\/b>\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
    const updated = tag(block, 'updated');
    const accepted = updated ? new Date(updated) : null;
    out.push({
      accessionNo: acc,
      cik: t[3],
      form: attr(block, 'category', 'term') || t[1],
      entityName: t[2],
      role: t[4],
      filedDate,
      acceptedAt: accepted && !isNaN(accepted.getTime()) ? accepted.toISOString() : new Date().toISOString(),
      url: attr(block, 'link', 'href'),
      items: [...summary.matchAll(/Item (\d+\.\d+):/g)].map((i) => i[1]),
    });
  }
  return out;
}

export function feedUrl(form: string, start = 0): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(form)}&start=${start}&count=${PAGE}&output=atom`;
}

export interface FeedPage {
  entries: FeedEntry[];
  status: number;
}

export async function fetchFeedPage(form: string, start = 0): Promise<FeedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(feedUrl(form, start), {
      headers: { 'User-Agent': UA, Accept: 'application/atom+xml, application/xml, text/xml' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return { entries: [], status: res.status };
    return { entries: parseEdgarFeed(await res.text()), status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

/** The names Helm watches: every held ticker plus every ticker with a tracked thesis, keyed by CIK. */
export interface WatchUniverse {
  cikToTickers: Map<string, string[]>;
  tickers: number;
}

async function distinctTickers(db: Db, table: 'holdings' | 'theses'): Promise<Set<string>> {
  const out = new Set<string>();
  // PostgREST pages at 1000 rows; holdings has many more rows than tickers.
  for (let page = 0; page < 10; page++) {
    let q = db.from(table).select('ticker').range(page * 1000, page * 1000 + 999);
    q = table === 'holdings' ? q.neq('ticker', 'UNKNOWN') : q.eq('tracked', true);
    const { data, error } = await q;
    if (error || !data) break;
    for (const r of data) if (r.ticker) out.add(String(r.ticker).toUpperCase());
    if (data.length < 1000) break;
  }
  return out;
}

export function universeFromMap(tickers: Iterable<string>, cikByTicker: Map<string, number>): WatchUniverse {
  const cikToTickers = new Map<string, string[]>();
  let n = 0;
  for (const t of tickers) {
    const cik = cikByTicker.get(t);
    if (cik == null) continue;
    const key = String(cik).padStart(10, '0');
    const list = cikToTickers.get(key) ?? [];
    list.push(t);
    cikToTickers.set(key, list.sort());
    n += 1;
  }
  return { cikToTickers, tickers: n };
}

export async function buildWatchUniverse(db: Db): Promise<WatchUniverse> {
  const [held, thesis, cikMap] = await Promise.all([
    distinctTickers(db, 'holdings'),
    distinctTickers(db, 'theses'),
    getTickerCikMap(),
  ]);
  const all = new Set([...held, ...thesis]);
  return universeFromMap(all, cikMap ?? new Map());
}

export interface WatchedEntry extends FeedEntry {
  tickers: string[];
}

/**
 * Entries on watched CIKs. Company filings are the Filer entry; a Form 4 is
 * matched on its Issuer entry only (the Reporting-person entries carry the
 * insider's own CIK). One entry per accession.
 */
export function selectWatched(entries: FeedEntry[], universe: WatchUniverse): WatchedEntry[] {
  const seen = new Set<string>();
  const out: WatchedEntry[] = [];
  for (const e of entries) {
    const isForm4 = e.form === '4' || e.form.startsWith('4/');
    if (isForm4 ? e.role !== 'Issuer' : e.role !== 'Filer') continue;
    const tickers = universe.cikToTickers.get(e.cik);
    if (!tickers || seen.has(e.accessionNo)) continue;
    seen.add(e.accessionNo);
    out.push({ ...e, tickers });
  }
  return out;
}

/**
 * Whether the feed moved by more than one page since the last read: true when
 * a full page came back and none of its accessions were in the previous read.
 * No previous read (cold instance) means one page; the hourly scan is the net.
 */
export function needsNextPage(page: FeedEntry[], previous: Set<string> | undefined): boolean {
  if (!previous || page.length < PAGE) return false;
  return !page.some((e) => previous.has(e.accessionNo));
}

export interface RecordedEvent extends WatchedEntry {
  /** The ticker the row is filed under (first of `tickers`). */
  ticker: string;
}

export interface WatchDeps {
  fetchPage: (form: string, start: number) => Promise<FeedPage>;
  universe: () => Promise<WatchUniverse>;
  /** Insert the events that are not already on record; return the ones that were new. */
  record: (hits: WatchedEntry[], dry: boolean, now: Date) => Promise<RecordedEvent[]>;
  /** Enqueue judge jobs for a new tier-now event; return how many were queued and the status to stamp. */
  enqueue: (event: RecordedEvent, log: string[]) => Promise<{ queued: number; status: 'queued' | 'skipped'; note: string | null }>;
  stamp: (accessionNo: string, status: 'queued' | 'skipped' | 'hourly' | 'new', note: string | null) => Promise<void>;
}

export interface WatchResult {
  dry: boolean;
  forms: string[];
  fetched: number;
  pages: number;
  watched: number;
  new: number;
  queued: number;
  /** Tier B: recorded, read at the hourly scan. */
  hourly: number;
  skipped: number;
  errors: string[];
  universe: { tickers: number; ciks: number };
  events: { ticker: string; form: string; accessionNo: string; acceptedAt: string; url: string; status: string; queued: number }[];
  ms: number;
}

/** Per-instance memory of the last read, per form, for the paging decision. */
const lastRead = new Map<string, Set<string>>();

export async function watchOnce(
  deps: WatchDeps,
  opts: { dry?: boolean; forms?: readonly string[]; log: string[]; now?: () => Date; memory?: Map<string, Set<string>> },
): Promise<WatchResult> {
  const now = opts.now ?? (() => new Date());
  const started = now();
  const dry = opts.dry ?? false;
  const forms = [...(opts.forms ?? WATCH_FORMS)];
  const memory = opts.memory ?? lastRead;
  const log = opts.log;
  const result: WatchResult = {
    dry, forms, fetched: 0, pages: 0, watched: 0, new: 0, queued: 0, hourly: 0, skipped: 0, errors: [],
    universe: { tickers: 0, ciks: 0 }, events: [], ms: 0,
  };

  let universe: WatchUniverse;
  try {
    universe = await deps.universe();
  } catch (err) {
    result.errors.push(`universe: ${err instanceof Error ? err.message : String(err)}`);
    result.ms = now().getTime() - started.getTime();
    return result;
  }
  result.universe = { tickers: universe.tickers, ciks: universe.cikToTickers.size };
  if (universe.cikToTickers.size === 0) {
    result.errors.push('universe: no CIKs resolved (EDGAR ticker map unavailable?)');
    result.ms = now().getTime() - started.getTime();
    return result;
  }

  for (const form of forms) {
    const previous = memory.get(form);
    const seenThisRead = new Set<string>();
    const hits: WatchedEntry[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      let feed: FeedPage;
      try {
        feed = await deps.fetchPage(form, page * PAGE);
      } catch (err) {
        result.errors.push(`${form} page ${page}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
      result.pages += 1;
      if (feed.status !== 200) {
        result.errors.push(`${form} page ${page}: HTTP ${feed.status}`);
        break;
      }
      result.fetched += feed.entries.length;
      for (const e of feed.entries) seenThisRead.add(e.accessionNo);
      hits.push(...selectWatched(feed.entries, universe));
      if (!needsNextPage(feed.entries, previous)) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    if (seenThisRead.size > 0) memory.set(form, seenThisRead);
    result.watched += hits.length;
    if (hits.length === 0) continue;

    let fresh: RecordedEvent[];
    try {
      fresh = await deps.record(hits, dry, now());
    } catch (err) {
      result.errors.push(`${form} record: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    result.new += fresh.length;
    for (const ev of fresh) {
      let queued = 0;
      let status: 'queued' | 'skipped' | 'hourly' | 'new' = 'new';
      let note: string | null = null;
      const tier = filingTier(ev.form, ev.items);
      const isForm4 = ev.form === '4' || ev.form.startsWith('4/');
      if (dry) {
        status = 'skipped';
        note = 'dry run';
      } else if (tier === 'never') {
        status = 'skipped';
        note = `tier C (${ev.items.join(' ')}): never bears on a pillar`;
        await deps.stamp(ev.accessionNo, status, note).catch((err) => result.errors.push(`${form} ${ev.accessionNo} stamp: ${err instanceof Error ? err.message : String(err)}`));
      } else if (tier === 'hourly') {
        status = 'hourly';
        note = isForm4 ? 'form 4 is read at the hourly scan' : `tier B (${ev.items.join(' ')}): read at the hour`;
        await deps.stamp(ev.accessionNo, status, note).catch((err) => result.errors.push(`${form} ${ev.accessionNo} stamp: ${err instanceof Error ? err.message : String(err)}`));
      } else {
        try {
          const q = await deps.enqueue(ev, log);
          queued = q.queued;
          status = q.status;
          note = q.note;
          await deps.stamp(ev.accessionNo, status, note);
        } catch (err) {
          result.errors.push(`${form} ${ev.accessionNo} enqueue: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      result.queued += queued;
      if (status === 'skipped') result.skipped += 1;
      if (status === 'hourly') result.hourly += 1;
      result.events.push({ ticker: ev.ticker, form: ev.form, accessionNo: ev.accessionNo, acceptedAt: ev.acceptedAt, url: ev.url, status, queued });
      log.push(`[edgar-watch] ${ev.form} ${ev.ticker} ${ev.accessionNo} accepted ${ev.acceptedAt} -> ${status}${note ? ` (${note})` : ''}${queued ? `, ${queued} job(s)` : ''}`);
    }
  }

  result.ms = now().getTime() - started.getTime();
  return result;
}

// ---------------------------------------------------------------------------
// Real collaborators
// ---------------------------------------------------------------------------

export async function recordFilingEvents(db: Db, hits: WatchedEntry[], dry: boolean, now: Date): Promise<RecordedEvent[]> {
  if (hits.length === 0) return [];
  const rows = hits.map((h) => ({
    accession_no: h.accessionNo,
    cik: h.cik,
    ticker: h.tickers[0],
    form: h.form,
    title: h.entityName,
    filed_at: h.acceptedAt,
    url: h.url,
    seen_at: now.toISOString(),
    status: dry ? 'skipped' : 'new',
    note: dry ? 'dry run' : h.tickers.length > 1 ? `also ${h.tickers.slice(1).join(', ')}` : null,
  }));
  const { data, error } = await db
    .from('filing_events')
    .upsert(rows, { onConflict: 'accession_no', ignoreDuplicates: true })
    .select('accession_no');
  if (error) throw new Error(error.message);
  const fresh = new Set((data ?? []).map((r) => String(r.accession_no)));
  return hits.filter((h) => fresh.has(h.accessionNo)).map((h) => ({ ...h, ticker: h.tickers[0] }));
}

/**
 * Judge jobs for a new tier-now filing: one per monitored thesis on the name.
 * Tier-hourly filings (Form 4 among them: the insider-cluster signal needs the
 * batch, and a busy insider day would spend the cap on the least urgent reads)
 * and tier-never filings are stamped by watchOnce and never reach here.
 */
export async function enqueueForEvent(db: Db, event: RecordedEvent, log: string[]): Promise<{ queued: number; status: 'queued' | 'skipped'; note: string | null }> {
  const { data: theses, error } = await db
    .from('theses')
    .select('id, user_id, ticker')
    .in('ticker', event.tickers)
    .eq('tracked', true)
    .limit(500);
  if (error) throw new Error(`theses: ${error.message}`);
  const rows = (theses ?? []) as { id: string; user_id: string; ticker: string }[];
  if (rows.length === 0) return { queued: 0, status: 'skipped', note: 'no tracked thesis' };

  const kept = await monitoredThesisIds(db, rows.map((r) => r.user_id));
  const jobs: NewJudgeJob[] = rows
    .filter((r) => kept.has(r.id))
    .map((r) => ({
      kind: 'filing',
      user_id: r.user_id,
      thesis_id: r.id,
      ticker: r.ticker,
      source_key: event.accessionNo,
      payload: { accession_no: event.accessionNo, form: event.form, filed_at: event.acceptedAt, url: event.url, items: event.items, ticker: event.ticker },
    }));
  if (jobs.length === 0) return { queued: 0, status: 'skipped', note: `${rows.length} tracked thesis/theses, none monitored on their tier` };

  const { inserted, error: qErr } = await enqueueJudgeJobs(db, jobs);
  if (qErr) throw new Error(`enqueue: ${qErr}`);
  if (inserted < jobs.length) log.push(`[edgar-watch] ${event.accessionNo}: ${jobs.length - inserted} job(s) already queued`);
  return { queued: inserted, status: 'queued', note: rows.length > jobs.length ? `${rows.length - jobs.length} not monitored on their tier` : null };
}

export async function stampFilingEvent(db: Db, accessionNo: string, status: 'queued' | 'skipped' | 'hourly' | 'new', note: string | null): Promise<void> {
  await db.from('filing_events').update({ status, note }).eq('accession_no', accessionNo);
}

export async function runEdgarWatch(db: Db, opts: { dry?: boolean; forms?: readonly string[]; log: string[] }): Promise<WatchResult> {
  const result = await watchOnce(
    {
      fetchPage: fetchFeedPage,
      universe: () => buildWatchUniverse(db),
      record: (hits, dry, now) => recordFilingEvents(db, hits, dry, now),
      enqueue: (event, log) => enqueueForEvent(db, event, log),
      stamp: (acc, status, note) => stampFilingEvent(db, acc, status, note),
    },
    opts,
  );
  // Stamped even on a quiet tick: the overview's "checked N min ago" is this.
  await beat(db, 'edgar-watch', { dry: result.dry, fetched: result.fetched, watched: result.watched, new: result.new, queued: result.queued, hourly: result.hourly, skipped: result.skipped, errors: result.errors.length, ms: result.ms });
  return result;
}
