import { SiteNav } from '@/components/site-nav';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';

const CONTENT = {
  "title": "Vela vs Helm: Thesis Monitoring and Availability",
  "description": "Vela currently invites waitlist signups. Compare its advertised thesis workflow with Helm, where you can start one confirmed thesis free.",
  "intro": "Vela describes a workflow for turning an investment idea into assumptions and monitoring signals against them. Its public page currently invites waitlist signups. Helm is available to start with one confirmed, tracked thesis free.",
  "headers": [
    "Question",
    "Helm",
    "Vela public page"
  ],
  "rows": [
    [
      "Can I start?",
      "Public signup",
      "Waitlist invitation"
    ],
    [
      "What is monitored?",
      "Reasons you confirm and track",
      "Structured assumptions; advertised workflow"
    ],
    [
      "Paid price",
      "$20/month or $149/year for Pro",
      "Not displayed"
    ],
    [
      "Evidence to inspect",
      "Public thesis pages and methodology",
      "Illustrative briefing; paid workflow not tested"
    ]
  ],
  "sections": [
    {
      "title": "Separate the pitch from the product test",
      "paragraphs": [
        "Vela describes daily checks across filings, earnings and other signals. A landing-page example is not enough to establish the quality of live citations or an absence of other features. We have not tested its private product.",
        "If you need a workflow now, try a real thesis in Helm. If Vela interests you, ask about access, pricing and how to inspect the documents behind a finding before making a decision."
      ]
    },
    {
      "title": "What starts monitoring in Helm",
      "paragraphs": [
        "Choose a stock, write or edit the reasons you own it, confirm those reasons, and enable tracking. Connecting a brokerage or importing holdings alone does not start thesis monitoring. Checks run on a schedule; a new finding or immediate alert is not guaranteed.",
        "Free includes one monitored thesis. Pro adds monitoring for more theses you confirm and track, at $20/month or $149/year. Brokerage linking is optional for your first thesis."
      ]
    },
    {
      "title": "Compare a real finding before subscribing",
      "paragraphs": [
        "Use the same stock and the same written reason in each tool. Open a finding, check the source and reporting date, and decide whether the evidence actually tests your reason. A source link, a quotation and a correct interpretation are three different things; none proves the others.",
        "Pay for broader monitoring when you have additional theses you want to keep under review. If you only need to write down one idea and check it yourself, the free worksheet or a spreadsheet may be enough."
      ]
    }
  ],
  "faqs": [
    {
      "q": "Is Vela available now?",
      "a": "On September 19, 2026, the reviewed Vela page describes a private waitlist and offers a waitlist form. This does not establish whether invited users already have access."
    },
    {
      "q": "Does Vela lack source quotations or portfolio features?",
      "a": "We have not tested its private product and do not establish either absence from a landing page. Ask for a live finding and verify its source, date and connection to your reason."
    },
    {
      "q": "Can I start without connecting a brokerage?",
      "a": "Yes. Helm lets you start with a stock and your confirmed investment reasons. Plaid or manual portfolio entry adds portfolio context but is not required for the first thesis."
    },
    {
      "q": "When would I need Helm Pro?",
      "a": "Free includes one monitored thesis. Pro adds monitoring for more theses you confirm and track, at $20/month or $149/year. Brokerage linking is optional for your first thesis."
    }
  ],
  "sources": [
    {
      "label": "Vela public waitlist",
      "href": "https://www.getvela.co/"
    }
  ]
};
const URL = 'https://helmterminal.dev/vela-alternative';

export const metadata: Metadata = {
  title: CONTENT.title + ' | Helm',
  description: CONTENT.description,
  openGraph: { title: CONTENT.title, description: CONTENT.description, url: URL, siteName: 'Helm Terminal', type: 'article' },
  twitter: { card: 'summary_large_image', title: CONTENT.title, description: CONTENT.description },
  alternates: { canonical: URL },
};

export default function VelaAlternativePage() {
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: CONTENT.title, description: CONTENT.description,
      datePublished: '2026-06-17', dateModified: '2026-09-19',
      author: { '@type': 'Person', name: 'Evan Kim', url: 'https://helmterminal.dev/about', jobTitle: 'Founder' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' }, url: URL },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: CONTENT.faqs.map(f => ({
      '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
    })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
      { '@type': 'ListItem', position: 2, name: CONTENT.title, item: URL },
    ] },
  ];
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />
      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Comparison · Updated September 19, 2026</div>
          <h1 className="font-sans mb-5">{CONTENT.title}</h1>
          <p className="text-[17px] leading-[1.55] text-[var(--color-text-secondary)]">{CONTENT.intro}</p>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-4">Written by Evan Kim, Helm&apos;s founder. Competitor details below describe public pages, not a hands-on test of their paid products.</p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[14px]">
            <Link href="/signup?next=%2Fdashboard%2Ftheses%2Fclassic" className="text-[var(--color-gold)] font-semibold hover:underline">Start one thesis free</Link>
            <Link href="/blog/investment-thesis-examples" className="text-[var(--color-text-secondary)] hover:underline">Read a worked example</Link>
          </div>
        </header>
        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section aria-label="Comparison table">
            <div className="overflow-x-auto sovereign-card rounded">
              <table className="w-full text-[14px] text-left border-collapse min-w-[560px]">
                <caption className="text-left p-3 text-[13px]">Public offers checked September 19, 2026. Confirm terms with each provider before paying.</caption>
                <thead><tr className="border-b border-[var(--color-border-base)]">{CONTENT.headers.map(h => <th key={h} scope="col" className="p-3 font-semibold text-[var(--color-text-primary)]">{h}</th>)}</tr></thead>
                <tbody>{CONTENT.rows.map(row => <tr key={row[0]} className="border-b border-[var(--color-border-subtle)] last:border-0">
                  {row.map((cell, i) => i === 0 ? <th key={i} scope="row" className="p-3 font-medium text-[var(--color-text-primary)]">{cell}</th> : <td key={i} className="p-3">{cell}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </section>
          {CONTENT.sections.map(section => <section key={section.title}>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">{section.title}</h2>
            {section.paragraphs.map(p => <p key={p} className="mb-3">{p}</p>)}
          </section>)}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Sources and a practical next step</h2>
            <ul className="list-disc pl-5 space-y-2">{CONTENT.sources.map(s => <li key={s.href}><a href={s.href} className="text-[var(--color-gold)] hover:underline">{s.label}</a></li>)}</ul>
            <p className="mt-4">Try the <Link href="/resources/helm-thesis-review-worksheet.pdf" className="text-[var(--color-gold)] hover:underline">free thesis review worksheet</Link> before choosing a tool. See <Link href="/how-helm-detects-thesis-drift" className="text-[var(--color-gold)] hover:underline">Helm&apos;s scoring methodology</Link> and <Link href="/pricing" className="text-[var(--color-gold)] hover:underline">the full Free/Pro comparison</Link>.</p>
          </section>
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">{CONTENT.faqs.map(f => <div key={f.q}><h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3><p>{f.a}</p></div>)}</div>
          </section>
          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">Start with one reason you can test.</h2>
            <p className="mb-5 max-w-xl mx-auto">Confirm your reasons for one stock and enable tracking. One monitored thesis is free; Pro adds more. No brokerage connection needed to begin.</p>
            <Link href="/signup?next=%2Fdashboard%2Ftheses%2Fclassic" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Start one thesis free</Link>
          </section>
          <p className="text-[13px] text-[var(--color-text-muted)] border-t border-[var(--color-border-subtle)] pt-6">General information, not investment advice. Product availability, prices and features can change. AI findings can be incomplete or wrong; verify the underlying evidence. Helm Terminal is not a registered investment advisor.</p>
        </div>
      </article>
      <LegalFooter />
    </main>
  );
}
