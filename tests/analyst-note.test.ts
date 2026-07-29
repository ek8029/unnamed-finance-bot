import { describe, it, expect } from 'vitest';
import { weekStartOf } from '@/lib/research/analyst-note';
import { stripClosingRecap } from '@/lib/research/compose';

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

describe('stripClosingRecap', () => {
  it('drops a trailing Overall recap sentence', () => {
    expect(stripClosingRecap('AMD gained $43,001. Overall, your portfolio remains resilient.')).toBe(
      'AMD gained $43,001.',
    );
  });

  it('drops In summary / In conclusion closers', () => {
    expect(stripClosingRecap('The thesis weakened. In summary, watch the margins.')).toBe('The thesis weakened.');
    expect(stripClosingRecap('Two catches filed. In conclusion, a busy week.')).toBe('Two catches filed.');
  });

  it('leaves a mid-text Overall sentence alone', () => {
    const text = 'Overall exposure sits at 48%. The AAPL thesis weakened this week.';
    expect(stripClosingRecap(text)).toBe(text);
  });

  it('leaves clean text untouched', () => {
    const text = 'You could harvest $26,932 across 9 positions.';
    expect(stripClosingRecap(text)).toBe(text);
  });

  it('handles a recap that is the whole text', () => {
    expect(stripClosingRecap('Overall, a quiet week.')).toBe('');
  });
});
