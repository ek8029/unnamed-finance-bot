import { describe, it, expect } from 'vitest';
import { claimSharesDriver, distinctiveTerms, termSet } from '../lib/driver-match';

// The live regression: SPCX's Starlink draft pillar shares only the filler words
// "revenue" + "growth" with the "Advertising revenue growth" cluster (GOOGL/META).
// It must NOT be reported as a shared-driver overlap.
const SPCX_STARLINK =
  "The company's expansion into satellite internet services through Starlink is driving significant revenue growth and addressing a critical demand for global high-speed internet access.";

describe('claimSharesDriver — the SPCX ↔ Advertising false match', () => {
  it('does NOT match a Starlink pillar to "Advertising revenue growth" on filler words', () => {
    expect(claimSharesDriver('Advertising revenue growth', SPCX_STARLINK)).toBe(false);
  });

  it('does NOT match on generic revenue/growth overlap alone', () => {
    expect(claimSharesDriver('Advertising revenue growth', 'Product revenue growth accelerates next year')).toBe(false);
    expect(claimSharesDriver('Data center growth', 'Overall revenue growth stays strong')).toBe(false);
    expect(claimSharesDriver('Cloud computing demand', 'Consumer demand keeps rising')).toBe(false);
  });

  it('a driver made only of generic words matches nothing', () => {
    expect(claimSharesDriver('Revenue growth', 'Advertising revenue growth reaccelerates')).toBe(false);
    expect(claimSharesDriver('Strong demand', 'Strong demand across the board')).toBe(false);
  });
});

describe('claimSharesDriver — genuine overlaps still match', () => {
  it('matches when the distinctive term is shared', () => {
    expect(claimSharesDriver('Advertising revenue growth', 'Instagram advertising revenue growth reaccelerates')).toBe(true);
    expect(claimSharesDriver('AI infrastructure demand', 'AI infrastructure demand accelerates hyperscaler capex')).toBe(true);
    expect(claimSharesDriver('Cloud computing demand', 'Azure cloud computing adoption keeps compounding')).toBe(true);
  });

  it('matches a single distinctive-word driver on that word', () => {
    expect(claimSharesDriver('Semiconductors', 'Semiconductors rally on the AI cycle')).toBe(true);
  });

  it('needs the distinctive word, not just a second generic one', () => {
    // shares "data" (generic) + "center" (distinctive) => match
    expect(claimSharesDriver('Data center growth', 'Hyperscaler data center buildout continues')).toBe(true);
    // shares only "data" (generic) => no match
    expect(claimSharesDriver('Data center growth', 'Big data analytics revenue climbs')).toBe(false);
  });
});

describe('helpers', () => {
  it('termSet drops short tokens and punctuation', () => {
    expect([...termSet('AI, revenue-growth!')].sort()).toEqual(['growth', 'revenue']);
  });
  it('distinctiveTerms strips generic filler', () => {
    expect([...distinctiveTerms(termSet('Advertising revenue growth'))]).toEqual(['advertising']);
  });
});
