import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { FILING_STATUSES, LATEST_TAX_YEAR, TAX_YEARS } from '@/lib/capital-gains';
import { CapitalGainsTool } from './capital-gains-tool';

const YEAR = LATEST_TAX_YEAR;
const F = TAX_YEARS[YEAR];
const URL = 'https://helmterminal.dev/tools/capital-gains-calculator';
const TITLE = `Capital Gains Tax Calculator ${YEAR} (Federal) | Helm`;

const DESCRIPTION =
  `Free ${YEAR} federal capital gains tax calculator: long-term gain across the 0, 15 and 20% brackets, short-term gain at ordinary rates, and the 3.8% NIIT.`;

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
    description: `Federal tax on a capital gain with the ${YEAR} brackets, bracket by bracket. Free, no signup.`,
  },
  alternates: { canonical: URL },
};

const whole = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
/** "up to $50,400", or for the top bracket "above $640,600" (the previous ceiling). */
const ceiling = (brackets: { upTo: number }[], i: number) =>
  brackets[i].upTo === Infinity ? `above ${whole(brackets[i - 1].upTo)}` : `up to ${whole(brackets[i].upTo)}`;

const FAQ: { q: string; a: string }[] = [
  {
    q: `What are the ${YEAR} long-term capital gains tax rates?`,
    a: `Long-term gains are taxed at 0, 15 or 20 percent depending on total taxable income. For ${YEAR}, the 0 percent rate applies up to ${whole(F.longTerm.single.zeroUpTo)} of taxable income for single filers and ${whole(F.longTerm.mfj.zeroUpTo)} for married filing jointly; the 15 percent rate runs up to ${whole(F.longTerm.single.fifteenUpTo)} single and ${whole(F.longTerm.mfj.fifteenUpTo)} joint; and 20 percent applies above that. The figures are from Rev. Proc. 2025-32.`,
  },
  {
    q: 'How are short-term capital gains taxed?',
    a: 'A gain on an asset held one year or less is added to ordinary income and taxed at the ordinary brackets, which for 2026 run from 10 percent to 37 percent. It is not eligible for the 0, 15 and 20 percent long-term rates.',
  },
  {
    q: 'Does a long-term gain push ordinary income into a higher bracket?',
    a: 'No. Ordinary income is taxed first and fills the brackets from the bottom. The long-term gain stacks on top of it, and only the gain is measured against the 0, 15 and 20 percent thresholds. A large gain can move part of itself from 0 to 15 percent or from 15 to 20 percent, but it does not change the rate on wages.',
  },
  {
    q: 'What is the net investment income tax?',
    a: 'A separate 3.8 percent tax under IRC section 1411 on the lesser of net investment income and the amount by which modified adjusted gross income exceeds $200,000 for single and head of household filers, $250,000 for married filing jointly, or $125,000 for married filing separately. Capital gains count as net investment income. The thresholds are set in the statute and are not indexed for inflation.',
  },
  {
    q: 'What happens when capital losses exceed capital gains?',
    a: 'Short-term and long-term results are netted against each other first. If the year nets to a loss, up to $3,000 of it ($1,500 for married filing separately) is deducted against ordinary income under IRC section 1211(b), and the rest carries forward to later years under section 1212(b), keeping its short-term or long-term character.',
  },
];

export default function CapitalGainsCalculatorPage() {
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
              name: 'Capital Gains Tax Calculator',
              description: `Free tool that computes the federal tax on a capital gain with the ${YEAR} brackets: long-term gain across the 0, 15 and 20 percent rates, short-term gain at ordinary rates, and the 3.8 percent net investment income tax.`,
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

      <CapitalGainsTool />

      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-3xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">The {YEAR} long-term capital gains brackets</h2>
            <p className="mb-4">
              The 0, 15 and 20 percent rates are measured against total taxable income, with the gain stacked on
              top of everything else. These are the {YEAR} amounts from{' '}
              <a href={F.sources.longTerm} className="text-[var(--color-gold)] hover:underline" rel="noopener">
                Rev. Proc. 2025-32, section 3.03
              </a>
              .
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Filing status</th>
                    <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">0% up to</th>
                    <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">15% up to</th>
                    <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">20% above</th>
                  </tr>
                </thead>
                <tbody>
                  {FILING_STATUSES.map((s) => (
                    <tr key={s.value} className="border-b border-[var(--color-border-base)] last:border-0">
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{s.label}</td>
                      <td className="px-4 py-3 text-right font-mono">{whole(F.longTerm[s.value].zeroUpTo)}</td>
                      <td className="px-4 py-3 text-right font-mono">{whole(F.longTerm[s.value].fifteenUpTo)}</td>
                      <td className="px-4 py-3 text-right font-mono">{whole(F.longTerm[s.value].fifteenUpTo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">The {YEAR} ordinary brackets, which short-term gains use</h2>
            <p className="mb-4">
              A gain on something held one year or less is ordinary income. Each rate applies to taxable income up
              to the figure shown, from{' '}
              <a href={F.sources.ordinary} className="text-[var(--color-gold)] hover:underline" rel="noopener">
                Rev. Proc. 2025-32, section 3.01
              </a>
              .
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Rate</th>
                    {FILING_STATUSES.map((s) => (
                      <th key={s.value} className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {F.ordinary.single.map((b, i) => (
                    <tr key={b.rate} className="border-b border-[var(--color-border-base)] last:border-0">
                      <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">{Math.round(b.rate * 100)}%</td>
                      {FILING_STATUSES.map((s) => (
                        <td key={s.value} className="px-4 py-3 text-right font-mono">
                          {ceiling(F.ordinary[s.value], i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="type-h2 mb-2.5">The 3.8 percent on top</h2>
            <p>
              The net investment income tax under IRC section 1411 is 3.8 percent of the lesser of net investment
              income and the excess of modified adjusted gross income over {whole(F.niitThreshold.single)} for single
              and head of household filers, {whole(F.niitThreshold.mfj)} for married filing jointly and{' '}
              {whole(F.niitThreshold.mfs)} for married filing separately, per{' '}
              <a href={F.sources.niit} className="text-[var(--color-gold)] hover:underline" rel="noopener">
                IRS Topic 559
              </a>
              . Those thresholds are written into the statute and do not move with inflation, so a 20 percent gain
              above them is a 23.8 percent gain.
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
                ['/blog/capital-gains-tax-calculator', 'How a capital gains tax calculator works, with two worked examples'],
                ['/blog/capital-gains-vs-losses-explained', 'Capital gains vs capital losses: the complete tax guide'],
                ['/blog/capital-loss-carryover', 'Capital loss carryover: how it works, with the math'],
                ['/blog/tax-loss-harvesting-guide', 'Tax-loss harvesting guide'],
                ['/tools/tlh-calculator', 'Tax-loss harvesting calculator'],
                ['/tools/wash-sale-calculator', 'Wash sale calculator'],
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
            Not tax advice. Federal only; state tax is not included. Bracket figures are the {YEAR} amounts published
            by the IRS, and the IRS pages linked above win if they differ from anything on this page.
          </p>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
