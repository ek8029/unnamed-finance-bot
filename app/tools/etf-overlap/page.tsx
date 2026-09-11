import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { ETFOverlapTool } from './etf-overlap-tool';

export const metadata: Metadata = {
  title: 'ETF Overlap Tool | Helm Terminal',
  description:
    'Free ETF overlap tool. Pick two funds and see which companies they both hold, with each fund’s weight in the shared names. Compares the ten largest holdings of 35 funds. No signup.',
  openGraph: {
    title: 'ETF Overlap Tool | Helm Terminal',
    description:
      'Check ETF overlap between two funds. See the companies they both hold and what each fund devotes to them. Free, no signup required.',
    url: 'https://helmterminal.dev/tools/etf-overlap',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ETF Overlap Tool | Helm Terminal',
    description: 'See which companies two funds both hold. Free, no signup required.',
  },
  alternates: { canonical: 'https://helmterminal.dev/tools/etf-overlap' },
};

export default function ETFOverlapPage() {
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
              name: 'ETF Overlap Tool',
              description:
                'Free tool that compares the ten largest holdings of two ETFs and reports the companies they share along with each fund’s weight in those names.',
              url: 'https://helmterminal.dev/tools/etf-overlap',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              creator: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'HowTo',
              name: 'How to Check ETF Overlap Between Two Funds',
              description:
                'Use the Helm Terminal ETF overlap tool to find the companies two funds both hold among their ten largest holdings.',
              tool: { '@type': 'HowToTool', name: 'Helm Terminal ETF Overlap Tool' },
              step: [
                {
                  '@type': 'HowToStep',
                  name: 'Pick the first fund',
                  text: 'Choose fund A from the list of 35 funds that have constituent data on file.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Pick the second fund',
                  text: 'Choose fund B. The comparison updates as soon as both funds are selected.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Read the shared holdings',
                  text: 'The table lists every company appearing in both funds’ ten largest holdings, with its weight inside each fund.',
                },
                {
                  '@type': 'HowToStep',
                  name: 'Read both summed weights',
                  text: 'Two figures are reported separately: the share of fund A sitting in the shared names, and the share of fund B sitting in the same names. Both count only the ten largest holdings, so each is a floor on the real overlap.',
                },
              ],
            },
          ]),
        }}
      />

      {/* Nav */}
      <SiteNav />

      <ETFOverlapTool />

      {/* SEO content */}
      <section className="relative z-10 container mx-auto px-6 pb-16 max-w-2xl">
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <div>
            <h2 className="type-h2 mb-2.5">What is ETF overlap?</h2>
            <p>
              ETF overlap is the part of two funds that is the same company twice. Funds are baskets, and two
              baskets built on the same market pull from the same pool of large companies. Holding both does not
              give you two sets of exposure to that pool. It gives you one set, weighted by whatever each fund
              assigns to the names they share.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">Why the two percentages differ</h2>
            <p>
              A shared holding rarely carries the same weight in both funds. A concentrated technology fund can
              put four times the weight on a chipmaker that a broad index fund puts on it. That is why this page
              reports two numbers instead of one blended figure. Each says what share of that specific fund sits in
              the names both funds hold.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">What this tool does not measure</h2>
            <p>
              It compares the ten largest holdings of each fund. It does not read the full basket, so it cannot
              report total overlap, and it does not estimate one. Two funds can share nothing in their top tens and
              still hold hundreds of the same companies further down. Treat a figure here as the part of the
              overlap that is visible at the top, not the whole of it.
            </p>
          </div>
          <div>
            <h2 className="type-h2 mb-2.5">What overlap looks like across a whole portfolio</h2>
            <p>
              Comparing two funds is a single question. The portfolio version is harder, because the same company
              can reach you through an index fund in a retirement account, a sector fund in a brokerage account,
              and shares you hold directly, and no single statement adds those up. Helm reads the positions in the
              accounts you connect and maps fund holdings back to the underlying companies, working from the same
              look-through data this page uses.
            </p>
          </div>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
