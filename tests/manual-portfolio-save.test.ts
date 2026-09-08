import { describe, expect, it } from 'vitest';
import { prepareManualSave, reconcileManualSave, persistManualSave, restoreManualSave, clearManualSave, MANUAL_SAVE_LOGIN_URL, type ManualHoldingRow } from '@/lib/manual-portfolio-save';
import { manualHoldingId } from '@/lib/manual-import';

const REQUEST_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row = (id: string, overrides: Partial<ManualHoldingRow> = {}): ManualHoldingRow => ({
  id, ticker: 'AAPL', shares: '1', costBasis: '', ...overrides,
});

describe('manual save validation', () => {
  it('allows entirely empty spare rows but never silently drops a partly entered position', () => {
    expect(prepareManualSave([row('complete'), row('empty', { ticker: '', shares: '' })], REQUEST_A).holdings).toHaveLength(1);
    for (const incomplete of [
      row('ticker-only', { shares: '' }),
      row('shares-only', { ticker: '' }),
      row('cost-only', { ticker: '', shares: '', costBasis: '15' }),
    ]) {
      expect(() => prepareManualSave([row('complete'), incomplete], REQUEST_A)).toThrow('Complete the ticker and shares for position 2');
    }
  });

  it('validates the full number and distinguishes unknown cost from an actual zero cost', () => {
    for (const shares of ['0', '-1', '2shares', 'Infinity', 'NaN']) {
      expect(() => prepareManualSave([row('invalid', { shares })], REQUEST_A)).toThrow('share count');
    }
    for (const costBasis of ['-1', '5dollars', 'Infinity', 'NaN']) {
      expect(() => prepareManualSave([row('invalid', { costBasis })], REQUEST_A)).toThrow('cost per share');
    }
    const request = prepareManualSave([row('unknown'), row('zero', { ticker: 'MSFT', costBasis: '0' })], REQUEST_A);
    expect(request.holdings[0]).not.toHaveProperty('costBasis');
    expect(request.holdings[1].costBasis).toBe(0);
  });

  it('rejects duplicate normalized tickers instead of pretending the schema supports separate manual lots', () => {
    expect(() => prepareManualSave([row('one'), row('two', { ticker: ' aapl ' })], REQUEST_A)).toThrow('Enter AAPL once');
  });

  it('preserves imported fractional shares and normalizes a valid class-share ticker', () => {
    expect(prepareManualSave([row('import', { ticker: ' brk.b ', shares: '1.125', costBasis: '421.0125' })], REQUEST_A).holdings)
      .toEqual([{ ticker: 'BRK.B', shares: 1.125, costBasis: 421.0125 }]);
  });
});

describe('manual save acknowledgement and retry boundaries', () => {
  it('keeps the submitted values and row order fixed when form/import rows later change', () => {
    const rows = [row('lot-one'), row('lot-two', { ticker: 'MSFT', shares: '2' })];
    const pending = prepareManualSave(rows, REQUEST_A);
    const firstBody = JSON.stringify({ requestId: pending.requestId, holdings: pending.holdings });
    rows[0].shares = '99';
    rows.reverse();
    expect(JSON.stringify({ requestId: pending.requestId, holdings: pending.holdings })).toBe(firstBody);
    expect(pending.rows.map(value => value.shares)).toEqual(['1', '2']);
    expect(manualHoldingId('user-a', pending.requestId, 0)).toBe(manualHoldingId('user-a', REQUEST_A, 0));
  });

  it('removes confirmed successes by row index so a corrected failed position cannot replay the successful one', () => {
    const first = prepareManualSave([row('lot-one'), row('lot-two', { ticker: 'MSFT', shares: '2' })], REQUEST_A);
    const partial = reconcileManualSave(first, { success: true, added: 1, failed: [{ ticker: 'MSFT', rowIndex: 1 }] });
    expect(partial.failedRows).toEqual([row('lot-two', { ticker: 'MSFT', shares: '2' })]);
    partial.failedRows[0].shares = '2.5';
    const next = prepareManualSave(partial.failedRows, REQUEST_B);
    expect(next.holdings).toEqual([{ ticker: 'MSFT', shares: 2.5 }]);
    expect(next.rows.map(value => value.id)).toEqual(['lot-two']);
    expect(manualHoldingId('user-a', next.requestId, 0)).not.toBe(manualHoldingId('user-a', first.requestId, 0));
    expect(manualHoldingId('user-a', next.requestId, 0)).not.toBe(manualHoldingId('user-a', first.requestId, 1));
  });

  it('does not unlock a new batch from an incomplete or ambiguous response; the original request remains replayable', () => {
    const pending = prepareManualSave([row('one'), row('two', { ticker: 'MSFT' })], REQUEST_A);
    const before = JSON.stringify(pending);
    for (const response of [
      null,
      { added: 2, failed: [] },
      { success: true, added: 1, failed: [] },
      { success: true, added: 1, failed: [{ ticker: 'AAPL' }] },
      { success: true, added: 1, failed: [{ ticker: 'AAPL', rowIndex: 2 }] },
      { success: true, added: 1, failed: [{ ticker: 'AAPL', rowIndex: 1 }] },
      { success: true, added: 0, failed: [{ ticker: 'MSFT', rowIndex: 1 }, { ticker: 'MSFT', rowIndex: 1 }] },
    ]) {
      expect(() => reconcileManualSave(pending, response)).toThrow('could not confirm');
      expect(JSON.stringify(pending)).toBe(before);
    }
    expect(reconcileManualSave(pending, { success: true, added: 2, failed: [] })).toEqual({ added: 2, failedRows: [], conflicts: [], duplicates: [] });
  });

  it('preserves explicit existing-position guidance in a fully acknowledged response', () => {
    const pending = prepareManualSave([row('existing')], REQUEST_A);
    expect(reconcileManualSave(pending, { success: true, added: 0, failed: [{ ticker: 'AAPL', rowIndex: 0, code: 'EXISTING_POSITION', retryable: false }] }))
      .toMatchObject({ added: 0, conflicts: ['AAPL'], duplicates: [] });
  });
});

describe('manual save recovery record', () => {
  function draftStorage() {
    const values = new Map<string, string>();
    return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  }

  it('restores only the authenticated owner and removes only that owner’s record', () => {
    const storage = draftStorage();
    const first = prepareManualSave([row('a')], REQUEST_A);
    const second = prepareManualSave([row('b', { ticker: 'MSFT' })], REQUEST_B);
    persistManualSave(storage, 'user-a', first);
    persistManualSave(storage, 'user-b', second);
    expect(restoreManualSave(storage, 'user-a')).toEqual(first);
    expect(restoreManualSave(storage, 'user-c')).toBeNull();
    expect(restoreManualSave(storage, '')).toBeNull();
    clearManualSave(storage, 'user-a');
    expect(restoreManualSave(storage, 'user-a')).toBeNull();
    expect(restoreManualSave(storage, 'user-b')).toEqual(second);
    expect(MANUAL_SAVE_LOGIN_URL).toBe('/login?redirect=%2Fdashboard%2Fportfolio%2Fadd');
  });

  it('rejects a corrupted payload or a record copied under another user’s key', () => {
    const storage = draftStorage();
    persistManualSave(storage, 'user-a', prepareManualSave([row('a')], REQUEST_A));
    const key = [...storage.values.keys()][0];
    const raw = storage.getItem(key)!;
    storage.setItem(key.replace('user-a', 'user-b'), raw);
    expect(() => restoreManualSave(storage, 'user-b')).toThrow('could not be read');
    const modified = JSON.parse(raw);
    modified.request.holdings[0].shares = 999;
    storage.setItem(key, JSON.stringify(modified));
    expect(() => restoreManualSave(storage, 'user-a')).toThrow('could not be read');
  });
});
