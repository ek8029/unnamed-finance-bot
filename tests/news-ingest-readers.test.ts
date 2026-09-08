import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: null as any,
  classifier: vi.fn(),
  narrate: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock('@/lib/news-subject-model', () => ({ classifySubjects: mocks.classifier, SUBJECT_MODEL: 'offline-classifier' }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mocks.db }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.db }));
vi.mock('@/lib/edgar', () => ({ getRecentFilings: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/financial-data', () => ({ getQuote: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/vix', () => ({ getVixQuote: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/digest/pack', () => ({ buildDigestContext: vi.fn().mockRejectedValue(new Error('offline fallback exercise')) }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.narrate } }; } }));
vi.mock('@/lib/agent/monitored', () => ({ monitoredThesisIds: async () => new Set(['thesis-nvda', 'thesis-aapl']) }));
vi.mock('@/lib/agent/judge-queue', () => ({ enqueueJudgeJobs: mocks.enqueue, recordLedgerRow: vi.fn() }));
vi.mock('@/lib/agent/heartbeat', () => ({ beat: vi.fn() }));

import { refreshRssNews } from '@/lib/free-news';
import { GET } from '@/app/api/market/intelligence/route';
import { generateDigest } from '@/lib/generate-digest';
import { runNewsWatch } from '@/lib/news-watch';
import { isDirectHoldingNews, newsDisposition, partitionNewsForReader } from '@/lib/news-relevance';

type Row = Record<string, any>;
const NOW = '2026-09-08T14:00:00.000Z';
const BITCOIN = 'Wall Street Investment Firm Bernstein Thinks Bitcoin Could Hit $300,000 by 2029. Is Bitcoin Now a Buy?';
const APPLE = 'Apple’s new CEO faces a staggering $14 billion iPhone test';
const companies = [
  ['NVDA', 'NVIDIA Corporation'], ['GOOGL', 'Alphabet Inc Class A'], ['AAPL', 'Apple Inc'],
  ['LLY', 'Eli Lilly and Company'], ['TSM', 'Taiwan Semiconductor Manufacturing'],
  ['META', 'Meta Platforms Inc'], ['AMZN', 'Amazon.com Inc'], ['ON', 'ON Semiconductor'],
].map(([ticker, security_name]) => ({ ticker, security_name }));

/** A bounded Supabase-shaped store. Selects project requested fields and every
 * filter actually applies, so omitting verdict fields or querying only the old
 * primary ticker cannot accidentally pass a re-aim test. No real DB is used. */
function memoryDb() {
  const tables: Record<string, Row[]> = {
    market_news: [], market_events: [], securities: companies,
    holdings: companies.map(c => ({ ticker: c.ticker, user_id: 'user-1', total_value: 1000, portfolio_allocation_pct: 10 })),
    theses: [{ id: 'thesis-nvda', user_id: 'user-1', ticker: 'NVDA', tracked: true }, { id: 'thesis-aapl', user_id: 'user-1', ticker: 'AAPL', tracked: true }],
  };
  const from = (table: string) => {
    if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
    const filters: ((r: Row) => boolean)[] = [];
    let columns = '*', limit = Infinity, offset = 0, order: string | null = null, ascending = true;
    let insert: Row[] | null = null, update: Row | null = null;
    const q: any = {
      select(value: string) { columns = value; return q; },
      eq(k: string, v: any) { filters.push(r => r[k] === v); return q; },
      neq(k: string, v: any) { filters.push(r => r[k] !== v); return q; },
      in(k: string, values: any[]) { filters.push(r => values.includes(r[k])); return q; },
      is(k: string, v: any) { filters.push(r => (r[k] ?? null) === v); return q; },
      not(k: string, op: string, v: any) { if (op !== 'is') throw new Error(op); filters.push(r => (r[k] ?? null) !== v); return q; },
      gte(k: string, v: any) { filters.push(r => r[k] >= v); return q; },
      or(expression: string) {
        const clauses = [...expression.matchAll(/(\w+)\.(in\.\(([^)]*)\)|is\.null)/g)];
        if (!clauses.length) throw new Error(`Unsupported OR ${expression}`);
        filters.push(r => clauses.some(m => m[2] === 'is.null' ? r[m[1]] == null : m[3].split(',').includes(r[m[1]])));
        return q;
      },
      order(k: string, opts: { ascending: boolean }) { order = k; ascending = opts.ascending; return q; },
      limit(n: number) { limit = n; return q; },
      range(start: number, end: number) { offset = start; limit = end - start + 1; return q; },
      insert(rows: Row[]) { if (table !== 'market_news') throw new Error('Unexpected write'); insert = rows; return q; },
      update(value: Row) { if (table !== 'market_news') throw new Error('Unexpected write'); update = value; return q; },
      async then(resolve: (value: any) => any) {
        if (insert) tables[table].push(...insert.map((r, i) => ({ id: `news-${tables[table].length + i}`, created_at: NOW, subject_verdict: null, subject_ticker: null, ...r })));
        let rows = tables[table].filter(r => filters.every(f => f(r)));
        if (update) for (const row of rows) Object.assign(row, update);
        if (order) rows = [...rows].sort((a, b) => String(a[order!]).localeCompare(String(b[order!])) * (ascending ? 1 : -1));
        rows = rows.slice(offset, offset + limit);
        const fields = columns.split(',').map(c => c.trim());
        const data = rows.map(r => columns === '*' ? { ...r } : Object.fromEntries(fields.map(k => [k, r[k] ?? null])));
        return resolve({ data, error: null });
      },
    };
    return q;
  };
  return { tables, from, auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } };
}

type Feed = { title: string; summary?: string; tags?: string[] };
let feeds: Record<string, Feed[]>;
function rss(rows: Feed[], ticker: string) {
  return `<rss><channel>${rows.map((r, i) => `<item><title><![CDATA[${r.title}]]></title><link>https://example.com/${ticker}/${i}</link><description><![CDATA[${r.summary ?? ''}]]></description><pubDate>Tue, 08 Sep 2026 13:00:00 GMT</pubDate>${r.tags ? `<nasdaq:tickers>${r.tags.join(',')}</nasdaq:tickers>` : ''}</item>`).join('')}</channel></rss>`;
}
async function ingest(classifySubjects = false) {
  const pending = refreshRssNews(mocks.db, [], Object.keys(feeds), { classifySubjects });
  await vi.runAllTimersAsync();
  return pending;
}
async function web(tickers: string[]) {
  const response = await GET(new Request(`http://local/api/market/intelligence?tickers=${tickers.join(',')}`));
  expect(response.status).toBe(200);
  return (await response.json()).news as Row[];
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); vi.clearAllMocks();
  mocks.db = memoryDb(); feeds = {};
  mocks.classifier.mockResolvedValue(new Map());
  mocks.narrate.mockResolvedValue({ choices: [{ message: { content: 'Offline test narration.' } }], usage: { total_tokens: 0 } });
  mocks.enqueue.mockImplementation(async (_db, jobs) => ({ inserted: jobs.length, error: null }));
  vi.stubGlobal('fetch', vi.fn(async (raw: string) => {
    const url = new URL(raw);
    if (url.hostname === 'www.nasdaq.com') return new Response(rss([], 'none'));
    if (url.hostname !== 'feeds.finance.yahoo.com') throw new Error(`Unexpected network attempt: ${url.hostname}`);
    const ticker = url.searchParams.get('s')!;
    return new Response(rss(feeds[ticker] ?? [], ticker));
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('actual RSS ingest → storage → web/email reader boundaries', () => {
  it('retains unrelated single-feed stories and serves them as context without portfolio exposure', async () => {
    feeds = { NVDA: [{ title: BITCOIN }], GOOGL: [{ title: APPLE }] };
    expect(await ingest()).toBe(2);
    expect(mocks.db.tables.market_news.map((r: Row) => r.primary_ticker)).toEqual([null, null]);
    expect(mocks.db.tables.market_news.map((r: Row) => r.tickers)).toEqual([['NVDA'], ['GOOGL']]);
    const news = await web(['NVDA', 'GOOGL']);
    expect(news).toHaveLength(2);
    for (const article of news) {
      expect(article.relevance).toBe('Market context'); expect(article.positionValue).toBeNull(); expect(article.impactNote).toBeNull();
      expect(isDirectHoldingNews(article as any, { ticker: article.tickers[0], asset_name: 'NVIDIA Corporation' })).toBe(false);
    }
    await generateDigest(['NVDA', 'GOOGL'], 'user-1');
    const prompt = mocks.narrate.mock.calls[0][0].messages[0].content as string;
    const positionSection = prompt.split('NEWS AFFECTING HOLDINGS (last 48 hours):')[1].split('GENERAL MARKET NEWS:')[0];
    expect(positionSection).not.toContain(BITCOIN); expect(positionSection).not.toContain(APPLE);
    expect(prompt.split('GENERAL MARKET NEWS:')[1]).toContain(BITCOIN);
    expect(prompt.split('GENERAL MARKET NEWS:')[1]).toContain(APPLE);
  });

  it('retains single-feed summary-only coverage while awaiting a classifier verdict', async () => {
    feeds = { NVDA: [{ title: 'Chipmaker secures a major contract', summary: 'Nvidia will supply the next generation of processors.' }] };
    await ingest();
    const stored = mocks.db.tables.market_news[0];
    expect(stored.primary_ticker).toBeNull(); expect(stored.summary).toContain('Nvidia');
    expect((await web(['NVDA']))[0].relevance).toBe('Market context');
  });

  it('preserves Google, Lilly, TSMC, Instagram, and AWS company coverage', async () => {
    feeds = {
      GOOGL: [{ title: 'Google announces a new data center' }], LLY: [{ title: 'Lilly reports phase three results' }],
      TSM: [{ title: 'TSMC opens a new factory' }], META: [{ title: 'Instagram launches a new video format' }],
      AMZN: [{ title: 'AWS expands its infrastructure investment' }],
    };
    expect(await ingest()).toBe(5);
    expect(mocks.db.tables.market_news.map((r: Row) => r.primary_ticker)).toEqual(Object.keys(feeds));
    const news = await web(Object.keys(feeds));
    expect(news).toHaveLength(5); expect(news.every(r => r.relevance === 'Your Holdings')).toBe(true);
  });

  it('continues excluding known spam and roundups instead of storing them as context', async () => {
    feeds = { NVDA: [{ title: 'Shareholder alert: deadline approaches' }, { title: 'Top Analyst Reports for Amazon, AbbVie & Alibaba' }, { title: 'Better AI Stock: Nvidia vs. AMD' }] };
    expect(await ingest()).toBe(0); expect(mocks.db.tables.market_news).toHaveLength(0);
  });

  it('does not mistake ON in an uppercase headline for the company, but keeps explicit company evidence', async () => {
    feeds = { ON: [{ title: 'BITCOIN RALLIES ON FED RATE HOPES' }, { title: 'onsemi announces new chip production' }] };
    expect(await ingest()).toBe(2);
    expect(mocks.db.tables.market_news.map((r: Row) => r.primary_ticker)).toEqual([null, 'ON']);
  });

  it('promotes confirmed context and re-aims the wrong feed without rewriting the provider tags', async () => {
    feeds = { NVDA: [{ title: 'Chipmaker secures a major contract', summary: 'Nvidia will supply the processors.' }, { title: BITCOIN }], GOOGL: [{ title: APPLE }] };
    mocks.classifier.mockImplementation(async (rows: Row[]) => new Map(rows.map(row => [row.key,
      row.title === APPLE ? { verdict: 'mention', subjectTicker: 'AAPL' }
        : row.title === BITCOIN ? { verdict: 'mention' } : { verdict: 'about' },
    ])));
    await ingest(true);
    const stored = mocks.db.tables.market_news as Row[];
    const contract = stored.find(r => r.title.startsWith('Chipmaker'))!;
    expect(contract.primary_ticker).toBe('NVDA'); expect(contract.subject_verdict).toBe('about');
    const apple = stored.find(r => r.title === APPLE)!;
    expect(apple.primary_ticker).toBeNull(); expect(apple.subject_ticker).toBe('AAPL'); expect(apple.tickers).toEqual(['GOOGL']);
    const grouped = partitionNewsForReader(stored as any[], ['NVDA', 'AAPL']);
    expect(grouped.subjects.map(r => r.primary_ticker)).toEqual(['NVDA', 'AAPL']);
    expect(grouped.context.map(r => r.title)).toEqual([BITCOIN]);
    const news = await web(['NVDA', 'AAPL']);
    const rendered = news.find(r => r.title === 'Chipmaker secures a major contract')!;
    expect(isDirectHoldingNews(rendered as any, { ticker: 'NVDA', asset_name: 'NVIDIA Corporation' })).toBe(true);
    expect(news.find(r => r.title === APPLE)?.primaryTicker).toBe('AAPL');
    await generateDigest(['NVDA', 'AAPL'], 'user-1');
    const prompt = mocks.narrate.mock.calls[0][0].messages[0].content as string;
    const positionSection = prompt.split('NEWS AFFECTING HOLDINGS (last 48 hours):')[1].split('GENERAL MARKET NEWS:')[0];
    expect(positionSection).toContain('[NVDA] Chipmaker'); expect(positionSection).toContain(`[AAPL] ${APPLE}`); expect(positionSection).not.toContain(BITCOIN);
  });

  it('enqueues only classifier-confirmed subjects through the real watch path, including re-aims', async () => {
    feeds = { NVDA: [{ title: 'Chipmaker secures a major contract', summary: 'Nvidia will supply the processors.' }, { title: BITCOIN }], GOOGL: [{ title: APPLE }] };
    mocks.classifier.mockImplementation(async (rows: Row[]) => new Map(rows.flatMap(row => row.title === BITCOIN ? [] : [[row.key, row.title === APPLE ? { verdict: 'mention', subjectTicker: 'AAPL' } : { verdict: 'about' }]])));
    const pending = runNewsWatch(mocks.db, { log: [], now: new Date(NOW), size: 40 });
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.errors).toEqual([]); expect(result.queued).toBe(2);
    expect(mocks.enqueue.mock.calls[0][1].map((job: Row) => job.ticker).sort()).toEqual(['AAPL', 'NVDA']);
    expect(mocks.db.tables.market_news.find((r: Row) => r.title === BITCOIN).primary_ticker).toBeNull();
    expect(newsDisposition(mocks.db.tables.market_news.find((r: Row) => r.title === BITCOIN)).kind).toBe('context');
  });
});
