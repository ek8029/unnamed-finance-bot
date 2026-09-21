import { describe, expect, it } from 'vitest';
import { purgePlaidItem, isStrandedPlaidAccount, type PurgeClient } from '../lib/plaid-item-purge';

const USER = 'd80b9593-96f3-478c-9d71-269928664eda';
const ITEM = '3f3e5c38-0000-4000-8000-000000000001';

type Call = { table: string; op: 'select' | 'delete'; column: string; value: string | string[] };

/**
 * Fake that records the shape of every call. Built from the real constraints:
 * `holdings.account_id` and `investment_transactions.account_id` are NOT NULL
 * references to `linked_accounts(id)` ON DELETE CASCADE (migrations 005 and
 * 039), and `linked_accounts.plaid_item_ref` is ON DELETE SET NULL (migration
 * 067). So deleting the item alone must leave the accounts and their positions
 * behind, which is exactly the bug this module exists to prevent.
 */
function fixture(opts: { accounts?: string[]; failOn?: string } = {}) {
  const accounts = opts.accounts ?? ['acct-1', 'acct-2'];
  const calls: Call[] = [];
  const err = (table: string) =>
    opts.failOn === table ? { message: `${table} exploded` } : null;

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              return {
                eq(_c2: string, _v2: string) {
                  calls.push({ table, op: 'select', column, value });
                  return Promise.resolve({
                    data: accounts.map(id => ({ id })),
                    error: err(`${table}(select)`),
                  });
                },
              };
            },
          };
        },
        delete() {
          return {
            in(column: string, values: string[]) {
              return {
                eq(_c2: string, _v2: string) {
                  calls.push({ table, op: 'delete', column, value: values });
                  return Promise.resolve({ error: err(table) });
                },
              };
            },
            eq(column: string, value: string) {
              return {
                eq(_c2: string, _v2: string) {
                  calls.push({ table, op: 'delete', column, value });
                  return Promise.resolve({ error: err(table) });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as PurgeClient;

  return { client, calls };
}

describe('purgePlaidItem', () => {
  it('removes the positions, the accounts and the item, in dependency order', async () => {
    const { client, calls } = fixture();
    const result = await purgePlaidItem(client, USER, ITEM);

    expect(result.failures).toEqual([]);
    expect(result.accountsRemoved).toBe(2);

    const deletes = calls.filter(c => c.op === 'delete').map(c => c.table);
    expect(deletes).toEqual([
      'holdings',
      'transactions',
      'investment_transactions',
      'linked_accounts',
      'plaid_items',
    ]);

    // Child rows must be gone before their parent account row.
    expect(deletes.indexOf('holdings')).toBeLessThan(deletes.indexOf('linked_accounts'));
    expect(deletes.indexOf('investment_transactions')).toBeLessThan(deletes.indexOf('linked_accounts'));
    // And the item goes last, so a partial failure leaves a syncable
    // connection rather than an orphan.
    expect(deletes[deletes.length - 1]).toBe('plaid_items');
  });

  it('deletes positions scoped to the accounts that belonged to the item', async () => {
    const { client, calls } = fixture({ accounts: ['acct-9'] });
    await purgePlaidItem(client, USER, ITEM);

    const holdings = calls.find(c => c.table === 'holdings' && c.op === 'delete');
    expect(holdings?.column).toBe('account_id');
    expect(holdings?.value).toEqual(['acct-9']);
  });

  it('never leaves the accounts behind, which a bare item delete would', async () => {
    const { client, calls } = fixture();
    await purgePlaidItem(client, USER, ITEM);

    const accountDelete = calls.find(c => c.table === 'linked_accounts' && c.op === 'delete');
    expect(accountDelete).toBeDefined();
    expect(accountDelete?.column).toBe('plaid_item_ref');
    expect(accountDelete?.value).toBe(ITEM);
  });

  it('skips the position deletes when the item had no accounts', async () => {
    const { client, calls } = fixture({ accounts: [] });
    const result = await purgePlaidItem(client, USER, ITEM);

    expect(result.accountsRemoved).toBe(0);
    expect(calls.some(c => c.table === 'holdings')).toBe(false);
    // The account and item deletes still run: an account row can exist with a
    // ref we failed to read, and the item must go regardless.
    expect(calls.some(c => c.table === 'plaid_items' && c.op === 'delete')).toBe(true);
  });

  it('collects a failure and still deletes the item', async () => {
    const { client, calls } = fixture({ failOn: 'holdings' });
    const result = await purgePlaidItem(client, USER, ITEM);

    expect(result.failures).toEqual([{ table: 'holdings', message: 'holdings exploded' }]);
    expect(calls.some(c => c.table === 'plaid_items' && c.op === 'delete')).toBe(true);
  });

  it('reports a failed account lookup rather than silently purging nothing', async () => {
    const { client } = fixture({ failOn: 'linked_accounts(select)' });
    const result = await purgePlaidItem(client, USER, ITEM);

    expect(result.failures.map(f => f.table)).toContain('linked_accounts(select)');
  });
});

describe('isStrandedPlaidAccount', () => {
  const live = new Set(['item-live']);

  it('treats a plaid account with no item reference as stranded', () => {
    expect(isStrandedPlaidAccount({ source: 'plaid', plaid_item_ref: null }, live)).toBe(true);
  });

  it('treats a plaid account pointing at a dead item as stranded', () => {
    expect(isStrandedPlaidAccount({ source: 'plaid', plaid_item_ref: 'item-gone' }, live)).toBe(true);
  });

  it('leaves a plaid account on a live item alone', () => {
    expect(isStrandedPlaidAccount({ source: 'plaid', plaid_item_ref: 'item-live' }, live)).toBe(false);
  });

  it('never strands a manual account, which legitimately has no item', () => {
    expect(isStrandedPlaidAccount({ source: 'manual', plaid_item_ref: null }, live)).toBe(false);
  });

  it('does not strand an account whose source is unset', () => {
    expect(isStrandedPlaidAccount({ plaid_item_ref: null }, live)).toBe(false);
  });
});
