import { describe, it, expect } from 'vitest';
import { summarizePillars, type SummaryPillar } from '@/lib/thesis-summary';

const p = (over: Record<string, unknown>) => ({
  confirmed: true, status: 'intact', status_override: null, lifecycle: 'confirmed', ...over,
});

describe('summarizePillars', () => {
  it('counts confirmed pillars by effective status', () => {
    const s = summarizePillars([p({}), p({ status: 'weakening' }), p({ status: 'broken' })] as SummaryPillar[]);
    expect(s.confirmedCount).toBe(3);
    expect(s.statusCounts).toEqual({ intact: 1, weakening: 1, broken: 1, unverified: 0 });
    expect(s.worst).toBe('broken');
  });
  it('status_override wins over derived status', () => {
    const s = summarizePillars([p({ status: 'broken', status_override: 'intact' })] as SummaryPillar[]);
    expect(s.statusCounts.intact).toBe(1);
    expect(s.worst).toBe('intact');
  });
  it('unconfirmed proposed drafts count as drafts, not statuses', () => {
    const s = summarizePillars([p({ confirmed: false, lifecycle: 'proposed', status: 'unverified' })] as SummaryPillar[]);
    expect(s.confirmedCount).toBe(0);
    expect(s.draftCount).toBe(1);
    expect(s.worst).toBeNull();
  });
  it('dismissed pillars are ignored entirely', () => {
    const s = summarizePillars([p({ confirmed: false, lifecycle: 'dismissed' })] as SummaryPillar[]);
    expect(s.draftCount).toBe(0);
    expect(s.confirmedCount).toBe(0);
  });
  it('empty input -> null worst, zero counts', () => {
    const s = summarizePillars([]);
    expect(s.worst).toBeNull();
    expect(s.confirmedCount).toBe(0);
  });
});
