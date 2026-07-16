// tests/evidence-quality.test.ts
import { describe, it, expect } from 'vitest';
import { isHedgedConnection, isOperationsPillar, OPERATIONAL_INCIDENT } from '@/lib/evidence-quality';

describe('isHedgedConnection', () => {
  it('drops the real KO fairlife why (hedged causal, neutral)', () => {
    expect(isHedgedConnection(
      "This incident may affect Coca-Cola's product portfolio by disrupting production in the dairy segment, specifically for fairlife.",
      'neutral',
    )).toBe(true);
  });
  it('drops hedged causal phrasing on any verdict', () => {
    expect(isHedgedConnection('The ruling could impact segment margins next year.', 'contradicts')).toBe(true);
    expect(isHedgedConnection('New tariffs might weigh on gross margin.', 'supports')).toBe(true);
  });
  it('drops soft tells on neutral rows only', () => {
    expect(isHedgedConnection('The event underscores potential vulnerabilities in operations.', 'neutral')).toBe(true);
    expect(isHedgedConnection('Management reiterated the growth potential of the segment.', 'supports')).toBe(false);
  });
  it('keeps plain, direct connections', () => {
    expect(isHedgedConnection('The 10-Q reports data center revenue grew 41% year over year, confirming the demand pillar.', 'supports')).toBe(false);
    expect(isHedgedConnection('France terminated the intelligence contract, a direct loss to government revenue.', 'contradicts')).toBe(false);
    expect(isHedgedConnection('Guidance was withdrawn for the fiscal year.', 'contradicts')).toBe(false);
  });
  it('does not trip on the month of May', () => {
    expect(isHedgedConnection('The May 10-Q reports segment revenue declined 12%.', 'contradicts')).toBe(false);
  });
});

describe('operational incident heuristics', () => {
  it('detects incident language', () => {
    expect(OPERATIONAL_INCIDENT.test('unauthorized access by a third party in connection with a ransomware event')).toBe(true);
    expect(OPERATIONAL_INCIDENT.test('quarterly dividend increased 5%')).toBe(false);
  });
  it('classifies pillar claims', () => {
    expect(isOperationsPillar('Operating margin keeps expanding through supply chain efficiency')).toBe(true);
    expect(isOperationsPillar('Diversified product portfolio, including low and no-sugar options, drives growth amid changing consumer preferences')).toBe(false);
  });
});
