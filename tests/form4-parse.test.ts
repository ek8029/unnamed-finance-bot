// tests/form4-parse.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseForm4Xml } from '@/lib/edgar';

const planXml = readFileSync('tests/fixtures/form4-sample.xml', 'utf-8');
const openXml = readFileSync('tests/fixtures/form4-open-market.xml', 'utf-8');

describe('parseForm4Xml', () => {
  it('extracts owner, role, and transactions', () => {
    const parsed = parseForm4Xml(planXml);
    expect(parsed.ownerName.length).toBeGreaterThan(0);
    expect(parsed.transactions.length).toBeGreaterThan(0);
    const t = parsed.transactions[0];
    expect(['S', 'P', 'A', 'M', 'F', 'G']).toContain(t.code);
    expect(t.shares).toBeGreaterThan(0);
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('detects 10b5-1 plan flag', () => {
    expect(parseForm4Xml(planXml).is10b51).toBe(true);
  });

  it('does not flag open-market transactions as 10b5-1', () => {
    expect(parseForm4Xml(openXml).is10b51).toBe(false);
  });

  it('computes total sale value when price present', () => {
    const parsed = parseForm4Xml(planXml);
    const sale = parsed.transactions.find((t) => t.code === 'S');
    if (sale && sale.pricePerShare) {
      expect(sale.value).toBeCloseTo(sale.shares * sale.pricePerShare, 0);
    }
  });
});
