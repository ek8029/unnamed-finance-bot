import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  db: null as unknown,
  send: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }) } }),
  createStaticServiceClient: () => mocks.db,
}));
vi.mock('@/lib/push/expo', () => ({
  isExpoPushToken: (token: unknown) => typeof token === 'string' && /^ExpoPushToken\[[\w-]+\]$/.test(token),
  sendExpoPush: mocks.send,
  getExpoReceipts: vi.fn(),
}));
vi.mock('@/lib/notify/deliver', () => ({ alreadyDelivered: async () => new Set(), recordDelivery: vi.fn() }));
vi.mock('@/lib/agent/judge-queue', () => ({ etDayStartIso: () => '2026-09-07T04:00:00Z' }));
vi.mock('@/lib/push/policy', () => ({
  DAILY_CAP: 10, inQuietHours: () => false, legacyAllows: () => true, levelAllows: () => true, parseLevel: () => 'all',
}));

import { DELETE, POST } from '@/app/api/push/register/route';
import { pushRevokeCapability, verifyPushRevoke } from '@/lib/push/revocation';
import { sendPush } from '@/lib/push/send';

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TOKEN = 'ExpoPushToken[test_device]';
const request = (method: string, body: unknown) => new Request('https://test.example/api/push/register', {
  method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-signing-secret');
  mocks.userId = null;
  mocks.db = null;
  mocks.send.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('device disable capability', () => {
  it('binds the exact account and token and rejects tampering', () => {
    const capability = pushRevokeCapability(A, TOKEN);
    expect(verifyPushRevoke(A, TOKEN, capability)).toBe(true);
    expect(verifyPushRevoke(B, TOKEN, capability)).toBe(false);
    expect(verifyPushRevoke(A, 'ExpoPushToken[other]', capability)).toBe(false);
    expect(verifyPushRevoke(A, TOKEN, capability.slice(1))).toBe(false);
  });

  it('prepares a capability before a token can be enabled', async () => {
    mocks.userId = A;
    const from = vi.fn(); mocks.db = { from };
    const result = await POST(request('POST', { token: TOKEN, prepare: true }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true, revokeCapability: pushRevokeCapability(A, TOKEN) });
    expect(from).not.toHaveBeenCalled();
  });

  it('cannot use an A logout capability to disable a token reassigned to B', async () => {
    const rows = [{ user_id: B, token: TOKEN, disabled_at: null as string | null }];
    mocks.db = { from: () => ({ update: (patch: Partial<typeof rows[number]>) => {
      const filters: [string, unknown][] = [];
      const query = {
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        then: (resolve: (value: { error: null }) => unknown) => {
          rows.filter((row) => filters.every(([key, value]) => row[key as keyof typeof row] === value)).forEach((row) => Object.assign(row, patch));
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return query;
    } }) };
    const result = await DELETE(request('DELETE', { userId: A, token: TOKEN, revokeCapability: pushRevokeCapability(A, TOKEN) }));
    expect(result.status).toBe(200);
    expect(rows[0].disabled_at).toBeNull();
    rows[0].user_id = A;
    await DELETE(request('DELETE', { userId: A, token: TOKEN, revokeCapability: pushRevokeCapability(A, TOKEN) }));
    expect(rows[0].disabled_at).not.toBeNull();
  });

  it('rejects an unauthenticated disable without a valid capability', async () => {
    const result = await DELETE(request('DELETE', { userId: A, token: TOKEN, revokeCapability: 'tampered' }));
    expect(result.status).toBe(401);
  });
});

it('removes all financial preview details at the final Expo send boundary', async () => {
  const db = { from: (table: string) => {
    const result = table === 'user_preferences' ? { data: { notification_push_level: 'all' }, error: null }
      : table === 'push_tokens' ? { data: [{ token: TOKEN }] }
      : { count: 0 };
    const query = {
      select: () => query, eq: () => query, contains: () => query, gte: () => query, is: () => query,
      limit: () => Promise.resolve(result), maybeSingle: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  } };
  mocks.send.mockResolvedValue([{ status: 'error', message: 'test transport' }]);
  await sendPush(db as unknown as SupabaseClient, A, 'brief', {
    title: 'Private AAPL holding', body: 'Your portfolio is worth $125,000', route: 'brief', id: 'private-thesis-id',
  }, [], { now: new Date('2026-09-07T14:00:00Z') });
  expect(mocks.send).toHaveBeenCalledWith([{
    to: TOKEN, title: 'Your morning brief is ready', body: 'Written before the open, from what you hold.', sound: 'default',
    data: { userId: A, route: 'brief', kind: 'brief' },
  }]);
});
