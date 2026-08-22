// tests/notify-material.test.ts
//
// The threshold and the key are the two things that decide whether Helm is
// worth listening to. Get the threshold wrong and people unsubscribe; get the
// key wrong and they get the same sentence every morning until they do.
import { describe, it, expect } from 'vitest';
import {
  normalizeFact,
  notifyKeyFor,
  selectMaterial,
  type NotifiableInsight,
} from '@/lib/notify/material';
import { MAX_AGE_DAYS } from '@/lib/notify/material';
import { wantsAlerts } from '@/lib/notify/preferences';
import { materialEventsBlock, tidyAmounts } from '@/lib/emails/templates';

/** Fixed clock. Every age assertion is relative to this. */
const NOW = Date.parse('2026-08-22T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function insight(over: Partial<NotifiableInsight> = {}): NotifiableInsight {
  return {
    id: 'i1',
    user_id: 'u1',
    created_at: daysAgo(0),
    insight_type: 'tax',
    priority: 'high',
    title: '$62,745.4 tax-loss harvesting opportunity',
    description: 'Losses across 4 positions could offset gains this year.',
    estimated_impact_amount: 62745.4,
    related_entity_type: 'holding',
    related_entity_ids: ['h1'],
    is_dismissed: false,
    is_archived: false,
    ...over,
  };
}

describe('normalizeFact', () => {
  it('removes the parts that drift daily', () => {
    expect(normalizeFact('$62,745.4 tax-loss harvesting opportunity'))
      .toBe(normalizeFact('$62,801 tax-loss harvesting opportunity'));
    expect(normalizeFact('NVDA is 34% of your portfolio'))
      .toBe(normalizeFact('NVDA is 35.2% of your portfolio'));
  });
  it('keeps the parts that identify the fact', () => {
    expect(normalizeFact('NVDA is 34% of your portfolio'))
      .not.toBe(normalizeFact('AMD is 34% of your portfolio'));
  });
});

describe('notifyKeyFor', () => {
  it('is stable while only the dollar amount moves', () => {
    const a = notifyKeyFor(insight());
    const b = notifyKeyFor(insight({ title: '$62,801.9 tax-loss harvesting opportunity', estimated_impact_amount: 62801.9 }));
    expect(a).toBe(b);
  });
  it('survives the row being deleted and reinserted under a new id', () => {
    expect(notifyKeyFor(insight({ id: 'brand-new-row-id' }))).toBe(notifyKeyFor(insight()));
  });
  it('changes when the finding escalates, which earns one more announcement', () => {
    expect(notifyKeyFor(insight({ priority: 'critical' }))).not.toBe(notifyKeyFor(insight()));
  });
  it('changes when it is about a different holding', () => {
    expect(notifyKeyFor(insight({ related_entity_ids: ['h2'] }))).not.toBe(notifyKeyFor(insight()));
  });
  it('does not depend on the order the entity ids arrive in', () => {
    expect(notifyKeyFor(insight({ related_entity_ids: ['h2', 'h1'] })))
      .toBe(notifyKeyFor(insight({ related_entity_ids: ['h1', 'h2'] })));
  });
});

describe('selectMaterial', () => {
  it('announces critical and high portfolio findings', () => {
    const out = selectMaterial([
      insight({ id: 'a', priority: 'high', insight_type: 'tax' }),
      insight({ id: 'b', priority: 'critical', insight_type: 'portfolio', related_entity_ids: ['h9'] }),
    ], NOW);
    expect(out.map((e) => e.insightId).sort()).toEqual(['a', 'b']);
  });

  // Live rows, verbatim: "Other spending up 357%", "Government & Non Profit
  // spending up 193%". That is Plaid's category tree moving, not somebody's
  // money moving, and it is the fastest way to teach people to ignore Helm.
  it('never announces spending or credit, whatever the priority', () => {
    const out = selectMaterial([
      insight({ id: 'c', insight_type: 'spending', priority: 'high', title: 'Other spending up 357%' }),
      insight({ id: 'd', insight_type: 'credit', priority: 'critical' }),
    ], NOW);
    expect(out).toEqual([]);
  });

  it('leaves medium and low in the inbox', () => {
    expect(selectMaterial([insight({ priority: 'medium' }), insight({ priority: 'low' })], NOW)).toEqual([]);
  });

  it('respects dismissed, archived, snoozed and expired', () => {
    const now = NOW;
    const future = new Date(now + 86_400_000).toISOString();
    const past = new Date(now - 86_400_000).toISOString();
    expect(selectMaterial([insight({ is_dismissed: true })], now)).toEqual([]);
    expect(selectMaterial([insight({ is_archived: true })], now)).toEqual([]);
    expect(selectMaterial([insight({ snoozed_until: future })], now)).toEqual([]);
    expect(selectMaterial([insight({ expires_at: past })], now)).toEqual([]);
    // A snooze that has run out is live again.
    expect(selectMaterial([insight({ snoozed_until: past })], now)).toHaveLength(1);
  });

  it('says the same thing once even when two rows carry it', () => {
    const out = selectMaterial([
      insight({ id: 'a', title: '$62,745.4 tax-loss harvesting opportunity' }),
      insight({ id: 'b', title: '$62,801 tax-loss harvesting opportunity' }),
    ], NOW);
    expect(out).toHaveLength(1);
  });

  it('puts critical first, then the largest number', () => {
    const out = selectMaterial([
      insight({ id: 'small', priority: 'high', estimated_impact_amount: 100, related_entity_ids: ['h1'] }),
      insight({ id: 'big', priority: 'high', estimated_impact_amount: 90_000, related_entity_ids: ['h2'] }),
      insight({ id: 'crit', priority: 'critical', estimated_impact_amount: 5, related_entity_ids: ['h3'] }),
    ], NOW);
    expect(out.map((e) => e.insightId)).toEqual(['crit', 'big', 'small']);
  });
});

describe('the age gate', () => {
  // The live data is the argument. 18 of 24 qualifying rows were older than two
  // days and the oldest was 150: "$62,745 tax-loss harvesting opportunity" has
  // been true since March. A standing condition is not an event, and a notifier
  // switched on today must not announce five months of backlog.
  it('will not announce a finding that has been true for months', () => {
    expect(selectMaterial([insight({ created_at: daysAgo(150) })], NOW)).toEqual([]);
    expect(selectMaterial([insight({ created_at: daysAgo(66) })], NOW)).toEqual([]);
    expect(selectMaterial([insight({ created_at: daysAgo(MAX_AGE_DAYS + 1) })], NOW)).toEqual([]);
  });
  it('announces one that appeared today, or within the window', () => {
    expect(selectMaterial([insight({ created_at: daysAgo(0) })], NOW)).toHaveLength(1);
    expect(selectMaterial([insight({ created_at: daysAgo(MAX_AGE_DAYS - 1) })], NOW)).toHaveLength(1);
  });
  it('stays quiet when there is no timestamp at all', () => {
    // Silence is recoverable on the next run. Announcing a five month old
    // number is not.
    expect(selectMaterial([insight({ created_at: null })], NOW)).toEqual([]);
  });
});

describe('wantsAlerts', () => {
  it('treats never answered as opted in', () => {
    expect(wantsAlerts(null)).toBe(true);
    expect(wantsAlerts({})).toBe(true);
    expect(wantsAlerts({ notification_email: null, notification_market_alerts: null })).toBe(true);
  });
  it('honours the specific preference', () => {
    expect(wantsAlerts({ notification_market_alerts: false })).toBe(false);
  });
  it('lets the master switch win, which is what one-click unsubscribe sets', () => {
    expect(wantsAlerts({ notification_email: false, notification_market_alerts: true })).toBe(false);
  });
});

describe('tidyAmounts', () => {
  it('drops false precision from generated titles', () => {
    expect(tidyAmounts('$62,745.4 tax-loss harvesting opportunity'))
      .toBe('$62,745 tax-loss harvesting opportunity');
    expect(tidyAmounts('$160449.5 idle cash could be working harder'))
      .toBe('$160,450 idle cash could be working harder');
  });
  it('leaves text without figures alone', () => {
    expect(tidyAmounts('Earnings land this week for 3 positions'))
      .toBe('Earnings land this week for 3 positions');
  });
});

describe('materialEventsBlock', () => {
  // Helm sends ONE email a day. These findings are a block inside the morning
  // brief, never an email of their own: a dry run named ten recipients and nine
  // were already getting The Current from the same cron run.
  const events = [
    { priority: 'critical', title: 'NVDA is 34% of your portfolio', description: 'One position carries a third of the book.' },
    { priority: 'high', title: '$62,745.4 tax-loss harvesting opportunity', description: 'Losses across 4 positions.' },
  ];
  const block = materialEventsBlock(events)!;

  it('returns nothing when there is nothing to say, so the brief is unchanged', () => {
    expect(materialEventsBlock([])).toBeNull();
  });
  it('carries every finding in one block rather than one message each', () => {
    expect(block.html).toContain('NVDA is 34% of your portfolio');
    expect(block.html).toContain('$62,745 tax-loss harvesting opportunity');
    expect(block.text).toContain('$62,745 tax-loss harvesting opportunity');
  });
  it('counts what it is carrying', () => {
    expect(block.html).toContain('2 things in your book');
    expect(materialEventsBlock([events[0]])!.html).toContain('one thing in your book');
  });
  it('is a fragment, not a document: no envelope of its own', () => {
    expect(block.html).not.toContain('<!DOCTYPE');
    expect(block.html).not.toContain('<body');
  });
  it('copy contains no em dashes', () => {
    expect(block.text).not.toContain('—');
    expect(block.html).not.toContain('—');
  });
});
