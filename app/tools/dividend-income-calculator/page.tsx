import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { DividendIncomeTool } from './dividend-income-tool';

const URL = 'https://helmterminal.dev/tools/dividend-income-calculator';
const TITLE = 'Dividend Income Calculator (Free, With Reinvestment) | Helm';
const DESCRIPTION =
  'Free dividend income calculator: project yearly dividend income, reinvestment growth, and portfolio value with contributions and dividend growth built in.';

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
    description: 'Project dividend income year by year, with or without reinvestment. Free, no signup.',
  },
  alternates: { canonical: URL },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do you calculate dividend income?',
    a: 'Multiply the dividend yield by the value of the position. A $50,000 position yielding 3 percent pays about $1,500 over the year. The figure moves every year because both the yield the position pays and the value it is paid on change: the yield if the dividend grows, and the value with price moves, contributions, and reinvestment.',
  },
  {
    q: 'Does dividend reinvestment actually make a meaningful difference?',
    a: 'Yes, and the gap compounds. Reinvesting buys more shares, which pay their own dividends the following year, which buy still more shares. Over a decade or longer at a typical yield, a meaningful share of the ending value comes from that compounding rather than from the original investment or its price appreciation alone.',
  },
  {
    q: 'What is a realistic dividend growth rate to use?',
    a: 'That depends entirely on the holding, and this tool has no view on it. A single stock with a history of raising its payout, a broad index fund, and a high-yield fund with a flat or declining payout are three different assumptions. Enter a rate based on the specific holding’s own dividend history, not a market-wide average.',
  },
  {
    q: 'Why does yield on cost make dividend growth look better than it is?',
    a: 'Yield on cost divides the current dividend by the price paid years ago, so it rises every time the dividend is raised, even if the stock has done nothing else. It is not the return being earned today. The current yield, which is the dividend divided by today’s value, is what this calculator uses for the income figure.',
  },
  {
    q: 'Does this calculator account for taxes on dividends?',
    a: 'No. Dividend income here is pre-tax. Qualified dividends are taxed at the same 0, 15, and 20 percent federal rates as long-term capital gains, while ordinary (non-qualified) dividends are taxed as ordinary income; which applies depends on the holding period and the type of payer. That is a separate calculation from the projection this tool runs.',
  },
  {
    q: 'What does this calculator not account for?',
    a: 'It holds the yield, dividend growth rate, price growth rate, and contribution constant for every year entered, which real holdings never do. It does not model taxes, fees, dividend cuts, or a variable contribution schedule. It is a projection built from the assumptions entered, not a forecast.',
  },
];

export default function DividendIncomeCalculatorPage() {
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
              name: 'Dividend Income Calculator',
              description:
                'Free tool that projects dividend income and portfolio value year by year from a starting investment, dividend yield, dividend growth rate, share price growth rate, contributions, and whether dividends are reinvested.',
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

      <DividendIncomeTool />

      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-3xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">How the projection compounds</h2>
            <p className="mb-3">
              Each year works in a fixed order. Any contribution is added to the portfolio first. That year&rsquo;s
              dividend income is the dividend yield times the resulting value, and the yield itself compounds by the
              dividend growth rate every year, separately from the share price. Price growth is then applied to the
              value. If reinvestment is on, the dividend is added back to the portfolio at year end; if it is off,
              the dividend is paid out and never adds to portfolio value again.
            </p>
            <p>
              The dividend growth rate and the price growth rate are two different assumptions on purpose. A
              holding&rsquo;s dividend can rise faster or slower than its price, and the gap between the two is a
              real driver of how much of the ending value comes from income versus appreciation.
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
                ['/blog/dividend-income-calculator', 'How dividend income calculators compound, with a worked example'],
                ['/blog/qualified-vs-ordinary-dividends', 'Qualified vs ordinary dividends: how each is taxed'],
                ['/blog/capital-gains-vs-losses-explained', 'Capital gains vs capital losses: the complete tax guide'],
                ['/tools/capital-gains-calculator', 'Capital gains tax calculator'],
                ['/tools/etf-overlap', 'ETF overlap tool'],
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
            Illustrative only, not a forecast and not advice. Yield, growth, and contributions are held constant for
            every year entered, which no real holding does, and no taxes are modeled.
          </p>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
