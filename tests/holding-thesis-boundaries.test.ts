import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HoldingPage, { generateMetadata as holdingMetadata } from '@/app/dashboard/holdings/[ticker]/page';
import ThesisPage, { generateMetadata as thesisMetadata } from '@/app/thesis/[ticker]/page';
import { getTickerThesisData } from '@/lib/content/public-thesis';
import { getScoringThesisData } from '@/lib/content/scoring-thesis';
import { parseHoldingSymbol } from '@/lib/holding-symbol';

const mocks = vi.hoisted(() => ({ create: vi.fn(), static: vi.fn(), quote: vi.fn(), filters: [] as [string, string, unknown][], held: true }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create, createStaticServiceClient: mocks.static }));
vi.mock('@/lib/financial-data', () => ({ getQuote: mocks.quote }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: () => { throw new Error('REDIRECT'); } }));
vi.mock('@/app/dashboard/holdings/[ticker]/holding-detail-client', () => ({ HoldingDetailClient: () => null }));
vi.mock('@/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/components/helm-mark', () => ({ HelmMark: () => null }));
vi.mock('@/components/legal-footer', () => ({ LegalFooter: () => null }));
vi.mock('@/components/cinematic-bg', () => ({ CinematicBg: () => null }));
vi.mock('@/components/watch-tickers-card', () => ({ WatchTickersCard: () => null }));
vi.mock('@/components/thesis/reasoning-trace', () => ({ ReasoningTrace: () => null }));

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('React', React); mocks.filters = []; mocks.held = true;
  mocks.quote.mockResolvedValue(null);
  mocks.create.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }) },
    from: (table: string) => {
      const query = {
        select: () => query, order: () => query, limit: () => query, gte: () => query,
        eq: (key: string, value: unknown) => { mocks.filters.push([table, key, value]); return query; },
        contains: (key: string, value: unknown) => { mocks.filters.push([table, key, value]); return query; },
        or: (value: string) => { mocks.filters.push([table, 'or', value]); return query; },
        then: (resolve: (result: unknown) => unknown) => resolve({ data: table === 'holdings' && mocks.held ? [{ shares: 1, total_value: 100, current_price: 100, security: null }] : [], error: null }),
      };
      return query;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it.each(['BRK.B', 'BRK-B', 'BTC-USD', 'ETH', '1INCH-USD'])('preserves held identifier %s in metadata, DB filters, provider call and returned holding', async symbol => {
  expect(parseHoldingSymbol(symbol.toLowerCase())).toBe(symbol);
  const props = { params: Promise.resolve({ ticker: symbol.toLowerCase() }) };
  expect(await holdingMetadata(props)).toEqual({ title: symbol });
  const page = await HoldingPage(props);
  expect(page.props.holding.ticker).toBe(symbol);
  expect(mocks.filters).toContainEqual(['holdings', 'ticker', symbol]);
  expect(mocks.filters).toContainEqual(['market_prices', 'ticker', symbol]);
  expect(mocks.filters).toContainEqual(['market_news', 'tickers', [symbol]]);
  expect(mocks.quote).toHaveBeenCalledWith(symbol);
});

it.each(['BRK/B', 'AA PL', 'AAPL,MSFT', 'AAPL%25', ''])('rejects unsafe/malformed holding identifier %s before data access', async ticker => {
  await expect(HoldingPage({ params: Promise.resolve({ ticker }) })).rejects.toThrow('NOT_FOUND');
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.quote).not.toHaveBeenCalled();
});

it('a missing share-class holding offers the research entry page rather than claiming a report exists', async () => {
  mocks.held = false;
  const page = await HoldingPage({ params: Promise.resolve({ ticker: 'BRK.B' }) });
  const hrefs: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const props = (node as { props: { href?: string; children?: unknown } }).props;
    if (props.href) hrefs.push(props.href);
    visit(props.children);
  };
  visit(page);
  expect(hrefs).toContain('/dashboard/analyze');
  expect(hrefs).not.toContain('/dashboard/analyze/BRK.B');
  expect(hrefs).not.toContain('/dashboard/analyze/BRKB');
});

it.each(['BRK.B', 'BRK-B', 'BTC-USD', 'AAPL1', 'AA PL'])('does not coerce unsupported %s into another thesis at page or read-layer boundaries', async ticker => {
  const props = { params: Promise.resolve({ ticker }) };
  expect(await thesisMetadata(props)).toMatchObject({ title: 'Research unavailable — Helm Terminal', robots: 'noindex' });
  await expect(ThesisPage(props)).rejects.toThrow('NOT_FOUND');
  expect(await getTickerThesisData(ticker)).toBeNull();
  expect(await getScoringThesisData(ticker, 'fixture-user')).toMatchObject({ ticker, pillars: [], rawRows: 0 });
  expect(mocks.static).not.toHaveBeenCalled();
});
