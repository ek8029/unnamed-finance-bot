import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'MyThesis Alternative Without the Per-Holding Meter | Helm Terminal',
  description:
    'Looking for a mythesis.ai alternative? MyThesis charges $49.99 to $199.99/month based on how many holdings you watch. Helm Terminal monitors your whole portfolio at $20/month flat, with verbatim dated SEC citations.',
  openGraph: {
    title: 'A MyThesis Alternative Without the Per-Holding Meter',
    description:
      'MyThesis meters by holding, up to $199.99/month for 25 positions. Helm watches your whole book at $20/month flat, with verbatim dated citations.',
    url: 'https://helmterminal.dev/mythesis-alternative',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A MyThesis Alternative Without the Per-Holding Meter',
    description: 'MyThesis meters by holding. Helm watches your whole portfolio at one flat price.',
  },
  alternates: { canonical: 'https://helmterminal.dev/mythesis-alternative' },
};

const FAQS = [
  {
    q: 'Is there a free MyThesis alternative?',
    a: 'Helm Terminal is free to start: portfolio aggregation, free AI stock analysis, and the actions inbox cost nothing. The thesis-monitoring layer is part of Helm Pro at $20/month for unlimited holdings. MyThesis has a free tier limited to a single holding.',
  },
  {
    q: 'What is the difference between MyThesis and Helm Terminal?',
    a: 'Both monitor investment theses and are live as of July 2026. MyThesis is a dedicated thesis-alert tool: manually entered holdings, per-pillar status, an alert feed, priced per holding from $49.99/month for 5 positions. Helm runs thesis monitoring inside a whole-portfolio agent: brokerage sync via Plaid, tax-loss harvesting, concentration and earnings scans, and a daily brief, at $20/month flat, and every thesis alert quotes the underlying filing or article verbatim with its date.',
  },
  {
    q: 'Does Helm Terminal track investment theses like MyThesis?',
    a: 'Yes. You write the pillars behind each holding (or let Helm draft them), and Helm scores SEC filings, earnings, news, and price against each pillar every trading day. When one weakens or breaks, the alert cites the exact source line with its date, so you can verify it yourself in one click.',
  },
  {
    q: 'How many holdings can I monitor on Helm vs MyThesis?',
    a: 'MyThesis meters by position: $49.99/month covers 5 holdings, $89.99 covers 10, and $199.99 covers 25. Helm Pro covers your entire portfolio at $20/month with no per-holding cap, whether you hold 5 positions or 60.',
  },
  {
    q: 'Does MyThesis connect to my brokerage?',
    a: 'As of July 2026, MyThesis holdings are entered manually. Helm connects to 12,000+ institutions through Plaid with read-only access, so your positions, cost basis, and accounts stay in sync automatically, and you can also add manual holdings.',
  },
];

const COST_ROWS = [
  ['5 holdings', '$49.99/mo ($600/yr)', '$20/mo ($240/yr)'],
  ['10 holdings', '$89.99/mo ($1,080/yr)', '$20/mo ($240/yr)'],
  ['25 holdings', '$199.99/mo ($2,400/yr)', '$20/mo ($240/yr)'],
  ['40 holdings', 'Not offered (25 max)', '$20/mo ($240/yr)'],
];

export default function MyThesisAlternativePage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'A MyThesis Alternative Without the Per-Holding Meter',
      description:
        'MyThesis charges by how many holdings you watch, up to $199.99/month for 25. Helm Terminal monitors the whole portfolio at $20/month flat, with verbatim dated SEC citations.',
      datePublished: '2026-07-16',
      dateModified: '2026-07-16',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: 'https://helmterminal.dev/mythesis-alternative',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'MyThesis Alternative', item: 'https://helmterminal.dev/mythesis-alternative' },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/thesis-monitoring" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/best-thesis-trackers" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Compare</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">MyThesis Alternative</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1] mb-5">
            Looking for a mythesis.ai alternative?
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            MyThesis is a clean, dedicated thesis-alert tool, and it is live, which already puts it ahead of most of this category. The catch is the meter: it charges by how many holdings you watch, up to $199.99 a month for 25 positions. Helm Terminal watches your whole portfolio, thesis monitoring included, at $20 a month flat.
          </p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">The per-holding math</h2>
            <p className="mb-4">Thesis monitoring gets more valuable the more of your portfolio it covers, because the risks that hurt most, shared drivers, hidden concentration, a thesis quietly breaking while the price holds up, live across positions, not inside one. Metering by holding prices the tool against its own usefulness. Here is what watching a real portfolio costs on each:</p>
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[15px] text-left border-collapse min-w-[480px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="p-3 font-semibold text-[var(--color-text-primary)]">Portfolio size</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">MyThesis</th>
                    <th className="p-3 font-semibold text-[var(--color-gold)]">Helm Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {COST_ROWS.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{r[0]}</td>
                      <td className="p-3">{r[1]}</td>
                      <td className="p-3 text-[var(--color-text-primary)]">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-2">MyThesis pricing from mythesis.ai, verified July 14, 2026; may change. MyThesis also offers a free tier limited to 1 holding.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Thesis alerts are one layer, not the whole job</h2>
            <p className="mb-3">MyThesis does one thing: thesis alerts on manually entered positions. That is a real job, and it does it with a tidy UI, per-pillar status, and severity-tagged alerts.</p>
            <p className="mb-3">Helm treats the thesis as connective tissue inside a broader agent that watches your actual book. Connect your brokerages through Plaid (read-only, it can never trade or move money) and the same positions that carry your theses also get tax-loss harvesting detection, concentration and earnings-exposure scans, and a daily brief on what moved and why. When a thesis pillar weakens, that shows up next to the tax and risk context for the same position, because in a real portfolio those are one decision, not three apps.</p>
            <p>You can also start a thesis from scratch: Helm drafts the pillars for any holding, you edit what you actually believe, and monitoring starts that day.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Receipts, not just source names</h2>
            <p className="mb-3">When MyThesis flags your thesis, the alert names its source. When Helm flags a pillar, the alert quotes the exact line from the SEC filing or article, with its date and a link, so you can verify the claim in one click before you act on it. A thesis alert is an argument about your money; the difference between "per AP News" and the actual sentence from the 10-Q is the difference between trusting the tool and checking its work.</p>
            <p>We hold ourselves to that standard in public: <Link href="/masthead" className="text-[var(--color-gold)] hover:underline">the masthead</Link> is a running log of calls Helm made, with the dated evidence behind each one. Every <Link href="/thesis/nvda" className="text-[var(--color-gold)] hover:underline">living thesis page</Link> shows its pillars, what would break them, and the verbatim citations tested against them.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">Watch every thesis. Pay one flat price.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm monitors the reasons behind every position you hold, quotes the evidence verbatim, and runs taxes, risk, and earnings on the same book. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
          </section>

          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            Comparison reflects public information as of July 16, 2026 and is provided for general information, not financial advice. Verify current details with MyThesis directly. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
