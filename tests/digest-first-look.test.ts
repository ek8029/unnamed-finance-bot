import { describe, expect, it, vi } from 'vitest';

// The pack's service client is lazy, so a bare import never touches Supabase. These three
// modules are the ones that would reach the network on import or on first call.
vi.mock('@/lib/financial-data', () => ({ getQuote: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/vix', () => ({ getVixQuote: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/earnings-edgar', () => ({ getEdgarEarnings: vi.fn().mockResolvedValue([]) }));

import { CAT_BONUS, FIRST_LOOK_BONUS, firstLookBonus } from '@/lib/digest/pack';

describe('firstLookBonus (spec 3.4: the first brief leads with the first-look choice)', () => {
  it('awards the bonus to a category the reader chose, on the first brief only', () => {
    expect(firstLookBonus('b', ['receipts'], true)).toBe(FIRST_LOOK_BONUS);
    expect(firstLookBonus('b', ['receipts'], false)).toBe(0);
  });

  it('awards nothing to a category outside the chosen set', () => {
    expect(firstLookBonus('e', ['receipts'], true)).toBe(0);
  });

  it('awards nothing when there is no preference (empty, null, or column missing)', () => {
    expect(firstLookBonus('a', [], true)).toBe(0);
    expect(firstLookBonus('a', null, true)).toBe(0);
    expect(firstLookBonus('a', undefined, true)).toBe(0);
  });

  it('maps overlap onto the weight-crossing category', () => {
    expect(firstLookBonus('a', ['overlap'], true)).toBe(FIRST_LOOK_BONUS);
  });

  it('is larger than the whole category spread, so a chosen item leads regardless of category', () => {
    expect(FIRST_LOOK_BONUS).toBeGreaterThan(Math.max(...Object.values(CAT_BONUS)));
  });
});
