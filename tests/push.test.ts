// tests/push.test.ts
import { describe, it, expect } from 'vitest';
import { levelAllows, legacyAllows, parseLevel, inQuietHours, selectMoves, dayET, DAILY_CAP } from '@/lib/push/policy';
import { briefReady, positionMoved, reasonBroke, investigated, filingFinding, clip, firstSentence, TITLE_MAX, BODY_MAX } from '@/lib/push/voice';
import { isExpoPushToken } from '@/lib/push/expo';

describe('policy: levels and toggles', () => {
  it('each tier adds its kinds and never removes the tier below', () => {
    expect(levelAllows('off', 'brief')).toBe(false);
    expect(levelAllows('brief', 'brief')).toBe(true);
    expect(levelAllows('brief', 'move')).toBe(false);
    expect(levelAllows('matters', 'move')).toBe(true);
    expect(levelAllows('matters', 'breach')).toBe(true);
    expect(levelAllows('matters', 'filing')).toBe(false);
    expect(levelAllows('all', 'filing')).toBe(true);
    expect(parseLevel('garbage')).toBe('matters');
  });
  it('the legacy toggles still mean something', () => {
    expect(legacyAllows({ notification_daily_brief: false }, 'brief')).toBe(false);
    expect(legacyAllows({ notification_daily_brief: false }, 'move')).toBe(true);
    expect(legacyAllows({ notification_market_alerts: false }, 'breach')).toBe(false);
    expect(legacyAllows(null, 'breach')).toBe(true);
    expect(DAILY_CAP).toBe(6);
  });
  it('quiet hours are New York hours', () => {
    expect(inQuietHours(new Date('2026-09-08T03:30:00Z'))).toBe(true);  // 11:30 PM ET Monday
    expect(inQuietHours(new Date('2026-09-08T11:30:00Z'))).toBe(true);  // 7:30 AM ET
    expect(inQuietHours(new Date('2026-09-08T12:30:00Z'))).toBe(false); // 8:30 AM ET
    expect(inQuietHours(new Date('2026-09-08T20:00:00Z'))).toBe(false); // 4 PM ET
    expect(dayET(new Date('2026-09-08T03:30:00Z'))).toBe('2026-09-07');
  });
});

describe('policy: which moves are worth a push', () => {
  it('needs both a real move and a real share of the book', () => {
    const moves = selectMoves([
      { ticker: 'NVDA', pct: 0.032, dollars: 4100, weight: 0.19 },   // 0.6% of the book: yes
      { ticker: 'TINY', pct: 0.12, dollars: 40, weight: 0.001 },    // big move, no weight: no
      { ticker: 'BIG', pct: 0.015, dollars: 900, weight: 0.30 },    // weight, small move: no
      { ticker: 'AMD', pct: -0.024, dollars: -1900, weight: 0.25 }, // 0.6%: yes
      { ticker: 'NONE', pct: null, dollars: 0, weight: 0.1 },
    ]);
    expect(moves.map((m) => m.ticker)).toEqual(['NVDA', 'AMD']);
  });
  it('caps at what one push can say', () => {
    const rows = ['A', 'B', 'C', 'D', 'E'].map((t, i) => ({ ticker: t, pct: 0.05 + i * 0.01, dollars: 1000, weight: 0.2 }));
    expect(selectMoves(rows)).toHaveLength(3);
  });
});

describe('voice', () => {
  const noDash = (s: string) => expect(s).not.toMatch(/—/);
  it('speaks the dollar on their position, inside the caps', () => {
    const m = positionMoved([{ ticker: 'NVDA', pct: 0.032, dollars: 4100, weight: 0.19, contribution: 0.006 }], 0.02);
    expect(m.title).toBe('NVDA +3.2% today');
    expect(m.body).toBe('$4,100 on your position, +0.6% of your book.');
    expect(m.route).toBe('book');
    noDash(m.title); noDash(m.body);
    const many = positionMoved([
      { ticker: 'NVDA', pct: 0.032, dollars: 4100, weight: 0.19, contribution: 0.006 },
      { ticker: 'AMD', pct: -0.024, dollars: -1900, weight: 0.25, contribution: 0.006 },
    ]);
    expect(many.title).toBe('2 of your names moved');
    expect(many.body).toBe('NVDA +3.2% $4,100, AMD -2.4% $1,900.');
  });
  it('a broken reason names the ticker and the document', () => {
    const m = reasonBroke({ ticker: 'NVDA', claim: 'data-center margin holds above 70%', sourceTitle: 'The 10-Q', thesisId: 't1' });
    expect(m.title).toBe('NVDA: a reason stopped holding');
    expect(m.body.length).toBeLessThanOrEqual(BODY_MAX);
    expect(m.body).toContain('The 10-Q contradicts');
    expect(m.id).toBe('t1');
  });
  it('the brief push leads with findings when there are any, else the first sentence', () => {
    const a = briefReady('Your MU led the day. Then more.', []);
    expect(a.body).toBe('Your MU led the day.');
    const b = briefReady('x', [{ title: 'NVDA is 31% of the book' }, { title: '$4,120 harvestable across 3 lots.' }]);
    expect(b.title).toBe('Your brief is ready · 2 findings');
    expect(b.body).toBe('NVDA is 31% of the book. $4,120 harvestable across 3 lots.');
  });
  it('investigated and filing lines stay inside the caps and say what Helm did', () => {
    const i = investigated({ ticker: 'AMD', pct: -0.12, contradicts: false });
    expect(i.title).toBe('AMD fell 12.0% today');
    expect(i.body).toContain('I read it against your pillars');
    const f = filingFinding({ ticker: 'NVDA', form: '10-Q', verdict: 'mixed' });
    expect(f.title).toBe('NVDA 10-Q read');
    for (const m of [i, f]) { expect(m.title.length).toBeLessThanOrEqual(TITLE_MAX); expect(m.body.length).toBeLessThanOrEqual(BODY_MAX); }
  });
  it('clip cuts at a word and never leaves a dangling comma', () => {
    expect(clip('a'.repeat(50), 40).length).toBeLessThanOrEqual(40);
    expect(clip('NVDA moved, AMD moved, MU moved, INTC moved, TSM moved', 30)).toBe('NVDA moved, AMD moved, MU.');
    expect(firstSentence('It fell 3%. Then it rose.')).toBe('It fell 3%.');
  });
});

describe('expo token shape', () => {
  it('accepts Expo tokens only', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123-XYZ_9]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('apns:deadbeef')).toBe(false);
    expect(isExpoPushToken(42)).toBe(false);
  });
});
