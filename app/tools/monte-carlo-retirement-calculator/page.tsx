import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import {
  DEFAULT_NOMINAL_RETURN,
  DEFAULT_VOLATILITY,
  DEFAULT_INFLATION,
  DEFAULT_SIMULATIONS,
  DEFAULTS_SOURCE,
  INFLATION_SOURCE,
} from '@/lib/monte-carlo-retirement';
import { MonteCarloTool } from './monte-carlo-tool';

const URL = 'https://helmterminal.dev/tools/monte-carlo-retirement-calculator';
const TITLE = 'Monte Carlo Retirement Calculator (Free) | Helm';

const DESCRIPTION =
  'Free Monte Carlo retirement calculator: seeded lognormal return paths, a success rate, and percentile balances at retirement, the end and every 5 years.';

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
    description: 'Thousands of simulated retirement paths, a success rate, and the spread of balances every five years. Free, no signup.',
  },
  alternates: { canonical: URL },
};

const pctText = (rate: number) => `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} percent`;

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is a Monte Carlo retirement calculator?',
    a: `A calculator that, instead of assuming one fixed return every year, draws a different random return for each year of each simulated path and runs the plan many times. This one runs ${DEFAULT_SIMULATIONS.toLocaleString('en-US')} paths by default, each with its own sequence of annual returns drawn from a lognormal distribution with the mean and standard deviation entered on the page. The output is the spread of outcomes across those paths, not a single projection.`,
  },
  {
    q: 'What does the success rate mean?',
    a: 'The share of simulated paths whose balance never reached zero before the last year of retirement. A success rate of 83 percent means 83 out of every 100 paths, under the stated return distribution and withdrawal schedule, stayed above zero the whole way. It is a property of the simulation and its assumptions, not the probability of any real outcome.',
  },
  {
    q: 'Why does the success rate fall when volatility rises but the expected return stays the same?',
    a: 'Because withdrawals make the order of returns matter. A bad year early in retirement removes money that would have compounded through every later year, and a fixed withdrawal takes a larger slice of a smaller balance. Higher volatility puts more paths through that sequence, so more of them run out, even though the average return across all the paths is unchanged.',
  },
  {
    q: 'Where do the default return and volatility come from?',
    a: `From the product page of the iShares Core S&P 500 ETF, IVV: an average annual NAV total return of ${pctText(DEFAULT_NOMINAL_RETURN)} since the fund's inception in May 2000, and a three-year standard deviation of ${pctText(DEFAULT_VOLATILITY)}. The return is a 26-year average of one index fund and the standard deviation covers only the last three years, so both fields can be changed. The default inflation rate of ${pctText(DEFAULT_INFLATION)} is the Federal Reserve's stated longer-run objective.`,
  },
  {
    q: 'Why is the withdrawal entered in today\'s dollars?',
    a: 'Because a withdrawal that stays fixed in nominal dollars buys less every year. The page takes the amount you type, inflates it at the entered rate for every year until retirement, and then keeps inflating it through retirement, so the first-year withdrawal it shows is already larger than the number you entered and the last-year withdrawal is larger still. The balances it reports are nominal, in the dollars of each future year.',
  },
];

export default function MonteCarloRetirementCalculatorPage() {
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
              name: 'Monte Carlo Retirement Calculator',
              description: `Free tool that runs ${DEFAULT_SIMULATIONS.toLocaleString('en-US')} seeded simulated retirement paths with lognormal annual returns and reports the success rate, percentile balances at retirement and at the end, and a balance band every five years.`,
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

      <MonteCarloTool />

      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-3xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">How the paths are built</h2>
            <p className="mb-4">
              Every path starts from the same balance. For each year, the simulation draws one return from a
              lognormal distribution set so that the simple annual return has the arithmetic mean and standard
              deviation entered above, and each draw is independent of every other year and every other path.
              During accumulation the balance earns that return and then the contribution is added. During
              retirement the inflated withdrawal comes out first and what is left earns the return. A balance
              that reaches zero stays at zero and the path is counted as a failure. The random draws come from a
              seeded generator, so the same inputs always print the same numbers, and changing the number of
              paths changes the sample rather than the method.
            </p>
            <p>
              Nothing else is in the model. There are no fees, no taxes, no Social Security, no pension, no
              change in the withdrawal when the balance is high or low, and no relationship between one
              year&rsquo;s return and the next.
            </p>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">What the defaults are</h2>
            <p>
              The default return of {pctText(DEFAULT_NOMINAL_RETURN)} and volatility of {pctText(DEFAULT_VOLATILITY)}{' '}
              are the average annual NAV total return since inception (May 15, 2000) and the three-year standard
              deviation printed on the{' '}
              <a href={DEFAULTS_SOURCE} className="text-[var(--color-gold)] hover:underline" rel="noopener">
                iShares Core S&amp;P 500 ETF product page
              </a>
              , read September 16, 2026. They describe one fund&rsquo;s past. The three-year standard deviation in
              particular covers a calm stretch, and a longer history of the same index runs higher, which is one
              reason the field is editable. The default inflation rate of {pctText(DEFAULT_INFLATION)} is the{' '}
              <a href={INFLATION_SOURCE} className="text-[var(--color-gold)] hover:underline" rel="noopener">
                Federal Reserve&rsquo;s stated longer-run objective
              </a>
              , not a measurement of any year.
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
                ['/blog/monte-carlo-retirement-calculator', 'What a Monte Carlo retirement calculator does, and what its success rate is not'],
                ['/blog/what-is-a-good-sharpe-ratio', 'What is a good Sharpe ratio'],
                ['/blog/time-weighted-vs-money-weighted-return', 'Time-weighted vs money-weighted return'],
                ['/blog/portfolio-diversification-guide', 'Portfolio diversification guide'],
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
            Illustrative only, not a forecast, not advice. The figures are random draws from a distribution you
            chose, applied to the numbers you typed. The pages linked above win if they differ from anything on
            this page.
          </p>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
