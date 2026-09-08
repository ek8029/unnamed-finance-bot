import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/accounts/route';
import { reportedAccountBalance } from '@/lib/account-balance';
import { accountBalanceDisplay, summarizeAccountBalances } from '@/lib/accounts-presentation';

const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }) },
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, order: () => query, limit: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: table === 'linked_accounts' ? mocks.rows : [], error: null }),
    };
    return query;
  },
}) }));

beforeEach(() => { mocks.rows = []; });
it('carries a missing balance through API, display, and partial totals without inventing zero', async () => {
  mocks.rows = [null, 0, -100].map((balance, i) => ({
    id: `account-${i}`, account_type: i === 2 ? 'credit_card' : 'checking',
    account_name: 'Fixture account', current_balance: balance,
    account_subtype: 'checking', available_balance: null, sync_status: 'healthy',
  }));
  const response = await GET();
  expect(response.status).toBe(200);
  const { accounts } = await response.json();
  expect(accounts.map((a: { balance: number | null }) => a.balance)).toEqual([null, 0, -100]);
  expect(accountBalanceDisplay(accounts[0]).amount).toBeNull();
  expect(accountBalanceDisplay(accounts[1]).amount).toBe(0);
  expect(summarizeAccountBalances(accounts)).toMatchObject({ credits: 100, net: 100, unavailable: 1 });
});
it('uses available cash only for the established allowlist, never a credit limit', () => {
  expect(reportedAccountBalance({ account_type: 'checking', account_subtype: 'checking', current_balance: null, available_balance: 0 })).toBe(0);
  expect(reportedAccountBalance({ account_type: 'credit_card', current_balance: null, available_balance: 8000 })).toBeNull();
  expect(reportedAccountBalance({ account_type: 'brokerage', current_balance: null, available_balance: 2000 })).toBeNull();
  for (const invalid of [null, '', 'bad', Infinity]) expect(reportedAccountBalance({ account_type: 'checking', current_balance: invalid })).toBeNull();
});
