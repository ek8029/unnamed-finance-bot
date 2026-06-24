import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'UseThesis (Thesis) Alternative You Can Use Today | Helm Terminal',
  description:
    'Looking for a Thesis (usethesis.com) alternative? Thesis is a note-first tracker in early access. Helm Terminal automates thesis monitoring live today, reading SEC filings against your reasons.',
  openGraph: {
    title: 'A UseThesis Alternative You Can Use Today',
    description:
      'Thesis is a manual note tracker in early access. Helm automates thesis monitoring live today, with SEC citations.',
    url: 'https://helmterminal.dev/usethesis-alternative',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A UseThesis Alternative You Can Use Today',
    description: 'Thesis is manual and in early access. Helm automates thesis monitoring live today.',
  },
  alternates: { canonical: 'https://helmterminal.dev/usethesis-alternative' },
};

const FAQS = [
  {
    q: 'Is Thesis (usethesis.com) available yet?',
    a: 'As of June 2026, Thesis is in early access with a waitlist and several features marked "coming soon." Helm Terminal is live and free to start today.',
  },
  {
    q: 'What is the best alternative to Thesis (UseThesis)?',
    a: 'Helm Terminal. Thesis is a manual, note-first tracker for remembering why you invested. Helm automates that job: it reads SEC filings, earnings, and news against your reasons and alerts you when one breaks, with a dated citation.',
  },
  {
    q: 'How is Helm different from Thesis?',
    a: 'Thesis is built around manual notes and does not cite SEC filings. Helm actively monitors primary sources for you, cites them verbatim with dates, and detects shared-driver risk across positions. Both connect brokerages via Plaid and cover US equities.',
  },
];

const ROWS = [
  ['Status (June 2026)', 'Live, free to start', 'Early access / waitlist'],
  ['How it works', 'Automated monitoring', 'Manual notes'],
  ['Reads SEC filings', 'Yes, verbatim + dated', 'No'],
  ['Cross-position risk', 'Shared-driver detection', 'Not offered'],
];

export default function UseThesisAlternativePage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'A UseThesis Alternative You Can Use Today',
      description: 'Thesis (usethesis.com) is a note-first tracker in early access. Helm automates thesis monitoring live today.',
      datePublished: '2026-06-17',
      dateModified: '2026-06-17',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: 'https://helmterminal.dev/usethesis-alternative',
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
        { '@type': 'ListItem', position: 2, name: 'UseThesis Alternative', item: 'https://helmterminal.dev/usethesis-alternative' },
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
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">UseThesis Alternative</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1] mb-5">
            A UseThesis alternative you can use today
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            Thesis (usethesis.com) is a clean idea: remember why you invested and take notes as things change. But it is manual, and as of June 2026 it is in early access. Helm Terminal does the watching for you, and it is live now.
          </p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section>
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[15px] text-left border-collapse min-w-[480px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="p-3 font-semibold text-[var(--color-text-primary)]">&nbsp;</th>
                    <th className="p-3 font-semibold text-[var(--color-gold)]">Helm</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">Thesis</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{r[0]}</td>
                      <td className="p-3 text-[var(--color-text-primary)]">{r[1]}</td>
                      <td className="p-3">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-2">Thesis details from usethesis.com, verified June 17, 2026; may change.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Notes vs monitoring</h2>
            <p className="mb-3">A note-first tracker is better than nothing, but it puts the work on you. You still have to read every filing, remember which note it affects, and update the note. That is exactly the discipline that quietly lapses, which is how thesis drift sets in.</p>
            <p>Helm flips it. You write the reasons once, and Helm reads SEC filings, earnings, and news against them every hour the market is open, surfacing only the moments a reason actually moves, with a dated, verbatim source. It is the difference between a notebook and a monitor. See <Link href="/thesis-monitoring" className="text-[var(--color-gold)] hover:underline">how it works</Link>.</p>
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
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">Let the filings come to you.</h2>
            <p className="mb-5 max-w-xl mx-auto">No manual notes, no waitlist. Helm watches your reasons against primary sources and tells you when one breaks. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
          </section>

          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            Comparison reflects public information as of June 17, 2026 and is provided for general information, not financial advice. Verify current details with Thesis directly. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
