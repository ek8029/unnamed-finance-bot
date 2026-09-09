// The news-watch tick hands refreshRssNews a Redis seen set (option seenSet)
// so a feed that repeats last tick's headlines opens no market_news statement.
// Without the option the daily sync path is byte-for-byte the old behaviour.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  unseen: vi.fn(),
  markSeen: vi.fn(),
  // Every db call in order: { table, ops: ['select("url")', 'in("url",[...])', ...] }.
  // 'markSeen' entries are pushed into the same sequence so ordering is provable.
  sequence: [] as { table?: string; ops?: string[]; mark?: string[] }[],
  existingUrls: [] as string[],
  insertError: null as null | { message: string },
}));
vi.mock('@/lib/watch/seen-set', () => ({ unseen: mocks.unseen, markSeen: mocks.markSeen }));
vi.mock('@/lib/news-subject-model', () => ({ classifySubjects: vi.fn(), SUBJECT_MODEL: 'offline-classifier' }));
vi.mock('@/lib/edgar', () => ({ getRecentFilings: vi.fn().mockResolvedValue([]) }));
vi.mock('openai', () => ({ default: class {} }));

import { refreshRssNews } from '@/lib/free-news';

/** Records every builder call. Resolves market_news url lookups from
 *  `existingUrls`, the 7-day title read and the securities read as empty,
 *  and the insert with `insertError`. Any other table is a test failure. */
function recordingDb() {
  return {
    from(table: string) {
      const entry = { table, ops: [] as string[] };
      mocks.sequence.push(entry);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = new Proxy({}, {
        get: (_t, prop) => {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown) => {
              if (table === 'securities') return resolve({ data: [], error: null });
              if (table !== 'market_news') throw new Error(`Unexpected table ${table}`);
              if (entry.ops[0]?.startsWith('insert(')) return resolve({ data: null, error: mocks.insertError });
              const inOp = entry.ops.find(o => o.startsWith('in("url"'));
              if (inOp) {
                const asked = JSON.parse(inOp.slice('in("url",'.length, -1)) as string[];
                return resolve({ data: mocks.existingUrls.filter(u => asked.includes(u)).map(url => ({ url })), error: null });
              }
              return resolve({ data: [], error: null });
            };
          }
          return (...args: unknown[]) => {
            entry.ops.push(`${String(prop)}(${args.map(a => JSON.stringify(a)).join(',')})`);
            return q;
          };
        },
      });
      return q;
    },
  };
}

const URLS = ['https://finance.yahoo.com/news/nvda-1', 'https://finance.yahoo.com/news/nvda-2', 'https://finance.yahoo.com/news/nvda-3'];
const DEFAULT_TITLES = [
  'Nvidia reports record data center revenue for the quarter',
  'Nvidia expands Blackwell production with TSMC',
  'Nvidia names a new chief financial officer',
];
const TITLES = [...DEFAULT_TITLES];
function rss() {
  return `<rss><channel>${URLS.map((u, i) => `<item><title><![CDATA[${TITLES[i]}]]></title><link>${u}</link><description><![CDATA[summary ${i}]]></description><pubDate>Tue, 08 Sep 2026 13:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`;
}

const urlLookups = () => mocks.sequence.filter(e => e.table === 'market_news' && e.ops?.some(o => o.startsWith('in("url"')));
const titleLookups = () => mocks.sequence.filter(e => e.table === 'market_news' && e.ops?.some(o => o.startsWith('gte("published_at"')));
const inserts = () => mocks.sequence.filter(e => e.table === 'market_news' && e.ops?.[0]?.startsWith('insert('));
const insertedUrls = () => inserts().flatMap(e => (JSON.parse(e.ops![0].slice('insert('.length, -1)) as { url: string }[]).map(r => r.url));

async function ingest(options?: { seenSet?: 'news' }) {
  const log: string[] = [];
  const pending = refreshRssNews(recordingDb(), log, ['NVDA'], options);
  await vi.runAllTimersAsync();
  return { inserted: await pending, log };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.sequence.length = 0;
  TITLES.splice(0, TITLES.length, ...DEFAULT_TITLES);
  mocks.existingUrls = [];
  mocks.insertError = null;
  mocks.unseen.mockImplementation(async (_name: string, ids: string[]) => ids);
  mocks.markSeen.mockImplementation(async (_name: string, ids: string[]) => { mocks.sequence.push({ mark: ids }); });
  vi.stubGlobal('fetch', vi.fn(async (raw: string) => {
    const url = new URL(raw);
    if (url.hostname === 'www.nasdaq.com') return new Response('<rss><channel></channel></rss>');
    if (url.hostname !== 'feeds.finance.yahoo.com') throw new Error(`Unexpected network attempt: ${url.hostname}`);
    return new Response(rss());
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('refreshRssNews with a seen set', () => {
  it('every url already seen: zero database calls, returns 0, nothing marked', async () => {
    mocks.unseen.mockResolvedValue([]);
    const { inserted, log } = await ingest({ seenSet: 'news' });
    expect(inserted).toBe(0);
    expect(mocks.unseen).toHaveBeenCalledWith('news', URLS);
    expect(mocks.sequence).toEqual([]);
    expect(mocks.markSeen).not.toHaveBeenCalled();
    expect(log).toContain('[news] 0 new articles (3 already seen)');
  });

  it('a fresh subset: the selects get only fresh urls, and markSeen gets the whole fresh subset after the insert', async () => {
    mocks.unseen.mockResolvedValue([URLS[1], URLS[2]]);
    mocks.existingUrls = [URLS[2]]; // the DB dedupe finds this one already present
    const { inserted } = await ingest({ seenSet: 'news' });
    expect(inserted).toBe(1);
    expect(urlLookups()).toHaveLength(1);
    expect(urlLookups()[0].ops).toContain(`in("url",${JSON.stringify([URLS[1], URLS[2]])})`);
    expect(titleLookups()).toHaveLength(1);
    expect(insertedUrls()).toEqual([URLS[1]]);
    // Settled either way: the inserted one and the one the DB already had.
    expect(mocks.markSeen).toHaveBeenCalledTimes(1);
    expect(mocks.markSeen).toHaveBeenCalledWith('news', [URLS[1], URLS[2]]);
    const insertAt = mocks.sequence.findIndex(e => e.ops?.[0]?.startsWith('insert('));
    const markAt = mocks.sequence.findIndex(e => e.mark);
    expect(insertAt).toBeGreaterThan(-1);
    expect(markAt).toBeGreaterThan(insertAt);
  });

  it('every fresh url is a database duplicate: no insert, the batch is still marked seen', async () => {
    mocks.existingUrls = [...URLS];
    const { inserted, log } = await ingest({ seenSet: 'news' });
    expect(inserted).toBe(0);
    expect(inserts()).toHaveLength(0);
    expect(mocks.markSeen).toHaveBeenCalledWith('news', URLS);
    expect(log).toContain('[news] 0 new articles (3 duplicates skipped)');
  });

  it('every fresh url is an editorial exclusion: no insert, the batch is still marked seen', async () => {
    // A comparison headline is excluded by newsDisposition (lib/news-quality isComparisonHeadline).
    TITLES.splice(0, 3, 'Nvidia vs AMD: which chip stock is the better buy', 'Nvidia versus Intel: which one wins the data center', 'AMD vs Nvidia: the better AI stock to own');
    const { inserted, log } = await ingest({ seenSet: 'news' });
    expect(inserted).toBe(0);
    expect(log).toContain('[news] 0 articles kept (3 excluded by editorial filters)');
    expect(inserts()).toHaveLength(0);
    expect(mocks.markSeen).toHaveBeenCalledWith('news', URLS);
  });

  it('without the option: unseen and markSeen are never called and both selects run on the full batch', async () => {
    const { inserted } = await ingest();
    expect(inserted).toBe(3);
    expect(mocks.unseen).not.toHaveBeenCalled();
    expect(mocks.markSeen).not.toHaveBeenCalled();
    expect(urlLookups()).toHaveLength(1);
    expect(urlLookups()[0].ops).toContain(`in("url",${JSON.stringify(URLS)})`);
    expect(titleLookups()).toHaveLength(1);
    expect(insertedUrls()).toEqual(URLS);
  });

  it('insert error: nothing is marked seen, so the tick retries next time', async () => {
    mocks.insertError = { message: 'boom' };
    const { inserted, log } = await ingest({ seenSet: 'news' });
    expect(inserted).toBe(0);
    expect(inserts()).toHaveLength(1);
    expect(mocks.markSeen).not.toHaveBeenCalled();
    expect(log).toContain('[news] Insert failed: boom');
  });
});
