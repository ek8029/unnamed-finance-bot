/**
 * Removing a Plaid item from our database, completely.
 *
 * This exists because there were two places that deleted a `plaid_items` row
 * and only one of them cleaned up after itself.
 *
 * `linked_accounts.plaid_item_ref` is declared
 * `REFERENCES plaid_items(id) ON DELETE SET NULL` (migration
 * 067_log_append_only_and_item_ref.sql line 15). It is NOT a cascade. Deleting
 * the item therefore nulls the reference and leaves the account row alive, and
 * because `holdings.account_id` cascades from `linked_accounts(id)` — a row
 * that still exists — the positions survive too. The account is then
 * unreachable by every sync (no item, so nothing fetches it) and unreachable by
 * the stale-position prune in lib/holdings-prune.ts, which only builds
 * keep-lists for accounts that appear in a Plaid response. The positions freeze
 * at whatever they last were and render forever.
 *
 * Measured 2026-09-21: 27 orphaned accounts across 3 users holding 91 frozen
 * positions worth $1,420,318, including a user who emailed in to report seeing
 * stock he had sold three months earlier.
 *
 * Call this instead of deleting a plaid_items row directly.
 */

/** The subset of the Supabase client this needs. Structural, so both the server
 *  client and the service client satisfy it without importing either, and a
 *  hand-written fake satisfies it in tests.
 *
 *  Terminals are PromiseLike, not Promise: a Postgrest builder is thenable but
 *  is not a Promise instance, so requiring Promise here rejects the real client. */
type Awaited<T> = PromiseLike<T>;
type Rows = { data: { id: string }[] | null; error: { message: string } | null };
type Written = { error: { message: string } | null };

export interface PurgeClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): Awaited<Rows>;
      };
    };
    delete(): {
      in(column: string, values: string[]): {
        eq(column: string, value: string): Awaited<Written>;
      };
      eq(column: string, value: string): {
        eq(column: string, value: string): Awaited<Written>;
      };
    };
  };
}

export interface PurgeResult {
  accountsRemoved: number;
  /** Tables that reported an error. The purge continues past a failure so one
   *  bad table cannot leave the item half-deleted, but the caller can log it. */
  failures: { table: string; message: string }[];
}

/**
 * Delete an item and everything hanging off it, in dependency order.
 *
 * Ordering matters: holdings and transactions reference `linked_accounts`, so
 * they go first. The item row goes last, because until it is gone its accounts
 * are still discoverable and a partial failure leaves a syncable connection
 * rather than an orphan.
 */
export async function purgePlaidItem(
  db: PurgeClient,
  userId: string,
  itemRowId: string,
): Promise<PurgeResult> {
  const failures: { table: string; message: string }[] = [];

  const { data: accounts, error: accountsError } = await db
    .from('linked_accounts')
    .select('id')
    .eq('plaid_item_ref', itemRowId)
    .eq('user_id', userId);

  if (accountsError) failures.push({ table: 'linked_accounts(select)', message: accountsError.message });

  const accountIds = (accounts ?? []).map(a => a.id);

  if (accountIds.length > 0) {
    // Positions and transactions belong to the accounts, not the item, and
    // nothing else can reach them once the accounts are gone.
    for (const table of ['holdings', 'transactions', 'investment_transactions']) {
      const { error } = await db.from(table).delete().in('account_id', accountIds).eq('user_id', userId);
      if (error) failures.push({ table, message: error.message });
    }
  }

  const { error: accountsDeleteError } = await db
    .from('linked_accounts')
    .delete()
    .eq('plaid_item_ref', itemRowId)
    .eq('user_id', userId);
  if (accountsDeleteError) failures.push({ table: 'linked_accounts', message: accountsDeleteError.message });

  const { error: itemError } = await db
    .from('plaid_items')
    .delete()
    .eq('id', itemRowId)
    .eq('user_id', userId);
  if (itemError) failures.push({ table: 'plaid_items', message: itemError.message });

  return { accountsRemoved: accountIds.length, failures };
}

/**
 * Is this account stranded? True when it came from Plaid but no longer points
 * at a live item, which means nothing will ever refresh or prune it.
 *
 * Read paths use this so that a future orphan is invisible the moment it
 * appears, rather than waiting for a repair. Manual accounts legitimately carry
 * no item reference and are never stranded.
 */
export function isStrandedPlaidAccount(
  account: { source?: string | null; plaid_item_ref?: string | null },
  liveItemIds: ReadonlySet<string>,
): boolean {
  if (account.source !== 'plaid') return false;
  if (!account.plaid_item_ref) return true;
  return !liveItemIds.has(account.plaid_item_ref);
}
