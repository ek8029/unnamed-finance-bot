// lib/onboarding/v3-copy.ts
// Every v3 string. tests/onboarding-v3-copy.test.ts lints all of it.
export const V3_COPY = {
  later: 'Do this later',
  step: (n: number) => `Step ${n} of 3`,
  ask: {
    title: 'Start with what you own.',
    loadError: 'Could not load your accounts.',
    lede: 'Connect a brokerage, or type in the positions you hold. Either one gives Helm something real to read.',
    syncing: 'Linked. Your holdings are syncing and show up here in a minute or two. You can leave this page; the sync keeps going.',
    manual: {
      heading: 'Add the positions you hold',
      body: 'Three to five tickers is enough. No credentials, no account numbers. Connect a brokerage later to import the rest.',
    },
    plaid: {
      heading: 'Connect a brokerage',
      body: 'Read-only. Helm can see positions and balances and can never trade, move money or see your login.',
      search: 'Search all brokerages',
      chips: ['Fidelity', 'Schwab', 'Robinhood', 'Vanguard', 'E*TRADE', 'Interactive Brokers'],
      trust: [
        'Read-only. Helm cannot trade or move money.',
        'Disconnect any time from Accounts. Helm removes the connection and everything it imported.',
        'Your login goes to Plaid, never to Helm.',
      ],
    },
  },
  loop: {
    title: 'Is that all of it?',
    lede: 'Helm reads across accounts. Add the others now or later from Accounts.',
    one: 'Most people who pay for Helm hold accounts at two or more brokerages. Add the others and the exposure view shows the overlap between them.',
    many: (n: number, positions: number, value: string) => `${n} accounts, ${positions} positions, ${value}. Add another, or continue.`,
    syncing: (institution: string) => `Syncing ${institution}`,
    positions: (n: number) => `${n} ${n === 1 ? 'position' : 'positions'}`,
    imported: 'imported',
    byHand: 'entered by hand',
    already: (institution: string) => `${institution} is already connected`,
    primary: 'Show me what Helm sees',
    secondary: 'You can add accounts any time from Accounts.',
  },
  reveal: {
    title: 'Here is your book, read.',
    loading: 'Reading your book',
    stillSyncing: (institution: string) => `${institution} is still syncing; this updates when it lands.`,
    error: 'Helm could not read the filings just now.',
    retry: 'Retry',
    exposureHeading: 'What you actually own',
    legendDirect: 'Held directly',
    legendFunds: 'Inside your funds',
    receiptHeading: (t: string) => `The reason you hold ${t}, checked`,
    receiptFallback: (t: string) => `No filing has moved ${t} in the last 90 days.`,
    changesHeading: 'What moved today in these positions',
    changesEmpty: 'Nothing in these positions moved outside its normal range today.',
    primary: 'Open the terminal',
    promise: 'The brief on these positions lands at 9:15 ET tomorrow.',
  },
  firstLook: {
    heading: 'What do you want to see first?',
    options: {
      exposure: 'How much of everything I actually own',
      receipts: 'Whether the reasons I hold these still hold',
      changes: 'What changed in these positions today',
      overlap: 'Overlap between my accounts',
    },
    skip: 'Skip',
    save: 'Continue',
  },
  sidebar: {
    briefTomorrow: 'tomorrow',
    afterBrief: 'after your brief',
    needsCostBasis: 'needs cost basis',
  },
  inbox: {
    secondAccountTitle: 'Add your second account',
    secondAccountBody: 'Exposure and the tax view are only as complete as the book. Accounts holds the connection.',
  },
  portfolio: {
    promise: 'Your first brief on these positions lands at 9:15 ET tomorrow.',
  },
} as const;
