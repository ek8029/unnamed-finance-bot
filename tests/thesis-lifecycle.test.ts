import { describe, it, expect } from 'vitest';
import { nextLifecycle } from '@/lib/thesis-lifecycle';

describe('nextLifecycle', () => {
  it('proposed + confirm without claim change -> confirmed', () => {
    expect(nextLifecycle('proposed', { confirmed: true, claimChanged: false })).toBe('confirmed');
  });
  it('proposed + confirm with claim change -> edited', () => {
    expect(nextLifecycle('proposed', { confirmed: true, claimChanged: true })).toBe('edited');
  });
  it('proposed + claim edit without confirm -> no transition', () => {
    expect(nextLifecycle('proposed', { claimChanged: true })).toBeNull();
  });
  it('confirmed pillar edits never regress lifecycle', () => {
    expect(nextLifecycle('confirmed', { confirmed: true, claimChanged: true })).toBeNull();
    expect(nextLifecycle('edited', { confirmed: true })).toBeNull();
  });
  it('dismissed never transitions via patch', () => {
    expect(nextLifecycle('dismissed', { confirmed: true })).toBeNull();
  });
});
