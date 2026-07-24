import { describe, it, expect } from 'vitest';
import { ceilingForMembers, convergence, type ClusterItem, type Mechanism } from '@/lib/content/mechanism-cluster';

const item = (over: Partial<ClusterItem>): ClusterItem => ({
  id: Math.random().toString(36).slice(2),
  text: 'x',
  sourceClass: 'primary_news',
  evidenceClass: 'emerging',
  dateISO: '2026-07-01',
  ...over,
});

describe('ceilingForMembers (polarity-aware ladder)', () => {
  it('supporting-only mechanisms can never weaken, whatever the corroboration', () => {
    const { maxStatus, reason } = ceilingForMembers([
      item({ verdict: 'supports', sourceClass: 'company_filing' }),
      item({ verdict: 'supports', sourceClass: 'primary_news' }),
      item({ verdict: 'supports', sourceClass: 'analyst_opinion' }),
    ]);
    expect(maxStatus).toBe('watch');
    expect(reason).toContain('supporting');
  });

  it('neutral-only mechanisms sit at watch too', () => {
    expect(ceilingForMembers([item({ verdict: 'neutral' }), item({ verdict: 'neutral', sourceClass: 'company_filing' })]).maxStatus).toBe('watch');
  });

  it('mixed mechanism: ceiling computes from the contradicting members only', () => {
    // One contradicting news item + corroborating SUPPORT from a filing must
    // NOT read as two independent adverse classes.
    const { maxStatus } = ceilingForMembers([
      item({ verdict: 'contradicts', sourceClass: 'primary_news' }),
      item({ verdict: 'supports', sourceClass: 'company_filing' }),
    ]);
    expect(maxStatus).toBe('watch'); // single adverse class
  });

  it('two adverse classes with a primary still weaken', () => {
    const { maxStatus } = ceilingForMembers([
      item({ verdict: 'contradicts', sourceClass: 'primary_news' }),
      item({ verdict: 'contradicts', sourceClass: 'analyst_opinion' }),
      item({ verdict: 'supports', sourceClass: 'xbrl' }),
    ]);
    expect(maxStatus).toBe('weakening');
  });

  it('a severe SUPPORTING move cannot break a pillar; a severe contradicting one can', () => {
    expect(ceilingForMembers([item({ verdict: 'supports', severe: true })]).maxStatus).toBe('watch');
    expect(ceilingForMembers([item({ verdict: 'contradicts', severe: true })]).maxStatus).toBe('broken');
  });

  it('items without a verdict keep the old catch-only behaviour', () => {
    const { maxStatus } = ceilingForMembers([
      item({ sourceClass: 'primary_news' }),
      item({ sourceClass: 'analyst_opinion' }),
    ]);
    expect(maxStatus).toBe('weakening');
  });
});

describe('convergence', () => {
  const mech = (maxStatus: Mechanism['maxStatus']): Mechanism => ({
    label: 'm',
    items: [],
    sourceClasses: [],
    confirmations: 0,
    mentions: 0,
    firstSeen: '',
    lastSeen: '',
    maxStatus,
    ladderReason: '',
  });

  it('flags two or more independent adverse mechanisms', () => {
    expect(convergence([mech('weakening'), mech('weakening'), mech('watch')])).toEqual({
      converging: true,
      adverseMechanisms: 2,
    });
  });

  it('one adverse mechanism is not convergence, however loud', () => {
    expect(convergence([mech('broken'), mech('watch'), mech('watch')]).converging).toBe(false);
  });

  it('watch-only pillars never converge', () => {
    expect(convergence([mech('watch'), mech('watch')]).converging).toBe(false);
  });
});
