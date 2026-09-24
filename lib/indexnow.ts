const HOST = 'https://helmterminal.dev';

/**
 * From a sitemap XML document, return the <loc> of every <url> whose <lastmod>
 * falls within the last `days` days of `now`. Entries with no <lastmod> are
 * skipped: without a date there is no evidence they changed. Pure, so the
 * script that submits blog and tool pages can be tested without the network.
 */
export function recentSitemapUrls(xml: string, now: Date, days: number): string[] {
  const since = now.getTime() - days * 86_400_000;
  const out: string[] = [];
  for (const entry of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = entry.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    const lastmod = entry.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1];
    if (!loc || !lastmod) continue;
    const t = Date.parse(lastmod);
    if (Number.isFinite(t) && t >= since && t <= now.getTime() + 86_400_000) out.push(loc);
  }
  return out;
}

/**
 * Notify Bing/Yandex IndexNow of new or updated URLs so answer engines that read Bing's
 * index (ChatGPT search, Copilot) pick up fresh evidence in minutes instead of waiting for
 * an organic crawl. Server-internal; the caller is already trusted, so no auth is required
 * (unlike the public /api/indexnow route). Fire-and-forget safe: never throws.
 */
/**
 * IndexNow is one protocol served by several engines, and a submission to any
 * participating endpoint is shared with the others. The generic host has been
 * seen resetting Node's TLS connection (ECONNRESET on 2026-09-24) while Bing's
 * own endpoint answered, so the endpoints are tried in order and the one that
 * answered is reported.
 */
export const INDEXNOW_ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow'];

export async function submitToIndexNow(
  urls: string[],
): Promise<{ ok: boolean; status?: number; endpoint?: string; error?: string }> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { ok: false, error: 'INDEXNOW_KEY not configured' };
  const urlList = urls.filter(Boolean).map((u) => (u.startsWith('http') ? u : `${HOST}${u}`));
  if (urlList.length === 0) return { ok: false, error: 'No URLs' };
  const body = JSON.stringify({
    host: 'helmterminal.dev',
    key,
    keyLocation: `${HOST}/${key}.txt`,
    urlList,
  });
  const errors: string[] = [];
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      // A 4xx from the engine is an answer about our payload, not a transport
      // failure, so it is returned rather than retried on the next endpoint.
      return { ok: res.ok, status: res.status, endpoint };
    } catch (err) {
      errors.push(`${endpoint}: ${err instanceof Error ? err.message : 'request failed'}`);
    }
  }
  return { ok: false, error: errors.join('; ') };
}
