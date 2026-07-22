import { describe, it, expect } from 'vitest';
import {
  clusterByMechanism,
  ladderCeiling,
  salientEntities,
  type ClusterItem,
  type SourceClass,
  type EvidenceClass,
} from '@/lib/content/mechanism-cluster';

function item(
  id: string,
  text: string,
  sourceClass: SourceClass,
  evidenceClass: EvidenceClass = 'emerging',
  dateISO = '2026-07-01',
): ClusterItem {
  return { id, text, sourceClass, evidenceClass, dateISO };
}

describe('ladderCeiling', () => {
  it('caps a single source class at watch no matter how many times it repeats', () => {
    const classes: SourceClass[] = Array(10).fill('analyst_opinion');
    const r = ladderCeiling(classes, Array(10).fill('speculative'));
    expect(r.maxStatus).toBe('watch');
  });

  it('is the fix for three minor news outweighing one filing', () => {
    const threeNews = ladderCeiling(['primary_news', 'primary_news', 'primary_news'], ['emerging', 'emerging', 'emerging']);
    const oneFiling = ladderCeiling(['company_filing'], ['realized']);
    expect(threeNews.maxStatus).toBe('watch');
    expect(oneFiling.maxStatus).toBe('broken');
  });

  it('escalates to weakening on two independent classes including a primary', () => {
    const r = ladderCeiling(['company_filing', 'analyst_opinion'], ['emerging', 'emerging']);
    expect(r.maxStatus).toBe('weakening');
    expect(r.reason).toContain('primary');
  });

  it('holds at watch when corroboration exists but no source is primary', () => {
    const r = ladderCeiling(['analyst_opinion', 'price'], ['speculative', 'emerging']);
    expect(r.maxStatus).toBe('watch');
    expect(r.reason).toContain('no primary');
  });

  it('lets a realized change reach broken even from one class', () => {
    expect(ladderCeiling(['xbrl'], ['realized']).maxStatus).toBe('broken');
  });

  it('treats realized as the ceiling regardless of how thin the corroboration is', () => {
    const r = ladderCeiling(['company_filing'], ['speculative', 'realized']);
    expect(r.maxStatus).toBe('broken');
  });
});

describe('salientEntities', () => {
  it('keeps proper nouns and drops stopwords and wire-service names', () => {
    const e = salientEntities('The Company said Google and Broadcom expanded TPU supply, Reuters reported Monday');
    expect(e).toContain('Google');
    expect(e).toContain('Broadcom');
    expect(e).toContain('TPU');
    expect(e).not.toContain('The');
    expect(e).not.toContain('Reuters');
    expect(e).not.toContain('Monday');
  });

  it('dedupes repeats', () => {
    expect(salientEntities('Google Google Google')).toEqual(['Google']);
  });
});

describe('clusterByMechanism', () => {
  it('collapses one story reported by several outlets into a single mechanism', () => {
    const items = [
      item('a', 'Google expands TPU deployment across its fleet', 'primary_news'),
      item('b', 'Report: Google TPU order grows again', 'analyst_opinion'),
      item('c', 'Google TPU shift pressures accelerator demand', 'primary_news'),
    ];
    const clusters = clusterByMechanism(items);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].mentions).toBe(3);
    // Three articles, two independent classes -> two confirmations, not three.
    expect(clusters[0].confirmations).toBe(2);
  });

  it('keeps unrelated stories in separate mechanisms', () => {
    const clusters = clusterByMechanism([
      item('a', 'Google TPU deployment expands', 'primary_news'),
      item('b', 'Gross margin guidance trimmed on memory costs', 'company_filing'),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('does not let membership depend on input order', () => {
    const a = item('a', 'Google TPU supply expands', 'primary_news');
    const b = item('b', 'Google TPU orders rise', 'analyst_opinion');
    const c = item('c', 'Broadcom TPU partnership with Google deepens', 'primary_news');
    const forward = clusterByMechanism([a, b, c]).map((m) => m.mentions);
    const reverse = clusterByMechanism([c, b, a]).map((m) => m.mentions);
    expect(forward).toEqual(reverse);
  });

  it('ranks the best-corroborated mechanism first', () => {
    const clusters = clusterByMechanism([
      item('solo', 'Lawsuit filed over patent dispute', 'analyst_opinion'),
      item('a', 'Google TPU capacity expands sharply', 'primary_news'),
      item('b', 'Google TPU orders confirmed in filing', 'company_filing'),
    ]);
    expect(clusters[0].confirmations).toBe(2);
    expect(clusters[0].maxStatus).toBe('weakening');
    expect(clusters[1].maxStatus).toBe('watch');
  });

  it('reports first and last seen across the cluster', () => {
    const clusters = clusterByMechanism([
      item('a', 'Google TPU supply expands', 'primary_news', 'emerging', '2026-03-02'),
      item('b', 'Google TPU supply expands further', 'company_filing', 'emerging', '2026-07-15'),
    ]);
    expect(clusters[0].firstSeen).toBe('2026-03-02');
    expect(clusters[0].lastSeen).toBe('2026-07-15');
    expect(clusters[0].items[0].id).toBe('b'); // newest first inside a cluster
  });

  it('returns nothing for no input', () => {
    expect(clusterByMechanism([]), 'empty input').toEqual([]);
  });

  it('does not chain unrelated stories through a shared middle item', () => {
    // A and C have nothing in common. Naive union-find would still merge them
    // through B, which is how AMZN ended up with 86 of 196 findings in one
    // cluster. Joining must be tested against the cluster core, not one member.
    const clusters = clusterByMechanism([
      item('a', 'Google Broadcom accelerator partnership expands', 'primary_news'),
      item('b', 'Google Broadcom deal follows Anthropic Azure capacity build', 'primary_news'),
      item('c', 'Anthropic Azure capacity expands in Europe', 'primary_news'),
    ]);
    expect(clusters.length).toBeGreaterThan(1);
    const sizes = clusters.map((m) => m.mentions).sort();
    expect(Math.max(...sizes)).toBeLessThan(3);
  });

  it('refuses to treat a term every finding mentions as a mechanism', () => {
    // Every one of these names Amazon and AWS, so those words separate nothing.
    // Grouping on them is how a whole pillar collapses into one row labelled
    // after the company instead of after a causal story.
    const items = Array.from({ length: 30 }, (_, i) =>
      item(`n${i}`, `Amazon AWS commentary on Topic${i} and Rival${i}`, 'analyst_opinion'),
    );
    const clusters = clusterByMechanism(items);
    expect(clusters.length).toBeGreaterThan(1);
    expect(clusters[0].mentions).toBeLessThan(30);
    expect(clusters[0].label).not.toContain('Amazon');
  });

  it('still groups a genuinely shared story inside a mixed corpus', () => {
    const noise = Array.from({ length: 10 }, (_, i) =>
      item(`x${i}`, `Amazon quarterly note on Topic${i} and Region${i}`, 'analyst_opinion'),
    );
    const story = [
      item('s1', 'Amazon faces FTC antitrust suit over Prime signup', 'primary_news'),
      item('s2', 'Amazon FTC antitrust case moves to discovery over Prime', 'primary_news'),
      item('s3', 'FTC antitrust filing details Prime enrolment claims', 'company_filing'),
    ];
    const clusters = clusterByMechanism([...noise, ...story]);
    const ftc = clusters.find((m) => m.items.some((i) => i.id === 's1'));
    expect(ftc?.mentions).toBe(3);
    expect(ftc?.confirmations).toBe(2);
    expect(ftc?.maxStatus).toBe('weakening');
  });

  it('counts repetition inside one class as recency, never as extra weight', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item(`r${i}`, `Rival silicon substitution accelerates, Broadcom TPU note ${i}`, 'analyst_opinion', 'speculative'),
    );
    const clusters = clusterByMechanism(items);
    for (const m of clusters) expect(m.confirmations).toBe(1);
    expect(clusters.every((m) => m.maxStatus === 'watch')).toBe(true);
  });
});
