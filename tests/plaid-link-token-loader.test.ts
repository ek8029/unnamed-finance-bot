import { expect, it, vi } from 'vitest';
import { createLinkTokenLoader, linkButtonStatus } from '@/lib/plaid/link-token-loader';

const TOKEN_A = 'link-sandbox-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN_B = 'link-production-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it('coalesces rapid initialization requests and can retry after a failed request', async () => {
  const first = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(Response.json({ link_token: TOKEN_A }));
  const loader = createLinkTokenLoader(fetcher);
  const pending = loader.load();
  expect(loader.load()).toBe(pending);
  expect(fetcher).toHaveBeenCalledTimes(1);
  first.resolve(Response.json({ error: 'Temporarily unavailable' }, { status: 503 }));
  await expect(pending).rejects.toThrow('Temporarily unavailable');
  await expect(loader.load()).resolves.toBe(TOKEN_A);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toBe('/api/plaid/create-link-token');
  expect(fetcher.mock.calls[1][1]?.method).toBe('POST');
});

it('rejects missing, malformed, and wrong-type tokens instead of leaving an unusable Link button', async () => {
  for (const payload of [null, {}, { link_token: null }, { link_token: 123 }, { link_token: '' }, { link_token: ' ' }, { link_token: 'public-sandbox-token' }, { link_token: `${TOKEN_A} ` }]) {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
    await expect(createLinkTokenLoader(fetcher).load()).rejects.toThrow('Please retry');
  }
});

it('allows retry after a network error or invalid JSON', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError('Network unavailable'))
    .mockResolvedValueOnce(new Response('<html>Unavailable</html>'))
    .mockResolvedValueOnce(Response.json({ link_token: TOKEN_B }));
  const loader = createLinkTokenLoader(fetcher);
  await expect(loader.load()).rejects.toThrow('Network unavailable');
  await expect(loader.load()).rejects.toThrow();
  await expect(loader.load()).resolves.toBe(TOKEN_B);
});

it('aborts unmounted work and ignores a late response even when the transport ignores cancellation', async () => {
  const old = deferred<Response>();
  const current = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const loader = createLinkTokenLoader(fetcher);
  const previous = loader.load();
  const previousSignal = fetcher.mock.calls[0][1]?.signal;
  loader.cancel();
  expect(previousSignal?.aborted).toBe(true);
  const latest = loader.load();
  old.resolve(Response.json({ link_token: TOKEN_A }));
  await expect(previous).resolves.toBeNull();
  expect(loader.load()).toBe(latest);
  current.resolve(Response.json({ link_token: TOKEN_B }));
  await expect(latest).resolves.toBe(TOKEN_B);
});

it('keeps retry available before Link is ready and makes operation labels take precedence', () => {
  const idle = { initializing: false, tokenError: false, ready: true, exchanging: false, linkOpen: false };
  expect(linkButtonStatus(idle)).toEqual({ label: null, disabled: false, busy: false });
  expect(linkButtonStatus({ ...idle, tokenError: true, ready: false })).toEqual({ label: 'Retry connection', disabled: false, busy: false });
  expect(linkButtonStatus({ ...idle, initializing: true, tokenError: true })).toEqual({ label: 'Preparing connection...', disabled: true, busy: true });
  expect(linkButtonStatus({ ...idle, exchanging: true })).toEqual({ label: 'Linking...', disabled: true, busy: true });
  expect(linkButtonStatus({ ...idle, linkOpen: true })).toEqual({ label: 'Connecting...', disabled: true, busy: true });
  expect(linkButtonStatus({ ...idle, ready: false })).toEqual({ label: 'Preparing connection...', disabled: true, busy: true });
});
