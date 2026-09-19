import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let script: { onload: () => void; onerror: () => void; remove: () => void };
let append: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  script = { onload: () => {}, onerror: () => {}, remove: vi.fn() };
  append = vi.fn();
  vi.stubGlobal('window', { location: { origin: 'https://helm.example', pathname: '/signup', search: '?email=private@example.test' } });
  vi.stubGlobal('document', { createElement: () => script, head: { appendChild: append } });
});
afterEach(() => vi.unstubAllGlobals());

it('does not load or capture before the privacy gate allows it', async () => {
  const analytics = await import('../lib/browser-page-analytics');
  analytics.captureBrowserPageview();
  analytics.setBrowserPageAnalytics(false);
  expect(append).not.toHaveBeenCalled();
});

it('drops a pending initial pageview when the user opts out during SDK load', async () => {
  const analytics = await import('../lib/browser-page-analytics');
  analytics.setBrowserPageAnalytics(true);
  const plausible = (window as any).plausible;
  const transform = plausible.o.transformRequest;
  analytics.setBrowserPageAnalytics(false);
  script.onload();
  expect(plausible.q).toBeUndefined();
  expect(transform({ n: 'pageview' })).toBeNull();
});

it('sends sanitized pageviews only while enabled and can resume without a second script', async () => {
  const analytics = await import('../lib/browser-page-analytics');
  analytics.setBrowserPageAnalytics(true);
  const plausible = (window as any).plausible;
  expect(plausible.o.autoCapturePageviews).toBe(false);
  script.onload();
  expect(plausible.q).toEqual([['pageview', { url: 'https://helm.example/signup' }]]);
  analytics.setBrowserPageAnalytics(false);
  analytics.captureBrowserPageview();
  expect(plausible.q).toHaveLength(1);
  analytics.setBrowserPageAnalytics(true);
  expect(plausible.q).toHaveLength(2);
  expect(append).toHaveBeenCalledTimes(1);
});
