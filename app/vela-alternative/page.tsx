import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

export const metadata: Metadata = {
  title: 'Vela Alternative You Can Use Today | Helm Terminal',
  description:
    'Looking for a Vela alternative? Vela is waitlist-only as of June 2026. Helm Terminal does thesis monitoring live today, with verbatim dated SEC citations and cross-position risk detection.',
  openGraph: {
    title: 'A Vela Alternative You Can Use Today',
    description:
      'Vela is waitlist-only. Helm does thesis monitoring live today, with verbatim dated SEC citations.',
    url: 'https://helmterminal.dev/vela-alternative',
    siteName: 'Helm Terminal',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A Vela Alternative You Can Use Today',
    description: 'Vela is waitlist-only. Helm does thesis monitoring live today.',
  },
  alternates: { canonical: 'https://helmterminal.dev/vela-alternative' },
};

const FAQS = [
  {
    q: 'Is Vela available yet?',
    a: 'As of June 2026, Vela (getvela.co) is in private waitlist and not open to the public. Helm Terminal is live and free to start today.',
  },
  {
    q: 'What is the best alternative to Vela?',
    a: 'Helm Terminal is the closest live alternative. Like Vela, it monitors the thesis behind your holdings, but it is shipping today, cites verbatim dated SEC filings rather than paraphrased signals, and adds shared-driver risk detection across positions.',
  },
  {
    q: 'How is Helm different from Vela?',
    a: 'Three differences as of June 2026: Helm is live (Vela is waitlist); Helm cites verbatim, dated primary sources (Vela presents paraphrased interpretations); and Helm detects shared-driver risk when multiple holdings rest on the same thesis pillar.',
  },
];

const ROWS = [
  ['Status (June 2026)', 'Live, free to start', 'Private waitlist'],
  ['Citations', 'Verbatim, dated SEC + news', 'Paraphrased signals'],
  ['Cross-position risk', 'Shared-driver detection', 'Not offered'],
  ['Pricing', '$20/mo Pro', 'Not public'],
];

export default function VelaAlternativePage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'A Vela Alternative You Can Use Today',
      description: 'Vela is waitlist-only as of June 2026. Helm Terminal does thesis monitoring live today.',
      datePublished: '2026-06-17',
      dateModified: '2026-06-17',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: 'https://helmterminal.dev/vela-alternative',
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
        { '@type': 'ListItem', position: 2, name: 'Vela Alternative', item: 'https://helmterminal.dev/vela-alternative' },
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
            <Link href="/thesis-monitoring" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/best-thesis-trackers" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Compare</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Vela Alternative</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.1] mb-5">
            A Vela alternative you can use today
          </h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">
            Vela has a sharp pitch: know when your thesis breaks. The catch is that, as of June 2026, Vela is waitlist-only. If you want thesis monitoring now, Helm Terminal is live and free to start.
          </p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section>
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[14px] text-left border-collapse min-w-[480px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)]">
                    <th className="p-3 font-semibold text-[var(--color-text-primary)]">&nbsp;</th>
                    <th className="p-3 font-semibold text-[var(--color-gold)]">Helm</th>
                    <th className="p-3 font-semibold text-[var(--color-text-muted)]">Vela</th>
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
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Vela details from getvela.co, verified June 17, 2026; may change.</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Where Helm goes further</h2>
            <p className="mb-3">Vela reads filings and maps signals to your thesis drivers, which is the right idea. Helm does the same job with two differences that matter when you are deciding whether to trust an alert.</p>
            <p className="mb-3"><span className="text-[var(--color-text-primary)] font-semibold">Verbatim, dated citations.</span> When a pillar weakens, Helm shows you the actual line from the filing or article with its date, not a paraphrased summary. You can verify it in one click.</p>
            <p><span className="text-[var(--color-text-primary)] font-semibold">Shared-driver risk.</span> Helm flags when several of your holdings depend on the same thesis pillar, the hidden correlation that breaks a "diversified" book all at once. Read more on <Link href="/thesis-monitoring" className="text-[var(--color-gold)] hover:underline">how thesis monitoring works</Link>.</p>
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
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">Start monitoring your thesis now.</h2>
            <p className="mb-5 max-w-xl mx-auto">No waitlist. Helm watches the reasons behind every position and tells you when one breaks. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
          </section>

          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            Comparison reflects public information as of June 17, 2026 and is provided for general information, not financial advice. Verify current details with Vela directly. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
