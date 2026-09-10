import { describe, it, expect } from 'vitest';
import { AGENT_LOG_COPY, AGENT_LOG_LINES, cadenceLabel, clockET, topSteps, updatesView } from '@/lib/agent/worklog-display';
import { hasAdviceLanguage } from '@/lib/investigation-memo';
import type { WorklogStep } from '@/lib/agent/worklog';

function step(id: string, ts: string | null, extra: Partial<WorklogStep> = {}): WorklogStep {
  return {
    id, ts: ts as string, kind: 'price', label: `did ${id}`, detail: null,
    href: '/dashboard', emphasis: false, cadence: '5 min', ...extra,
  } as WorklogStep;
}

describe('topSteps', () => {
  it('puts the newest line first', () => {
    const out = topSteps([
      step('a', '2026-09-09T14:00:00Z'),
      step('b', '2026-09-09T18:00:00Z'),
      step('c', '2026-09-09T16:00:00Z'),
    ]);
    expect(out.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('caps at the line budget and defaults to it', () => {
    const many = Array.from({ length: 12 }, (_, i) => step(`s${i}`, `2026-09-09T0${i % 10}:00:00Z`));
    expect(topSteps(many)).toHaveLength(AGENT_LOG_LINES);
    expect(topSteps(many, 2)).toHaveLength(2);
    expect(topSteps(many, 0)).toEqual([]);
  });

  it('keeps one line per id', () => {
    const out = topSteps([step('a', '2026-09-09T14:00:00Z'), step('a', '2026-09-09T15:00:00Z')]);
    expect(out).toHaveLength(1);
  });

  it('sorts a missing or unparsable time last rather than dropping the line', () => {
    const out = topSteps([step('none', null), step('real', '2026-09-09T14:00:00Z'), step('junk', 'not a date')]);
    expect(out.map((s) => s.id)[0]).toBe('real');
    expect(out).toHaveLength(3);
  });
});

describe('updatesView', () => {
  const steps = [
    step('a', '2026-09-09T14:00:00Z'),
    step('b', '2026-09-09T18:00:00Z'),
    step('c', '2026-09-09T16:00:00Z'),
  ];

  it('shows only the lines that arrived after the watermark, newest first', () => {
    const view = updatesView(steps, '2026-09-09T15:00:00Z');
    expect(view.lines.map((s) => s.id)).toEqual(['b', 'c']);
    expect(view.newCount).toBe(2);
    expect(view.note).toBe(`2 ${AGENT_LOG_COPY.newSuffix}`);
  });

  it('counts every new line even when more arrived than the card shows', () => {
    const many = Array.from({ length: 8 }, (_, i) => step(`s${i}`, `2026-09-09T1${i}:00:00Z`));
    const view = updatesView(many, '2026-09-09T09:00:00Z');
    expect(view.lines).toHaveLength(AGENT_LOG_LINES);
    expect(view.newCount).toBe(8);
    expect(view.note).toBe(`8 ${AGENT_LOG_COPY.newSuffix}`);
  });

  it('falls back to the most recent lines when nothing is new, and marks it', () => {
    const view = updatesView(steps, '2026-09-09T19:00:00Z');
    expect(view.lines.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(view.newCount).toBe(0);
    expect(view.note).toBe(AGENT_LOG_COPY.nothingNew);
  });

  // Before migration 078 is applied, and on a first visit, there is no mark.
  it('reads exactly as it did without a watermark when there is none', () => {
    const view = updatesView(steps, null);
    expect(view.lines).toEqual(topSteps(steps));
    expect(view.newCount).toBe(0);
    expect(view.note).toBe('');
  });

  it('treats an unparsable watermark as none rather than throwing', () => {
    expect(() => updatesView(steps, 'not a date')).not.toThrow();
    const view = updatesView(steps, 'not a date');
    expect(view.lines).toEqual(topSteps(steps));
    expect(view.newCount).toBe(0);
    expect(view.note).toBe('');
  });

  it('never calls a line new when its own time is missing or unparsable', () => {
    const view = updatesView([step('none', null), step('junk', 'not a date'), step('b', '2026-09-09T18:00:00Z')], '2026-09-09T15:00:00Z');
    expect(view.lines.map((s) => s.id)).toEqual(['b']);
    expect(view.newCount).toBe(1);
  });

  it('says nothing about novelty in the fallback line', () => {
    expect(AGENT_LOG_COPY.nothingNew.toLowerCase()).toContain('nothing new');
    expect(AGENT_LOG_COPY.nothingNew.toLowerCase()).not.toContain('just');
  });
});

describe('cadenceLabel', () => {
  it('reads as an adverb next to a past tense line', () => {
    expect(cadenceLabel('1 min')).toBe('every 1 min');
    expect(cadenceLabel('5 min')).toBe('every 5 min');
    expect(cadenceLabel('hourly')).toBe('hourly');
    expect(cadenceLabel('daily')).toBe('daily');
    expect(cadenceLabel('on event')).toBe('on event');
  });
});

describe('clockET', () => {
  it('prints market time, not the viewer or server zone', () => {
    // 18:30 UTC is 2:30 PM in New York on this date, daylight time.
    expect(clockET('2026-09-09T18:30:00Z')).toBe('2:30 PM');
  });

  it('is empty for a missing or unparsable stamp instead of printing NaN', () => {
    expect(clockET(null)).toBe('');
    expect(clockET(undefined)).toBe('');
    expect(clockET('not a date')).toBe('');
  });
});

describe('card copy', () => {
  const strings = Object.values(AGENT_LOG_COPY);

  it('carries no em dash and no exclamation mark', () => {
    for (const s of strings) expect(s).not.toMatch(/[—!]/);
  });

  it('never recommends anything', () => {
    for (const s of strings) expect(hasAdviceLanguage(s)).toBe(false);
  });

  it('names what Pro adds rather than implying the agent is off', () => {
    expect(AGENT_LOG_COPY.unlockWhy.toLowerCase()).toContain('pro');
  });
});
