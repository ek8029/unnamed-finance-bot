// Sample data for the advisor lab. Every household, figure and quotation here
// is invented for the mockup. Nothing is read from the database on purpose:
// the lab is about the shape of the screens, and no real client of a real
// firm should ever appear on a design page.

export const FIRM = {
  name: 'Larkspur Wealth Partners',
  advisor: 'Sarah Whitcomb, CFP',
  ops: 'Dana Ruiz',
  cco: 'Michael Larkspur',
  households: 38,
  accounts: 61,
  aum: 312_000_000,
  heldAwayShare: 0.44,
  date: 'Wednesday, August 26, 2026',
  time: '7:40 AM ET',
};

export const usd = (n: number, opts: { compact?: boolean } = {}) => {
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
  }
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
export const pct = (f: number, d = 1) => `${(f * 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

export interface Household {
  id: string;
  name: string;
  total: number;
  custodied: number;
  heldAwayAccounts: number;
  largest: { ticker: string; weight: number; custodiedWeight: number };
  breaches: number;
  harvestable: number | null; // null = no taxable held-away or nothing to harvest
  lastSync: string;
  changed: boolean;
  note?: string;
}

export const HOUSEHOLDS: Household[] = [
  { id: 'okafor', name: 'Okafor, Harold & June', total: 3_198_000, custodied: 2_404_000, heldAwayAccounts: 2, largest: { ticker: 'NVDA', weight: 0.182, custodiedWeight: 0.061 }, breaches: 1, harvestable: 12_400, lastSync: '06:12', changed: true, note: '10-Q contradicts the NVDA supply pillar' },
  { id: 'lindqvist', name: 'Lindqvist, Anders', total: 1_530_000, custodied: 1_110_000, heldAwayAccounts: 1, largest: { ticker: 'MU', weight: 0.31, custodiedWeight: 0.04 }, breaches: 0, harvestable: null, lastSync: '06:12', changed: true, note: 'RSU vest Sep 1 takes MU to 31% of the household' },
  { id: 'berglund', name: 'Berglund, Ingrid', total: 730_000, custodied: 730_000, heldAwayAccounts: 0, largest: { ticker: 'VTI', weight: 0.41, custodiedWeight: 0.41 }, breaches: 0, harvestable: 2_150, lastSync: '06:13', changed: true, note: 'Revoked the Robinhood link last night' },
  { id: 'castellano', name: 'Castellano, Marco & Dana', total: 1_692_000, custodied: 1_600_000, heldAwayAccounts: 1, largest: { ticker: 'AAPL', weight: 0.14, custodiedWeight: 0.14 }, breaches: 1, harvestable: 4_800, lastSync: '06:12', changed: true, note: 'AAPL services pillar weakened, second quarter running' },
  { id: 'marchetti', name: 'Marchetti Family Trust', total: 4_810_000, custodied: 4_810_000, heldAwayAccounts: 0, largest: { ticker: 'BRK.B', weight: 0.12, custodiedWeight: 0.12 }, breaches: 0, harvestable: 31_900, lastSync: '06:12', changed: false },
  { id: 'nakamura', name: 'Nakamura, Ken', total: 2_140_000, custodied: 1_870_000, heldAwayAccounts: 1, largest: { ticker: 'MSFT', weight: 0.22, custodiedWeight: 0.19 }, breaches: 0, harvestable: null, lastSync: '06:13', changed: false },
  { id: 'raman', name: 'Raman, Priya', total: 890_000, custodied: 650_000, heldAwayAccounts: 1, largest: { ticker: 'VOO', weight: 0.36, custodiedWeight: 0.36 }, breaches: 0, harvestable: null, lastSync: '06:12', changed: false },
  { id: 'osei', name: 'Osei-Bonsu, Adjoa', total: 1_310_000, custodied: 1_310_000, heldAwayAccounts: 0, largest: { ticker: 'SCHD', weight: 0.18, custodiedWeight: 0.18 }, breaches: 0, harvestable: 8_700, lastSync: '06:12', changed: false },
  { id: 'whitfield', name: 'Whitfield, Thomas', total: 560_000, custodied: 250_000, heldAwayAccounts: 1, largest: { ticker: 'FXAIX', weight: 0.44, custodiedWeight: 0.0 }, breaches: 0, harvestable: null, lastSync: '06:14', changed: false },
  { id: 'feldman', name: 'Feldman, Ruth', total: 3_220_000, custodied: 3_220_000, heldAwayAccounts: 0, largest: { ticker: 'TLT', weight: 0.15, custodiedWeight: 0.15 }, breaches: 0, harvestable: 0, lastSync: '06:12', changed: false },
];

export const OVERNIGHT = [
  {
    when: 'Aug 25\n17:04 ET',
    kind: 'Filing',
    title: 'NVDA 10-Q contradicts the pillar "data-center demand outpaces supply"',
    quote: 'Inventory of data center products increased to $9.1 billion, reflecting purchase commitments made in anticipation of demand that did not fully materialize in the quarter.',
    source: 'Form 10-Q, filed 2026-08-25, p. 23. Retrieved 06:31 ET.',
    scope: '11 households hold NVDA. 64% of that exposure is in accounts you do not custody.',
    action: 'Draft the note',
    href: '/testing/advisor/note',
  },
  {
    when: 'Sep 1\nin 6 days',
    kind: 'Event',
    title: 'Lindqvist: 1,900 MU shares vest at E*TRADE',
    quote: null,
    source: 'Vest schedule from the linked E*TRADE account. Lot-level cost basis will arrive with the vest.',
    scope: 'MU moves from 24% to 31% of the household. In your custody it reads 4%.',
    action: 'Open household',
    href: '/testing/advisor/client',
  },
  {
    when: 'Aug 25\n21:14 ET',
    kind: 'Access',
    title: 'Berglund revoked the Robinhood link through Plaid Portal',
    quote: null,
    source: 'Revocation is the client’s right and needs no approval. The $118K that account held is no longer in view; the record of what you saw before 21:14 is retained.',
    scope: 'Household total shown is now custodied only.',
    action: 'See access log',
    href: '/testing/advisor/compliance',
  },
];

export const BOOK_ROLLUPS = {
  nvda: { households: 11, bookShare: 0.092, heldAwayShare: 0.64 },
  harvestable: { total: 148_300, households: 14, taxableOnly: true },
  breaches: [
    { ticker: 'NVDA', n: 11, pillar: 'Supply constraint' },
    { ticker: 'AAPL', n: 3, pillar: 'Services growth' },
    { ticker: 'MU', n: 1, pillar: 'HBM pricing' },
  ],
  quiet: 27,
  reviewedThisWeek: { n: 31, of: 38 },
};

// The Okafor household in detail.
export const OKAFOR = {
  name: 'Okafor, Harold & June',
  granted: '2026-07-14',
  grantedBy: 'June Okafor',
  accounts: [
    { name: 'Schwab Brokerage', custody: 'custodied', tax: 'taxable', value: 1_844_000, synced: '06:12' },
    { name: 'Schwab Rollover IRA', custody: 'custodied', tax: 'retirement', value: 560_000, synced: '06:12' },
    { name: 'Fidelity 401(k)', custody: 'held-away', tax: 'retirement', value: 610_000, synced: '06:11' },
    { name: 'Robinhood', custody: 'held-away', tax: 'taxable', value: 184_000, synced: '06:12' },
  ],
  positions: [
    { ticker: 'NVDA', account: 'Robinhood + Schwab', value: 582_000, weight: 0.182, thesis: 'contradicted', evidence: '10-Q · 2026-08-25', why: 'Owned since 2019. Harold’s reason: the data-center build cycle has years left. Reviewed with him Apr 9.' },
    { ticker: 'FXAIX', account: 'Fidelity 401(k)', value: 402_000, weight: 0.126, thesis: 'index', evidence: null, why: 'Plan default. Not a thesis position.' },
    { ticker: 'MSFT', account: 'Schwab Brokerage', value: 318_000, weight: 0.099, thesis: 'holds', evidence: '10-K · 2026-07-30', why: 'Azure share gains; margin expansion pillar confirmed two quarters running.' },
    { ticker: 'VTI', account: 'Schwab Brokerage', value: 611_000, weight: 0.191, thesis: 'index', evidence: null, why: 'Core.' },
    { ticker: 'SCHD', account: 'Schwab Rollover IRA', value: 288_000, weight: 0.09, thesis: 'index', evidence: null, why: 'Income sleeve.' },
    { ticker: 'PFE', account: 'Schwab Brokerage', value: 96_000, weight: 0.03, thesis: 'weakening', evidence: '8-K · 2026-08-12', why: 'Pipeline replacement for the LOE cliff. Two of three pillars unconfirmed since May.' },
    { ticker: 'RIVN', account: 'Robinhood', value: 41_000, weight: 0.013, thesis: 'none', evidence: null, why: 'Not discussed. Bought Mar 2026 in the held-away account.' },
  ],
  harvest: [
    { ticker: 'PFE', account: 'Schwab Brokerage', loss: -7_200, lots: 2, wash: 'No purchase in 30 days' },
    { ticker: 'RIVN', account: 'Robinhood', loss: -5_200, lots: 1, wash: 'Bought 2026-03-04; clear' },
  ],
  excludedRetirement: 1_170_000,
  nextSteps: [
    'Send the NVDA note before Thursday’s check-in. Draft is ready.',
    'Ask about RIVN. It was never part of the plan and sits at a loss in the account you do not custody.',
    'PFE: 5 of 6 pillars are stale. Decide whether it is still a thesis or a leftover.',
    'Harvest window: $12,400 realized if sold. Tax effect depends on the household’s return; not estimated here.',
  ],
};

export const CONSENT_LOG = [
  { client: 'Okafor, June', granted: '2026-07-14 09:41', ip: '72.229.14.8', agent: 'Safari 19 · iPhone', status: 'active' },
  { client: 'Okafor, Harold', granted: '2026-07-14 19:02', ip: '72.229.14.8', agent: 'Chrome 139 · Windows', status: 'active' },
  { client: 'Lindqvist, Anders', granted: '2026-07-21 12:15', ip: '98.116.40.211', agent: 'Chrome 139 · macOS', status: 'active' },
  { client: 'Berglund, Ingrid', granted: '2026-07-22 08:30', ip: '24.90.188.5', agent: 'Safari 19 · iPhone', status: 'revoked 2026-08-25 21:14' },
  { client: 'Castellano, Dana', granted: '2026-08-02 14:47', ip: '108.6.72.190', agent: 'Firefox 142 · Windows', status: 'active' },
  { client: 'Whitfield, Thomas', granted: '2026-08-19 10:05', ip: '67.243.9.77', agent: 'Chrome 139 · Android', status: 'pending' },
];

export const ACCESS_LOG = [
  { at: '07:42:10', who: 'S. Whitcomb', role: 'advisor', action: 'Viewed household', subject: 'Okafor', detail: 'Tax detail, harvestable lots' },
  { at: '07:41:52', who: 'S. Whitcomb', role: 'advisor', action: 'Viewed household', subject: 'Okafor', detail: 'Positions, thesis evidence' },
  { at: '07:40:03', who: 'S. Whitcomb', role: 'advisor', action: 'Opened book', subject: '38 households', detail: 'Overnight, roll-ups' },
  { at: '06:31:00', who: 'Helm', role: 'system', action: 'Evidence retrieved', subject: 'NVDA', detail: 'Form 10-Q 2026-08-25, p. 23' },
  { at: '06:14:22', who: 'Helm', role: 'system', action: 'Sync complete', subject: '61 accounts', detail: '61 of 61 within 24h' },
  { at: '21:14:37 (Aug 25)', who: 'I. Berglund', role: 'client', action: 'Revoked grant', subject: 'Robinhood', detail: 'Via Plaid Portal. Data withdrawn from view.' },
  { at: '16:20:11 (Aug 25)', who: 'D. Ruiz', role: 'operations', action: 'Exported', subject: 'Marchetti', detail: 'holdings.csv, transactions.csv' },
  { at: '11:05:48 (Aug 25)', who: 'M. Larkspur', role: 'compliance', action: 'Viewed access log', subject: 'Firm', detail: 'Aug 18 to Aug 25' },
];

export const VENDOR_FILE = [
  { doc: 'Vendor agreement + data protection exhibit', status: 'Signed 2026-07-01', note: '72-hour breach notice from awareness. Export rights. Not an investment adviser.' },
  { doc: 'Subprocessor register', status: 'Current · 6 entries', note: 'Supabase, Vercel, Resend, PostHog, OpenAI, Plaid. 30-day change notice.' },
  { doc: 'Security questionnaire', status: '17 of 17 answered', note: 'Encryption, access control, penetration testing, incident response, backup and recovery, retention, AI data handling.' },
  { doc: 'Cyber liability certificate', status: '$2M · renews 2027-06', note: 'Carrier certificate on file.' },
  { doc: 'AI data handling statement', status: 'Current', note: 'Portfolio content sent to OpenAI API; not used for training; retained up to 30 days in abuse logs.' },
  { doc: 'SOC 2', status: 'Not held', note: 'Type I report available on request; allow 8 weeks.' },
];
