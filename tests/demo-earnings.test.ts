import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise mount effects without a browser or any live account services.
const harness = vi.hoisted(() => ({ effects: [] as Array<() => unknown> }));
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => unknown) => harness.effects.push(effect),
  useCallback: (fn: unknown) => fn,
  useRef: (current: unknown) => ({ current }),
}));
vi.mock('@/hooks/use-live-prices', () => ({ isUsMarketOpen: () => false }));

import { useEarnings } from '@/hooks/use-financial-data';

describe('earnings in a sample portfolio', () => {
  const request = vi.fn();
  beforeEach(() => {
    harness.effects.length = 0;
    request.mockReset();
    request.mockResolvedValue({ ok: true, json: async () => ({ upcoming: [], recent: [], isPro: false }) });
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', request);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows explicitly labeled fixtures without requesting real account data', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => '1' });
    const result = useEarnings();
    harness.effects.forEach(effect => effect());
    expect(request).not.toHaveBeenCalled();
    expect(result.loading).toBe(false);
    expect(result.report?.sample).toBe(true);
    expect(result.report?.upcoming.length).toBeGreaterThan(0);
    expect(result.report?.totalUpcomingExposure).toBe(result.report?.upcoming.reduce((total, row) => total + row.position.totalValue, 0));
  });

  it('still requests the authenticated earnings endpoint outside demo mode', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => null });
    const result = useEarnings();
    harness.effects.forEach(effect => effect());
    expect(result.report).toBeNull();
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/dashboard/earnings');
  });
});
