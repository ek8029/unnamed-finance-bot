import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ thesis: vi.fn(), entries: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/content/public-thesis', () => ({ getTickerThesisData: mocks.thesis }));
vi.mock('@/lib/edgar', () => ({ getCompanyEntries: mocks.entries }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.limit, getClientIP: () => 'fixture' }));
import { GET } from '@/app/api/scan/ticker/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.thesis.mockResolvedValue(null);
  mocks.entries.mockResolvedValue([
    { ticker: 'BRK-B', title: 'Berkshire Hathaway Inc.' },
    { ticker: 'MU', title: 'MICRON TECHNOLOGY INC' },
    { ticker: 'CRM', title: 'Salesforce Inc.' },
  ]);
  mocks.limit.mockReturnValue({ allowed: true });
});

const scan = (symbol: string) => GET(new Request(`https://fixture.example/api/scan/ticker?symbol=${encodeURIComponent(symbol)}`));

it.each(['BRK.B', 'BRK-B', 'BTC-USD'])('keeps %s intact and offers supported research entry, never a report or draft', async symbol => {
  const response = await scan(symbol.toLowerCase());
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ house: false, kind: 'unsupported', ticker: symbol, analyzePath: '/analyze' });
  expect(result.researchUnavailable).toEqual(expect.any(String));
  expect(result.researchUnavailable.length).toBeGreaterThan(0);
  expect(mocks.thesis).toHaveBeenCalledWith(symbol);
  expect(result).not.toHaveProperty('drafted');
  expect(result).not.toHaveProperty('pillars');
});

it('keeps unsupported research unavailable even when the company directory is down', async () => {
  mocks.entries.mockResolvedValue(null);
  expect(await (await scan('BRK-B')).json()).toMatchObject({ kind: 'unsupported', ticker: 'BRK-B', analyzePath: '/analyze' });
});

it('preserves supported SEC filers and their exact analysis destination', async () => {
  const result = await (await scan('crm')).json();
  expect(result).toMatchObject({ house: false, kind: 'filer', ticker: 'CRM', analyzePath: '/analyze/CRM' });
  expect(result).not.toHaveProperty('researchUnavailable');
});

it('preserves company-name suggestions instead of rejecting longer search terms', async () => {
  const result = await (await scan('MICRON')).json();
  expect(result).toMatchObject({ kind: 'suggest', ticker: 'MICRON', suggestions: [{ ticker: 'MU', title: 'MICRON TECHNOLOGY INC' }], analyzePath: '/analyze' });
});

it('preserves a supported unknown result when the company directory is down', async () => {
  mocks.entries.mockResolvedValue(null);
  expect(await (await scan('CRM')).json()).toMatchObject({ kind: 'unknown', ticker: 'CRM', analyzePath: '/analyze/CRM' });
});

it('leaves actual house-thesis evidence intact without a directory lookup', async () => {
  mocks.thesis.mockResolvedValue({ ticker: 'AAPL', company: 'Apple', health: 'unverified', healthLabel: 'Unverified', pillars: [], asOfDate: null });
  expect(await (await scan('AAPL')).json()).toMatchObject({ house: true, ticker: 'AAPL', company: 'Apple', pillarCount: 0, catchCount: 0 });
  expect(mocks.entries).not.toHaveBeenCalled();
});

it('retains malformed-input and rate-limit status branches before thesis access', async () => {
  expect((await scan('AA PL')).status).toBe(400);
  expect(mocks.thesis).not.toHaveBeenCalled();
  mocks.limit.mockReturnValue({ allowed: false, retryAfterSeconds: 10 });
  const response = await scan('AAPL');
  expect(response.status).toBe(429);
  expect(await response.json()).toMatchObject({ retryAfterSeconds: 10 });
  expect(mocks.thesis).not.toHaveBeenCalled();
});
