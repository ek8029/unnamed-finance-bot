import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { IntakeForm } from '@/components/advisors/intake-form';

export const metadata: Metadata = {
  title: 'Held-Away Visibility for Advisors | Helm Terminal Research',
  description:
    'We are researching an advisor platform: read-only visibility across in-custody and held-away accounts, no credential sharing, an MCP layer for your AI tools. In research with practicing advisors, not for sale.',
  openGraph: {
    title: 'Held-Away Visibility for Advisors | Helm Terminal Research',
    description:
      'Read-only, whole-book visibility for advisors. In research with practicing advisors, not for sale.',
    url: 'https://helmterminal.dev/advisors',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/advisors' },
};

/* The whole-book design concept. Illustrative data only, labeled as such in
   the panel chrome. Held-away rows carry the gold badge because they are the
   rows an advisor's stack cannot show today. */
const BOOK_ROWS = [
  { household: 'Household A', account: 'Taxable · Schwab', custody: 'in' as const, value: '$412,800', signal: null },
  { household: 'Household A', account: '401(k) · Fidelity', custody: 'out' as const, value: '$688,200', signal: 'NVDA 31% of household across all three accounts' },
  { household: 'Household A', account: 'RSU · Shareworks', custody: 'out' as const, value: '$194,500', signal: null },
  { household: 'Household B', account: 'IRA · Schwab', custody: 'in' as const, value: '$897,400', signal: 'Drifted 6.4 pts from the household target since March' },
  { household: 'Household B', account: '403(b) · Empower', custody: 'out' as const, value: '$241,900', signal: null },
  { household: 'Household C', account: 'Brokerage · Vanguard', custody: 'out' as const, value: '$156,300', signal: 'Holds MU · filing last week contradicts the stated reason' },
];

const TIMELINE = [
  { date: 'Sept 2024', text: 'Fidelity, the largest plan provider, restricts third-party credential sharing.' },
  { date: 'Oct 2025', text: 'Pontera’s CEO publishes an open letter calling it an anticompetitive power grab.' },
  { date: 'Dec 2025', text: 'The bans spread. Schwab and other custodians decline to engage.' },
];

const RESEARCH_LEDGER = [
  { title: 'The whole book, by name', line: 'Every client holding a given security across every account, custodied or not. The list-holders lookup wirehouse desks have and independents lack.' },
  { title: 'Reasons, monitored', line: 'A reason on file for each position, read daily against filings, with verbatim citations when something contradicts it. No reason on file is itself a flag.' },
  { title: 'What changed overnight', line: 'Concentration that crossed a line, drift past tolerance, evidence against a held reason. Not a news feed. What moved in your book.' },
  { title: 'The pre-meeting brief', line: 'Before the 2pm: what changed in this household since you last met, across all of their accounts, with the receipts attached.' },
  { title: 'MCP for your AI tools', line: 'A read-only, audit-logged layer so the notetaker and CRM assistant you already pay for can answer questions about actual portfolios.' },
  { title: 'Read-only by construction', line: 'Client-permissioned, token-based connections. No credentials stored, no trading capability anywhere in the design, revocable by the client.' },
];

const READING: { href: string; title: string }[] = [
  { href: '/blog/what-are-held-away-assets', title: 'What are held-away assets?' },
  { href: '/blog/can-advisors-see-clients-outside-accounts', title: 'Can an advisor see a client’s outside accounts?' },
  { href: '/blog/best-pontera-alternatives', title: 'Pontera alternatives after the custodian crackdown' },
  { href: '/blog/pontera-pricing', title: 'What Pontera actually costs' },
  { href: '/blog/best-byallaccounts-alternatives', title: 'ByAllAccounts alternatives after the Pello collapse' },
  { href: '/blog/account-aggregation-for-financial-advisors', title: 'Account aggregation: the 2026 field guide' },
  { href: '/blog/plaid-for-financial-advisors', title: 'Plaid for advisors: coverage, verified' },
  { href: '/blog/mcp-for-financial-advisors', title: 'MCP for advisors, in plain language' },
  { href: '/blog/best-ai-tools-for-financial-advisors', title: 'AI tools for advisors, by the job they do' },
  { href: '/blog/ria-tech-stack', title: 'The RIA tech stack in 2026' },
  { href: '/blog/chatgpt-prompts-for-financial-advisors', title: 'ChatGPT prompts, and the rules before them' },
];

function CustodyBadge({ custody }: { custody: 'in' | 'out' }) {
  if (custody === 'out') {
    return (
      <span className="inline-block whitespace-nowrap px-2 py-1 rounded-[3px] font-mono text-[10px] tracking-[0.14em] uppercase bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] text-[var(--color-gold)]">
        Held away
      </span>
    );
  }
  return (
    <span className="inline-block whitespace-nowrap px-2 py-1 rounded-[3px] font-mono text-[10px] tracking-[0.14em] uppercase border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]">
      In custody
    </span>
  );
}

export default function AdvisorsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] overflow-x-clip">
      {/* Nav */}
      <nav className="border-b border-[var(--color-border-base)]">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <a
            href="#intake"
            className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase px-4 rounded-[5px] border border-[var(--color-gold)] text-[var(--color-gold)] transition-colors duration-200 hover:bg-[var(--color-gold)] hover:text-black min-h-[44px] flex items-center"
          >
            Talk to us
          </a>
        </div>
      </nav>

      {/* Hero, then the book fills the fold */}
      <header className="max-w-[1240px] mx-auto px-10 max-sm:px-5 pt-20 max-sm:pt-12">
        <div className="max-w-[820px]">
          <p className="font-mono text-[12px] font-medium tracking-[0.25em] uppercase text-[var(--color-gold)] mb-6">
            Research preview · Not a product yet
          </p>
          <h1 className="text-[clamp(2.4rem,5vw,3.8rem)] font-bold tracking-[-0.035em] leading-[1.03]">
            The accounts your software{' '}
            <span className="text-[var(--color-gold)]">can&rsquo;t&nbsp;reach.</span>
          </h1>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] max-w-[520px]">
              The 401(k), the HSA, the outside brokerage: they decide a client&rsquo;s real
              risk, and the standard fix is emailed statements. We are researching the third way
              with practicing advisors. There is nothing to buy on this page.
            </p>
            <div className="flex flex-col items-start gap-3 pb-1">
              <a
                href="#intake"
                className="font-mono text-[13px] font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap"
              >
                Compare notes &darr;
              </a>
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-secondary)]">
                20 min · no pitch · read by the founder
              </span>
            </div>
          </div>
        </div>

        {/* The book panel */}
        <div className="mt-14 max-sm:mt-9 border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border-base)] font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--color-text-muted)] flex-wrap">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-gold)] shadow-[0_0_10px_var(--color-gold)]" />
            One book · Custody marked
            <span className="ml-auto text-[var(--color-text-secondary)]">Design concept · Illustrative data</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[var(--color-border-base)]">
                  {['Household', 'Account', 'Custody', 'Value', 'Signal'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={`font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] font-medium px-5 py-3 ${h === 'Value' ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BOOK_ROWS.map((row, i) => (
                  <tr key={row.account} className={i < BOOK_ROWS.length - 1 ? 'border-b border-[var(--color-border-subtle)]' : ''}>
                    <td className="px-5 py-3.5 text-[var(--color-text-muted)] whitespace-nowrap">{row.household}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">{row.account}</td>
                    <td className="px-5 py-3.5"><CustodyBadge custody={row.custody} /></td>
                    <td className="px-5 py-3.5 font-mono text-right whitespace-nowrap">{row.value}</td>
                    <td className="px-5 py-3.5 min-w-[240px]">
                      {row.signal ? (
                        <span className="text-[var(--color-gold)]">{row.signal}</span>
                      ) : (
                        <>
                          <span aria-hidden className="text-[var(--color-text-secondary)]">·</span>
                          <span className="sr-only">no signal</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked, so the signals stay on screen */}
          <div className="sm:hidden">
            {BOOK_ROWS.map((row, i) => (
              <div key={row.account} className={`px-5 py-4 ${i < BOOK_ROWS.length - 1 ? 'border-b border-[var(--color-border-subtle)]' : ''}`}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[14px] font-medium">{row.account}</span>
                  <CustodyBadge custody={row.custody} />
                </div>
                <div className="flex items-center justify-between gap-3 font-mono text-[12px] text-[var(--color-text-secondary)]">
                  <span>{row.household}</span>
                  <span>{row.value}</span>
                </div>
                {row.signal && <p className="mt-2 text-[13px] leading-snug text-[var(--color-gold)]">{row.signal}</p>}
              </div>
            ))}
          </div>

          <div className="px-5 py-3.5 border-t border-[var(--color-border-base)] font-mono text-[12px] tracking-[0.03em] text-[var(--color-text-muted)] leading-relaxed">
            Household A&rsquo;s flag only appears because the 401(k) and the RSU account are in
            the view · account by account, nothing looks wrong ·{' '}
            <b className="text-[var(--color-gold)]">the held-away rows are what your stack cannot show you today</b>
          </div>
        </div>
      </header>

      {/* The receipt: the category broke, with dates */}
      <section className="max-w-[1240px] mx-auto px-10 max-sm:px-5 mt-24 max-sm:mt-14">
        <div className="border-y border-[var(--color-border-base)] grid md:grid-cols-3">
          {TIMELINE.map((t, i) => (
            <div
              key={t.date}
              className={`py-8 md:px-8 ${i > 0 ? 'md:border-l border-[var(--color-border-subtle)] max-md:border-t' : 'md:pl-0'}`}
            >
              <p className="font-mono text-[12px] tracking-[0.18em] uppercase text-[var(--color-gold)] mb-2.5">{t.date}</p>
              <p className="text-[14.5px] leading-relaxed text-[var(--color-text-muted)]">{t.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[15px] text-[var(--color-text-primary)] max-w-[640px] leading-relaxed">
          Credential sharing is dying custodian by custodian. Read-only, client-permissioned
          access is the mechanism left standing, and nobody has built the advisor terminal on
          it. That is the research.
        </p>
      </section>

      {/* The research ledger */}
      <section className="max-w-[1240px] mx-auto px-10 max-sm:px-5 mt-24 max-sm:mt-14">
        <div className="grid lg:grid-cols-[4fr_7fr] gap-x-16 gap-y-8">
          <div>
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] leading-[1.08] lg:sticky lg:top-10">
              Six things we are testing with{' '}
              <span className="text-[var(--color-gold)]">practicing advisors.</span>
            </h2>
          </div>
          <div>
            {RESEARCH_LEDGER.map((item, i) => (
              <div
                key={item.title}
                className={`grid grid-cols-[auto_1fr] gap-x-6 max-sm:gap-x-4 py-6 ${i > 0 ? 'border-t border-[var(--color-border-subtle)]' : 'pt-1'}`}
              >
                <span className="font-mono text-[13px] text-[var(--color-gold)] pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-bold mb-1.5 leading-snug">{item.title}</h3>
                  <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed max-w-[62ch]">{item.line}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scope */}
      <section className="max-w-[1240px] mx-auto px-10 max-sm:px-5 mt-24 max-sm:mt-14">
        <div className="max-w-[820px]">
          <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] leading-[1.08] mb-3">
            What the client authorizes,{' '}
            <span className="text-[var(--color-gold)]">and nothing else.</span>
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--color-text-muted)] max-w-[560px] mb-10">
            Each account is authorized through the institution&rsquo;s own login. The
            institution issues a revocable token. The scope below is the design, enforced at
            the protocol level, not promised in a policy.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-x-20 gap-y-10 max-w-[900px]">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--color-positive)] pb-3 border-b border-[var(--color-border-strong)]">
              Granted · read-only
            </p>
            {['Balances and holdings', 'Transactions and history', 'Visibility, in-custody and held-away alike', 'Audit-logged queries from your AI tools'].map((g) => (
              <p key={g} className="text-[15px] py-3.5 border-b border-[var(--color-border-subtle)]">{g}</p>
            ))}
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--color-negative-text)] pb-3 border-b border-[var(--color-border-strong)]">
              Never granted
            </p>
            {['Stored credentials', 'Trading capability', 'Money movement', 'Model training on client data'].map((n) => (
              <p key={n} className="text-[15px] py-3.5 border-b border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                <span className="relative">
                  <span aria-hidden className="absolute left-0 right-0 top-[54%] h-px bg-[rgba(248,113,113,0.45)]" />
                  {n}
                </span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* The ask + form */}
      <section id="intake" className="max-w-[1240px] mx-auto px-10 max-sm:px-5 mt-24 max-sm:mt-14 scroll-mt-8">
        <div className="grid lg:grid-cols-[4fr_7fr] gap-x-16 gap-y-8">
          <div>
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] leading-[1.08] mb-4">
              Twenty minutes. <span className="text-[var(--color-gold)]">No pitch.</span>
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--color-text-muted)] mb-3">
              Fee-only planners, RIA owner-operators, advisors candid about what their tools do
              not show them. Your workflow, your morning, what you would actually use.
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--color-text-muted)]">
              Interviews shape what gets built and whether it gets built.
            </p>
          </div>
          <IntakeForm />
        </div>
      </section>

      {/* Reading */}
      <section className="border-t border-[var(--color-border-base)] mt-24 max-sm:mt-14">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 py-16 max-sm:py-10">
          <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-[var(--color-text-secondary)] mb-7">
            The research, in public
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-12 gap-y-3 max-w-[1040px]">
            {READING.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[15px] text-[var(--color-text-primary)] transition-colors duration-200 hover:text-[var(--color-gold)]"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LegalFooter />
    </main>
  );
}
