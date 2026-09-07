// tests/push-reconnect.test.ts
// A Plaid connection only its owner can fix gets one push a week, on any level
// above off, whatever the market toggles say. Never for a transient error or a
// link that never finished, and never to someone without a phone.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { levelAllows, legacyAllows, needsReconnect, weekET, reconnectKey } from '@/lib/push/policy';
import { connectionNeedsLogin, shortInstitution, TITLE_MAX, BODY_MAX } from '@/lib/push/voice';

const sendPush = vi.fn();
const liveTokenUsers = vi.fn();
vi.mock('@/lib/push/send', () => ({
  sendPush: (...a: unknown[]) => sendPush(...a),
  liveTokenUsers: (...a: unknown[]) => liveTokenUsers(...a),
}));

describe('policy: reconnect', () => {
  it('is heard on every level above off, and the market toggles do not silence it', () => {
    expect(levelAllows('off', 'reconnect')).toBe(false);
    expect(levelAllows('brief', 'reconnect')).toBe(true);
    expect(levelAllows('all', 'reconnect')).toBe(true);
    expect(legacyAllows({ notification_market_alerts: false, notification_daily_brief: false }, 'reconnect')).toBe(true);
  });
  it('only a code a login fixes is a reconnect case', () => {
    expect(needsReconnect({ status: 'login_required', error_code: 'ITEM_LOGIN_REQUIRED' })).toBe(true);
    expect(needsReconnect({ status: 'error', error_code: 'INVALID_ACCESS_TOKEN' })).toBe(true);
    expect(needsReconnect({ status: 'error', error_code: null })).toBe(false); // a link that never finished
    expect(needsReconnect({ status: 'error', error_code: 'INSTITUTION_DOWN' })).toBe(false); // transient
    expect(needsReconnect({ status: 'active', error_code: 'ITEM_LOGIN_REQUIRED' })).toBe(false); // healed
  });
  it('the key changes once a week, on the New York Monday', () => {
    expect(weekET(new Date('2026-09-06T23:00:00Z'))).toBe('2026-08-31'); // Sunday 7 PM ET
    expect(weekET(new Date('2026-09-08T03:30:00Z'))).toBe('2026-09-07'); // Monday 11:30 PM ET is still Monday, and Monday starts its own week
    expect(weekET(new Date('2026-09-08T12:30:00Z'))).toBe('2026-09-07'); // Tuesday morning ET
    expect(reconnectKey('item-1', new Date('2026-09-08T12:30:00Z'))).toBe('reconnect:item-1:2026-09-07');
  });
});

describe('voice: connectionNeedsLogin', () => {
  it('names the institution the way a person does, with the date it stopped', () => {
    expect(shortInstitution('Edward Jones - U.S. Clients Access')).toBe('Edward Jones');
    expect(shortInstitution('Charles Schwab')).toBe('Charles Schwab');
    const m = connectionNeedsLogin({ itemId: 'item-1', institution: 'Edward Jones - U.S. Clients Access', since: '2026-08-09' });
    expect(m.title).toBe('Edward Jones needs a new login');
    expect(m.body).toBe('Your Edward Jones connection stopped updating on 2026-08-09. Tap to reconnect.');
    expect(m.route).toBe('reconnect');
    expect(m.id).toBe('item-1');
    expect(m.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(m.body.length).toBeLessThanOrEqual(BODY_MAX);
    expect(m.body).not.toMatch(/—/);
  });
  it('survives an unnamed institution and a missing date', () => {
    const m = connectionNeedsLogin({ itemId: 'item-2', institution: null });
    expect(m.title).toBe('A brokerage needs a new login');
    expect(m.body).toBe('Your brokerage connection stopped updating. Tap to reconnect.');
  });
});

// A fake supabase: from(table).select().neq().not() and .eq().maybeSingle() over fixed rows.
function fakeDb(rows: Record<string, unknown>[]) {
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    const self = new Proxy(c, {
      get(_t, prop: string) {
        if (prop === 'then') return (res: (v: unknown) => void) => res({ data: rows, error: null });
        if (prop === 'maybeSingle') return () => Promise.resolve({ data: rows[0] ?? null, error: null });
        return () => self;
      },
    });
    return self;
  };
  return { from: () => chain() };
}
const item = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'item-1', user_id: 'u1', institution_name: 'Edward Jones - U.S. Clients Access', status: 'login_required',
  error_code: 'ITEM_LOGIN_REQUIRED', last_holdings_sync: '2026-08-09T13:16:00Z', ...over,
});

describe('nudge-reconnect', () => {
  beforeEach(() => { sendPush.mockReset(); liveTokenUsers.mockReset(); sendPush.mockResolvedValue({ sent: 1 }); });

  it('the webhook path pushes the one item with a weekly key', async () => {
    const { nudgeReconnect } = await import('@/lib/plaid/nudge-reconnect');
    const r = await nudgeReconnect(fakeDb([item()]) as never, 'item-1', new Date('2026-09-08T12:30:00Z'));
    expect(r).toEqual({ sent: 1 });
    expect(sendPush).toHaveBeenCalledTimes(1);
    const [, userId, kind, message, keys] = sendPush.mock.calls[0];
    expect(userId).toBe('u1');
    expect(kind).toBe('reconnect');
    expect((message as { title: string }).title).toBe('Edward Jones needs a new login');
    expect(keys).toEqual(['reconnect:item-1:2026-09-07']);
  });
  it('a transient error is not a reconnect case', async () => {
    const { nudgeReconnect } = await import('@/lib/plaid/nudge-reconnect');
    const r = await nudgeReconnect(fakeDb([item({ status: 'error', error_code: 'INSTITUTION_DOWN' })]) as never, 'item-1');
    expect(r.sent).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });
  it('the daily pass skips owners without a phone and items without a code', async () => {
    const { nudgeReconnects } = await import('@/lib/plaid/nudge-reconnect');
    liveTokenUsers.mockResolvedValue(new Set(['u1']));
    const rows = [item(), item({ id: 'item-2', user_id: 'u2' }), item({ id: 'item-3', error_code: null })];
    const log: string[] = [];
    const n = await nudgeReconnects(fakeDb(rows) as never, log);
    expect(n).toBe(1);
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush.mock.calls[0][1]).toBe('u1');
    expect(log).toEqual(['[reconnect] Edward Jones - U.S. Clients Access: pushed']);
  });
});
