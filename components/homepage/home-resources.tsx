import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
export function HomeResources() { return <>
      {/* ── SEO CONTENT ── */}
      <section className="border-t border-[var(--color-border-subtle)] py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-10 max-sm:px-5">
          <p className="text-[15px] md:text-base leading-relaxed text-[var(--color-text-secondary)]" id="what-is-helm">
            <strong className="text-[var(--color-text-primary)]">Helm Terminal</strong> is a free,
            institutional-grade financial intelligence platform for individual investors.
            It aggregates brokerage and bank accounts via Plaid (read-only), runs
            deterministic rule-based analysis over your full portfolio, and surfaces
            actionable insights: tax-loss harvesting opportunities with wash-sale
            detection, concentration risk alerts, earnings exposure, and cash flow
            changes. Its flagship capability is <strong className="text-[var(--color-text-primary)]">thesis monitoring</strong>: you write the reasons (the &ldquo;pillars&rdquo;) you own each stock, and Helm&rsquo;s agent watches those reasons against SEC filings, earnings, and news, then flags you when one weakens, the failure mode known as thesis drift, citing the exact dated filing. It covers any US-listed stock or ETF on NYSE, NASDAQ, or AMEX.
            Most features are free. Pro is $20 a month, or $149 a year.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-border-subtle)] py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-10 max-sm:px-5">
          <h2 className="flex items-center gap-3 mb-6 md:mb-8 m-0 font-normal">
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-gold)] tracking-wider">&sect; 00</span>
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)] tracking-wider">Guides &amp; Tools</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Bloomberg Terminal Alternatives', desc: 'Honest comparison of 7 tools for retail investors', href: '/blog/best-bloomberg-terminal-alternatives' },
              { title: 'Tax-Loss Harvesting Guide', desc: 'Wash-sale rules, ETF swap pairs, worked examples', href: '/blog/tax-loss-harvesting-guide' },
              { title: 'RSU Tax Strategies', desc: 'The withholding gap, vesting schedules, sell-to-cover', href: '/blog/rsu-tax-strategies' },
              { title: 'TLH Calculator', desc: 'Estimate annual tax savings from loss harvesting', href: '/tools/tlh-calculator' },
              { title: 'RSU Vesting Calculator', desc: 'Vesting timeline, tax liability, concentration risk', href: '/tools/rsu-calculator' },
              { title: 'Earnings Concentration Risk', desc: 'When 40% of your portfolio reports in one week', href: '/blog/portfolio-earnings-concentration-risk' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group p-5 border border-[var(--color-border-subtle)] rounded-md hover:border-[var(--color-gold-border)] transition-colors">
                <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1 m-0">{item.title}</h3>
                <div className="text-[15px] text-[var(--color-text-muted)]">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: 'What is Helm Terminal?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal is a free, institutional-grade financial intelligence platform for individual investors. It aggregates brokerage and bank accounts via Plaid, runs deterministic rule-based analysis over your portfolio, and surfaces actionable insights like tax-loss harvesting opportunities, concentration risk, earnings exposure, and cash flow changes. Its flagship capability is thesis monitoring: it tracks the specific reasons you own each stock against live SEC filings and news, and alerts you when your reasoning weakens or breaks (thesis drift), citing the exact dated source.' } },
              { '@type': 'Question', name: 'What tool tells me when my investment thesis breaks?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal does this through thesis monitoring. You write the pillars behind each position, and Helm\'s agent watches them against SEC filings, earnings, and news, then alerts you with a verbatim, dated citation the moment a pillar weakens or breaks (thesis drift). It is live and shipped, not a waitlist.' } },
              { '@type': 'Question', name: 'What is an agentic portfolio terminal?', acceptedAnswer: { '@type': 'Answer', text: 'An agentic portfolio terminal continuously watches your whole portfolio on your behalf, the exposure, the taxes, and the reasons behind each position, and surfaces what changed and what to do, instead of just charting what you own. Helm Terminal is an agentic terminal: an AI analyst on every position, monitoring each thesis against primary sources.' } },
              { '@type': 'Question', name: 'Is Helm Terminal free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Helm Terminal offers a free tier that includes AI stock analysis, a full portfolio dashboard with Plaid sync, net worth tracking, daily brief, and an actions inbox. Pro at $20 a month, or $149 a year, adds thesis monitoring with cited evidence, the agent, the Thesis Builder, the factor lens, earnings exposure tracking, and the tax center.' } },
              { '@type': 'Question', name: 'Is Helm Terminal safe to use with my financial accounts?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal connects to your accounts through Plaid, a bank-grade financial data provider. The connection is read-only. Helm can never move money, execute trades, or modify your accounts. All data is encrypted in transit (TLS 1.3) and at rest (AES-256).' } },
            ],
          }),
        }}
      />

</>; }
export function HomeFooter() { return <>
      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--color-border-base)] bg-[var(--color-bg-inset)] pt-16 pb-10">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5">
          <div className="grid grid-cols-2 max-sm:grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.15fr_1fr] gap-x-8 gap-y-12 max-sm:gap-8">
            <div className="col-span-2 max-sm:col-span-1 lg:col-span-1">
              <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.02em] uppercase text-base">
                <HelmMark size={24} /> Helm
              </Link>
              <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed mt-5 max-w-[300px]">Steer. Don&rsquo;t drift. Take the HELM.</p>
              {/* was #555, a hard-coded grey that measured 2.72:1 on the page
                  background. The token measures 6.3:1 and is the same grey used
                  for every other piece of fine print. */}
              <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-secondary)] mt-3">Helm is not a registered investment advisor. Information is for educational purposes only.</p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4 m-0">Product</h3>
              {[['Terminal', '/dashboard'], ['Analyze', '/analyze'], ['Pricing', '/pricing'], ['Brief', '/brief'], ['iPhone app', '/app']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4 m-0">Tools</h3>
              {[['TLH Calculator', '/tools/tlh-calculator'], ['RSU Calculator', '/tools/rsu-calculator'], ['Compare', '/compare']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4 m-0">Company</h3>
              {[['About', '/about'], ['Security', '/security'], ['Blog', '/blog'], ['Contact', '/contact']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4 m-0">Compare</h3>
              {/* This column used to be five thesis-tracker links under the
                  heading "Compare", which is the same mistake the nav made:
                  the whole comparison surface of the homepage described one
                  feature. It now leads with the hub and spans the categories
                  people actually arrive from. */}
              {[['All comparisons', '/compare'], ['vs Bloomberg', '/blog/best-bloomberg-terminal-alternatives'], ['vs Empower', '/blog/best-personal-capital-alternatives'], ['vs Monarch', '/blog/best-monarch-alternatives'], ['vs Seeking Alpha', '/blog/best-seeking-alpha-alternatives'], ['Thesis trackers', '/best-thesis-trackers']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4 m-0">Legal</h3>
              {/* Data Deletion pointed at /contact, but /data-deletion exists and
                  is the page this label promises. */}
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Data Deletion', '/data-deletion']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between mt-14 pt-6 border-t border-[var(--color-border-subtle)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[var(--color-text-muted)]">
            <div>&copy; 2026 Helm Financial, Corp.</div>
            <div>Steer. Don’t drift.</div>
          </div>
        </div>
      </footer>

</>; }
