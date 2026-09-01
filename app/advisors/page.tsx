import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
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

const CTA_HREF = '#intake';

/* Static equivalent of the homepage EyebrowRule (that one animates on scroll
   and needs a client hook; this page is a server component on purpose). */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 mb-5 font-mono text-[12px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
      <span aria-hidden className="w-[26px] h-px bg-[var(--color-gold)] shrink-0" />
      {children}
    </div>
  );
}

/* The whole-book design concept. Illustrative data only, labeled as such in
   the panel chrome: the platform does not exist and this table is the
   hypothesis we put in front of advisors. Held-away rows carry the gold badge
   because they are the rows an advisor's stack cannot show today. */
const BOOK_ROWS = [
  {
    household: 'Household A',
    account: 'Taxable · Schwab',
    custody: 'in' as const,
    value: '$412,800',
    signal: null,
  },
  {
    household: 'Household A',
    account: '401(k) · Fidelity',
    custody: 'out' as const,
    value: '$688,200',
    signal: 'NVDA 31% of household across all three accounts',
  },
  {
    household: 'Household A',
    account: 'RSU · Shareworks',
    custody: 'out' as const,
    value: '$194,500',
    signal: null,
  },
  {
    household: 'Household B',
    account: 'IRA · Schwab',
    custody: 'in' as const,
    value: '$897,400',
    signal: 'Drifted 6.4 pts from the household target since March',
  },
  {
    household: 'Household B',
    account: '403(b) · Empower',
    custody: 'out' as const,
    value: '$241,900',
    signal: null,
  },
  {
    household: 'Household C',
    account: 'Brokerage · Vanguard',
    custody: 'out' as const,
    value: '$156,300',
    signal: 'Holds MU · filing last week contradicts the stated reason',
  },
];

const RESEARCH_LEDGER = [
  {
    title: 'The whole book, by name',
    line: 'Every client holding a given security across every account, custodied or not. The list-holders lookup wirehouse desks have and independents lack.',
  },
  {
    title: 'Reasons, monitored',
    line: 'A reason on file for each position, read daily against filings, with verbatim citations when something contradicts it. No reason on file is itself a flag.',
  },
  {
    title: 'What changed overnight',
    line: 'Concentration that crossed a line, drift past tolerance, evidence against a held reason. Not a news feed. What moved in your book.',
  },
  {
    title: 'The pre-meeting brief',
    line: 'Before the 2pm: what changed in this household since you last met, across all of their accounts, with the receipts attached.',
  },
  {
    title: 'MCP for your AI tools',
    line: 'A read-only, audit-logged layer so the notetaker and CRM assistant you already pay for can answer questions about actual portfolios.',
  },
  {
    title: 'Read-only by construction',
    line: 'Client-permissioned, token-based connections. No credentials stored, no trading capability anywhere in the design, revocable by the client.',
  },
];

const READING: { href: string; title: string }[] = [
  { href: '/blog/what-are-held-away-assets', title: 'What are held-away assets?' },
  {
    href: '/blog/can-advisors-see-clients-outside-accounts',
    title: 'Can an advisor see a client’s outside accounts?',
  },
  {
    href: '/blog/best-pontera-alternatives',
    title: 'Pontera alternatives after the custodian crackdown',
  },
  { href: '/blog/pontera-pricing', title: 'What Pontera actually costs' },
  {
    href: '/blog/best-byallaccounts-alternatives',
    title: 'ByAllAccounts alternatives after the Pello collapse',
  },
  {
    href: '/blog/account-aggregation-for-financial-advisors',
    title: 'Account aggregation: the 2026 field guide',
  },
  {
    href: '/blog/plaid-for-financial-advisors',
    title: 'Plaid for advisors: coverage, verified',
  },
  { href: '/blog/mcp-for-financial-advisors', title: 'MCP for advisors, in plain language' },
  {
    href: '/blog/best-ai-tools-for-financial-advisors',
    title: 'AI tools for advisors, by the job they do',
  },
  { href: '/blog/ria-tech-stack', title: 'The RIA tech stack in 2026' },
  {
    href: '/blog/chatgpt-prompts-for-financial-advisors',
    title: 'ChatGPT prompts, and the rules before them',
  },
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
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <a
            href={CTA_HREF}
            className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase px-4 rounded-[5px] border border-[var(--color-gold)] text-[var(--color-gold)] transition-colors duration-200 hover:bg-[var(--color-gold)] hover:text-black min-h-[44px] flex items-center"
          >
            Talk to us
          </a>
        </div>
      </nav>

      {/* Hero + the book, one viewport. The object carries the argument. */}
      <section className="relative z-10 max-w-[1240px] mx-auto px-10 max-sm:px-5 pt-20 max-sm:pt-12 pb-16">
        <div className="max-w-[720px] mb-14">
          <Eyebrow>Research preview · Not a product yet</Eyebrow>
          <h1 className="text-[clamp(2.2rem,4.6vw,3.4rem)] font-bold tracking-[-0.035em] leading-[1.05]">
            Advisors see their book.{' '}
            <em className="not-italic font-bold text-[var(--color-gold)]">
              Nobody sees the whole&nbsp;client.
            </em>
          </h1>
          <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[600px]">
            The accounts that decide a client&rsquo;s real risk, the 401(k), the HSA, the outside
            brokerage, sit where an advisor&rsquo;s software cannot reach. The standard fix is
            emailed statements. The contested fix, credential sharing, is being banned custodian by
            custodian. We are researching the third way with practicing advisors, and there is
            nothing to buy on this page.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-8">
            <a
              href={CTA_HREF}
              className="font-mono text-[13px] font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-all min-h-[44px] flex items-center"
            >
              Compare notes &darr;
            </a>
            <a
              href="#testing"
              className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text-primary)] min-h-[44px] flex items-center"
            >
              See what we&rsquo;re testing
            </a>
          </div>
        </div>

        {/* The book panel */}
        <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border-base)] font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--color-text-muted)] flex-wrap">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-gold)] shadow-[0_0_10px_var(--color-gold)]" />
            One book · Custody marked
            <span className="ml-auto text-[var(--color-text-secondary)]">
              Design concept · Illustrative data
            </span>
          </div>

          {/* Desktop: the table. */}
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
                  <tr
                    key={`${row.household}-${row.account}`}
                    className={
                      i < BOOK_ROWS.length - 1
                        ? 'border-b border-[var(--color-border-subtle)]'
                        : ''
                    }
                  >
                    <td className="px-5 py-3.5 text-[var(--color-text-muted)] whitespace-nowrap">
                      {row.household}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">{row.account}</td>
                    <td className="px-5 py-3.5">
                      <CustodyBadge custody={row.custody} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-right whitespace-nowrap">
                      {row.value}
                    </td>
                    <td className="px-5 py-3.5 min-w-[240px]">
                      {row.signal ? (
                        <span className="text-[var(--color-gold)]">{row.signal}</span>
                      ) : (
                        <>
                          <span aria-hidden className="text-[var(--color-text-secondary)]">
                            ·
                          </span>
                          <span className="sr-only">no signal</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: the same book stacked, so the signals stay on screen. */}
          <div className="sm:hidden">
            {BOOK_ROWS.map((row, i) => (
              <div
                key={`${row.household}-${row.account}`}
                className={`px-5 py-4 ${i < BOOK_ROWS.length - 1 ? 'border-b border-[var(--color-border-subtle)]' : ''}`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[14px] font-medium">{row.account}</span>
                  <CustodyBadge custody={row.custody} />
                </div>
                <div className="flex items-center justify-between gap-3 font-mono text-[12px] text-[var(--color-text-secondary)]">
                  <span>{row.household}</span>
                  <span>{row.value}</span>
                </div>
                {row.signal && (
                  <p className="mt-2 text-[13px] leading-snug text-[var(--color-gold)]">
                    {row.signal}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-3.5 border-t border-[var(--color-border-base)] font-mono text-[12px] tracking-[0.03em] text-[var(--color-text-muted)] leading-relaxed">
            Household A&rsquo;s flag only appears because the 401(k) and the RSU account are in
            the view · account by account, nothing looks wrong ·{' '}
            <b className="text-[var(--color-gold)]">
              the held-away rows are what your stack cannot show you today
            </b>
          </div>
        </div>
      </section>

      {/* The research ledger */}
      <section
        id="testing"
        className="relative z-10 max-w-[1240px] mx-auto px-10 max-sm:px-5 py-[100px] max-sm:py-14"
      >
        <div className="max-w-[720px] mb-10">
          <Eyebrow>The research</Eyebrow>
          <h2 className="text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold tracking-[-0.035em] leading-[1.05]">
            Six things we are testing{' '}
            <em className="not-italic font-bold text-[var(--color-gold)]">
              with practicing advisors.
            </em>
          </h2>
        </div>
        <div className="max-w-[840px]">
          {RESEARCH_LEDGER.map((item, i) => (
            <div
              key={item.title}
              className="grid grid-cols-[auto_1fr] gap-x-6 max-sm:gap-x-4 py-6 border-b border-[var(--color-border-subtle)] first:pt-0 last:border-b-0"
            >
              <span className="font-mono text-[13px] text-[var(--color-gold)] pt-0.5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-bold mb-1.5 leading-snug">{item.title}</h3>
                <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed max-w-[62ch]">
                  {item.line}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Permission panel */}
      <section className="relative z-10 max-w-[1240px] mx-auto px-10 max-sm:px-5 pb-[100px] max-sm:pb-14">
        <div className="max-w-[720px] mb-12">
          <Eyebrow>Access</Eyebrow>
          <h2 className="text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold tracking-[-0.035em] leading-[1.05]">
            The client grants sight.{' '}
            <em className="not-italic font-bold text-[var(--color-gold)]">Nothing else exists.</em>
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[560px]">
            The client authorizes each account through their institution&rsquo;s own login. The
            institution issues a revocable token. Here is the entire scope we are designing to,
            enforced at the protocol level, not promised in a policy.
          </p>
        </div>
        <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--color-border-base)] font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--color-text-muted)] flex-wrap">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-positive)] shadow-[0_0_10px_var(--color-positive)]" />
            Connection scope · client-permissioned · revocable
            <span className="ml-auto hidden sm:inline">held-away and in-custody alike</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-8 max-sm:p-5 md:border-r border-[var(--color-border-base)]">
              <div className="font-mono text-[12px] tracking-[0.14em] uppercase text-[var(--color-positive)] mb-4 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="w-5 h-5 rounded-[5px] bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.3)] text-[var(--color-positive)] inline-flex items-center justify-center text-[13px] font-mono"
                >
                  &#10003;
                </span>
                Granted · read-only
              </div>
              <ul className="list-none m-0 p-0">
                {[
                  'Balances and holdings',
                  'Transactions and history',
                  'Ongoing visibility, in-custody and held-away alike',
                  'Audit-logged queries from your AI tools',
                ].map((item) => (
                  <li
                    key={item}
                    className="text-base py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 flex items-center gap-3 text-[var(--color-text-primary)]"
                  >
                    <span aria-hidden className="font-mono text-[15px] w-4 text-[var(--color-positive)]">
                      &#10003;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-8 max-sm:p-5 border-t md:border-t-0 border-[var(--color-border-base)]">
              <div className="font-mono text-[12px] tracking-[0.14em] uppercase text-[var(--color-negative-text)] mb-4 flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="w-5 h-5 rounded-[5px] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.28)] text-[var(--color-negative-text)] inline-flex items-center justify-center text-[13px] font-mono"
                >
                  &#10007;
                </span>
                Never granted
              </div>
              <ul className="list-none m-0 p-0">
                {[
                  'Stored credentials',
                  'Trading capability',
                  'Money movement',
                  'Model training on client data',
                ].map((item) => (
                  <li
                    key={item}
                    className="text-base py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 flex items-center gap-3 text-[var(--color-text-muted)]"
                  >
                    <span aria-hidden className="font-mono text-[15px] w-4 text-[var(--color-negative-text)]">
                      &#10007;
                    </span>
                    <span className="relative">
                      <span
                        aria-hidden
                        className="absolute left-0 right-0 top-[54%] h-px bg-[rgba(248,113,113,0.35)]"
                      />
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-[var(--color-border-base)] font-mono text-[12px] tracking-[0.03em] text-[var(--color-text-muted)] leading-relaxed">
            No credential sharing anywhere in the design · the client can cut any link at any
            time · a categorically different posture from the one{' '}
            <Link
              href="/blog/best-pontera-alternatives"
              className="text-[var(--color-text-secondary)] underline underline-offset-2 transition-colors duration-200 hover:text-[var(--color-gold)]"
            >
              custodians are banning
            </Link>
          </div>
        </div>
      </section>

      {/* The ask */}
      <section
        id="intake"
        className="relative z-10 max-w-[1240px] mx-auto px-10 max-sm:px-5 pb-[100px] max-sm:pb-14 scroll-mt-8"
      >
        <div className="max-w-[760px]">
          <Eyebrow>The ask</Eyebrow>
          <h2 className="text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold tracking-[-0.035em] leading-[1.05] mb-5">
            Twenty minutes.{' '}
            <em className="not-italic font-bold text-[var(--color-gold)]">No pitch.</em>
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] max-w-[600px] mb-3">
            We want advisors who feel the outside-account blind spot weekly: fee-only planners, RIA
            owner-operators, and advisors at larger firms who are candid about what their tools do
            not show them. Your workflow, your morning, what you would actually use.
          </p>
          <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] max-w-[600px] mb-8">
            Interviews shape what gets built and whether it gets built.
          </p>
          <IntakeForm />
        </div>
      </section>

      {/* Reading */}
      <section className="relative z-10 border-t border-[var(--color-border-base)]">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 py-[80px] max-sm:py-12">
          <Eyebrow>The research, in public</Eyebrow>
          <ul className="grid sm:grid-cols-2 gap-x-12 gap-y-3.5 max-w-[1040px] mt-8">
            {READING.map((item) => (
              <li key={item.href} className="flex gap-3 items-start">
                <span aria-hidden className="text-[var(--color-gold)] font-mono text-[14px]">
                  &rarr;
                </span>
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
