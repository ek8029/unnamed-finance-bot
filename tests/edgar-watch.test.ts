import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseEdgarFeed, selectWatched, needsNextPage, universeFromMap, watchOnce, feedUrl,
  type FeedEntry, type WatchDeps, type WatchedEntry, type RecordedEvent,
} from '@/lib/edgar-watch';

const fixture = (name: string) => readFileSync(join(process.cwd(), 'tests/fixtures', name), 'utf8');
const EIGHT_K = parseEdgarFeed(fixture('edgar-latest-8k.atom'));
const FORM_4 = parseEdgarFeed(fixture('edgar-latest-4.atom'));

describe('parseEdgarFeed', () => {
  it('reads every field the poller needs off a live 8-K page', () => {
    expect(EIGHT_K).toHaveLength(6);
    const e = EIGHT_K[0];
    expect(e.accessionNo).toBe('0001140361-26-035809');
    expect(e.cik).toBe('0001472091');
    expect(e.form).toBe('8-K');
    expect(e.entityName).toBe('PDS Biotechnology Corp');
    expect(e.role).toBe('Filer');
    expect(e.filedDate).toBe('2026-09-04');
    // <updated>2026-09-04T17:25:28-04:00</updated>: acceptance time, to the second
    expect(e.acceptedAt).toBe('2026-09-04T21:25:28.000Z');
    expect(e.url).toBe('https://www.sec.gov/Archives/edgar/data/1472091/000114036126035809/0001140361-26-035809-index.htm');
    expect(e.items).toEqual(['1.01', '2.03', '9.01']);
  });

  it('reads Form 4 entries with their Issuer / Reporting roles and no items', () => {
    expect(FORM_4).toHaveLength(4);
    expect(FORM_4.map((e) => e.role)).toEqual(['Reporting', 'Issuer', 'Issuer', 'Reporting']);
    expect(FORM_4[1].cik).toBe('0001702924');
    expect(FORM_4[1].form).toBe('4');
    expect(FORM_4[1].items).toEqual([]);
  });

  it('drops an entry without an accession instead of throwing', () => {
    expect(parseEdgarFeed('<feed><entry><title>8-K - X (0000000001) (Filer)</title></entry></feed>')).toEqual([]);
    expect(parseEdgarFeed('')).toEqual([]);
  });

  it('asks EDGAR for the atom form of the global feed, 100 at a time', () => {
    expect(feedUrl('8-K')).toBe('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&start=0&count=100&output=atom');
    expect(feedUrl('10-Q', 100)).toContain('&start=100&');
  });
});

describe('selectWatched', () => {
  it('keeps company filings on watched CIKs only', () => {
    const universe = universeFromMap(['VSAT', 'NVDA'], new Map([['VSAT', 797721], ['NVDA', 1045810]]));
    const hits = selectWatched(EIGHT_K, universe);
    expect(hits.map((h) => [h.entityName, h.tickers])).toEqual([['VIASAT INC', ['VSAT']]]);
  });

  it('matches a Form 4 on its Issuer entry, once per accession', () => {
    const universe = universeFromMap(['WRAP'], new Map([['WRAP', 1702924]]));
    const hits = selectWatched(FORM_4, universe);
    expect(hits.map((h) => h.accessionNo)).toEqual(['0001493152-26-041638', '0001493152-26-041637']);
    // the Reporting-person entries share the accession and carry the insider's CIK
    expect(hits.every((h) => h.role === 'Issuer')).toBe(true);
  });

  it('files a shared CIK under every ticker that maps to it', () => {
    const universe = universeFromMap(['GOOGL', 'GOOG'], new Map([['GOOG', 1652044], ['GOOGL', 1652044]]));
    expect(universe.cikToTickers.get('0001652044')).toEqual(['GOOG', 'GOOGL']);
    expect(universe.tickers).toBe(2);
  });
});

describe('needsNextPage', () => {
  const page = (n: number, offset = 0): FeedEntry[] =>
    Array.from({ length: n }, (_, i) => ({ ...EIGHT_K[0], accessionNo: `acc-${i + offset}` }));
  it('is false on a cold instance and on a short page', () => {
    expect(needsNextPage(page(100), undefined)).toBe(false);
    expect(needsNextPage(page(40), new Set(['zzz']))).toBe(false);
  });
  it('is true only when a full page has nothing from the previous read', () => {
    expect(needsNextPage(page(100), new Set(['acc-50']))).toBe(false);
    expect(needsNextPage(page(100, 1000), new Set(['acc-50']))).toBe(true);
  });
});

describe('watchOnce', () => {
  // Three watched filers from the fixture, one per tier:
  //   GRLD  Greenland Mines   items 1.01 2.01 3.02 5.03 5.07 9.01  -> 2.01 completed deal, read now
  //   PDSB  PDS Biotechnology items 1.01 2.03 9.01                 -> financing, read at the hour
  //   VSAT  Viasat            items 5.07 9.01                      -> vote results, never
  const universe = universeFromMap(['GRLD', 'PDSB', 'VSAT'], new Map([['GRLD', 1907223], ['PDSB', 1472091], ['VSAT', 797721]]));

  function fakes() {
    const recorded = new Map<string, { status: string; note: string | null }>();
    const enqueued: string[] = [];
    const deps: WatchDeps = {
      fetchPage: async (form) => ({ entries: form === '8-K' ? EIGHT_K : [], status: 200 }),
      universe: async () => universe,
      record: async (hits: WatchedEntry[], dry: boolean) => {
        const fresh: RecordedEvent[] = [];
        for (const h of hits) {
          if (recorded.has(h.accessionNo)) continue;
          recorded.set(h.accessionNo, { status: dry ? 'skipped' : 'new', note: dry ? 'dry run' : null });
          fresh.push({ ...h, ticker: h.tickers[0] });
        }
        return fresh;
      },
      enqueue: async (event) => { enqueued.push(event.accessionNo); return { queued: 2, status: 'queued', note: null }; },
      stamp: async (acc, status, note) => { recorded.set(acc, { status, note }); },
    };
    return { deps, recorded, enqueued };
  }

  it('tiers each new filing: enqueues tier now, stamps tier hourly and tier never, and never repeats', async () => {
    const { deps, recorded, enqueued } = fakes();
    const memory = new Map<string, Set<string>>();
    const first = await watchOnce(deps, { log: [], forms: ['8-K', '10-Q'], memory });
    expect(first.fetched).toBe(6);
    expect(first.watched).toBe(3);
    expect(first.new).toBe(3);
    expect(first.queued).toBe(2);
    expect(first.hourly).toBe(1);
    expect(first.skipped).toBe(1);
    const byTicker = Object.fromEntries(first.events.map((e) => [e.ticker, e]));
    expect(byTicker.GRLD).toMatchObject({ form: '8-K', status: 'queued', queued: 2 });
    expect(byTicker.PDSB).toMatchObject({ status: 'hourly', queued: 0 });
    expect(byTicker.VSAT).toMatchObject({ status: 'skipped', queued: 0 });
    expect(recorded.get(byTicker.PDSB.accessionNo)?.note).toContain('read at the hour');
    expect(recorded.get(byTicker.VSAT.accessionNo)?.note).toContain('never bears on a pillar');
    expect(enqueued).toEqual([byTicker.GRLD.accessionNo]);

    const second = await watchOnce(deps, { log: [], forms: ['8-K', '10-Q'], memory });
    expect(second.watched).toBe(3);
    expect(second.new).toBe(0);
    expect(second.queued).toBe(0);
    expect(enqueued).toHaveLength(1);
  });

  it('dry mode records everything as skipped and never enqueues, whatever the tier', async () => {
    const { deps, recorded, enqueued } = fakes();
    const log: string[] = [];
    const r = await watchOnce(deps, { log, dry: true, forms: ['8-K'], memory: new Map() });
    expect(r.new).toBe(3);
    expect(r.queued).toBe(0);
    expect(r.hourly).toBe(0);
    expect(r.skipped).toBe(3);
    expect(enqueued).toEqual([]);
    expect([...recorded.values()].every((v) => v.status === 'skipped' && v.note === 'dry run')).toBe(true);
    expect(log[0]).toContain('dry run');
  });

  it('a feed error is reported in the body, not thrown', async () => {
    const { deps } = fakes();
    deps.fetchPage = async (form) => (form === '8-K' ? { entries: [], status: 503 } : { entries: [], status: 200 });
    const r = await watchOnce(deps, { log: [], forms: ['8-K', '10-K'], memory: new Map() });
    expect(r.errors).toEqual(['8-K page 0: HTTP 503']);
    expect(r.pages).toBe(2);
  });
});

describe('edgar watch cron', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.OPENAI_API_KEY ||= 'test-key-never-used';
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/edgar-watch/route');
    const res = await GET(new Request('http://cron.internal/api/cron/edgar-watch', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });

  it('polls every minute through the session and keeps a slow pulse otherwise', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const runs = (cfg.crons as { path: string; schedule: string }[]).filter((c) => c.path.startsWith('/api/cron/edgar-watch'));
    const bySlot = Object.fromEntries(runs.map((r) => [new URL('http://x' + r.path).searchParams.get('slot'), r.schedule]));
    expect(bySlot.session).toBe('* 13-21 * * 1-5');
    expect(bySlot.off).toBe('*/5 0-12,22-23 * * 1-5');
    expect(bySlot.weekend).toBe('*/30 * * * 0,6');
  });
});
