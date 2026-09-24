import { describe, it, expect, vi, afterEach } from 'vitest';
import { recentSitemapUrls, submitToIndexNow, INDEXNOW_ENDPOINTS } from '../lib/indexnow';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// On 2026-09-24 the generic endpoint reset Node's connection (ECONNRESET) while
// Bing's endpoint answered. The library must fall through to the next endpoint
// on a transport failure, and must NOT fall through on an HTTP answer, because
// a 4xx is the engine telling us about the payload.
describe('submitToIndexNow endpoint fallback', () => {
  it('falls back to the next endpoint when the first one fails at the transport layer', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'k');
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } }))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const out = await submitToIndexNow(['/tools/rsu-calculator']);
    expect(out).toEqual({ ok: true, status: 200, endpoint: INDEXNOW_ENDPOINTS[1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(INDEXNOW_ENDPOINTS[0]);
    expect(fetchMock.mock.calls[1][0]).toBe(INDEXNOW_ENDPOINTS[1]);
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sent.urlList).toEqual(['https://helmterminal.dev/tools/rsu-calculator']);
    expect(sent.keyLocation).toBe('https://helmterminal.dev/k.txt');
  });

  it('does not retry on an HTTP rejection from the first endpoint', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'k');
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 422 });
    vi.stubGlobal('fetch', fetchMock);
    const out = await submitToIndexNow(['/blog/x']);
    expect(out).toEqual({ ok: false, status: 422, endpoint: INDEXNOW_ENDPOINTS[0] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports every endpoint when all of them fail', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    const out = await submitToIndexNow(['/blog/x']);
    expect(out.ok).toBe(false);
    for (const e of INDEXNOW_ENDPOINTS) expect(out.error).toContain(e);
  });

  it('refuses without a key and without URLs before touching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('INDEXNOW_KEY', '');
    expect((await submitToIndexNow(['/blog/x'])).ok).toBe(false);
    vi.stubEnv('INDEXNOW_KEY', 'k');
    expect((await submitToIndexNow([])).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// The sitemap production serves is the source of truth for what changed. The
// picker has to read Next's sitemap XML shape (one <url> per entry, <lastmod>
// as a full ISO timestamp), keep only entries inside the window, and never
// return an entry with no lastmod at all.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://helmterminal.dev/tools/rsu-calculator</loc><lastmod>2026-09-24T00:00:00.000Z</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
<url><loc>https://helmterminal.dev/blog/gemini-stock-analysis</loc><lastmod>2026-09-15T00:00:00.000Z</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
<url><loc>https://helmterminal.dev/blog/best-mint-alternatives</loc>
  <lastmod>2026-09-23T14:00:00.000Z</lastmod>
</url>
<url><loc>https://helmterminal.dev/privacy</loc></url>
</urlset>`;

describe('recentSitemapUrls', () => {
  const now = new Date('2026-09-24T18:00:00Z');

  it('keeps entries modified inside the window and drops older ones', () => {
    expect(recentSitemapUrls(xml, now, 3)).toEqual([
      'https://helmterminal.dev/tools/rsu-calculator',
      'https://helmterminal.dev/blog/best-mint-alternatives',
    ]);
  });

  it('widens with the window', () => {
    expect(recentSitemapUrls(xml, now, 10)).toHaveLength(3);
  });

  it('never returns an entry without a lastmod', () => {
    expect(recentSitemapUrls(xml, now, 10_000)).not.toContain('https://helmterminal.dev/privacy');
  });

  it('returns nothing for an empty or malformed document', () => {
    expect(recentSitemapUrls('', now, 3)).toEqual([]);
    expect(recentSitemapUrls('<urlset></urlset>', now, 3)).toEqual([]);
  });
});
