import { describe, it, expect } from 'vitest';
import { AGENT_LOG_COPY, AGENT_LOG_LINES, cadenceLabel, clockET, topSteps, updatesView, withNovelty } from '@/lib/agent/worklog-display';
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

// Evan looked at a test account and the card reported work at 12:03 AM. True,
// because news-watch runs every 5 minutes and the judge queue every minute, but
// "Ran the risk scans across your book" is a true line that says nothing. A
// line earns a slot when it names a subject. The ids below are the real ones
// from lib/agent/worklog.ts.
describe('withNovelty', () => {
  const filing = (ts: string) => step('filing-0001234567-26-000123', ts, { kind: 'read' });

  it('drops the filing count once the filings themselves are listed', () => {
    const out = withNovelty([filing('2026-09-09T18:00:00Z'), step('read-filings', '2026-09-09T17:00:00Z', { kind: 'read' })]);
    expect(out.map((s) => s.id)).toEqual(['filing-0001234567-26-000123']);
  });

  it('keeps the filing count when no individual filing made the log', () => {
    const out = withNovelty([
      step('read-filings', '2026-09-09T17:00:00Z', { kind: 'read' }),
      step('news-42', '2026-09-09T16:00:00Z', { kind: 'read' }),
    ]);
    expect(out.map((s) => s.id)).toContain('read-filings');
  });

  it('drops the news count once the stories themselves are listed', () => {
    const out = withNovelty([
      step('news-42', '2026-09-09T18:00:00Z', { kind: 'read' }),
      step('read-news', '2026-09-09T17:00:00Z', { kind: 'read' }),
    ]);
    expect(out.map((s) => s.id)).toEqual(['news-42']);
  });

  it('keeps the news count when no individual story made the log', () => {
    const out = withNovelty([step('read-news', '2026-09-09T17:00:00Z', { kind: 'read' }), filing('2026-09-09T16:00:00Z')]);
    expect(out.map((s) => s.id)).toContain('read-news');
  });

  it('never gives the scan line a slot, whether or not it flagged anything', () => {
    const foundNothing = withNovelty([
      step('scan', '2026-09-09T04:03:00Z', { kind: 'scan' }),
      step('news-42', '2026-09-09T18:00:00Z', { kind: 'read' }),
    ]);
    expect(foundNothing.map((s) => s.id)).toEqual(['news-42']);

    const foundSomething = withNovelty([
      step('scan', '2026-09-09T04:03:00Z', { kind: 'scan' }),
      step('flag-7', '2026-09-09T04:03:00Z', { kind: 'flag', emphasis: true }),
    ]);
    expect(foundSomething.map((s) => s.id)).toEqual(['flag-7']);
  });

  it('never lets a sync displace a specific line', () => {
    const out = withNovelty([
      step('sync', '2026-09-09T18:00:00Z', { kind: 'sync' }),
      step('inv-9', '2026-09-09T17:00:00Z', { kind: 'flag', emphasis: true }),
    ]);
    expect(out.map((s) => s.id)).toEqual(['inv-9']);
  });

  it('keeps the sync when it is the only line left, so the card is not empty', () => {
    const out = withNovelty([
      step('sync', '2026-09-09T18:00:00Z', { kind: 'sync' }),
      step('scan', '2026-09-09T04:03:00Z', { kind: 'scan' }),
    ]);
    expect(out.map((s) => s.id)).toEqual(['sync']);
  });

  it('keeps an emphasised line even when its id is a generic one', () => {
    const out = withNovelty([
      step('scan', '2026-09-09T04:03:00Z', { kind: 'scan' }),
      step('read-news', '2026-09-09T17:00:00Z', { kind: 'read', emphasis: true }),
      step('news-42', '2026-09-09T18:00:00Z', { kind: 'read' }),
    ]);
    expect(out.map((s) => s.id)).toEqual(['read-news', 'news-42']);
  });

  it('leaves a log of specific lines alone, in order', () => {
    const specific = [
      filing('2026-09-09T18:00:00Z'),
      step('news-42', '2026-09-09T17:00:00Z', { kind: 'read' }),
      step('severe-3', '2026-09-09T16:00:00Z', { kind: 'flag', emphasis: true }),
      step('flag-7', '2026-09-09T15:00:00Z', { kind: 'flag', emphasis: true }),
      step('inv-9', '2026-09-09T14:00:00Z', { kind: 'flag', emphasis: true }),
    ];
    expect(withNovelty(specific)).toEqual(specific);
  });

  it('is empty only for an empty log', () => {
    expect(withNovelty([])).toEqual([]);
  });
});

describe('updatesView novelty', () => {
  it('filters the new-since-your-last-visit path and counts only survivors', () => {
    const view = updatesView([
      step('sync', '2026-09-09T18:05:00Z', { kind: 'sync' }),
      step('read-news', '2026-09-09T18:02:00Z', { kind: 'read' }),
      step('news-42', '2026-09-09T18:01:00Z', { kind: 'read' }),
      step('scan', '2026-09-09T18:00:00Z', { kind: 'scan' }),
    ], '2026-09-09T15:00:00Z');
    expect(view.lines.map((s) => s.id)).toEqual(['news-42']);
    // The number the card prints must match the lines the reader can see.
    expect(view.newCount).toBe(1);
    expect(view.note).toBe(`1 ${AGENT_LOG_COPY.newSuffix}`);
  });

  it('reads as nothing new when every new line only said a job ran', () => {
    const view = updatesView([
      step('scan', '2026-09-09T18:00:00Z', { kind: 'scan' }),
      step('news-42', '2026-09-08T12:00:00Z', { kind: 'read' }),
    ], '2026-09-09T15:00:00Z');
    expect(view.newCount).toBe(0);
    expect(view.note).toBe(AGENT_LOG_COPY.nothingNew);
    expect(view.lines.map((s) => s.id)).toEqual(['news-42']);
  });

  it('filters the most-recent fallback path too', () => {
    const view = updatesView([
      step('scan', '2026-09-09T18:00:00Z', { kind: 'scan' }),
      step('flag-7', '2026-09-09T17:00:00Z', { kind: 'flag', emphasis: true }),
    ], '2026-09-09T19:00:00Z');
    expect(view.lines.map((s) => s.id)).toEqual(['flag-7']);
  });

  it('filters when there is no watermark at all', () => {
    const view = updatesView([
      step('news-42', '2026-09-09T18:00:00Z', { kind: 'read' }),
      step('read-news', '2026-09-09T17:00:00Z', { kind: 'read' }),
    ], null);
    expect(view.lines.map((s) => s.id)).toEqual(['news-42']);
    expect(view.note).toBe('');
  });

  // AGENT_LOG_COPY.empty says nothing was recorded. Something was.
  it('never hands the card an empty list when the log had lines', () => {
    const logs = [
      [step('scan', '2026-09-09T18:00:00Z', { kind: 'scan' })],
      [step('sync', '2026-09-09T18:00:00Z', { kind: 'sync' }), step('scan', '2026-09-09T04:00:00Z', { kind: 'scan' })],
    ];
    for (const log of logs) {
      for (const mark of [null, '2026-09-09T15:00:00Z', '2026-09-09T19:00:00Z']) {
        expect(updatesView(log, mark).lines.length).toBeGreaterThan(0);
      }
    }
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
