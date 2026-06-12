// tests/thesis-status.test.ts
import { describe, it, expect } from 'vitest';
import { derivePillarStatus, type EvidenceForStatus } from '@/lib/thesis-status';

const NOW = new Date('2026-06-11T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400_000).toISOString();

function ev(overrides: Partial<EvidenceForStatus>): EvidenceForStatus {
  return {
    verdict: 'supports',
    materiality: 'context',
    source_type: 'news',
    source_key: 'https://example.com/a',
    is_backfill: false,
    created_at: daysAgo(1),
    ...overrides,
  };
}

describe('derivePillarStatus', () => {
  it('returns unverified with no evidence', () => {
    expect(derivePillarStatus([], null, NOW)).toBe('unverified');
  });

  it('returns unverified when only backfill evidence exists', () => {
    expect(derivePillarStatus([ev({ is_backfill: true })], null, NOW)).toBe('unverified');
  });

  it('returns intact with supporting evidence', () => {
    expect(derivePillarStatus([ev({})], null, NOW)).toBe('intact');
  });

  it('returns intact with only context-level contradiction', () => {
    expect(derivePillarStatus([ev({ verdict: 'contradicts', materiality: 'context' })], null, NOW)).toBe('intact');
  });

  it('returns weakening with 1 material contradiction in 30d', () => {
    expect(derivePillarStatus(
      [ev({ verdict: 'contradicts', materiality: 'material' })], null, NOW,
    )).toBe('weakening');
  });

  it('ignores material contradictions older than 30d', () => {
    expect(derivePillarStatus(
      [ev({ verdict: 'contradicts', materiality: 'material', created_at: daysAgo(31) })], null, NOW,
    )).toBe('intact');
  });

  it('returns broken with 2 independent material contradictions, one primary', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-001' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'news', source_key: 'https://example.com/b' }),
    ], null, NOW)).toBe('broken');
  });

  it('two news rewrites cannot break a thesis (no primary source)', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_key: 'https://a.com/1' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_key: 'https://b.com/2' }),
    ], null, NOW)).toBe('weakening');
  });

  it('same source_key twice is not independent', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-001' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-001' }),
    ], null, NOW)).toBe('weakening');
  });

  it('backfill contradictions never count toward status', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-1', is_backfill: true }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'form4', source_key: 'acc-2', is_backfill: true }),
      ev({}),
    ], null, NOW)).toBe('intact');
  });

  it('status_override wins over everything', () => {
    expect(derivePillarStatus([
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'filing', source_key: 'acc-1' }),
      ev({ verdict: 'contradicts', materiality: 'material', source_type: 'form4', source_key: 'acc-2' }),
    ], 'intact', NOW)).toBe('intact');
  });
});
