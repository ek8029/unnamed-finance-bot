// Invented data for the advisor lab. Every household, figure and quotation here
// is invented for the mockup. Nothing is read from the database on purpose:
// the lab is about the shape of the screens, and no real client of a real
// firm should ever appear on a design page.
//
// Vocabulary: an account is either "managed" (Larkspur custodies it) or
// "linked" (the client runs it and linked it themselves). Both arrive through
// the same read-only client-initiated Plaid link.

export const FIRM = {
  name: 'Larkspur Wealth Partners',
  advisor: 'Sarah Whitcomb, CFP',
  ops: 'Dana Ruiz',
  cco: 'Michael Larkspur',
  households: 38,
  accounts: 61,
  managed: 248_000_000,
  linked: 64_000_000,
  inView: 312_000_000,
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

// ISO dates are stored, never parsed. String comparison orders them and this
// helper prints them, so the lab never depends on the machine's clock.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const mdy = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
};

export interface Household {
  id: string;
  name: string;
  total: number;
  managedValue: number;
  linkedValue: number;
  linkedAccounts: number;
  largest: { ticker: string; weight: number; managedWeight: number };
  breaches: number;
  harvestable: number | null; // null = no taxable account with a loss
  lastSync: string;
  changed: boolean;
  note?: string;
}

export const HOUSEHOLDS: Household[] = [
  { id: 'okafor', name: 'Okafor, Harold & June', total: 3_198_000, managedValue: 2_404_000, linkedValue: 794_000, linkedAccounts: 2, largest: { ticker: 'NVDA', weight: 0.182, managedWeight: 0.061 }, breaches: 1, harvestable: 12_400, lastSync: '06:12', changed: true, note: '10-Q contradicts the NVDA reason on file' },
  { id: 'lindqvist', name: 'Lindqvist, Anders', total: 1_530_000, managedValue: 1_110_000, linkedValue: 420_000, linkedAccounts: 1, largest: { ticker: 'MU', weight: 0.31, managedWeight: 0.04 }, breaches: 0, harvestable: null, lastSync: '06:12', changed: true, note: 'RSU vest Sep 1 takes MU to 31% of the household' },
  { id: 'berglund', name: 'Berglund, Ingrid', total: 730_000, managedValue: 730_000, linkedValue: 0, linkedAccounts: 0, largest: { ticker: 'VTI', weight: 0.41, managedWeight: 0.41 }, breaches: 0, harvestable: 2_150, lastSync: '06:13', changed: true, note: 'Revoked the Robinhood link last night' },
  { id: 'castellano', name: 'Castellano, Marco & Dana', total: 1_692_000, managedValue: 1_600_000, linkedValue: 92_000, linkedAccounts: 1, largest: { ticker: 'AAPL', weight: 0.14, managedWeight: 0.14 }, breaches: 1, harvestable: 4_800, lastSync: '06:12', changed: true, note: 'AAPL services reason weakened, second quarter running' },
  { id: 'marchetti', name: 'Marchetti Family Trust', total: 4_810_000, managedValue: 4_810_000, linkedValue: 0, linkedAccounts: 0, largest: { ticker: 'BRK.B', weight: 0.12, managedWeight: 0.12 }, breaches: 0, harvestable: 31_900, lastSync: '06:12', changed: false },
  { id: 'nakamura', name: 'Nakamura, Ken', total: 2_140_000, managedValue: 1_870_000, linkedValue: 270_000, linkedAccounts: 1, largest: { ticker: 'MSFT', weight: 0.22, managedWeight: 0.19 }, breaches: 0, harvestable: null, lastSync: '06:13', changed: false },
  { id: 'raman', name: 'Raman, Priya', total: 890_000, managedValue: 650_000, linkedValue: 240_000, linkedAccounts: 1, largest: { ticker: 'VOO', weight: 0.36, managedWeight: 0.36 }, breaches: 0, harvestable: null, lastSync: '06:12', changed: false },
  { id: 'osei', name: 'Osei-Bonsu, Adjoa', total: 1_310_000, managedValue: 1_310_000, linkedValue: 0, linkedAccounts: 0, largest: { ticker: 'SCHD', weight: 0.18, managedWeight: 0.18 }, breaches: 0, harvestable: 8_700, lastSync: '06:12', changed: false },
  { id: 'whitfield', name: 'Whitfield, Thomas', total: 560_000, managedValue: 250_000, linkedValue: 310_000, linkedAccounts: 1, largest: { ticker: 'FXAIX', weight: 0.44, managedWeight: 0.0 }, breaches: 0, harvestable: null, lastSync: '06:14', changed: false },
  { id: 'feldman', name: 'Feldman, Ruth', total: 3_220_000, managedValue: 3_220_000, linkedValue: 0, linkedAccounts: 0, largest: { ticker: 'TLT', weight: 0.15, managedWeight: 0.15 }, breaches: 0, harvestable: 0, lastSync: '06:12', changed: false },
];

// Every single name held anywhere in the book, managed and client-linked alike,
// with the count of holders who have a written reason on file. This is the
// table the product is actually about; the household ledger is one way to cut
// it. Weights are the share of the $312M in view.
export interface FirmName {
  ticker: string;
  name: string;
  firmWeight: number;
  households: number;
  reasonsOnFile: number;
  status: 'holds' | 'tested' | 'none';
  nextEarnings: string | null;
  lastTest: { date: string; source: string; quote: string } | null;
}

export const NAMES: FirmName[] = [
  { ticker: 'AAPL', name: 'Apple', firmWeight: 0.058, households: 22, reasonsOnFile: 17, status: 'tested', nextEarnings: '2026-10-29', lastTest: { date: '2026-08-24', source: 'Form 8-K, filed 2026-08-24, item 2.02', quote: 'Services revenue grew 8% in the quarter, compared with 14% in the prior-year quarter, reflecting slower growth in advertising and App Store billings.' } },
  { ticker: 'NVDA', name: 'NVIDIA', firmWeight: 0.052, households: 11, reasonsOnFile: 9, status: 'tested', nextEarnings: '2026-11-18', lastTest: { date: '2026-08-25', source: 'Form 10-Q, filed 2026-08-25, p. 23', quote: 'Inventory of data center products increased to $9.1 billion, reflecting purchase commitments made in anticipation of demand that did not fully materialize in the quarter.' } },
  { ticker: 'MSFT', name: 'Microsoft', firmWeight: 0.046, households: 19, reasonsOnFile: 15, status: 'holds', nextEarnings: '2026-10-27', lastTest: null },
  { ticker: 'AMZN', name: 'Amazon', firmWeight: 0.034, households: 17, reasonsOnFile: 12, status: 'holds', nextEarnings: '2026-10-29', lastTest: null },
  { ticker: 'GOOGL', name: 'Alphabet', firmWeight: 0.029, households: 15, reasonsOnFile: 11, status: 'holds', nextEarnings: '2026-10-27', lastTest: null },
  { ticker: 'AVGO', name: 'Broadcom', firmWeight: 0.021, households: 9, reasonsOnFile: 5, status: 'holds', nextEarnings: '2026-09-01', lastTest: null },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', firmWeight: 0.019, households: 12, reasonsOnFile: 9, status: 'holds', nextEarnings: '2026-11-07', lastTest: null },
  { ticker: 'JPM', name: 'JPMorgan Chase', firmWeight: 0.015, households: 10, reasonsOnFile: 7, status: 'holds', nextEarnings: '2026-10-13', lastTest: null },
  { ticker: 'UNH', name: 'UnitedHealth', firmWeight: 0.013, households: 9, reasonsOnFile: 4, status: 'tested', nextEarnings: '2026-10-15', lastTest: { date: '2026-08-25', source: 'Form 8-K, filed 2026-08-25, item 8.01', quote: 'The Company now expects the full-year medical care ratio to exceed the range previously provided, reflecting higher than anticipated utilization in Medicare Advantage.' } },
  { ticker: 'LLY', name: 'Eli Lilly', firmWeight: 0.012, households: 8, reasonsOnFile: 5, status: 'holds', nextEarnings: '2026-10-29', lastTest: null },
  { ticker: 'XOM', name: 'Exxon Mobil', firmWeight: 0.011, households: 9, reasonsOnFile: 3, status: 'holds', nextEarnings: '2026-10-30', lastTest: null },
  { ticker: 'CRM', name: 'Salesforce', firmWeight: 0.009, households: 7, reasonsOnFile: 4, status: 'holds', nextEarnings: '2026-09-02', lastTest: null },
  { ticker: 'COST', name: 'Costco', firmWeight: 0.009, households: 6, reasonsOnFile: 5, status: 'holds', nextEarnings: '2026-09-24', lastTest: null },
  { ticker: 'PG', name: 'Procter & Gamble', firmWeight: 0.008, households: 8, reasonsOnFile: 2, status: 'holds', nextEarnings: '2026-10-23', lastTest: null },
  { ticker: 'KO', name: 'Coca-Cola', firmWeight: 0.007, households: 7, reasonsOnFile: 3, status: 'holds', nextEarnings: '2026-10-20', lastTest: null },
  { ticker: 'PFE', name: 'Pfizer', firmWeight: 0.007, households: 6, reasonsOnFile: 6, status: 'tested', nextEarnings: '2026-11-03', lastTest: { date: '2026-08-24', source: 'Form 8-K, filed 2026-08-24, item 8.01', quote: 'Following the Phase 3 readout, the Company has discontinued development of its oral GLP-1 candidate and recorded a charge of $1.2 billion.' } },
  { ticker: 'MU', name: 'Micron', firmWeight: 0.006, households: 4, reasonsOnFile: 4, status: 'holds', nextEarnings: '2026-09-23', lastTest: null },
  { ticker: 'DIS', name: 'Walt Disney', firmWeight: 0.005, households: 5, reasonsOnFile: 1, status: 'holds', nextEarnings: '2026-11-12', lastTest: null },
  { ticker: 'TSLA', name: 'Tesla', firmWeight: 0.005, households: 5, reasonsOnFile: 2, status: 'holds', nextEarnings: '2026-10-21', lastTest: null },
  { ticker: 'INTC', name: 'Intel', firmWeight: 0.004, households: 4, reasonsOnFile: 0, status: 'none', nextEarnings: '2026-10-22', lastTest: null },
  { ticker: 'CVS', name: 'CVS Health', firmWeight: 0.003, households: 4, reasonsOnFile: 0, status: 'none', nextEarnings: '2026-11-04', lastTest: null },
  { ticker: 'RIVN', name: 'Rivian', firmWeight: 0.002, households: 3, reasonsOnFile: 0, status: 'none', nextEarnings: '2026-11-05', lastTest: null },
];

// The rest of the single names: the ones nobody built on purpose. Held one or
// two households deep, small enough to fall out of every review, and the place
// the reason register is emptiest.
export const TAIL = {
  names: 212,
  households: 29,
  under: 250_000,
  withReason: 31,
  value: 18_400_000,
  earningsThisWeek: 9,
};

export const NAMED_POSITIONS = NAMES.reduce((s, n) => s + n.households, 0);
export const NAMED_REASONS = NAMES.reduce((s, n) => s + n.reasonsOnFile, 0);
export const ALL_POSITIONS = NAMED_POSITIONS + TAIL.names;
export const ALL_REASONS = NAMED_REASONS + TAIL.withReason;

// Next review per household and the planning topic the firm's service calendar
// has already assigned to it. A finding competes for the "special topic" slot.
export const MEETINGS: Record<string, { next: string; topic: string }> = {
  okafor: { next: 'Thu Aug 27', topic: 'Tax planning' },
  lindqvist: { next: 'Tue Sep 8', topic: 'Equity comp' },
  berglund: { next: 'Oct 6', topic: 'Estate' },
  castellano: { next: 'Sep 15', topic: 'Insurance' },
  marchetti: { next: 'Sep 22', topic: 'Tax planning' },
  nakamura: { next: 'Oct 13', topic: 'Retirement projection' },
  raman: { next: 'Sep 29', topic: 'Cash flow' },
  osei: { next: 'Oct 20', topic: 'Tax planning' },
  whitfield: { next: 'Sep 10', topic: 'Get organized' },
  feldman: { next: 'Nov 3', topic: 'Charitable giving' },
};

// Connections that need the client to act. A stale link is shown, never hidden.
export const STALE: Record<string, string> = {
  whitfield: 'Fidelity 401(k) · last synced 34 days ago · client must reconnect',
};

// The rule the household agreed to, kept beside the reason. A breach is a rule
// being crossed, not an opinion about the stock.
export const RULES: Record<string, string> = {
  NVDA: 'Max 15% of the household. Reviewed quarterly, not on headlines.',
  MSFT: 'Max 12% of the household.',
  AAPL: 'Max 10% of the household. Trim past the line, not on the news.',
  PFE: 'Hold while 2 of 3 reasons stand. Reassess at 6 months stale.',
  RIVN: 'No rule set. Bought outside the plan.',
};

export const OVERNIGHT = [
  {
    when: 'Aug 25\n17:04 ET',
    kind: 'Filing',
    title: 'NVDA 10-Q contradicts the reason on file: data-center demand outpaces supply',
    quote: 'Inventory of data center products increased to $9.1 billion, reflecting purchase commitments made in anticipation of demand that did not fully materialize in the quarter.',
    source: 'Form 10-Q, filed 2026-08-25, p. 23. Retrieved 06:31 ET.',
    scope: '11 households hold NVDA, 9 of them with a reason on file. 64% of the exposure sits in accounts the clients run themselves.',
    action: 'Draft the note',
    href: '/testing/advisor/note',
  },
  {
    when: 'Sep 1\nin 6 days',
    kind: 'Event',
    title: 'Lindqvist: 1,900 MU shares vest at E*TRADE',
    quote: null,
    source: 'Vest schedule from the linked E*TRADE account. Cost basis will arrive with the vest.',
    scope: 'MU moves from 24% to 31% of the household. In the accounts Larkspur manages it reads 4%.',
    action: 'Open household',
    href: '/testing/advisor/client',
  },
  {
    when: 'Aug 25\n21:14 ET',
    kind: 'Access',
    title: 'Berglund revoked the Robinhood link through Plaid Portal',
    quote: null,
    source: 'Revocation is the client’s right and needs no approval. The $118K that account held is no longer in view; the record of what you saw before 21:14 is retained.',
    scope: 'Household total now shows accounts under management only.',
    action: 'See access log',
    href: '/testing/advisor/compliance',
  },
];

export const BOOK_ROLLUPS = {
  nvda: { households: 11, linkedShare: 0.64, overLimit: 4 },
  harvestable: { total: 148_300, households: 14, taxableOnly: true },
  breaches: [
    { ticker: 'NVDA', n: 11, reason: 'Supply constraint' },
    { ticker: 'AAPL', n: 3, reason: 'Services growth' },
    { ticker: 'MU', n: 1, reason: 'HBM pricing' },
  ],
  quiet: 27,
  reviewedThisWeek: { n: 31, of: 38 },
};

// The digest is dated, not clocked. Everything it reports falls inside the week
// it covers, and the earnings window is the seven days after it lands.
export const DIGEST = {
  to: 'dana@larkspurwealth.com',
  cc: 'sarah@larkspurwealth.com',
  sent: 'Monday, August 31, 2026 · 6:45 AM',
  weekLabel: 'Week of Aug 24',
  testedFrom: '2026-08-24',
  earningsFrom: '2026-08-31',
  earningsTo: '2026-09-06',
  documentsRead: 1_412,
};

// The Okafor household in detail. Seventeen positions: fourteen single names
// and three funds. Values roll up to each account, and the accounts to the
// household total.
export const OKAFOR = {
  name: 'Okafor, Harold & June',
  granted: '2026-07-14',
  grantedBy: 'June Okafor',
  accounts: [
    { name: 'Schwab Brokerage', custody: 'managed' as const, tax: 'taxable', value: 1_844_000, synced: '06:12' },
    { name: 'Schwab Rollover IRA', custody: 'managed' as const, tax: 'retirement', value: 560_000, synced: '06:12' },
    { name: 'Fidelity 401(k)', custody: 'linked' as const, tax: 'retirement', value: 610_000, synced: '06:11' },
    { name: 'Robinhood', custody: 'linked' as const, tax: 'taxable', value: 184_000, synced: '06:12' },
  ],
  positions: [
    { ticker: 'NVDA', name: 'NVIDIA', account: 'Schwab Brokerage, Fidelity 401(k), Robinhood', source: 'both' as const, value: 582_000, weight: 0.182, thesis: 'contradicted', lastTest: { date: '2026-08-25', doc: '10-Q · 2026-08-25' }, reason: 'Owned since 2019. Harold’s reason: the data-center build cycle has years left. Reviewed with him Apr 9.' },
    { ticker: 'VTI', name: 'Vanguard Total Stock Market', account: 'Schwab Brokerage', source: 'managed' as const, value: 611_000, weight: 0.191, thesis: 'index', lastTest: null, reason: 'index' },
    { ticker: 'FXAIX', name: 'Fidelity 500 Index', account: 'Fidelity 401(k)', source: 'linked' as const, value: 365_000, weight: 0.114, thesis: 'index', lastTest: null, reason: 'index' },
    { ticker: 'MSFT', name: 'Microsoft', account: 'Schwab Brokerage', source: 'managed' as const, value: 318_000, weight: 0.099, thesis: 'holds', lastTest: { date: '2026-07-30', doc: '10-K · 2026-07-30' }, reason: 'Azure share gains. Margin expansion confirmed two quarters running.' },
    { ticker: 'SCHD', name: 'Schwab US Dividend Equity', account: 'Schwab Rollover IRA', source: 'managed' as const, value: 288_000, weight: 0.090, thesis: 'index', lastTest: null, reason: 'index' },
    { ticker: 'AAPL', name: 'Apple', account: 'Schwab Brokerage', source: 'managed' as const, value: 186_000, weight: 0.058, thesis: 'weakening', lastTest: { date: '2026-08-24', doc: '8-K · 2026-08-24' }, reason: 'June’s reason: the installed base pays a subscription every month. Services growth is the test she set.' },
    { ticker: 'AMZN', name: 'Amazon', account: 'Schwab Brokerage', source: 'managed' as const, value: 132_000, weight: 0.041, thesis: 'holds', lastTest: { date: '2026-08-04', doc: '10-Q · 2026-08-04' }, reason: 'Bought at the 2022 lows for AWS operating margin. Margin has widened every quarter since.' },
    { ticker: 'GOOGL', name: 'Alphabet', account: 'Schwab Brokerage', source: 'managed' as const, value: 104_000, weight: 0.033, thesis: 'holds', lastTest: { date: '2026-07-28', doc: '10-Q · 2026-07-28' }, reason: 'Search share holds and YouTube is the second business. Reviewed Jan 22.' },
    { ticker: 'BRK.B', name: 'Berkshire Hathaway', account: 'Schwab Brokerage', source: 'managed' as const, value: 97_000, weight: 0.030, thesis: 'holds', lastTest: { date: '2026-08-08', doc: '10-Q · 2026-08-08' }, reason: 'Harold’s cash sleeve with an equity coupon. Not sold before a market he wants to buy into.' },
    { ticker: 'PFE', name: 'Pfizer', account: 'Schwab Brokerage', source: 'managed' as const, value: 96_000, weight: 0.030, thesis: 'weakening', lastTest: { date: '2026-08-24', doc: '8-K · 2026-08-24' }, reason: 'Pipeline replacement for the patent cliff. Two of three reasons unconfirmed since May.' },
    { ticker: 'COST', name: 'Costco', account: 'Schwab Rollover IRA', source: 'managed' as const, value: 96_000, weight: 0.030, thesis: 'holds', lastTest: { date: '2026-06-04', doc: '8-K · 2026-06-04' }, reason: 'Membership renewal rate is the whole reason. It has not moved below 92% in six years.' },
    { ticker: 'PG', name: 'Procter & Gamble', account: 'Schwab Rollover IRA', source: 'managed' as const, value: 71_000, weight: 0.022, thesis: 'none', lastTest: null, reason: null },
    { ticker: 'XOM', name: 'Exxon Mobil', account: 'Schwab Rollover IRA', source: 'managed' as const, value: 62_000, weight: 0.019, thesis: 'none', lastTest: null, reason: null },
    { ticker: 'JPM', name: 'JPMorgan Chase', account: 'Schwab Brokerage', source: 'managed' as const, value: 61_000, weight: 0.019, thesis: 'holds', lastTest: { date: '2026-08-05', doc: '10-Q · 2026-08-05' }, reason: 'Bought for the deposit franchise in 2020. Reviewed each January with the rest of the sleeve.' },
    { ticker: 'KO', name: 'Coca-Cola', account: 'Schwab Brokerage', source: 'managed' as const, value: 44_000, weight: 0.014, thesis: 'none', lastTest: null, reason: null },
    { ticker: 'UNH', name: 'UnitedHealth', account: 'Schwab Rollover IRA', source: 'managed' as const, value: 43_000, weight: 0.013, thesis: 'none', lastTest: null, reason: null },
    { ticker: 'RIVN', name: 'Rivian', account: 'Robinhood', source: 'linked' as const, value: 42_000, weight: 0.013, thesis: 'none', lastTest: null, reason: null },
  ],
  harvest: [
    { ticker: 'PFE', account: 'Schwab Brokerage', loss: -7_200, wash: 'No purchase in 30 days' },
    { ticker: 'RIVN', account: 'Robinhood', loss: -5_200, wash: 'Last bought 2026-03-04, outside the 30-day window' },
  ],
  excludedRetirement: 1_170_000,
  nextSteps: [
    'Send the NVDA note before Thursday’s check-in. Draft is ready.',
    'Five single names carry no reason on file: PG, XOM, KO, UNH and RIVN. The legacy note asks about four of them.',
    'Ask about RIVN separately. It was never part of the plan and sits at a loss in an account June runs herself.',
    'Harvest window: $12,400 realized if sold, from average cost. Tax effect depends on the household’s return; not estimated here.',
  ],
};

// The prospect firm on the "before the first call" screen. Public filings only:
// nothing here needed Ridgeline to share anything or sign anything.
export const PROSPECT = {
  firm: 'Ridgeline Capital Advisors',
  city: 'Radnor, Pennsylvania',
  filing: {
    form: '13F-HR',
    period: 'quarter ended June 30, 2026',
    filed: '2026-08-13',
    lagDays: 44,
  },
  positions: 271,
  etfCount: 35,
  nameCount: 236,
  reported: 486_300_000,
  etfShare: 0.74,
  singleShare: 0.26,
  small: { count: 218, under: 250_000, value: 21_700_000 },
  top: [
    { ticker: 'AAPL', name: 'Apple', weight: 0.039, quote: 'Services revenue grew 8% in the quarter, compared with 14% in the prior-year quarter, reflecting slower growth in advertising and App Store billings.', source: 'Form 8-K, filed 2026-08-24' },
    { ticker: 'NVDA', name: 'NVIDIA', weight: 0.034, quote: 'Inventory of data center products increased to $9.1 billion, reflecting purchase commitments made in anticipation of demand that did not fully materialize in the quarter.', source: 'Form 10-Q, filed 2026-08-25' },
    { ticker: 'MSFT', name: 'Microsoft', weight: 0.031, quote: 'We expect the growth rate of capital expenditures, including finance leases, to exceed the growth rate of Microsoft Cloud revenue in fiscal year 2027.', source: 'Form 10-K, filed 2026-07-30' },
    { ticker: 'AMZN', name: 'Amazon', weight: 0.022, quote: 'North America segment operating margin declined to 5.1% from 6.4%, primarily driven by higher fulfillment and transportation costs.', source: 'Form 10-Q, filed 2026-08-04' },
    { ticker: 'GOOGL', name: 'Alphabet', weight: 0.019, quote: 'The Company recorded a charge of $3.1 billion in connection with the remedies order entered in the search distribution matter.', source: 'Form 8-K, filed 2026-08-21' },
    { ticker: 'UNH', name: 'UnitedHealth', weight: 0.014, quote: 'The Company now expects the full-year medical care ratio to exceed the range previously provided, reflecting higher than anticipated utilization in Medicare Advantage.', source: 'Form 8-K, filed 2026-08-25' },
    { ticker: 'PFE', name: 'Pfizer', weight: 0.011, quote: 'Following the Phase 3 readout, the Company has discontinued development of its oral GLP-1 candidate and recorded a charge of $1.2 billion.', source: 'Form 8-K, filed 2026-08-24' },
    { ticker: 'AVGO', name: 'Broadcom', weight: 0.009, quote: 'Two customers accounted for 39% of net revenue in the six months ended May 3, 2026.', source: 'Form 10-Q, filed 2026-06-11' },
  ],
  blind: [
    'Open-end mutual funds and the money market sleeve. Neither is reportable on this form.',
    'Bonds, CDs and cash. A 13F covers listed equities, options and convertibles, nothing else.',
    'Accounts Ridgeline advises without discretion, and every account a client runs alone.',
    'Short positions, and any name sold between June 30 and the filing date.',
    'Which household holds what. The form reports the firm in aggregate and names nobody.',
  ],
};

// The second kind of note: the four Okafor names with nothing written down
// against them, each with the most recent thing the company itself filed. The
// note asks a question; it does not answer one.
export const LEGACY_NOTE = [
  {
    ticker: 'PG',
    name: 'Procter & Gamble',
    value: 71_000,
    where: 'Schwab Rollover IRA',
    held: 'Transferred in from the previous adviser, March 2019',
    quote: 'Organic sales increased 1%, with shipment volume down 2% and pricing contributing three points.',
    source: 'Form 10-K, filed 2026-08-06, p. 21',
  },
  {
    ticker: 'XOM',
    name: 'Exxon Mobil',
    value: 62_000,
    where: 'Schwab Rollover IRA',
    held: 'Transferred in from the previous adviser, March 2019',
    quote: 'Upstream earnings decreased $1.9 billion from the prior quarter, primarily reflecting lower liquids realizations.',
    source: 'Form 10-Q, filed 2026-08-05, p. 14',
  },
  {
    ticker: 'KO',
    name: 'Coca-Cola',
    value: 44_000,
    where: 'Schwab Brokerage',
    held: 'Transferred in from the previous adviser, March 2019',
    quote: 'Unit case volume declined 1% in the quarter, with declines in North America partially offset by growth in Latin America.',
    source: 'Form 10-Q, filed 2026-07-23, p. 9',
  },
  {
    ticker: 'UNH',
    name: 'UnitedHealth',
    value: 43_000,
    where: 'Schwab Rollover IRA',
    held: 'Bought August 2021, no note on file',
    quote: 'The Company now expects the full-year medical care ratio to exceed the range previously provided, reflecting higher than anticipated utilization in Medicare Advantage.',
    source: 'Form 8-K, filed 2026-08-25, item 8.01',
  },
];

export const CONSENT_LOG = [
  { client: 'Okafor, June', granted: '2026-07-14 09:41', ip: '72.229.14.8', agent: 'Safari 19 · iPhone', status: 'active' },
  { client: 'Okafor, Harold', granted: '2026-07-14 19:02', ip: '72.229.14.8', agent: 'Chrome 139 · Windows', status: 'active' },
  { client: 'Lindqvist, Anders', granted: '2026-07-21 12:15', ip: '98.116.40.211', agent: 'Chrome 139 · macOS', status: 'active' },
  { client: 'Berglund, Ingrid', granted: '2026-07-22 08:30', ip: '24.90.188.5', agent: 'Safari 19 · iPhone', status: 'revoked 2026-08-25 21:14' },
  { client: 'Castellano, Dana', granted: '2026-08-02 14:47', ip: '108.6.72.190', agent: 'Firefox 142 · Windows', status: 'active' },
  { client: 'Whitfield, Thomas', granted: '2026-08-19 10:05', ip: '67.243.9.77', agent: 'Chrome 139 · Android', status: 'pending' },
];

export const ACCESS_LOG = [
  { at: '07:42:10', who: 'S. Whitcomb', role: 'advisor', action: 'Viewed household', subject: 'Okafor', detail: 'Tax detail, harvestable losses' },
  { at: '07:41:52', who: 'S. Whitcomb', role: 'advisor', action: 'Viewed household', subject: 'Okafor', detail: 'Positions, reasons, cited documents' },
  { at: '07:40:03', who: 'S. Whitcomb', role: 'advisor', action: 'Opened book', subject: '38 households', detail: 'Overnight, roll-ups' },
  { at: '06:31:00', who: 'Helm', role: 'system', action: 'Evidence retrieved', subject: 'NVDA', detail: 'Form 10-Q 2026-08-25, p. 23' },
  { at: '06:14:22', who: 'Helm', role: 'system', action: 'Sync complete', subject: '61 accounts', detail: '61 of 61 within 24h' },
  { at: '21:14:37 (Aug 25)', who: 'I. Berglund', role: 'client', action: 'Revoked grant', subject: 'Robinhood', detail: 'Via Plaid Portal. Data withdrawn from view.' },
  { at: '16:20:11 (Aug 25)', who: 'D. Ruiz', role: 'operations', action: 'Exported', subject: 'Marchetti', detail: 'holdings.csv, transactions.csv' },
  { at: '11:05:48 (Aug 25)', who: 'M. Larkspur', role: 'compliance', action: 'Viewed access log', subject: 'Firm', detail: 'Aug 18 to Aug 25' },
];

// One row per source type. Everything on every screen comes from one of these
// two, and each row says what it cannot do as plainly as what it can.
export const PROVENANCE = [
  {
    source: 'Client-linked through Plaid',
    detail: 'Read-only, client-initiated, revocable',
    provides: 'Holdings, transactions, balances and cost basis as the custodian reports it, for accounts the client links. The same link covers the accounts Larkspur custodies and the accounts the client runs alone.',
    never: 'Login details, which Helm never holds. Trading, transfers or any write of any kind. Individual tax lots: cost basis arrives as an average, so harvestable losses are computed from average cost. Anything at all after the client revokes.',
  },
  {
    source: 'Public filings',
    detail: 'SEC EDGAR: 10-K, 10-Q, 8-K, 13F-HR',
    provides: 'Sentences quoted verbatim from the filed document, with the form, the filing date, the page and the time Helm retrieved it. Every quotation on every screen is checked against the source before it is shown.',
    never: 'A forecast, a price target, a recommendation, or a sentence the document does not contain. Filings are public and lag the quarter they describe.',
  },
];

export const VENDOR_FILE = [
  { doc: 'Vendor agreement + data protection exhibit', status: 'Signed 2026-07-01', note: '72-hour breach notice from awareness. Export rights. Not an investment adviser.' },
  { doc: 'Subprocessor register', status: 'Current · 6 entries', note: 'Supabase, Vercel, Resend, PostHog, OpenAI, Plaid. 30-day change notice.' },
  { doc: 'Security questionnaire', status: '17 of 17 answered', note: 'Encryption, access control, penetration testing, incident response, backup and recovery, retention, AI data handling.' },
  { doc: 'Cyber liability certificate', status: '$2M · renews 2027-06', note: 'Carrier certificate on file.' },
  { doc: 'AI data handling statement', status: 'Current', note: 'Portfolio content sent to OpenAI API; not used for training; retained up to 30 days in abuse logs.' },
  { doc: 'SOC 2', status: 'Not held', note: 'Type I report available on request; allow 8 weeks.' },
];
