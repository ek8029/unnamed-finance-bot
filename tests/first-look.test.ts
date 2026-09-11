import { describe, it, expect } from 'vitest';
import { FIRST_LOOK_CODES, parseFirstLook, orderRevealCards } from '@/lib/onboarding/first-look';
import { WRITABLE_PREFERENCE_FIELDS } from '@/lib/preference-fields';

describe('parseFirstLook', () => {
  it('accepts only known codes, deduplicated, in the given order', () => {
    expect(parseFirstLook(['receipts', 'exposure', 'receipts'])).toEqual(['receipts', 'exposure']);
  });
  it('rejects unknown codes and non-arrays', () => {
    expect(parseFirstLook(['tlh'])).toBeNull();
    expect(parseFirstLook('exposure')).toBeNull();
    expect(parseFirstLook([1])).toBeNull();
  });
  it('accepts the empty set (skipped) as an empty array', () => {
    expect(parseFirstLook([])).toEqual([]);
  });
  it('offers the four that always apply before the one that needs two accounts', () => {
    expect([...FIRST_LOOK_CODES]).toEqual(['exposure', 'receipts', 'changes', 'brief', 'overlap']);
  });

  it('accepts brief, which migration 079 added to the column constraint', () => {
    expect(parseFirstLook(['brief', 'exposure'])).toEqual(['brief', 'exposure']);
  });
});

describe('orderRevealCards', () => {
  it('default order with no answer', () => {
    expect(orderRevealCards(null, 1)).toEqual(['exposure', 'receipts']);
  });
  it('chosen card first, changes adds a third card', () => {
    expect(orderRevealCards(['changes'], 1)).toEqual(['changes', 'exposure', 'receipts']);
    expect(orderRevealCards(['receipts'], 1)).toEqual(['receipts', 'exposure']);
  });
  it('overlap only counts with two or more accounts and swaps the exposure sentence, not the card', () => {
    expect(orderRevealCards(['overlap'], 1)).toEqual(['exposure', 'receipts']);
    expect(orderRevealCards(['overlap'], 2)).toEqual(['exposure', 'receipts']);
  });
  it('several choices keep their order', () => {
    expect(orderRevealCards(['receipts', 'changes'], 1)).toEqual(['receipts', 'changes', 'exposure']);
  });
});

describe('first_look is writable through the preferences route', () => {
  it('is on the whitelist', () => {
    expect((WRITABLE_PREFERENCE_FIELDS as readonly string[]).includes('first_look')).toBe(true);
  });
});
