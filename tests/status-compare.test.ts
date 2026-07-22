import { describe, it, expect } from 'vitest';
import { comparePillar, ladderCeilingForPillar } from '@/lib/content/status-compare';
import { clusterByMechanism } from '@/lib/content/mechanism-cluster';
import type { ScoredCatch } from '@/lib/content/scoring-thesis';

const NOW = new Date('2026-07-22T00:00:00Z');
const recent = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86400_000).toISOString();

function against(
  id: string,
  text: string,
  sourceClass: ScoredCatch['sourceClass'],
  rawSourceType: string,
  daysAgo = 5,
  evidenceClass: ScoredCatch['evidenceClass'] = 'speculative',
): ScoredCatch {
  return {
    id,
    text,
    sourceClass,
    evidenceClass,
    dateISO: recent(daysAgo).slice(0, 10),
    verdict: 'contradicts',
    materiality: 'material',
    title: text,
    excerpt: text,
    why: '',
    whatItMeans: '',
    consider: null,
    url: `https://example.com/${id}`,
    copies: 1,
    sourceKey: `https://example.com/${id}`,
    rawSourceType,
    isBackfill: false,
    createdAt: recent(daysAgo),
  };
}

const supports = (c: ScoredCatch): ScoredCatch => ({ ...c, verdict: 'supports' });

describe('comparePillar', () => {
  it('holds down a pillar the shipped engine escalated on repetition alone', () => {
    // One analyst note, five outlets. Five distinct URLs, so the shipped engine
    // sees five independent material contradictions and calls it weakening.
    const catches = Array.from({ length: 5 }, (_, i) =>
      against(`n${i}`, 'Google TPU substitution threatens accelerator share', 'analyst_opinion', 'news'),
    );
    const r = comparePillar(catches, clusterByMechanism(catches), NOW);
    expect(r.shipped).toBe('weakening');
    expect(r.shippedIndependent).toBe(5);
    expect(r.v2Confirmations).toBe(1);
    expect(r.v2).toBe('intact');
    expect(r.changed).toBe(true);
  });

  it('leaves a genuinely corroborated contradiction alone', () => {
    const catches = [
      against('a', 'Google TPU substitution cuts accelerator orders', 'analyst_opinion', 'news'),
      against('b', 'Google TPU substitution disclosed in quarterly filing', 'company_filing', 'filing'),
    ];
    const r = comparePillar(catches, clusterByMechanism(catches), NOW);
    expect(r.shipped).toBe('broken'); // two independent, one primary
    expect(r.ceiling).toBe('weakening');
    expect(r.v2).toBe('weakening');
  });

  it('never pushes a status up, only holds it down', () => {
    const catches = [
      against('a', 'Margin collapse confirmed in filing', 'company_filing', 'filing', 5, 'realized'),
      against('b', 'Margin collapse widely reported', 'primary_news', 'news', 4, 'realized'),
    ];
    const r = comparePillar(catches, clusterByMechanism(catches), NOW);
    expect(r.ceiling).toBe('broken');
    // Ceiling allows broken, but the ladder can only cap, so v2 tracks shipped.
    expect(r.v2).toBe(r.shipped);
  });

  it('reports unverified when nothing live has landed', () => {
    const backfilled = { ...against('a', 'x', 'analyst_opinion', 'news'), isBackfill: true };
    const r = comparePillar([backfilled], clusterByMechanism([backfilled]), NOW);
    expect(r.shipped).toBe('unverified');
    expect(r.changed).toBe(false);
  });

  it('says both engines agree when nothing contradicts', () => {
    const catches = [supports(against('a', 'Revenue grew strongly', 'company_filing', 'filing'))];
    const r = comparePillar(catches, clusterByMechanism(catches), NOW);
    expect(r.shipped).toBe('intact');
    expect(r.changed).toBe(false);
  });
});

describe('ladderCeilingForPillar', () => {
  it('ignores mechanisms carrying only supporting evidence', () => {
    const catches = [
      supports(against('a', 'Blackwell ramp ahead of plan per filing', 'company_filing', 'filing')),
      supports(against('b', 'Blackwell ramp ahead of plan reported widely', 'primary_news', 'news')),
    ];
    const r = ladderCeilingForPillar(clusterByMechanism(catches));
    expect(r.ceiling).toBe('watch');
  });

  it('takes the strongest contradicting mechanism, not the loudest', () => {
    const loud = Array.from({ length: 8 }, (_, i) =>
      against(`loud${i}`, 'Valuation Multiple looks stretched to bearish desks', 'analyst_opinion', 'news'),
    );
    const real = [
      against('r1', 'Nvidia Guidance withdrawn in the current report', 'company_filing', 'filing'),
      against('r2', 'Nvidia Guidance withdrawal confirmed on the wire', 'primary_news', 'news'),
    ];
    const r = ladderCeilingForPillar(clusterByMechanism([...loud, ...real]));
    expect(r.ceiling).toBe('weakening');
    expect(r.confirmations).toBe(2);
  });
});
