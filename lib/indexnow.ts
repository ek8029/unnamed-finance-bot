const HOST = 'https://helmterminal.dev';

/**
 * Notify Bing/Yandex IndexNow of new or updated URLs so answer engines that read Bing's
 * index (ChatGPT search, Copilot) pick up fresh evidence in minutes instead of waiting for
 * an organic crawl. Server-internal; the caller is already trusted, so no auth is required
 * (unlike the public /api/indexnow route). Fire-and-forget safe: never throws.
 */
export async function submitToIndexNow(
  urls: string[],
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { ok: false, error: 'INDEXNOW_KEY not configured' };
  const urlList = urls.filter(Boolean).map((u) => (u.startsWith('http') ? u : `${HOST}${u}`));
  if (urlList.length === 0) return { ok: false, error: 'No URLs' };
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'helmterminal.dev',
        key,
        keyLocation: `${HOST}/${key}.txt`,
        urlList,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'IndexNow request failed' };
  }
}
