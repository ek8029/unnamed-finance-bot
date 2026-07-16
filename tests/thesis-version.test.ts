// tests/thesis-version.test.ts
import { describe, it, expect } from 'vitest';
import { isMaterialPillarPatch } from '@/lib/thesis-version';

describe('isMaterialPillarPatch', () => {
  it('claim change is material', () => {
    expect(isMaterialPillarPatch({ claim: 'new claim' }, true)).toBe(true);
  });
  it('claim key present but unchanged is not material', () => {
    expect(isMaterialPillarPatch({ claim: 'same claim' }, false)).toBe(false);
  });
  it('confirm-only is not material', () => {
    expect(isMaterialPillarPatch({ confirmed: true }, false)).toBe(false);
  });
  it('status override is not material', () => {
    expect(isMaterialPillarPatch({ status_override: 'intact' }, false)).toBe(false);
  });
  it('reorder is not material', () => {
    expect(isMaterialPillarPatch({ sort_order: 2 }, false)).toBe(false);
  });
});
