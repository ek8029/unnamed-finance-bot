import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { MAX_ROWS } from '@/lib/portfolio-beta';
import { PortfolioBetaTool } from './portfolio-beta-tool';

const URL = 'https://helmterminal.dev/tools/portfolio-beta-calculator';
const TITLE = 'Portfolio Beta Calculator (Free) | Helm';
const DESCRIPTION =
  "Free portfolio beta calculator. Enter each holding's value and beta to get the weighted portfolio beta, top contributors, and the implied index move.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: 'Weight each holding\'s beta by its market value to get the portfolio beta. Free, no signup.',
  },
  alternates: { canonical: URL },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is portfolio beta?',
    a: 'Portfolio beta is the weighted average of the beta of every holding in a book, cash included at a beta of zero. It estimates how much the whole portfolio should move for a given move in a benchmark index, based on how each holding has historically moved relative to that index.',
  },
  {
    q: 'How do you calculate portfolio beta?',
    a: 'Multiply each holding\'s weight, its market value divided by the total portfolio value, by that holding\'s beta, then add the results across every holding. A position that is half the portfolio contributes half of its beta to the total; a position that is one-tenth contributes one-tenth of its beta.',
  },
  {
    q: 'Where does the beta for each holding come from?',
    a: 'This calculator does not fetch beta. It is typed in from a brokerage research page or a financial data site, and it is worth checking the benchmark and lookback window each source uses, because the same ticker can carry a different beta on two different pages.',
  },
  {
    q: 'Why does cash lower portfolio beta?',
    a: 'Cash does not move with the market, so it is treated as a beta of zero. Any dollar sitting in cash contributes nothing to the weighted average, which pulls the overall figure toward zero as the cash weight rises, all else equal.',
  },
  {
    q: 'Can portfolio beta be negative?',
    a: 'Yes, when a position with a large negative beta, such as an inverse fund, carries enough weight to outweigh the positive-beta holdings. A negative portfolio beta implies the book is expected to move opposite the index on average, though this is a historical relationship, not a guarantee.',
  },
];

export default function PortfolioBetaCalculatorPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Portfolio Beta Calculator',
              description:
                'Free tool that computes the weighted-average beta of a portfolio from each holding\'s market value and beta, along with the share of that beta coming from the largest contributors and the implied move for a given index move.',
              url: URL,
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQ.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ]),
        }}
      />

      <SiteNav />

      <PortfolioBetaTool />

      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-3xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">The weighted-average shortcut</h2>
            <p>
              Beta is properly defined as the covariance of a holding&rsquo;s returns with the index&rsquo;s
              returns, divided by the variance of the index&rsquo;s returns. Running that regression on a whole
              portfolio&rsquo;s return series gets the same answer, to a close approximation, as taking the
              weighted average of each holding&rsquo;s individual beta. That shortcut is what this calculator
              does: it never runs a regression, it only weights the beta figures typed in.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">Up to {MAX_ROWS} holdings, plus cash</h2>
            <p>
              Add a row for each position with its current market value and its beta. Cash and cash-equivalent
              balances go in the separate field at the bottom and are always treated as a beta of zero, since a
              dollar in a money market fund does not move with the index.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">What beta misses</h2>
            <p>
              Beta describes co-movement with an index, not total risk. A holding with a low beta can still carry
              large idiosyncratic risk, the part of its price movement that has nothing to do with the market,
              from a product recall to a lost customer. Beta is also computed over a specific lookback window
              against a specific benchmark, so it can shift as that window rolls forward or if the benchmark
              changes, and the relationship it describes is a historical average, not a fixed multiplier that
              holds in every market regime, such as a sharp, correlated sell-off where most betas move toward one.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">Frequently asked questions</h2>
            <div className="space-y-6">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">Related reading</h2>
            <ul className="space-y-1.5">
              {[
                ['/blog/what-is-a-good-sharpe-ratio', 'What is a good Sharpe ratio?'],
                ['/blog/portfolio-concentration-problem', 'The portfolio concentration problem'],
                ['/blog/portfolio-diversification-guide', 'Portfolio diversification guide'],
                ['/tools/etf-overlap', 'ETF overlap tool'],
                ['/tools/capital-gains-calculator', 'Capital gains tax calculator'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-[var(--color-gold)] hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[13px] text-[var(--color-text-muted)]">
            Not investment advice. Beta figures are the ones typed into the form; this page does not fetch or
            verify them against any source, and it computes a linear, historical approximation only.
          </p>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
