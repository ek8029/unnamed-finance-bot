import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/transactions/route';
import { summarizeCashFlow } from '@/lib/cash-flow';

// The mock filters rows the way PostgREST does, so a query that forgets the
// constraint returns the wrong rows instead of passing:
// - eq/gte/lte/lt/gt on a column filter the table's rows;
// - eq on an embedded column ('account.account_type') removes PARENT rows only
//   when the embed is declared !inner; without it PostgREST keeps the row and
//   nulls the embed, so the mock keeps the row too;
// - count: 'exact' is the filtered count before range(); range() pages.
type Row = Record<string, unknown> & { account?: { account_type: string } | null };
const mocks = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, selects: [] as string[] }));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }) },
  from: (table: string) => {
    let select = '';
    let rows: Row[] = [...(mocks.tables[table] ?? [])];
    let window: [number, number] | null = null;
    let cap: number | null = null;
    const query = {
      select: (columns: string) => { select = columns; mocks.selects.push(`${table}: ${columns}`); return query; },
      eq: (column: string, value: unknown) => {
        if (column.startsWith('account.')) {
          const field = column.slice('account.'.length) as 'account_type';
          if (/linked_accounts!inner/.test(select)) rows = rows.filter((r) => r.account?.[field] === value);
          return query;
        }
        rows = rows.filter((r) => r[column] === value);
        return query;
      },
      gt: (column: string, value: number) => { rows = rows.filter((r) => Number(r[column]) > value); return query; },
      lt: (column: string, value: number) => { rows = rows.filter((r) => Number(r[column]) < value); return query; },
      not: () => query, in: () => query, or: () => query, ilike: () => query, is: () => query,
      gte: () => query, lte: () => query,
      order: (column: string, options?: { ascending?: boolean }) => {
        const ascending = options?.ascending ?? true; // PostgREST's default
        rows.sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
        return query;
      },
      range: (from: number, to: number) => { window = [from, to]; return query; },
      limit: (n: number) => { cap = n; return query; },
      overrideTypes: () => query, // types only; no runtime effect in postgrest-js
      then: (resolve: (value: unknown) => void) => {
        const count = rows.length;
        let data = window ? rows.slice(window[0], window[1] + 1) : rows;
        if (cap != null) data = data.slice(0, cap);
        resolve({ data, error: null, count });
      },
    };
    return query;
  },
}) }));

const card = { account_name: 'Card', account_type: 'credit_card', institution: { name: 'Bank' } };
const brokerage = { account_name: 'Brokerage', account_type: 'brokerage', institution: { name: 'Broker' } };
const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

beforeEach(() => {
  mocks.selects = [];
  // 30 card purchases, all newer than any trade, one brokerage dividend filed
  // as a bank transaction, and 10 trades.
  mocks.tables = {
    transactions: [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `card-${i}`, user_id: 'fixture-user', amount: -5, transaction_date: day(28),
        description: 'Coffee', category_name: 'FOOD_AND_DRINK', account: card,
      })),
      { id: 'div-1', user_id: 'fixture-user', amount: 12, transaction_date: day(3),
        description: 'Dividend', category_name: 'Dividend Income', account: brokerage },
    ],
    investment_transactions: Array.from({ length: 10 }, (_, i) => ({
      id: `trade-${i}`, user_id: 'fixture-user', amount: -100, transaction_date: day(10 + i),
      name: 'Buy', ticker: 'NVDA', transaction_type: 'buy', quantity: 1, price: 100, account: brokerage,
    })),
    linked_accounts: [],
  };
});

const read = async (query: string) => {
  const response = await GET(new Request(`https://helm.test/api/transactions?${query}`));
  expect(response.status).toBe(200);
  return response.json() as Promise<{ transactions: { id: string }[]; pagination: { total: number }; summary: Record<string, number> }>;
};

it('without kind, card rows still fill the page ahead of trades (web behaviour unchanged)', async () => {
  const body = await read('limit=20');
  expect(body.transactions).toHaveLength(20);
  expect(body.transactions.every((t) => t.id.startsWith('card-'))).toBe(true);
  expect(mocks.selects.some((s) => s.startsWith('transactions:') && s.includes('linked_accounts!inner'))).toBe(false);
});

it('kind=investment applies the limit to the investment surface: every trade and the brokerage dividend, no card rows', async () => {
  const body = await read('limit=20&kind=investment');
  const ids = body.transactions.map((t) => t.id);
  expect(ids.filter((id) => id.startsWith('trade-'))).toHaveLength(10);
  expect(ids).toContain('div-1');
  expect(ids.some((id) => id.startsWith('card-'))).toBe(false);
  expect(body.pagination.total).toBe(11);
  // Newest first across both tables.
  expect(ids[0]).toBe('trade-9');
  expect(ids[ids.length - 1]).toBe('div-1');
  // The summary describes the same rows as the list: no card spending in it.
  const investmentRows = mocks.tables.investment_transactions as { amount: number; transaction_type: string }[];
  expect(body.summary).toMatchObject(summarizeCashFlow([{ amount: 12 }, ...investmentRows]));
  const everything = await read('limit=20');
  expect(everything.summary).not.toMatchObject(body.summary);
});

it('kind=investment still cuts to the limit, newest first', async () => {
  const body = await read('limit=4&kind=investment');
  expect(body.transactions.map((t) => t.id)).toEqual(['trade-9', 'trade-8', 'trade-7', 'trade-6']);
});

it('an unknown kind is ignored, like before the param existed', async () => {
  const body = await read('limit=20&kind=bank');
  expect(body.transactions.every((t) => t.id.startsWith('card-'))).toBe(true);
});
