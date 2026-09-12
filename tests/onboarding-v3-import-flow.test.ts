import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { OnboardingFlowV3 } from '@/components/onboarding/v3/onboarding-flow-v3';
import { BookAsk } from '@/components/onboarding/v3/book-ask';
import { AccountLoop } from '@/components/onboarding/v3/account-loop';
import { FirstLookScreen } from '@/components/onboarding/v3/first-look';
import { BookReveal } from '@/components/onboarding/v3/book-reveal';

// Render the real flow and invoke its actual child callbacks. Only the hook
// scheduler and external child/network boundaries are controlled; no database
// mock or invented persistence success is used.
const h = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, effects: [] as (() => unknown)[],
  accounts: [] as { id: string; institution: string; account_type: string; source: 'plaid' | 'manual'; positions: number }[],
  capture: vi.fn(), refetch: vi.fn(), sync: vi.fn(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[index], (value: unknown) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = { current: initial };
      return h.slots[index];
    },
    useEffect: (effect: () => unknown) => { h.effects.push(effect); },
    useCallback: (callback: unknown) => callback,
  };
});
vi.mock('posthog-js', () => ({ default: { capture: h.capture } }));
vi.mock('@/lib/plaid/background-sync', () => ({ runBackgroundSync: h.sync }));
vi.mock('@/components/onboarding/v3/use-book', () => ({ useBook: () => ({ accounts: h.accounts, holdings: [], error: null, loading: false, refetch: h.refetch }) }));
vi.mock('@/components/onboarding/v3/book-ask', () => ({ BookAsk: () => null }));
vi.mock('@/components/onboarding/v3/account-loop', () => ({ AccountLoop: () => null }));
vi.mock('@/components/onboarding/v3/first-look', () => ({ FirstLookScreen: () => null }));
vi.mock('@/components/onboarding/v3/book-reveal', () => ({ BookReveal: () => null }));

type Element = React.ReactElement<Record<string, any>>;
function nodes(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function render() {
  h.cursor = 0;
  h.effects = [];
  return nodes(OnboardingFlowV3({ harness: true }));
}
function child(type: unknown) {
  const node = render().find((element) => element.type === type);
  expect(node).toBeDefined();
  return node!.props;
}
function retryButton() {
  return render().find((node) => node.type === 'button' && node.props.children === 'Retry import');
}

beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.effects = [];
  h.accounts = [];
  h.capture.mockClear();
  h.refetch.mockReset().mockResolvedValue(undefined);
  h.sync.mockReset();
  vi.stubGlobal('React', React);
});

describe('V3 real flow import callbacks', () => {
  it('does not name the wrong brokerage when a later import settles first', () => {
    child(BookAsk).onPlaidSuccess('item-one');
    h.accounts = [{ id: 'account-one', institution: 'Fidelity', account_type: 'brokerage', source: 'plaid', positions: 0 }];
    render();
    h.effects[1](); // Run the real fresh-account effect, retaining its FIFO labels.
    expect(child(AccountLoop).syncing).toBe('Fidelity');
    child(AccountLoop).onPlaidSuccess('item-two');
    h.accounts = [...h.accounts, { id: 'account-two', institution: 'Schwab', account_type: 'brokerage', source: 'plaid', positions: 0 }];
    render();
    h.effects[1]();
    child(AccountLoop).onPlaidSynced('synced', 'item-two');
    // The old FIFO now contains Schwab, but Fidelity is the pending item.
    const loop = child(AccountLoop);
    expect(loop.syncing).toBe('Your brokerage');
    loop.onContinue();
    expect(child(FirstLookScreen).syncing).toBe('Your brokerage');
    child(FirstLookScreen).onDone([]);
    expect(child(BookReveal).syncing).toBe('Your brokerage');
  });

  it.each(['failed', 'partial', 'timeout'] as const)('carries %s through the account screen and reveal', (result) => {
    const ask = child(BookAsk);
    ask.onPlaidSuccess('item-one');
    expect(child(AccountLoop).syncing).toBeTruthy();
    ask.onPlaidSynced(result, 'item-one');
    const loop = child(AccountLoop);
    expect(loop.syncing).toBeNull();
    expect(loop.importsIncomplete).toBe(true);
    expect(retryButton()).toBeDefined();
    expect(h.capture).toHaveBeenCalledWith('onb3_import_settled', { flow: 'v3', outcome: result });
    loop.onContinue();
    child(FirstLookScreen).onDone([]);
    expect(child(BookReveal).importsIncomplete).toBe(true);
    const back = render().find((node) => node.type === 'button' && node.props.children === 'Review or add positions');
    back!.props.onClick();
    expect(child(AccountLoop).onManualComplete).toBeTypeOf('function');
  });

  it('retries the failed item once, preserves another failure and avoids new account-added events', async () => {
    const ask = child(BookAsk);
    ask.onPlaidSuccess('item-one');
    ask.onPlaidSynced('failed', 'item-one');
    const loop = child(AccountLoop);
    loop.onPlaidSuccess('item-two');
    loop.onPlaidSynced('timeout', 'item-two');
    let finish!: (result: 'synced') => void;
    h.sync.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const retry = retryButton()!;
    retry.props.onClick();
    retry.props.onClick(); // Same rendered button, before React can disable it.
    expect(h.sync).toHaveBeenCalledTimes(1);
    expect(h.sync).toHaveBeenCalledWith({ itemId: 'item-one' });
    finish('synced');
    await Promise.resolve();
    expect(child(AccountLoop).importsIncomplete).toBe(true);
    expect(h.capture.mock.calls.filter(([event]) => event === 'onb3_account_added')).toHaveLength(2);
  });

  it('keeps successful imports ready and missing-item failures recoverable without an unsafe retry', () => {
    const ask = child(BookAsk);
    ask.onPlaidSuccess('item-one');
    ask.onPlaidSynced('synced', 'item-one');
    expect(child(AccountLoop).importsIncomplete).toBe(false);
    ask.onPlaidSuccess();
    ask.onPlaidSynced('failed');
    expect(child(AccountLoop).importsIncomplete).toBe(true);
    expect(retryButton()).toBeUndefined();
  });

  it('does not retry a failed import while another connection is pending', () => {
    const ask = child(BookAsk);
    ask.onPlaidSuccess('item-one');
    ask.onPlaidSynced('failed', 'item-one');
    const staleRetry = retryButton()!;
    child(AccountLoop).onPlaidSuccess('item-two');
    staleRetry.props.onClick();
    expect(h.sync).not.toHaveBeenCalled();
  });

  it('discards a stale retry result after the harness resets', async () => {
    const ask = child(BookAsk);
    ask.onPlaidSuccess('old-item');
    ask.onPlaidSynced('failed', 'old-item');
    let finish!: (result: 'failed') => void;
    h.sync.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    retryButton()!.props.onClick();
    render().find((node) => node.type === 'button' && node.props.children === 'Do this later')!.props.onClick();
    const restarted = child(BookAsk);
    restarted.onPlaidSuccess('new-item');
    restarted.onPlaidSynced('synced', 'new-item');
    finish('failed');
    await Promise.resolve();
    expect(child(AccountLoop).importsIncomplete).toBe(false);
    expect(retryButton()).toBeUndefined();
    expect(h.capture.mock.calls.filter(([event]) => event === 'onb3_import_settled')).toHaveLength(2);
  });
});
