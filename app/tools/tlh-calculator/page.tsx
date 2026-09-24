import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { TLHCalculator } from './tlh-calculator';

export const metadata: Metadata = {
  title: 'Tax-Loss Harvesting Calculator | Helm Terminal',
  description:
    'Free tax-loss harvesting calculator. Enter your losses and tax bracket to see estimated annual savings, short-term vs long-term, and the $3,000 deduction.',
  openGraph: {
    title: 'Tax-Loss Harvesting Calculator | Helm Terminal',
    description: 'See how much tax-loss harvesting could save you. Free calculator for self-directed investors.',
    url: 'https://helmterminal.dev/tools/tlh-calculator',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tax-Loss Harvesting Calculator | Helm Terminal',
    description: 'See how much tax-loss harvesting could save you. Free, no signup required.',
  },
  alternates: { canonical: 'https://helmterminal.dev/tools/tlh-calculator' },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is tax-loss harvesting?',
    a: 'Tax-loss harvesting is selling an investment for less than its cost basis and using the realized loss to offset a realized capital gain, or, within limits, ordinary income, in the same tax year. The loss has to be realized through an actual sale; a paper loss on a position still held does not count. It is a federal individual income tax mechanism, not investment advice about which position to sell.',
  },
  {
    q: 'How much capital loss can you deduct per year?',
    a: 'After netting all short-term and long-term gains and losses for the year, up to $3,000 of any remaining net capital loss can be deducted against ordinary income, or $1,500 for a married individual filing a separate return, under section 1211(b). Any loss beyond that annual limit is not lost; it carries forward to future tax years under section 1212(b).',
  },
  {
    q: 'Does tax-loss harvesting reduce taxes or defer them?',
    a: 'For most investors who reinvest the proceeds, harvesting mostly defers tax rather than eliminating it, because the replacement position takes on the same lower cost basis, so a future sale of the replacement produces a larger taxable gain than it otherwise would. The immediate benefit is real: current-year tax is lower. Whether the deferral becomes permanent depends on what happens to the replacement position afterward.',
  },
  {
    q: 'What is the wash sale rule?',
    a: 'The wash sale rule disallows a loss deduction if the taxpayer buys the same security, or one that is substantially identical, within 30 days before or 30 days after the sale that produced the loss, under section 1091. That creates a 61-day window centered on the sale date. A disallowed loss is not lost permanently; it is added to the cost basis of the newly purchased shares.',
  },
  {
    q: 'Can capital losses be carried forward?',
    a: 'Yes. Any net capital loss beyond the annual deduction limit carries forward to future tax years, keeping its short-term or long-term character, under section 1212(b), with no limit on how many years it can be carried forward. It can offset gains in a later year or, again subject to the annual limit, be deducted against ordinary income.',
  },
  {
    q: 'When does tax-loss harvesting produce a saving?',
    a: 'It produces a saving in the year it is used, either by reducing tax on a gain realized that year or by lowering taxable ordinary income up to the annual limit. The saving tends to be larger when it offsets a short-term gain, which is taxed at ordinary rates, than when it offsets a long-term gain taxed at the lower preferential rates. Whether that saving compounds over time depends on what happens to any replacement position bought with the proceeds.',
  },
];

export default function TLHCalculatorPage() {
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
              name: 'Tax-Loss Harvesting Calculator',
              description: 'Free calculator to estimate annual tax savings from tax-loss harvesting.',
              url: 'https://helmterminal.dev/tools/tlh-calculator',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: 'How to Calculate Tax-Loss Harvesting Savings',
              description: 'Use the Helm Terminal calculator to estimate how much you could save by harvesting investment losses for tax purposes.',
              tool: { '@type': 'HowToTool', name: 'Helm Terminal Calculator' },
              step: [
                {
                  '@type': 'HowToStep',
                  name: 'Enter your unrealized losses',
                  text: 'Input the total dollar amount of unrealized losses across your taxable brokerage accounts.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Select your tax bracket',
                  text: 'Choose your federal income tax bracket (22%–37%) and optionally add your state tax rate.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Specify short-term vs long-term',
                  text: 'Indicate whether losses are short-term (held < 1 year) or long-term, as they offset gains at different rates.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Review estimated savings',
                  text: 'The calculator shows your estimated annual tax savings, including the $3,000 ordinary income deduction and capital gains offsets.',
                },
              ],
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

      {/* Nav */}
      <SiteNav />

      {/* Rendered here, not in the client component: useSearchParams under a
          bare Suspense boundary keeps that whole subtree out of the server HTML,
          which is how this page shipped for months with no H1. */}
      <section className="relative z-10 container mx-auto px-6 pt-16 max-w-xl">
        <div className="mb-12">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Free tool</div>
          <h1 className="font-sans font-bold text-[30px] sm:text-[36px] md:text-[44px] tracking-tight leading-[1.08] mb-3">
            Tax-Loss <span className="text-[var(--color-gold)]">Harvesting</span> Calculator
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed">
            How much could tax-loss harvesting save you?
          </p>
        </div>
      </section>

      <Suspense>
        <TLHCalculator />
      </Suspense>

      {/* SEO content */}
      <section className="relative z-10 container mx-auto px-6 py-16 max-w-2xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            This describes the federal rules for individuals. It is not tax advice.
          </p>
          <div>
            <h2 className="type-h2 mb-2.5">What is tax-loss harvesting?</h2>
            <p>
              Tax-loss harvesting is the practice of selling an investment for less than its cost basis and using
              that realized loss to offset a realized capital gain elsewhere in the same tax year, or, within
              limits, to offset ordinary income. The loss only counts for tax purposes once the position is
              actually sold. An unrealized loss sitting in a portfolio does nothing on a tax return until it is
              locked in by a sale, which is why harvesting is a decision about timing a sale, not a prediction
              about where a security is headed next. It works the same way whether the loss comes from a single
              stock, a fund, or a crypto position, since the federal rules apply to capital assets generally.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">How losses net against gains</h2>
            <p>
              Losses and gains do not net against each other freely. Short-term results, on positions held one
              year or less, are netted against each other first, producing a single net short-term gain or loss
              for the year. Long-term results, on positions held more than one year, are netted separately,
              producing a single net long-term gain or loss. Only after each bucket has its own net figure are the
              two combined against each other: a net short-term loss offsets a net long-term gain, and a net
              long-term loss offsets a net short-term gain. The order matters because short-term gains are taxed
              at ordinary income rates while long-term gains get lower preferential rates, so a dollar of
              short-term loss is worth more when it offsets a short-term gain than when it offsets a long-term
              one, and a taxpayer harvesting losses to target a specific gain needs to track which bucket that
              gain sits in.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">The annual deduction limit and carryover</h2>
            <p>
              If losses still exceed gains after all of that netting, the remainder can be deducted against
              ordinary income, but only up to $3,000 a year, or $1,500 for a married individual filing a separate
              return, under{' '}
              <a
                href="https://www.law.cornell.edu/uscode/text/26/1211"
                className="text-[var(--color-gold)] hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                26 U.S. Code &sect;1211(b)
              </a>
              . Anything beyond that annual cap is not lost. It carries forward into future tax years, keeping its
              original short-term or long-term character, under{' '}
              <a
                href="https://www.law.cornell.edu/uscode/text/26/1212"
                className="text-[var(--color-gold)] hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                26 U.S. Code &sect;1212(b)
              </a>
              , with no limit on how many years it can carry forward. A large loss realized in one year can
              therefore keep producing deductions and offsets for years afterward, a year at a time.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">The wash sale rule</h2>
            <p>
              A realized loss can still be disallowed by the wash sale rule. Under{' '}
              <a
                href="https://www.law.cornell.edu/uscode/text/26/1091"
                className="text-[var(--color-gold)] hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                26 U.S. Code &sect;1091
              </a>
              , a loss is disallowed if the taxpayer acquires, or enters a contract or option to acquire,
              substantially identical stock or securities within the 30 days before the sale or the 30 days after
              it, a 61-day window centered on the sale date. The rule applies across accounts, including an IRA,
              and to purchases made by a spouse filing jointly, not only the account where the sale happened. A
              disallowed loss is not erased. It is added to the cost basis of the replacement shares, so it is
              deferred rather than lost outright. Helm Terminal, the product this calculator is part of, runs this
              30-day lookback automatically across the brokerage accounts a user links, as part of its paid Pro
              plan; this calculator itself is free and needs no account.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">Why harvesting mostly defers tax, not eliminates it</h2>
            <p>
              Harvesting a loss rarely eliminates a tax bill outright. If the proceeds are reinvested in a
              similar, but not substantially identical, position to preserve market exposure, that replacement
              carries the same lower cost basis as the position that was sold. When the replacement is eventually
              sold at a gain, the built-in gain is measured from that lower basis, so more of the eventual sale
              price is taxable than it would have been without harvesting. For an investor who keeps reinvesting
              rather than pulling money out of the market, the practical effect of harvesting is usually to move a
              tax bill from the current year into a future one, when the deferred gain is finally realized, rather
              than to remove the bill entirely.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">A worked example</h2>
            <p>
              An investor who realizes an $8,000 long-term loss and a $5,000 long-term gain in the same year nets
              them against each other first, leaving a $3,000 net long-term loss. With no other gain that year to
              absorb it, the full $3,000 is deducted against ordinary income, the maximum allowed under section
              1211(b), and nothing carries forward, since the loss and the annual limit happen to match exactly.
              If the loss had instead been $12,000 against the same $5,000 gain, the net loss would be $7,000:
              $3,000 deducted against ordinary income this year, and the remaining $4,000 carried forward as a
              long-term capital loss into next year under section 1212(b), available to offset a future gain or,
              again subject to the annual limit, more ordinary income.
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
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
