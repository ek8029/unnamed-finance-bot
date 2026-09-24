import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

// The eight calculators had no index page and no nav or footer link, so each
// was reachable only from whichever blog posts happened to mention it. Search
// Console showed the RSU calculator going five weeks between crawls. This page
// is the crawl path and the one place that lists them all.

const TITLE = 'Free Investing Calculators and Tools | Helm';
const DESCRIPTION =
  'Free investor calculators: capital gains tax, tax-loss harvesting, wash sales, RSU tax, ETF overlap, dividend income, portfolio beta and Monte Carlo.';
const URL = 'https://helmterminal.dev/tools';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: 'Helm Terminal', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

type Tool = {
  slug: string;
  name: string;
  question: string;
  detail: string;
  guide?: [string, string];
};

const TOOLS: Tool[] = [
  {
    slug: 'capital-gains-calculator',
    name: 'Capital Gains Tax Calculator',
    question: 'What is the federal tax on a gain I am about to realize?',
    detail:
      'Short-term and long-term gains, the 0, 15 and 20 percent thresholds by filing status, and the net investment income tax, using the current year’s published figures.',
    guide: ['/blog/capital-gains-tax-calculator', 'How the calculator works, with two worked examples'],
  },
  {
    slug: 'tlh-calculator',
    name: 'Tax-Loss Harvesting Calculator',
    question: 'How much would realizing a loss offset this year?',
    detail:
      'Nets a realized loss against gains, applies the annual ordinary-income limit, and shows what carries forward.',
    guide: ['/blog/tax-loss-harvesting-guide', 'Tax-loss harvesting guide'],
  },
  {
    slug: 'wash-sale-calculator',
    name: 'Wash Sale Calculator',
    question: 'How much of this loss is disallowed under the wash sale rule?',
    detail:
      'The disallowed portion of a loss when replacement shares are bought inside the 61-day window, the part still deductible, and the adjusted basis of the new lot.',
    guide: ['/blog/wash-sale-rule', 'The wash sale rule, explained'],
  },
  {
    slug: 'rsu-calculator',
    name: 'RSU Tax Calculator',
    question: 'What are my RSUs worth after tax, and is withholding enough?',
    detail:
      'Income at vesting, withholding at the flat supplemental rate, the gap at higher brackets, sell-to-cover, and how large the position is against the rest of a portfolio.',
    guide: ['/blog/rsu-tax-strategies', 'RSU tax strategies'],
  },
  {
    slug: 'etf-overlap',
    name: 'ETF Overlap Tool',
    question: 'Which companies do these two funds both hold?',
    detail:
      'Compares the ten largest holdings of two funds and reports the shared names with the weight each fund gives them.',
    guide: ['/blog/etf-overlap', 'ETF overlap: why two funds can be one bet'],
  },
  {
    slug: 'dividend-income-calculator',
    name: 'Dividend Income Calculator',
    question: 'What does this yield pay per year, and what does reinvesting do to it?',
    detail:
      'Annual and monthly income from a position and yield, with an optional reinvestment path over a chosen number of years.',
    guide: ['/blog/dividend-income-calculator', 'How dividend income compounds'],
  },
  {
    slug: 'portfolio-beta-calculator',
    name: 'Portfolio Beta Calculator',
    question: 'How much does my whole portfolio move with the market?',
    detail:
      'Weights each position’s beta by its share of the portfolio and returns the blended figure.',
    guide: ['/blog/how-to-calculate-portfolio-beta', 'How to calculate portfolio beta'],
  },
  {
    slug: 'monte-carlo-retirement-calculator',
    name: 'Monte Carlo Retirement Calculator',
    question: 'How often does this plan run out of money before I do?',
    detail:
      'Simulates thousands of return paths for a balance, contribution and withdrawal schedule and reports how many of them last.',
    guide: ['/blog/monte-carlo-retirement-calculator', 'What a Monte Carlo retirement simulation tells you'],
  },
];

export default function ToolsIndexPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: TITLE,
              description: DESCRIPTION,
              url: URL,
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: TOOLS.map((t, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: t.name,
                  url: `https://helmterminal.dev/tools/${t.slug}`,
                })),
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
                { '@type': 'ListItem', position: 2, name: 'Tools', item: URL },
              ],
            },
          ]),
        }}
      />

      <SiteNav />

      <section className="relative z-10 container mx-auto px-6 pt-16 pb-10 max-w-2xl">
        <div className="type-eyebrow text-[var(--color-gold)] mb-4">Free tools</div>
        <h1 className="font-sans font-bold text-[30px] sm:text-[36px] md:text-[44px] tracking-tight leading-[1.08] mb-4">
          Investing <span className="text-[var(--color-gold)]">calculators</span>
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
          Eight calculators, each built to answer one question an individual investor runs into. None of them
          needs an account. Where a figure comes from a statute or an IRS publication, the page links to it, and
          each tool explains what it does not measure.
        </p>
      </section>

      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-2xl">
        <ul className="space-y-8">
          {TOOLS.map((t) => (
            <li key={t.slug} className="border-t border-[var(--color-border-base)] pt-6">
              <h2 className="type-h2 mb-1">
                <Link href={`/tools/${t.slug}`} className="hover:text-[var(--color-gold)]">
                  {t.name}
                </Link>
              </h2>
              <p className="text-[15px] text-[var(--color-text-primary)] mb-1.5">{t.question}</p>
              <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-2">{t.detail}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
                <Link href={`/tools/${t.slug}`} className="text-[var(--color-gold)] hover:underline">
                  Open the calculator
                </Link>
                {t.guide && (
                  <Link href={t.guide[0]} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)]">
                    {t.guide[1]}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-14 text-[15px] text-[var(--color-text-secondary)] leading-relaxed space-y-4">
          <h2 className="type-h2 mb-2.5">What these tools have in common</h2>
          <p>
            Each one takes a few numbers you already have and returns one answer, with the arithmetic visible.
            The tax calculators describe the federal rules for individuals and are not tax advice; state tax
            applies on top and varies. The portfolio tools work from the positions you type in and do not see
            anything you have not entered.
          </p>
          <p>
            The connected version of the same questions, run against the accounts you link rather than numbers
            you type, is what the Helm terminal does. This page is for the moment before that, when the question
            is about one sale, one grant or one pair of funds.
          </p>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
