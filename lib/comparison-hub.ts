/**
 * The tool-comparison half of /compare.
 *
 * Two separate problems shared one cause. The homepage nav item labelled
 * "Compare" pointed at /best-thesis-trackers, so the one place a visitor is
 * invited to compare Helm against anything landed them on a roundup of thesis
 * monitors. And the ~25 comparison pages that already exist, most of them blog
 * posts about terminals, trackers and budgeting apps, had no hub at all, so
 * nothing inside the site linked to them.
 *
 * Both fixes are the same list. Thesis monitors are ONE of five categories
 * here, deliberately, and not the first one. Helm reads a book across
 * brokerages: exposure, taxes, earnings, the daily brief, and the reasons
 * behind a position. A comparison surface that only lines Helm up against
 * thesis trackers describes a fifth of the product.
 *
 * Every entry points at a page that already exists and is already in the
 * sitemap. Adding a row here does not create a route.
 */

export interface ComparisonEntry {
  /** What the reader is coming from. */
  name: string;
  href: string;
  /** One line on where that tool stops. No prices: they go stale. */
  note: string;
}

export interface ComparisonCategory {
  id: string;
  title: string;
  /** Where Helm sits relative to the whole category. */
  standing: string;
  entries: ComparisonEntry[];
}

export const COMPARISON_CATEGORIES: ComparisonCategory[] = [
  {
    id: 'terminals',
    title: 'Terminals and research platforms',
    standing:
      'Deep data on any company you care to look up. The work still starts with you deciding what to look up, and ends when you close the tab.',
    entries: [
      {
        name: 'Bloomberg Terminal',
        href: '/blog/best-bloomberg-terminal-alternatives',
        note: 'Institutional depth at $24,000 a year.',
      },
      {
        name: 'Bloomberg, the free options',
        href: '/blog/free-bloomberg-terminal-alternative',
        note: 'What $0 actually covers of a terminal.',
      },
      {
        name: 'Koyfin',
        href: '/blog/best-koyfin-alternatives',
        note: 'Sharp dashboards, and a free tier that keeps shrinking.',
      },
      {
        name: 'Morningstar',
        href: '/blog/best-morningstar-alternatives',
        note: 'Ratings and fund research, light on your own book.',
      },
      {
        name: 'Seeking Alpha',
        href: '/blog/best-seeking-alpha-alternatives',
        note: 'The crowd is the product and the problem.',
      },
      {
        name: 'Simply Wall St',
        href: '/blog/best-simply-wall-st-alternatives',
        note: 'Per stock snowflakes that stop at the portfolio line.',
      },
      {
        name: 'TIKR',
        href: '/blog/best-tikr-alternatives',
        note: 'Institutional fundamentals, history depth behind the paywall.',
      },
      {
        name: 'Atom Finance',
        href: '/blog/best-atom-finance-alternatives',
        note: 'Acquired, and the consumer terminal went quiet.',
      },
      {
        name: 'Stock Rover',
        href: '/blog/best-stock-rover-alternatives',
        note: 'One of the deepest screeners built for retail.',
      },
      {
        name: 'Finviz',
        href: '/blog/best-finviz-alternatives',
        note: 'Excellent screener, never built for after you buy.',
      },
      {
        name: 'Yahoo Finance',
        href: '/blog/best-yahoo-finance-alternatives',
        note: 'Where most people start, and eventually outgrow.',
      },
      {
        name: 'Public.com',
        href: '/blog/best-public-com-alternatives',
        note: 'Good app, and its view stops at the money held there.',
      },
    ],
  },
  {
    id: 'trackers',
    title: 'Portfolio and net worth trackers',
    standing:
      'They answer what you own and what it is worth. Helm starts from that same ledger and reads it: concentration, harvestable losses, earnings landing this week.',
    entries: [
      {
        name: 'Kubera',
        href: '/blog/best-kubera-alternatives',
        note: 'Built for balance sheets full of alternatives.',
      },
      {
        name: 'Sharesight',
        href: '/blog/best-sharesight-alternatives',
        note: 'An excellent record keeper with a ledger view of the world.',
      },
      {
        name: 'Empower (Personal Capital)',
        href: '/blog/best-personal-capital-alternatives',
        note: 'Free dashboard, with a sales call attached.',
      },
    ],
  },
  {
    id: 'budgeting',
    title: 'Budgeting and money apps',
    standing:
      'Built around cash flow, thin on the brokerage side. Helm never touches a budget and starts at the brokerage account.',
    entries: [
      {
        name: 'Mint',
        href: '/blog/best-mint-alternatives',
        note: 'Closed in 2024, and the migration dropped history.',
      },
      {
        name: 'Monarch',
        href: '/blog/best-monarch-alternatives',
        note: 'Took most of the Mint migration.',
      },
      {
        name: 'Copilot Money',
        href: '/blog/best-copilot-money-alternatives',
        note: 'The best designed budgeting app on iOS.',
      },
      {
        name: 'Quicken Simplifi',
        href: '/blog/best-quicken-simplifi-alternatives',
        note: 'The cheapest credible budgeting app.',
      },
    ],
  },
  {
    id: 'advisor',
    title: 'Advisor and held-away tools',
    standing:
      'Built for an advisor reading accounts that belong to someone else. Helm reads the same accounts for the person who owns them.',
    entries: [
      {
        name: 'Pontera',
        href: '/blog/best-pontera-alternatives',
        note: 'After Fidelity and Schwab restricted credential sharing.',
      },
      {
        name: 'ByAllAccounts',
        href: '/blog/best-byallaccounts-alternatives',
        note: 'Aggregation, after the Pello deal collapsed.',
      },
      {
        name: 'Morningstar Direct',
        href: '/blog/morningstar-direct-alternatives',
        note: 'Quote priced in the five figures per seat.',
      },
    ],
  },
  {
    id: 'thesis',
    title: 'Thesis monitors',
    standing:
      'The nearest neighbours to one part of Helm. Writing down why you own something, and having filings and reporting read back against it, is a feature here rather than the whole product.',
    entries: [
      {
        name: 'The category, compared',
        href: '/best-thesis-trackers',
        note: 'Every thesis tracker worth naming, in one table.',
      },
      {
        name: 'MyThesis',
        href: '/mythesis-alternative',
        note: 'Priced per holding, which caps how much you track.',
      },
      {
        name: 'UseThesis',
        href: '/usethesis-alternative',
        note: 'Still gated behind a waitlist.',
      },
      {
        name: 'Vela',
        href: '/vela-alternative',
        note: 'Research notes, without the book underneath.',
      },
    ],
  },
];

export const COMPARISON_ENTRY_COUNT = COMPARISON_CATEGORIES.reduce(
  (n, c) => n + c.entries.length,
  0,
);
