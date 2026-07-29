import { describe, it, expect } from 'vitest';
import { weekStartOf } from '@/lib/research/analyst-note';

describe('weekStartOf', () => {
  it('returns the same Monday for a Monday', () => {
    expect(weekStartOf(new Date('2026-07-27T15:00:00Z'))).toBe('2026-07-27');
  });

  it('maps mid-week to the preceding Monday', () => {
    expect(weekStartOf(new Date('2026-07-29T04:00:00Z'))).toBe('2026-07-27');
    expect(weekStartOf(new Date('2026-07-31T23:59:00Z'))).toBe('2026-07-27');
  });

  it('maps Sunday back to the Monday six days earlier', () => {
    expect(weekStartOf(new Date('2026-08-02T12:00:00Z'))).toBe('2026-07-27');
  });

  it('crosses month boundaries', () => {
    expect(weekStartOf(new Date('2026-08-01T00:00:00Z'))).toBe('2026-07-27');
  });
});
