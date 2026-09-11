// lib/onboarding/v3-copy.ts
// Every v3 string. tests/onboarding-v3-copy.test.ts lints all of it.
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export const V3_COPY = {
  later: 'Do this later',
  step: (n: number) => `Step ${n} of 4`,
  ask: {
    title: 'Start with what you own.',
    loadError: 'Could not load your accounts.',
    lede: 'Connect a brokerage, or type in the positions you hold. Either one gives Helm something real to read.',
    syncing: 'Linked. Your holdings are syncing and show up here in a minute or two. You can leave this page; the sync keeps going.',
    duplicate: 'That brokerage is already connected. Accounts shows the connection.',
    syncFailed: 'The connection is saved, but the first import did not finish. Accounts shows its status and the next sync runs on its own.',
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
    lede: 'Helm reads across accounts, so it works best when it can see all of them. Add the others now, or later from Accounts.',
    one: 'One account is enough to start. Exposure, overlap and the tax view only ever see what the book holds, so anything held somewhere else stays invisible to them.',
    many: (n: number, positions: number, value: string) => `${n} ${plural(n, 'account', 'accounts')}, ${positions} ${plural(positions, 'position', 'positions')}, ${value}. Add another, or continue.`,
    yourEntry: 'What you typed in',
    andMore: (n: number) => `and ${n} more`,
    shares: (n: string) => `${n} ${plural(Number(n), 'share', 'shares')}`,
    syncing: (institution: string) => `Syncing ${institution}`,
    positions: (n: number) => `${n} ${plural(n, 'position', 'positions')}`,
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
    bookError: 'Helm could not read your accounts just now.',
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
    title: 'What do you want to see first?',
    lede: 'Pick as many as you want. Helm leads with them on the next screen and in your brief.',
    options: {
      exposure: 'How much of everything I actually own',
      receipts: 'Whether the reasons I hold these still hold',
      changes: 'What changed in these positions',
      overlap: 'Overlap between my accounts',
    },
    hints: {
      // Each line describes the picture on its own card, which is not always
      // the same cut as the card the reveal then leads with: the sector map
      // counts a fund as a fund, while the reveal looks through it.
      exposure: 'Your book by sector, with a fund counted as a fund.',
      receipts: 'The filings and news behind your largest position, quoted.',
      changes: 'The session\'s biggest moves among the names you hold.',
      overlap: 'The names sitting in more than one of your accounts.',
    },
    pending: 'Your positions fill in here when the first import lands.',
    empty: 'Your book has no priced positions yet.',
    buckets: {
      funds: 'Funds',
      crypto: 'Crypto',
      unclassified: 'No sector on file',
    },
    sectorTop: (label: string, pct: number) => `${label} is your largest sector at ${pct}% of the book.`,
    movedToday: 'Today',
    movedLastSession: 'Last session',
    quiet: 'Nothing on the book moved more than 2% in the last session.',
    receiptOn: (t: string) => `Helm's read on ${t}`,
    sharedNames: (n: number) => `${n} ${plural(n, 'name', 'names')} in more than one account, funds included`,
    noShared: 'Nothing is in more than one account yet.',
    heldIn: (t: string, n: number) => `${t} is held in ${n} of these accounts`,
    sourceTags: ['10-K', '10-Q', '8-K', 'news'],
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
