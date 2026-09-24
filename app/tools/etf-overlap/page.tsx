import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { ETFOverlapTool } from './etf-overlap-tool';

export const metadata: Metadata = {
  title: 'ETF Overlap Tool | Helm Terminal',
  description:
    'Free ETF overlap tool. Pick two funds and see which companies they both hold and the weight each fund gives the shared names. Covers 35 funds, no signup.',
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

// Rendered as FAQPage schema and as the visible FAQ section. Every answer
// restates a fact the explainer above it already makes; nothing new is claimed.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is ETF overlap?',
    a: 'ETF overlap is the part of two funds that is the same company held twice. Funds built on the same market draw from the same pool of large companies, so holding both gives one set of exposure to those names, weighted by what each fund assigns to them, not two.',
  },
  {
    q: 'How does an ETF overlap calculator work?',
    a: 'It takes the holdings list of each fund, matches the companies that appear in both, and reports the weight each fund gives the shared names. This tool compares the ten largest holdings of each of the 35 funds on file and shows the common names with both weights.',
  },
  {
    q: 'Why does the tool report two overlap percentages instead of one?',
    a: 'A shared holding rarely carries the same weight in both funds. A concentrated technology fund can weight a chipmaker several times more heavily than a broad index fund does, so each percentage states what share of that specific fund sits in the names both funds hold.',
  },
  {
    q: 'Does overlap between funds in different accounts still count?',
    a: 'Yes. Overlap is about the companies, not the account. An index fund in a retirement account and a sector fund in a brokerage account that both hold the same company add to the same exposure, and no single statement adds those positions up.',
  },
  {
    q: 'Is a high overlap percentage bad?',
    a: 'Not by itself. Two funds tracking the same index overlap almost entirely by design, and holding both adds a second line on a statement rather than a second source of return. The figure describes how concentrated a pair of funds is in the same companies; what it means depends on why each fund is held.',
  },
  {
    q: 'Why are only the ten largest holdings compared?',
    a: 'The ten largest positions carry the most weight in a concentrated fund and are what the data on file covers. The tool does not read the full basket, so it cannot report total overlap and does not estimate one. Two funds can share nothing in their top tens and still hold many of the same companies further down.',
  },
];

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
              '@type': 'FAQPage',
              mainEntity: FAQ.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
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
            <h2 className="type-h2 mb-2.5">Compared with Morningstar X-Ray</h2>
            <p>
              Morningstar&rsquo;s Instant X-Ray is the tool most people know for this job. It reads a whole portfolio
              of funds and reports the stocks that repeat across them, along with sector and style breakdowns, and
              it lives inside a Morningstar account. This page answers the narrower two-fund question, compares the
              ten largest holdings rather than the full basket, and needs no account. For the portfolio-wide
              version of the same look-through across the accounts you hold, see the last section on this page.
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
