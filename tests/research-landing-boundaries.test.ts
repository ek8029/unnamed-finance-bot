import { beforeEach, expect, it, vi } from 'vitest';
import WhenToSell, { generateMetadata as whenMetadata } from '@/app/when-to-sell/[ticker]/page';
import ThesisRisks, { generateMetadata as riskMetadata } from '@/app/thesis-risks/[ticker]/page';

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), thesis: vi.fn() }));
vi.mock('@/lib/analyze-stock', () => ({ analyzeStock: mocks.analyze }));
vi.mock('@/lib/content/public-thesis', () => ({ getTickerThesisData: mocks.thesis }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/components/helm-mark', () => ({ HelmMark: () => null }));
vi.mock('@/components/legal-footer', () => ({ LegalFooter: () => null }));
vi.mock('@/components/cinematic-bg', () => ({ CinematicBg: () => null }));

beforeEach(() => vi.clearAllMocks());

it.each(['BRK.B', 'BRK-B', 'AAPL1', 'AA PL', 'BTC-USD'])('does not strip %s into another security in landing metadata, data calls, or links', async ticker => {
  for (const [metadata, page] of [[whenMetadata, WhenToSell], [riskMetadata, ThesisRisks]] as const) {
    const props = { params: Promise.resolve({ ticker }) };
    expect(await metadata(props)).toMatchObject({ title: 'Research unavailable — Helm Terminal', robots: { index: false, follow: true } });
    await expect(page(props)).rejects.toThrow('NOT_FOUND');
  }
  expect(mocks.analyze).not.toHaveBeenCalled();
  expect(mocks.thesis).not.toHaveBeenCalled();
});

it('keeps valid ticker SEO content and cache-only analysis behavior', async () => {
  mocks.analyze.mockResolvedValue({ analysis: { companyName: 'Apple', bearCase: 'Demand could weaken.' }, computedAt: '2026-09-07T00:00:00Z' });
  const props = { params: Promise.resolve({ ticker: 'aapl' }) };
  expect(await whenMetadata(props)).toMatchObject({
    title: 'When to Sell AAPL: A Thesis-Based Checklist | Helm Terminal',
    alternates: { canonical: 'https://helmterminal.dev/when-to-sell/AAPL' },
  });
  expect(await riskMetadata(props)).toMatchObject({
    title: 'What Could Invalidate the AAPL Thesis | Helm Terminal',
    alternates: { canonical: 'https://helmterminal.dev/thesis-risks/AAPL' },
  });
  expect(mocks.analyze).toHaveBeenNthCalledWith(1, 'AAPL', false);
  expect(mocks.analyze).toHaveBeenNthCalledWith(2, 'AAPL', false);
});
