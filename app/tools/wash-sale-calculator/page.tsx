import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { WashSaleTool } from './wash-sale-tool';

const DESCRIPTION =
  'Free wash sale calculator. Enter a sale at a loss and the purchases around it to see how much IRC 1091 disallows and the new replacement-share basis.';

export const metadata: Metadata = {
  title: 'Wash Sale Calculator: Disallowed Loss | Helm Terminal',
  description: DESCRIPTION,
  openGraph: {
    title: 'Wash Sale Calculator: Disallowed Loss | Helm Terminal',
    description:
      'Work out how much of a loss the wash sale rule disallows, what survives, and the new basis on the shares you bought back. Free, no signup required.',
    url: 'https://helmterminal.dev/tools/wash-sale-calculator',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wash Sale Calculator: Disallowed Loss | Helm Terminal',
    description: 'How much of your loss the wash sale rule disallows, and the new basis. Free, no signup.',
  },
  alternates: { canonical: 'https://helmterminal.dev/tools/wash-sale-calculator' },
};

export default function WashSaleCalculatorPage() {
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
              name: 'Wash Sale Calculator',
              description:
                'Free tool that computes the portion of a capital loss disallowed under IRC §1091, the portion still deductible, and the adjusted basis of the replacement shares.',
              url: 'https://helmterminal.dev/tools/wash-sale-calculator',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: 'How to Calculate a Wash Sale',
              description:
                'Work out the disallowed portion of a capital loss under the wash sale rule and the adjusted basis of the shares bought back.',
              tool: { '@type': 'HowToTool', name: 'Helm Terminal Wash Sale Calculator' },
              step: [
                {
                  '@type': 'HowToStep',
                  name: 'Enter the sale',
                  text: 'Give the sale date, the number of shares sold, the total proceeds and the total cost basis. The loss is the basis minus the proceeds.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Enter every purchase around it',
                  text: 'Add each purchase of the same or a substantially identical security made in the 30 days before the sale, on the sale date, or in the 30 days after, including dividend reinvestments and purchases in other accounts.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Mark any retirement-account purchase',
                  text: 'Tick the retirement box for a purchase made in an IRA or Roth IRA. Under Rev. Rul. 2008-5 that loss is disallowed with no basis restored anywhere, so it is lost rather than deferred.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Read the split',
                  text: 'The disallowed loss is the realized loss multiplied by the replacement shares matched against the shares sold, divided by the shares sold. The remainder stays deductible, before the annual cap under IRC §1211(b).',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Read the new basis',
                  text: 'The disallowed loss is added to the basis of the replacement shares, matched earliest purchase first. That is what makes an ordinary wash sale a deferral rather than a loss of the deduction.',
                },
              ],
            },
          ]),
        }}
      />

      {/* Nav */}
      <SiteNav />

      <WashSaleTool />

      {/* SEO content */}
      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-2xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">What the wash sale rule does</h2>
            <p>
              IRC §1091 disallows a loss on a sale of stock or securities when you acquire the same or a
              substantially identical security within 30 days before or 30 days after that sale. With the sale date
              itself, that is a 61-day window. The loss does not vanish in the ordinary case: §1091(d) adds the
              disallowed amount to the basis of the shares you bought, so it comes back when you eventually sell
              those. The rule delays the deduction rather than cancelling it.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">How the disallowed amount is worked out</h2>
            <p>
              It is proportional. Sell 100 shares at a $1,000 loss and buy 40 back inside the window, and 40 percent
              of the loss is disallowed, leaving $600 deductible. Buy all 100 back and the whole loss is out. Buy
              150 back and still only 100 shares count as replacement property, matched against the shares sold in
              order of acquisition under Reg. §1.1091-1(b). The disallowance is capped at the loss.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">The IRA version is worse</h2>
            <p>
              Buying the replacement inside an IRA or Roth IRA is the one case where the loss is not deferred. Under
              Rev. Rul. 2008-5 the loss on the taxable sale is disallowed and your basis in the IRA is not
              increased, so there is nowhere for the deduction to come back from. An automatic contribution or a
              standing order inside a retirement account can do this without any deliberate repurchase.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">The holding period follows the shares</h2>
            <p>
              Under IRC §1223(3) the replacement shares inherit the period you held the shares you sold. A lot you
              bought yesterday can already be long term if the position it replaced was held for years. This cuts
              both ways and is easy to miss, because a brokerage statement usually shows the purchase date rather
              than the tacked holding period.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">What no calculator can tell you</h2>
            <p>
              Two things. First, whether two securities are substantially identical: the IRS has never defined the
              term for funds, and two different index funds tracking the same index have never been ruled on. Second,
              what you actually bought. §1091 is tested across everything one taxpayer owns, so a dividend
              reinvestment in an account you forgot about, or a purchase by a spouse, counts the same as a
              deliberate repurchase. A calculation is only as complete as the list of purchases behind it.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">Screening a whole book instead of one sale</h2>
            <p>
              This page prices a sale you already know about. Helm works the other direction: it reads the
              transactions in the accounts you connect, finds positions carrying a loss, and screens each one
              against purchases in the previous 30 days across every linked account, retirement accounts included.
              The forward half of the window is unknowable, since those purchases have not happened yet, and any
              account you have not connected stays invisible. Both limits are stated on the result rather than
              buried.
            </p>
          </div>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
