import { describe, expect, it } from 'vitest';
import { accountBalanceDisplay, accountConnectionState, summarizeAccountBalances } from '@/lib/accounts-presentation';

const account = (account_type: string, balance: number) => ({ account_type, balance, sync_status: 'healthy' });
const ready = { loading: false, error: false, syncing: false };

describe('account balance presentation', () => {
  it('adds statement credits and subtracts debt and overdrafts without changing API signs', () => {
    const rows = [account('brokerage', 12000), account('checking', -120), account('credit_card', 600), account('credit_card', -80), account('loan', 2500)];
    expect(summarizeAccountBalances(rows)).toEqual({ assets: 12000, owed: 3100, credits: 80, overdrafts: 120, net: 8860, unavailable: 0 });
  });
  it('labels positive liabilities as due, negative liabilities as credit, and keeps negative assets visible', () => {
    expect(accountBalanceDisplay(account('credit_card', 600))).toEqual({ amount: 600, suffix: 'due' });
    expect(accountBalanceDisplay(account('credit_card', -80))).toEqual({ amount: 80, suffix: 'credit' });
    expect(accountBalanceDisplay(account('checking', -120))).toEqual({ amount: -120, suffix: 'overdrawn' });
    expect(accountBalanceDisplay(account('loan', 0))).toEqual({ amount: 0, suffix: '' });
  });
  it('handles an empty book without inventing balances', () => {
    expect(summarizeAccountBalances([])).toEqual({ assets: 0, owed: 0, credits: 0, overdrafts: 0, net: 0, unavailable: 0 });
  });
  it('marks an unknown balance instead of presenting it as an observed zero', () => {
    const unknown = { ...account('checking', 0), balance: null };
    expect(accountBalanceDisplay(unknown)).toEqual({ amount: null, suffix: '' });
    expect(summarizeAccountBalances([unknown, account('brokerage', 500)])).toMatchObject({ net: 500, unavailable: 1 });
    expect(accountBalanceDisplay(account('checking', 0))).toEqual({ amount: 0, suffix: '' });
  });
});

describe('account connection presentation', () => {
  it('does not call manual accounts synced even if their stored status is healthy', () => {
    expect(accountConnectionState({ ...account('brokerage', 1000), source: 'manual' }, undefined, { ...ready, syncing: true })).toBe('manual');
  });
  it('requires current health evidence before claiming a connection', () => {
    const row = account('brokerage', 1000);
    expect(accountConnectionState(row, 'active', { ...ready, loading: true })).toBe('checking');
    expect(accountConnectionState(row, 'active', { ...ready, error: true })).toBe('unavailable');
    expect(accountConnectionState(row, undefined, ready)).toBe('unknown');
    expect(accountConnectionState(row, 'active', ready)).toBe('connected');
  });
  it('distinguishes connection errors from a refresh in progress', () => {
    expect(accountConnectionState(account('brokerage', 1000), 'login_required', ready)).toBe('attention');
    expect(accountConnectionState(account('brokerage', 1000), 'active', { ...ready, syncing: true })).toBe('syncing');
  });
});
