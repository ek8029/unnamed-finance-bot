import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import {
  DeviceScroller,
  PhoneFrame,
  type AppScreen,
} from '@/components/app-showcase/device-scroller';

/**
 * /app — the iPhone app, shown rather than described.
 *
 * Screenshots are the real build, lifted off the device at 1290x2796, not
 * mockups. Order is deliberate: overview, brief, portfolio, theses, taxes.
 * Theses is fourth. Helm gets called a thesis tracker far more often than it
 * should be, and a page that opens on the theses screen is how that keeps
 * happening.
 *
 * APP_STORE_URL stays null until Apple approves the build in review. A page
 * that says "Download on the App Store" and then does not is worse than a page
 * that says it is in review, and flipping this on later is one line.
 */

const APP_STORE_URL: string | null = null;

export const metadata: Metadata = {
  title: 'Helm for iPhone | Helm Terminal',
  description:
    'The Helm terminal on iPhone. Your whole book across brokerages, a written brief each morning, every position with cost basis, the reasons behind each holding, and the losses worth taking.',
  openGraph: {
    title: 'Helm for iPhone',
    description:
      'Your whole book across brokerages, read before you open it. Five screens, no ticker hunting.',
    url: 'https://helmterminal.dev/app',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/app' },
};

const SCREENS: AppScreen[] = [
  {
    id: 'overview',
    src: '/app/overview.png',
    tab: 'Overview',
    eyebrow: 'Overview',
    title: 'The day, on a scale',
    body: 'Net worth across every account you have linked or typed in, with the day set against a fixed plus or minus 2% rail. A green number gets a size, not just a sign.',
    points: [
      'Invested, cash and debt separated rather than netted into one figure',
      'What moved since you last opened the app, not since midnight',
      'How the book splits by sector, against the concentration line you set',
    ],
  },
  {
    id: 'brief',
    src: '/app/brief.png',
    tab: 'Brief',
    eyebrow: 'The Current',
    title: 'Written at 9:15, before the open',
    body: 'A brief on your holdings, not on the market. Built each morning from filings, reporting and the overnight move, fifteen minutes before the bell.',
    points: [
      'The band behind the day bar is what options are pricing, VIX divided by 16',
      'Signals tagged to the position they affect, marked supports or challenges',
      'Every claim carries the source it was pulled from',
    ],
  },
  {
    id: 'portfolio',
    src: '/app/portfolio.png',
    tab: 'Portfolio',
    eyebrow: 'Portfolio',
    title: 'Every position, and what you paid',
    body: 'One list across all your brokerages, with the numbers that matter on the same line: share count, weight in the book, price in, and what the position has actually done.',
    points: [
      'Equities, ETFs, crypto and cash filtered without leaving the screen',
      'Cost basis carried through from the brokerage, not re-entered by hand',
      'Anything Helm cannot sync is marked as typed in, so nothing looks live that is not',
    ],
  },
  {
    id: 'theses',
    src: '/app/theses.png',
    tab: 'Theses',
    eyebrow: 'Theses',
    title: 'The reasons, checked against filings',
    body: 'Write down why you own something and Helm reads filings and reporting back against it. Trouble sorts to the top, and each finding quotes the document it came from.',
    points: [
      'How much of the book has a reason on file, in dollars and percent',
      'Breaking and under pressure separated from holding up',
      'The verbatim sentence that changed the reading, with its filing date',
    ],
  },
  {
    id: 'taxes',
    src: '/app/taxes.png',
    tab: 'Taxes',
    eyebrow: 'Tax Center',
    title: 'The losses worth selling',
    body: 'The only dollar figure in Helm computed rather than judged. It comes from your own cost basis, and it is the number most people find on day one.',
    points: [
      'Harvestable loss by position, largest first',
      'A 30 day wash-sale lookback across the accounts you have linked',
      'Estimates only, with the assumptions written out. Helm is not a tax advisor',
    ],
  },
];

const FACTS: { k: string; v: string }[] = [
  { k: 'Institutions', v: '12,000+' },
  { k: 'Brokerage access', v: 'Read only' },
  { k: 'Brief lands', v: '9:15 AM ET' },
  { k: 'To start', v: 'Free' },
];

export default function AppShowcasePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex flex-col relative overflow-x-clip">
      <CinematicBg />

      <header className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6">
            <Link
              href="/analyze"
              className="text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/compare"
              className="hidden sm:inline text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110 active:translate-y-px"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 flex-1 w-full">
        {/* ── Hero: asymmetric, device cluster carries the right side ── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:pt-24 pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-12 lg:gap-8 items-center">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-6"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Helm for iPhone
              </p>
              <h1
                className="text-[44px] sm:text-[62px] lg:text-[72px] xl:text-[84px] leading-[0.94] tracking-[-0.025em] text-[var(--color-text-primary)] mb-7 text-balance"
                style={{ fontFamily: 'var(--font-display-serif), Georgia, serif' }}
              >
                Your book, read
                <br />
                before you open it.
              </h1>
              <p className="text-[17px] text-[var(--color-text-secondary)] max-w-[52ch] leading-[1.6]">
                Every brokerage in one list, read overnight. What moved, what it costs you in tax,
                what reports this week, and whether the reasons you bought still stand.
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-4 mt-9">
                {APP_STORE_URL ? (
                  <a
                    href={APP_STORE_URL}
                    className="px-7 py-3.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110 active:translate-y-px"
                  >
                    Download on the App Store
                  </a>
                ) : (
                  <Link
                    href="/signup"
                    className="px-7 py-3.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110 active:translate-y-px"
                  >
                    Open the terminal
                  </Link>
                )}
                <Link
                  href="/brief"
                  className="text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors underline-offset-[6px] hover:underline"
                >
                  Read today&rsquo;s brief
                </Link>
              </div>

              {!APP_STORE_URL && (
                <p
                  className="mt-7 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] flex items-center gap-2.5"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]"
                  />
                  iOS build in review with Apple. The web terminal runs on your phone today.
                </p>
              )}
            </div>

            {/* One device, large enough to read.
                The overlapped, tilted, blurred triptych that was here is the
                default app-landing hero, and at 55% opacity behind a 12 degree
                rotation you could not read a single figure on the two rear
                phones. This page's premise is that the app is shown rather
                than described, so the hero shows one real screen at full
                opacity with the numbers legible. */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-[72%] sm:w-[52%] lg:w-full lg:max-w-[390px]">
                <PhoneFrame
                  src="/app/overview.png"
                  alt="The Helm Overview screen on iPhone, showing net worth across 23 accounts, the day's move on a plus or minus 2% scale, and the book split by sector."
                  priority
                  sizes="(max-width: 640px) 72vw, (max-width: 1024px) 52vw, 390px"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Fact rule ── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <dl className="grid grid-cols-2 md:grid-cols-4 border-t border-[var(--color-rule)]">
            {FACTS.map((f) => (
              <div
                key={f.k}
                className="py-6 md:py-7 px-0 md:px-6 md:first:pl-0 md:last:pr-0 border-b md:border-b-0 md:border-r last:border-r-0 border-[var(--color-rule)]"
              >
                <dt
                  className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {f.k}
                </dt>
                <dd className="text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)] font-tabular">
                  {f.v}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── The five screens, against one pinned device ── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-16 lg:mt-24">
          <div className="device-stage mb-12 lg:mb-16">
            {/* Spacer so the heading shares its left edge with the copy column
                it introduces, rather than with the device column. */}
            <div aria-hidden="true" />
            <div className="max-w-[46ch]">
              <p
                className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                The five screens
              </p>
              <h2
                className="text-[36px] sm:text-[46px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] text-balance"
                style={{ fontFamily: 'var(--font-display-serif), Georgia, serif' }}
              >
                What Helm has already read
              </h2>
            </div>
          </div>

          <DeviceScroller screens={SCREENS} />
        </section>

        {/* ── Permissions: sticky heading, ruled denials ── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-24 lg:mt-32">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,8fr)] gap-10 md:gap-16 border-t border-[var(--color-rule)] pt-12">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Permissions
              </p>
              <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-[1.08] text-[var(--color-text-primary)] mb-5 text-balance">
                What the app cannot do
              </h2>
              <p className="text-[15px] text-[var(--color-text-secondary)] leading-[1.65] max-w-[42ch]">
                Brokerage connections run through Plaid and are read only. This is not a setting you
                turn on. The access Helm is granted does not include the ability to do any of it.
              </p>
            </div>

            <ul className="md:pt-1">
              {[
                'Place a trade, of any size, in any account',
                'Move, transfer or withdraw a single dollar',
                'Change anything at your brokerage',
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-baseline gap-6 py-5 border-t border-[var(--color-rule)]"
                >
                  <span
                    className="shrink-0 w-[52px] text-[10px] uppercase tracking-[0.2em] text-[var(--color-negative-text)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Never
                  </span>
                  <p className="text-[16px] text-[var(--color-text-primary)] leading-snug">
                    {line}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-24 lg:mt-32 mb-24">
          <div className="border-t border-[var(--color-rule)] pt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <h2
                className="text-[34px] sm:text-[46px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] mb-4 text-balance"
                style={{ fontFamily: 'var(--font-display-serif), Georgia, serif' }}
              >
                The app and the terminal are the same book.
              </h2>
              <p className="text-[16px] text-[var(--color-text-secondary)] max-w-[48ch] leading-[1.6]">
                Connect a brokerage or type in what you hold. Helm reads it either way, and the
                phone shows what your desk shows.
              </p>
            </div>
            <Link
              href="/signup"
              className="shrink-0 px-7 py-3.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110 active:translate-y-px"
            >
              Open the terminal
            </Link>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
