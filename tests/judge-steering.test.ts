// tests/judge-steering.test.ts
import { describe, it, expect } from 'vitest';
import { buildJudgeSteering, STEERING_CHAR_CAP } from '@/lib/judge-steering';

const P = (claim: string, override: string | null = null, at: string | null = null) => ({
  claim, status_override: override, status_changed_at: at,
});

describe('buildJudgeSteering', () => {
  it('empty when nothing overridden or dismissed', () => {
    expect(buildJudgeSteering([P('Margins expand')], [])).toBe('');
  });
  it('renders an override with date', () => {
    const out = buildJudgeSteering([P('Margins keep expanding', 'intact', '2026-07-05T12:00:00Z')], []);
    expect(out).toBe('Holder disagreed with our derived status and marked "Margins keep expanding" as intact (2026-07-05).');
  });
  it('renders dismissed drafts, capped at 3', () => {
    const out = buildJudgeSteering([], [
      { claim: 'Draft A' }, { claim: 'Draft B' }, { claim: 'Draft C' }, { claim: 'Draft D' },
    ]);
    expect(out.match(/dismissed/g)?.length).toBe(3);
    expect(out).not.toContain('Draft D');
  });
  it('hard-caps total length', () => {
    const long = 'A very long pillar claim about margins and datacenter growth that goes on and on';
    const out = buildJudgeSteering(
      Array.from({ length: 10 }, (_, i) => P(`${long} ${i}`, 'intact', '2026-07-01T00:00:00Z')),
      [],
    );
    expect(out.length).toBeLessThanOrEqual(STEERING_CHAR_CAP);
  });
  it('truncates long claims on word boundaries', () => {
    const out = buildJudgeSteering([P('Government revenue stays sticky across every allied procurement cycle through the decade', 'intact', null)], []);
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(160);
  });
});
