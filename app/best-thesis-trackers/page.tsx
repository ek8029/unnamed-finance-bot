import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'Best Investment Thesis Trackers in 2026 (Compared) | Helm Terminal',
  description:
    'An honest comparison of investment thesis trackers in 2026: Helm Terminal, MyThesis, Vela, Thesis (UseThesis), and ThesisWatch. Which ones are live, which cite SEC filings, and how they price.',
  openGraph: {
    title: 'Best Investment Thesis Trackers in 2026 (Compared)',
    description:
      'Helm vs MyThesis vs Vela vs Thesis vs ThesisWatch. Which thesis-monitoring tools are live today, which cite primary sources, and what they cost.',
    url: 'https://helmterminal.dev/best-thesis-trackers',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Investment Thesis Trackers in 2026 (Compared)',
    description: 'Helm vs MyThesis vs Vela vs Thesis vs ThesisWatch, compared honestly.',
  },
  alternates: { canonical: 'https://helmterminal.dev/best-thesis-trackers' },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is the best investment thesis tracker in 2026?',
    a: 'Helm Terminal is the only thesis-monitoring tool in this comparison that watches your whole portfolio on flat pricing, cites verbatim, dated SEC filings rather than paraphrased signals, and detects shared-driver risk across positions. MyThesis (mythesis.ai) is the other live paid option, but it meters by holding at $4.99 each per month, so the bill scales with the size of your book. Vela and Thesis (UseThesis) are still waitlist or early access as of July 2026.',
  },
  {
    q: 'Which thesis trackers are actually available right now?',
    a: 'As of August 2026, three are live: Helm Terminal (free to start), MyThesis (paid, $4.99 per holding per month with the first free), and ThesisLoop (paid, $60/year or $200/year). Vela (getvela.co) is in private waitlist. Thesis (usethesis.com) is in early access with several features marked "coming soon." Confirm current status and pricing on each site before signing up.',
  },
  {
    q: 'Which thesis tracker cites SEC filings with sources?',
    a: 'Helm cites verbatim, dated excerpts from SEC EDGAR filings and news. Vela reads filings but presents paraphrased interpretations rather than verbatim quotes. MyThesis names the source behind an alert but does not quote the underlying document. Thesis (UseThesis) is a manual note-taking tracker and does not cite filings.',
  },
  {
    q: 'Is there a free investment thesis tracker?',
    a: 'Helm Terminal is free to start: portfolio aggregation, AI stock analysis, and the actions inbox are free. The thesis-monitoring layer is part of Helm Pro at $20/month for your whole portfolio. MyThesis gives you your first holding free and charges $4.99 per holding per month after that. ThesisLoop is $60/year or $200/year. Vela and Thesis had not published pricing as of August 2026.',
  },
  {
    q: 'How is MyThesis different from Helm Terminal?',
    a: 'Both monitor investment theses and are live today. MyThesis is a dedicated thesis-alert tool priced at $4.99 per holding per month, first holding free, with manually entered positions, so 10 holdings is $44.91/month and 25 is $119.76/month. Helm runs thesis monitoring inside a broader portfolio agent: brokerage aggregation via Plaid, tax-loss harvesting, concentration and earnings scans, and a daily brief, at $20/month flat for unlimited holdings, with verbatim dated citations behind every alert.',
  },
];

type Cell = string;
const ROWS: { label: string; helm: Cell; mythesis: Cell; vela: Cell; thesis: Cell; watch: Cell }[] = [
  { label: 'Status (July 2026)', helm: 'Live, shipping', mythesis: 'Live, shipping', vela: 'Private waitlist', thesis: 'Early access', watch: 'Not disclosed' },
  { label: 'Free tier', helm: 'Yes', mythesis: '1 holding', vela: 'Not shown', thesis: 'Not shown', watch: 'Not disclosed' },
  { label: 'Paid price', helm: '$20/mo, unlimited holdings', mythesis: '$4.99/mo per holding, 1st free', vela: 'Not public', thesis: 'Not public', watch: 'Not disclosed' },
  { label: 'Reads SEC filings', helm: 'Yes (EDGAR)', mythesis: 'Not shown', vela: 'Yes', thesis: 'No', watch: 'Not disclosed' },
  { label: 'Verbatim dated citations', helm: 'Yes', mythesis: 'No (source named only)', vela: 'No (paraphrased)', thesis: 'No', watch: 'Not disclosed' },
  { label: 'Shared-driver risk', helm: 'Yes', mythesis: 'No', vela: 'No', thesis: 'No', watch: 'Not disclosed' },
  { label: 'Account sync', helm: 'Plaid + manual', mythesis: 'Manual only', vela: 'Plaid (optional)', thesis: 'Plaid', watch: 'Not disclosed' },
  { label: 'Taxes, concentration, earnings', helm: 'Yes', mythesis: 'No', vela: 'No', thesis: 'No', watch: 'Not disclosed' },
  { label: 'Coverage', helm: 'US-listed', mythesis: 'US equities', vela: 'US-focused', thesis: 'US equities + ETFs', watch: 'Not disclosed' },
];

export default function BestThesisTrackersPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Best Investment Thesis Trackers in 2026 (Compared)',
      description:
        'An honest comparison of investment thesis trackers in 2026: Helm Terminal, MyThesis, Vela, Thesis (UseThesis), and ThesisWatch.',
      datePublished: '2026-06-17',
      dateModified: '2026-07-16',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: 'https://helmterminal.dev/best-thesis-trackers',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Best Thesis Trackers', item: 'https://helmterminal.dev/best-thesis-trackers' },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/thesis-monitoring" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/pricing" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Pricing</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Comparison</div>
          <h1 className="font-sans font-bold text-[32px] md:text-[42px] tracking-tight leading-[1.1] mb-5">
            Best investment thesis trackers in 2026
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            A new category is forming: tools that watch the reasons you own a stock, not just the price. Here is an honest look at the five names in the space as of July 2026, including ours. Only two are open to the public today.
          </p>
        </header>

        <div className="space-y-12 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          {/* Table */}
          <section>
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[14.5px] text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="p-3 font-semibold text-[var(--color-text-primary)]">&nbsp;</th>
                    <th className="p-3 font-semibold text-[var(--color-gold)]">Helm</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">MyThesis</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">Vela</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">Thesis</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">ThesisWatch</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.label} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{r.label}</td>
                      <td className="p-3 text-[var(--color-text-primary)]">{r.helm}</td>
                      <td className="p-3">{r.mythesis}</td>
                      <td className="p-3">{r.vela}</td>
                      <td className="p-3">{r.thesis}</td>
                      <td className="p-3">{r.watch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-2">Vela, Thesis, and ThesisWatch details verified from public sites on June 17, 2026; MyThesis details verified July 14, 2026. All may change. ThesisWatch did not expose details to public crawls, so its cells are marked not disclosed.</p>
          </section>

          {/* Per-tool */}
          <section className="space-y-8">
            <div>
              <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] mb-2">Helm Terminal</h2>
              <p>Helm is a financial intelligence terminal whose flagship layer is thesis monitoring. You write the pillars behind each holding, and Helm scores SEC filings, earnings, news, and price against them every trading day, flagging thesis drift with verbatim, dated citations. It is the only tool here that cites primary sources verbatim, detects shared-driver risk across positions, and runs the thesis layer inside a whole-portfolio agent: brokerage aggregation, tax-loss harvesting, concentration and earnings scans, and a daily brief. The core terminal is free; the thesis layer is Pro at $20/month for unlimited holdings. <Link href="/thesis-monitoring" className="text-[var(--color-gold)] hover:underline">How it works.</Link></p>
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] mb-2">MyThesis</h2>
              <p>MyThesis (mythesis.ai) is the newest live entrant: a dedicated thesis-alert tool with a status chip per thesis (Supported or Challenged), a per-pillar breakdown, an alert feed tagged by severity, and versioned theses. It is a focused take on one job and it does that job cleanly. The tradeoffs are structural: holdings are entered manually (no brokerage sync), alerts name their source but do not quote the underlying document, and pricing meters by position at $4.99 per holding per month with the first one free (observed August 9, 2026). A good fit if you hold a few positions and want a standalone thesis alert feed. If you want the thesis layer inside a whole-portfolio agent, or you hold more than a handful of names, the per-holding math turns against it quickly. <Link href="/mythesis-alternative" className="text-[var(--color-gold)] hover:underline">Full MyThesis vs Helm breakdown.</Link></p>
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] mb-2">Vela</h2>
              <p>Vela (getvela.co) positions around the line "know when your thesis breaks." It reads filings and maps signals to your thesis drivers, but presents paraphrased interpretations rather than verbatim quotes, and as of June 2026 it is in private waitlist with pricing not public. Closest in positioning to Helm; the main differences are that Helm is live, cites verbatim sources, and adds cross-position risk.</p>
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] mb-2">Thesis (UseThesis)</h2>
              <p>Thesis (usethesis.com) is a lighter, note-first tracker: remember why you invested and take notes as events happen. It connects brokerages via Plaid and supports US equities and ETFs, but does not cite SEC filings, and several features were marked "coming soon" with a waitlist as of June 2026. A good fit for manual journaling; not an automated monitor.</p>
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] mb-2">ThesisWatch</h2>
              <p>ThesisWatch (thesiswatch.com) bills itself as an investment thesis management platform. Its site did not expose product details, pricing, or launch status to public crawls as of June 2026, so we have left those cells blank rather than guess. Check the site directly for current details.</p>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">Every holding. One flat price. Real receipts.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm watches the thesis behind every position and tells you, with dated citations, when it breaks. No per-holding meter. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
          </section>

          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            Comparison reflects public information as of July 16, 2026 and is provided for general information, not financial advice. Verify current details with each provider. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
