import { isLiabilityType } from '@/lib/account-balance';

export interface DisplayAccount {
  account_type: string;
  balance: number | null;
  source?: string;
  sync_status: string;
  last_synced_at?: string;
}

/** `/api/accounts` already chooses available/current balances. Keep its signs. */
export function summarizeAccountBalances(accounts: DisplayAccount[]) {
  let assets = 0;
  let owed = 0;
  let credits = 0;
  let overdrafts = 0;
  let unavailable = 0;
  for (const account of accounts) {
    if (account.balance == null || !Number.isFinite(account.balance)) { unavailable++; continue; }
    if (isLiabilityType(account.account_type)) {
      owed += Math.max(account.balance, 0);
      credits += Math.max(-account.balance, 0);
    } else {
      assets += Math.max(account.balance, 0);
      overdrafts += Math.max(-account.balance, 0);
    }
  }
  return { assets, owed, credits, overdrafts, net: assets + credits - owed - overdrafts, unavailable };
}

export function accountBalanceDisplay(account: Pick<DisplayAccount, 'account_type' | 'balance'>) {
  if (account.balance == null || !Number.isFinite(account.balance)) return { amount: null, suffix: '' };
  if (isLiabilityType(account.account_type)) {
    return { amount: Math.abs(account.balance), suffix: account.balance < 0 ? 'credit' : account.balance > 0 ? 'due' : '' };
  }
  return { amount: account.balance, suffix: account.balance < 0 ? 'overdrawn' : '' };
}

export type AccountConnectionState = 'manual' | 'checking' | 'unavailable' | 'attention' | 'syncing' | 'connected' | 'unknown';

export function accountConnectionState(
  account: DisplayAccount,
  healthStatus: string | undefined,
  options: { loading: boolean; error: boolean; syncing: boolean },
): AccountConnectionState {
  if (account.source === 'manual') return 'manual';
  if (options.loading) return 'checking';
  if (options.error) return 'unavailable';
  if ((healthStatus && healthStatus !== 'active') || ['error', 'login_required', 'reconnect'].includes(account.sync_status)) return 'attention';
  if (options.syncing || ['syncing', 'pending'].includes(account.sync_status)) return 'syncing';
  return healthStatus === 'active' ? 'connected' : 'unknown';
}
