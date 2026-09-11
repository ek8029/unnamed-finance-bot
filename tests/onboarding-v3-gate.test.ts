import { describe, expect, it, vi, beforeEach } from 'vitest';
import { decideV3Gate, deferredKey } from '@/lib/onboarding/v3-gate';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), activation: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('@/lib/activation-state', () => ({ readActivationState: mocks.activation }));

/** The gate as the component runs it: a status read, then this browser's store. */
function gate(store: Record<string, string>, status: { ok: boolean; userId?: string | null; hasSavedWork?: boolean }) {
  if (!status.ok) return decideV3Gate({ ok: false });
  const userId = typeof status.userId === 'string' && status.userId ? status.userId : null;
  return decideV3Gate({
    ok: true,
    hasSavedWork: !!status.hasSavedWork,
    deferred: !!userId && store[deferredKey(userId)] === '1',
  });
}

describe('onboarding v3 gate', () => {
  it('keys a deferral to the account, not the browser', () => {
    expect(deferredKey('user-a')).not.toBe(deferredKey('user-b'));
    expect(deferredKey('user-a')).toContain('user-a');
  });

  it('shows onboarding to a new account in a browser where someone else chose later', () => {
    // Evan's production bug: the harness or a "later" click in this browser
    // must not settle the next signup.
    const store = { [deferredKey('tester')]: '1' };
    expect(gate(store, { ok: true, userId: 'brand-new', hasSavedWork: false })).toBe('show');
  });

  it('still settles the account that chose later, in the same browser', () => {
    const store = { [deferredKey('tester')]: '1' };
    expect(gate(store, { ok: true, userId: 'tester', hasSavedWork: false })).toBe('settle');
  });

  it('never reads an unscoped legacy key', () => {
    const store = { helm_onboarding_v3_deferred: '1' };
    expect(gate(store, { ok: true, userId: 'brand-new', hasSavedWork: false })).toBe('show');
  });

  it('fails open when the status read is unavailable', () => {
    expect(gate({}, { ok: false })).toBe('show-unavailable');
    expect(decideV3Gate({ ok: false, hasSavedWork: true, deferred: true })).toBe('show-unavailable');
  });

  it('settles an account that already has a book, and records the deferral', () => {
    expect(gate({}, { ok: true, userId: 'has-book', hasSavedWork: true })).toBe('defer-and-settle');
  });

  it('reads saved work before this browser, so a book settles even with no key', () => {
    expect(decideV3Gate({ ok: true, hasSavedWork: true, deferred: false })).toBe('defer-and-settle');
  });

  it('shows onboarding when nothing is on record', () => {
    expect(gate({}, { ok: true, userId: 'brand-new', hasSavedWork: false })).toBe('show');
  });

  it('shows onboarding rather than settling when the body carries no account id', () => {
    expect(gate({ [deferredKey('tester')]: '1' }, { ok: true, userId: null, hasSavedWork: false })).toBe('show');
  });
});

describe('/api/onboarding/status', () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.activation.mockReset();
  });

  it("returns the caller's own id so a client can scope per-account state", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    mocks.activation.mockResolvedValue({ hasSavedWork: false, hasBrief: false, hasConnection: false });
    const { GET } = await import('@/app/api/onboarding/status/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-a');
    // The existing consumers keep reading their own fields.
    expect(body).toMatchObject({ hasSavedWork: false, hasBrief: false, hasConnection: false });
  });

  it('leaks no id to an unauthenticated caller', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { GET } = await import('@/app/api/onboarding/status/route');
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).not.toHaveProperty('userId');
  });
});
