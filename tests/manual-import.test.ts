import { beforeEach, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ db: null as unknown, quote: vi.fn(), userId: 'user-a' as string | null }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) } }),
  createServiceClient: async () => state.db,
}));
vi.mock('@/lib/financial-data', () => ({ getQuote: state.quote }));
vi.mock('@/lib/finazon', () => ({ recentlyRateLimited: () => false }));
import { POST } from '@/app/api/portfolio/manual/route';
import { isImportRequestId, manualHoldingId } from '@/lib/manual-import';
import { prepareManualSave, persistManualSave, restoreManualSave, clearManualSave } from '@/lib/manual-portfolio-save';

const REQUEST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
type Row = Record<string, unknown>;
let saved: Row[];
let failShares: number | null;
let loseInsertResponse: boolean;
beforeEach(() => {
  saved = []; failShares = null; loseInsertResponse = false;
  state.userId = 'user-a';
  state.quote.mockReset().mockResolvedValue({ c: 10 });
  state.db = { from: (table: string) => {
    const filters: [string, unknown][] = [];
    let value: Row | null = null;
    const matches = (row: Row) => filters.every(([key, expected]) => row[key] === expected);
    const query = {
      select: () => query,
      eq: (key: string, expected: unknown) => { filters.push([key, expected]); return query; },
      upsert: (row: Row) => { value = row; return query; },
      maybeSingle: async () => ({ error: null, data: table === 'institutions' ? { id: 'manual-institution' }
        : table === 'linked_accounts' ? { id: 'manual-account' }
        : table === 'securities' ? { id: `security-${value?.ticker}` }
        : saved.find(matches) ?? null }),
      insert: async (row: Row) => {
        if (row.shares === failShares) return { error: { code: '23514', message: 'test row failure' } };
        if (row.id && saved.some((prior) => prior.id === row.id)) return { error: { code: '23505', message: 'duplicate' } };
        // Match the actual UNIQUE(user_id, account_id, security_id) schema,
        // not just the request-derived primary key.
        if (saved.some(prior => prior.user_id === row.user_id && prior.account_id === row.account_id && prior.security_id === row.security_id)) {
          return { error: { code: '23505', message: 'holdings_user_id_account_id_security_id_key' } };
        }
        saved.push(row);
        if (loseInsertResponse) { loseInsertResponse = false; return { error: { message: 'fetch failed after commit' } }; }
        return { error: null };
      },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: saved.filter(matches), error: null }).then(resolve),
    };
    return query;
  } };
});
const post = (holdings: unknown[], requestId = REQUEST, expectedUserId = 'user-a') => POST(new Request('https://test.example/api/portfolio/manual', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ holdings, requestId, expectedUserId }),
}) as NextRequest);

it('generates stable account-scoped IDs for indexed requests', () => {
  expect(isImportRequestId(REQUEST)).toBe(true);
  expect(isImportRequestId('bad')).toBe(false);
  const id = manualHoldingId('user-a', REQUEST, 0);
  expect(manualHoldingId('user-a', REQUEST.toUpperCase(), 0)).toBe(id);
  expect(manualHoldingId('user-b', REQUEST, 0)).not.toBe(id);
  expect(manualHoldingId('user-a', REQUEST, 1)).not.toBe(id);
});

it('replays a lost response without creating another lot or needing another quote', async () => {
  const holdings = [{ ticker: 'AAPL', shares: 1.25, costBasis: 0 }];
  const first = await post(holdings);
  expect((await first.json()).added).toBe(1);
  const retried = await post(holdings);
  expect((await retried.json()).added).toBe(1);
  expect(saved).toHaveLength(1);
  expect(state.quote).toHaveBeenCalledTimes(1);
  expect(saved[0]).toMatchObject({ shares: 1.25, average_cost_basis: 0, total_cost_basis: 0, unrealised_gain_loss: 12.5 });
});

it('reports exact failed row indexes for a partial save of different positions', async () => {
  failShares = 2;
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await post([{ ticker: 'AAPL', shares: 1 }, { ticker: 'MSFT', shares: 2 }]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ added: 1, failed: [{ ticker: 'MSFT', rowIndex: 1, error: 'Failed to save', retryable: true }] });
    expect(saved).toHaveLength(1);
    failShares = null;
    expect(await (await post([{ ticker: 'AAPL', shares: 1 }, { ticker: 'MSFT', shares: 2 }])).json()).toMatchObject({ added: 2, failed: [] });
    expect(saved).toHaveLength(2);
  } finally { spy.mockRestore(); }
});

it('keeps an uncertain insert replayable instead of reporting it as an unsaved lot', async () => {
  loseInsertResponse = true;
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const first = await post([{ ticker: 'AAPL', shares: 1 }]);
    expect(first.status).toBe(503);
    expect(saved).toHaveLength(1);
    const retry = await post([{ ticker: 'AAPL', shares: 1 }]);
    expect((await retry.json()).added).toBe(1);
    expect(saved).toHaveLength(1);
  } finally { spy.mockRestore(); }
});

it('concurrent replays converge on the same holding primary key', async () => {
  const responses = await Promise.all([post([{ ticker: 'AAPL', shares: 1 }]), post([{ ticker: 'AAPL', shares: 1 }])]);
  expect(saved).toHaveLength(1);
  expect(await Promise.all(responses.map(async (response) => (await response.json()).added))).toEqual([1, 1]);
});

it('reports an existing position as nonretryable without adding or merging a second lot', async () => {
  await post([{ ticker: 'AAPL', shares: 1 }]);
  const conflict = await post([{ ticker: 'AAPL', shares: 2, costBasis: 5 }], 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  expect(await conflict.json()).toMatchObject({ added: 0, failed: [{ ticker: 'AAPL', rowIndex: 0, code: 'EXISTING_POSITION', retryable: false }] });
  expect(saved).toHaveLength(1);
  expect(saved[0].shares).toBe(1);
  expect(saved[0].total_cost_basis).toBeNull();
});

it('classifies every duplicate ticker before inserting any of those rows', async () => {
  const response = await post([{ ticker: 'AAPL', shares: 1 }, { ticker: ' aapl ', shares: 2 }]);
  expect(await response.json()).toMatchObject({ added: 0, failed: [
    { ticker: 'AAPL', rowIndex: 0, code: 'DUPLICATE_TICKER', retryable: false },
    { ticker: 'AAPL', rowIndex: 1, code: 'DUPLICATE_TICKER', retryable: false },
  ] });
  expect(saved).toHaveLength(0);
  expect(state.quote).not.toHaveBeenCalled();
});

it('can confirm a historically saved row when replaying an older duplicate-ticker request', async () => {
  await post([{ ticker: 'AAPL', shares: 1 }]);
  const response = await post([{ ticker: 'AAPL', shares: 1 }, { ticker: 'AAPL', shares: 2 }]);
  expect(await response.json()).toMatchObject({ added: 1, failed: [{ rowIndex: 1, code: 'DUPLICATE_TICKER', retryable: false }] });
  expect(saved).toHaveLength(1);
});

it('concurrent distinct requests for the same position obey the live unique constraint', async () => {
  const responses = await Promise.all([
    post([{ ticker: 'AAPL', shares: 1 }]),
    post([{ ticker: 'AAPL', shares: 2 }], 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ]);
  const results = await Promise.all(responses.map(response => response.json()));
  expect(saved).toHaveLength(1);
  expect(results.map(result => result.added).sort()).toEqual([0, 1]);
  expect(results.find(result => result.added === 0).failed[0]).toMatchObject({ code: 'EXISTING_POSITION', retryable: false });
});

it('survives uncertain save, expired session, wrong-account login, and same-user recovery without duplicate writes', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const request = prepareManualSave([{ id: 'row-a', ticker: 'AAPL', shares: '1', costBasis: '' }], REQUEST);
  persistManualSave(storage, 'user-a', request);
  loseInsertResponse = true;
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await post(request.holdings, request.requestId)).status).toBe(503);
    expect(saved).toHaveLength(1);
    state.userId = null;
    expect((await post(request.holdings, request.requestId)).status).toBe(401);
    expect(restoreManualSave(storage, 'user-b')).toBeNull();
    state.userId = 'user-b';
    expect((await post(request.holdings, request.requestId, 'user-a')).status).toBe(409);
    state.userId = 'user-a';
    const recovered = restoreManualSave(storage, 'user-a')!;
    expect(recovered).toEqual(request);
    expect(await (await post(recovered.holdings, recovered.requestId)).json()).toMatchObject({ added: 1, failed: [] });
    expect(saved).toHaveLength(1);
    clearManualSave(storage, 'user-a');
    expect(restoreManualSave(storage, 'user-a')).toBeNull();
    // Discarding a recovery record is not undo. Starting again still gets an
    // explicit conflict rather than a duplicate of the already saved position.
    expect(await (await post(request.holdings, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).json())
      .toMatchObject({ added: 0, failed: [{ code: 'EXISTING_POSITION', retryable: false }] });
    expect(saved).toHaveLength(1);
  } finally { spy.mockRestore(); }
});

it('rejects malformed requests before any holding can be inserted', async () => {
  expect((await post([{ ticker: 'AAPL', shares: 1 }], 'not-a-request-id')).status).toBe(400);
  expect((await post([{ ticker: 'AAPL', shares: 1, costBasis: -1 }])).status).toBe(400);
  expect((await post([{ ticker: 'AAPL', shares: 0 }])).status).toBe(400);
  expect(saved).toHaveLength(0);
});
