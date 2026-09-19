import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_CHANGE_KEY, clearAccountBrowserData, navigateAfterAuth, watchAccountChanges } from '@/lib/auth-navigation';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
let local: ReturnType<typeof storage>;
let session: ReturnType<typeof storage>;
let events: Map<string, (event: any) => void>;
const replace = vi.fn();
const reload = vi.fn();
beforeEach(() => {
  local = storage(); session = storage(); events = new Map();
  replace.mockReset(); reload.mockReset();
  vi.stubGlobal('localStorage', local); vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', { location: { replace, reload }, addEventListener: (key: string, fn: any) => events.set(key, fn), removeEventListener: (key: string) => events.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe('account boundary browser data', () => {
  it('drops account caches while retaining explicit opt-out, auth and purchase intent', () => {
    local.setItem('helm-settings', JSON.stringify({ analyticsEnabled: false, notifications: { email: false } }));
    local.setItem('helm_dismissed_alerts', '[{"insight":{"title":"private"}}]');
    local.setItem('sb-fixture-auth-token', 'token');
    session.setItem('helm_research_history', '[{"content":"private"}]');
    session.setItem('helm_demo_mode', '1');
    session.setItem('helm_pending_checkout', 'pro_annual');
    clearAccountBrowserData();
    expect(local.getItem('helm-settings')).toBeNull();
    expect(local.getItem('helm_dismissed_alerts')).toBeNull();
    expect(session.getItem('helm_research_history')).toBeNull();
    expect(session.getItem('helm_demo_mode')).toBeNull();
    expect(local.getItem('helm:analytics-enabled')).toBe('false');
    expect(local.getItem('sb-fixture-auth-token')).toBe('token');
    expect(session.getItem('helm_pending_checkout')).toBe('pro_annual');
  });
  it('starts a new document and announces a boundary without sending identity', () => {
    navigateAfterAuth('/dashboard?checkout=pro_annual');
    expect(replace).toHaveBeenCalledWith('/dashboard?checkout=pro_annual');
    expect(local.getItem(AUTH_CHANGE_KEY)).toMatch(/^[\da-f-]{36}$/i);
  });
  it('does not allow an external auth destination', () => {
    navigateAfterAuth('//evil.example');
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });
  it('still navigates when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
    vi.stubGlobal('sessionStorage', { removeItem() { throw Error('blocked'); } });
    navigateAfterAuth('/login');
    expect(replace).toHaveBeenCalledWith('/login');
  });
  it('clears another tab before reloading, without broadcasting a loop', () => {
    session.setItem('helm_research_history', 'private');
    const changed = vi.fn(() => { expect(session.getItem('helm_research_history')).toBeNull(); });
    const stop = watchAccountChanges(changed);
    events.get('storage')!({ key: 'unrelated' });
    expect(reload).not.toHaveBeenCalled();
    events.get('storage')!({ key: AUTH_CHANGE_KEY });
    expect(changed).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(local.getItem(AUTH_CHANGE_KEY)).toBeNull();
    stop(); expect(events.size).toBe(0);
  });
  it('refreshes a restored back-forward document but not an ordinary page load', () => {
    const changed = vi.fn(); watchAccountChanges(changed);
    events.get('pageshow')!({ persisted: false });
    expect(reload).not.toHaveBeenCalled();
    events.get('pageshow')!({ persisted: true });
    expect(changed).toHaveBeenCalledOnce(); expect(reload).toHaveBeenCalledOnce();
  });
});
