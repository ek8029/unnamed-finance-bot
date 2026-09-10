import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }));
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect),
  useRef: (current: unknown) => ({ current }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/compare/AAPL-vs-MSFT' }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

import { CompareGate } from '@/components/compare-gate';
import { AnalysisGate } from '@/components/analysis-gate';

describe('research quota checks across interrupted mounts', () => {
  const setItem = vi.fn();
  const request = vi.fn();
  beforeEach(() => {
    harness.effects.length = 0;
    setItem.mockClear();
    request.mockReset();
    vi.stubGlobal('fetch', request);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([CompareGate, AnalysisGate])('does not consume anonymous usage after unmount', async Gate => {
    let respond!: (value: unknown) => void;
    request.mockReturnValue(new Promise(resolve => { respond = resolve; }));
    Gate();
    const cleanups = harness.effects.map(effect => effect());
    cleanups.forEach(cleanup => cleanup?.());
    respond({ status: 401 });
    await Promise.resolve();
    expect(setItem).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('still consumes one comparison for a mounted anonymous viewer', async () => {
    request.mockResolvedValue({ status: 401 });
    CompareGate();
    harness.effects.forEach(effect => effect());
    // The tier read goes through the shared api cache, so the answer reaches the
    // component a couple of microtasks later than a bare fetch did.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(setItem.mock.calls[0][1]).count).toBe(1);
  });

  it('does not record signed-in analysis usage if unmounted while tier JSON resolves', async () => {
    let resolveTier!: (value: unknown) => void;
    request.mockResolvedValue({ status: 200, ok: true, json: () => new Promise(resolve => { resolveTier = resolve; }) });
    AnalysisGate();
    const cleanups = harness.effects.map(effect => effect());
    await Promise.resolve();
    cleanups.forEach(cleanup => cleanup?.());
    resolveTier({ tier: 'free', quota: { remaining: 5 } });
    await Promise.resolve();
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/user/tier');
  });
});
