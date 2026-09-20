import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as countMembers } from '@/app/api/founding-member-count/route';
import { GET as referral } from '@/app/api/waitlist/[code]/route';
import { POST as join } from '@/app/api/waitlist/route';

const m = vi.hoisted(() => ({ service: vi.fn(), anonymous: vi.fn(), calls: [] as unknown[][], results: [] as any[] }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: m.service, createClient: m.anonymous }));

beforeEach(() => {
  vi.clearAllMocks(); m.calls.length = 0; m.results.length = 0;
  // Models the intended grant boundary: public database clients cannot read
  // these tables. Query responses are fixtures, not an RLS emulator.
  m.anonymous.mockRejectedValue(new Error('permission denied'));
  m.service.mockImplementation(async () => ({ from(table: string) {
    const result = m.results.shift();
    if (!result) throw new Error('Unexpected query');
    m.calls.push(['from', table]);
    const q: any = {
      select: (...args: unknown[]) => { m.calls.push(['select', ...args]); return q; },
      eq: (...args: unknown[]) => { m.calls.push(['eq', ...args]); return q; },
      insert: (row: any) => {
        // Live information_schema + migration 018: these columns are NOT NULL.
        for (const key of ['email', 'referral_code', 'position']) {
          if (row[key] == null) throw new Error(`NOT NULL: ${key}`);
        }
        m.calls.push(['insert', row]); return q;
      },
      maybeSingle: async () => result,
      then: (resolve: (r: any) => unknown) => Promise.resolve(result).then(resolve),
    };
    return q;
  } }));
});

describe('public routes after private-table grants are removed', () => {
  it('returns only the founding aggregate through the server client', async () => {
    m.results.push({ count: 3, error: null });
    const res = await countMembers();
    expect(await res.json()).toEqual({ count: 3 });
    expect(m.anonymous).not.toHaveBeenCalled();
    expect(m.calls).toContainEqual(['select', '*', { count: 'exact', head: true }]);
    expect(m.calls).toContainEqual(['eq', 'billing_period', 'founding']);
  });
  it('returns referral summary without exposing email or other row fields', async () => {
    m.results.push({ data: { position: 2, referral_code: 'ABC234', email: 'private@example.test' } }, { count: 4 });
    const res = await referral(new Request('http://localhost'), { params: Promise.resolve({ code: 'abc234' }) });
    expect(await res.json()).toEqual({ position: 2, referral_code: 'ABC234', referral_count: 4 });
    expect(m.anonymous).not.toHaveBeenCalled();
    expect(m.calls).toContainEqual(['eq', 'referral_code', 'ABC234']);
  });
  it('keeps an existing waitlist entry usable without public table reads', async () => {
    m.results.push({ data: { position: 1, referral_code: 'ABC234' } }, { count: 0 });
    const res = await join(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: ' Fixture@example.test ' }) }));
    expect(await res.json()).toEqual({ position: 1, referral_code: 'ABC234', referral_count: 0, already_registered: true });
    expect(m.calls).toContainEqual(['eq', 'email', 'fixture@example.test']);
    expect(m.anonymous).not.toHaveBeenCalled();
  });
  it('supplies the required position on a new insert', async () => {
    m.results.push({ data: null }, { data: null }, { count: 6, error: null }, { data: { id: 'fixture-id' }, error: null });
    const res = await join(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'new@example.test' }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ position: 7, already_registered: false });
    expect(m.calls.find(c => c[0] === 'insert')?.[1]).toMatchObject({ email: 'new@example.test', position: 7 });
    expect(m.results).toHaveLength(0);
  });
  it('rejects invalid input before privileged database access', async () => {
    const res = await join(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'bad' }) }));
    expect(res.status).toBe(400);
    expect(m.service).not.toHaveBeenCalled();
  });
  it('does not insert when the position count fails', async () => {
    m.results.push({ data: null }, { data: null }, { count: null, error: { message: 'database unavailable' } });
    const res = await join(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'new@example.test' }) }));
    expect(res.status).toBe(500);
    expect(m.results).toHaveLength(0);
    expect(m.service).toHaveBeenCalledOnce();
    expect(m.calls.some(c => c[0] === 'insert')).toBe(false);
  });
});
