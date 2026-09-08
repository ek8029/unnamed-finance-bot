import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), send: vi.fn(), activation: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/emails/resend', () => ({ resend: { emails: { send: mocks.send } }, FROM_EMAIL: 'sender@example.test' }));
vi.mock('@/lib/activation-state', () => ({ readActivationState: mocks.activation }));
vi.mock('@/lib/emails/templates', () => ({
  DRIP_DAYS: [1, 3, 7, 14, 21, 30],
  getTemplate: (day: number) => ({ subject: `Day ${day}`, html: '<p>Preview</p>', text: 'Preview' }),
}));

import { POST } from '@/app/api/emails/drip/route';

type User = { id: string; email: string; created_at: string; user_metadata: Record<string, string> };
type LogRow = { user_id: string; drip_day: number; email_subject: string; sent_at: string };
const user = (id = 'user-1'): User => ({ id, email: `${id}@example.test`, created_at: '2026-08-01T12:00:00Z', user_metadata: {} });

function database(options: {
  users?: User[]; optedOut?: string[]; preferenceError?: boolean; subscriptionError?: boolean;
  historyError?: boolean; insertError?: boolean; paid?: boolean;
} = {}) {
  const users = options.users ?? [user()];
  const logs: LogRow[] = [];
  const inserts = vi.fn(async (rows: LogRow[]) => {
    if (options.insertError) return { error: { message: 'database unavailable' } };
    logs.push(...rows);
    return { error: null };
  });
  const db = {
    auth: { admin: { listUsers: vi.fn(async () => ({ data: { users }, error: null })) } },
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      const result = () => {
        if (table === 'user_preferences') return {
          data: (options.optedOut ?? []).map(user_id => ({ user_id, notification_email: false })),
          error: options.preferenceError ? { message: 'preferences unavailable' } : null,
        };
        if (table === 'user_subscriptions') return {
          data: options.paid ? { tier: 'pro', stripe_subscription_id: 'sub_test', source: 'stripe' } : null,
          error: options.subscriptionError ? { message: 'subscription unavailable' } : null,
        };
        if (table === 'email_drip_log') return {
          data: logs.filter(row => row.user_id === filters.user_id),
          error: options.historyError ? { message: 'history unavailable' } : null,
        };
        throw new Error(`Unexpected table: ${table}`);
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        in: () => query,
        maybeSingle: async () => result(),
        insert: inserts,
        then: (resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    }),
  };
  mocks.createClient.mockReturnValue(db);
  return { db, logs, inserts };
}

async function run() {
  const response = await POST(new NextRequest('http://cron.internal/api/emails/drip', {
    method: 'POST', headers: { Authorization: 'Bearer test-cron-secret' },
  }));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://unused.example.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'unused-test-value');
  mocks.activation.mockResolvedValue({ hasSavedWork: false });
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'accepted-message' }, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('drip delivery receipts and retries', () => {
  it('keeps all days eligible when Resend resolves an error, then records only after a successful retry', async () => {
    const { inserts, logs } = database();
    mocks.send.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', message: 'Try later' } });
    const failed = await run();
    expect(failed.body).toMatchObject({ sent: 0, attempted: 1, errors: ['provider_rejected_or_unverified'] });
    expect(inserts).not.toHaveBeenCalled();
    expect(logs).toEqual([]);

    const accepted = await run();
    expect(accepted.body).toMatchObject({ sent: 1, attempted: 1 });
    expect(logs.map(row => row.drip_day)).toEqual([30, 21, 14, 7, 3, 1]);
    expect(logs[0].email_subject).toBe('Day 30');
    expect(logs.slice(1).every(row => row.email_subject.startsWith('[skipped'))).toBe(true);
    expect(mocks.send.mock.calls[0][1]).toEqual({ idempotencyKey: 'helm-drip/user-1/30' });
    expect(mocks.send.mock.calls[1][1]).toEqual(mocks.send.mock.calls[0][1]);

    await run();
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['missing receipt', { data: null, error: null }],
    ['error despite data', { data: { id: 'ambiguous' }, error: { message: 'failure' } }],
  ])('does not mark success with %s', async (_label, providerResult) => {
    const { inserts } = database();
    mocks.send.mockResolvedValue(providerResult);
    expect((await run()).body.sent).toBe(0);
    expect(inserts).not.toHaveBeenCalled();
  });

  it('leaves delivery history untouched when the provider throws', async () => {
    const { inserts } = database();
    mocks.send.mockRejectedValue(new Error('network unavailable'));
    expect((await run()).body).toMatchObject({ sent: 0, attempted: 1, errors: ['delivery_or_log_request_failed'] });
    expect(inserts).not.toHaveBeenCalled();
  });

  it('bounds failed send attempts rather than only counting successes', async () => {
    const { inserts } = database({ users: Array.from({ length: 45 }, (_, i) => user(`user-${i}`)) });
    mocks.send.mockResolvedValue({ data: null, error: { message: 'provider unavailable' } });
    expect((await run()).body).toMatchObject({ sent: 0, attempted: 40, deferred: 5 });
    expect(mocks.send).toHaveBeenCalledTimes(40);
    expect(inserts).not.toHaveBeenCalled();
  });

  it('reports failed history persistence and uses the same provider key on retry', async () => {
    const { inserts } = database({ insertError: true });
    expect((await run()).body).toMatchObject({ sent: 0, errors: ['accepted_but_delivery_log_failed'] });
    await run();
    expect(inserts).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[1][1]).toEqual(mocks.send.mock.calls[0][1]);
  });
});

describe('drip eligibility fails closed', () => {
  it('does not send when preference reads fail', async () => {
    database({ preferenceError: true });
    expect((await run()).status).toBe(500);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(['subscriptionError', 'historyError'] as const)('defers when %s prevents safe eligibility', async option => {
    const { inserts } = database({ [option]: true });
    expect((await run()).body).toMatchObject({ sent: 0, attempted: 0, deferred: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(inserts).not.toHaveBeenCalled();
  });

  it('defers when saved-work reads fail', async () => {
    database();
    mocks.activation.mockRejectedValue(new Error('activation unavailable'));
    expect((await run()).body).toMatchObject({ sent: 0, deferred: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(['optedOut', 'paid', 'savedWork'] as const)('preserves suppression for %s users', async kind => {
    database({ optedOut: kind === 'optedOut' ? ['user-1'] : [], paid: kind === 'paid' });
    if (kind === 'savedWork') mocks.activation.mockResolvedValue({ hasSavedWork: true });
    expect((await run()).body).toMatchObject({ sent: 0, attempted: 0, skipped: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
