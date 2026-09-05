import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';

/**
 * /app — the iPhone app, shown rather than described.
 *
 * Screenshots are the real build (1.0.1), lifted straight off the device at
 * 1290x2796, not mockups. They are the same five surfaces the App Store
 * listing uses, and the order here is deliberate: overview, brief, portfolio,
 * theses, taxes. Theses is fourth. Helm gets described as a thesis tracker far
 * more often than it should be, and a page that opens on the theses screen is
 * how that keeps happening.
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

interface Screen {
  id: string;
  src: string;
  tab: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}

const SCREENS: Screen[] = [
  {
    id: 'overview',
    src: '/app/overview.png',
    tab: 'Overview',
    eyebrow: 'Overview',
    title: 'The day, on a scale',
    body: 'Net worth across every account you have linked or typed in, and the day put on a fixed plus or minus 2% rule so a green number has a size as well as a sign.',
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
    title: 'Written before you wake up',
    body: 'A brief on your holdings specifically, generated each morning from filings, reporting and the day’s move. Not a market wrap that would read the same for anybody.',
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
    body: 'One list across all your brokerages, with the number that matters on the same line: share count, weight in the book, price in, and what the position has actually done.',
    points: [
      'Equities, ETFs, crypto and cash filtered without leaving the screen',
      'Cost basis carried through from the brokerage, not re-entered by hand',
      'Positions Helm cannot sync are marked as typed in, so nothing looks live that is not',
    ],
  },
  {
    id: 'theses',
    src: '/app/theses.png',
    tab: 'Theses',
    eyebrow: 'Theses',
    title: 'The reasons, kept honest',
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

function PhoneFrame({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div
      className="relative rounded-[2.2rem] p-[3px] bg-[#1c1c1e] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 30px 80px -20px rgba(0,0,0,0.9)' }}
    >
      <div className="relative rounded-[2rem] overflow-hidden bg-black">
        <Image
          src={src}
          alt={alt}
          width={1290}
          height={2796}
          priority={priority}
          sizes="(max-width: 768px) 70vw, 300px"
          className="block w-full h-auto"
        />
      </div>
    </div>
  );
}

export default function AppShowcasePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex flex-col relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <header className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/analyze"
              className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/compare"
              className="hidden sm:inline text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full">
        {/* ── Hero ── */}
        <section className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 pt-14 pb-4 text-center">
          <p className="type-eyebrow text-[var(--color-gold)] mb-4">Helm for iPhone</p>
          <h1
            className="text-[40px] sm:text-[58px] leading-[1.02] tracking-tight text-[var(--color-text-primary)] mb-5"
            style={{ fontFamily: 'var(--font-display-serif), Georgia, serif' }}
          >
            The whole book, in your pocket.
          </h1>
          <p className="text-[16px] text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Helm connects your brokerages and reads what you hold. The day on a scale, a brief
            written before you wake up, every position with its cost basis, the reasons behind each
            holding, and the losses worth taking. Five screens, no ticker hunting.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {APP_STORE_URL ? (
              <a
                href={APP_STORE_URL}
                className="px-6 py-3 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
              >
                Download on the App Store
              </a>
            ) : (
              <Link
                href="/signup"
                className="px-6 py-3 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
              >
                Open the terminal
              </Link>
            )}
            <Link
              href="/brief"
              className="px-6 py-3 rounded border border-[var(--color-border-strong)] text-[13px] uppercase tracking-[0.15em] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-gold)] transition-colors"
            >
              Read today&rsquo;s brief
            </Link>
          </div>

          {!APP_STORE_URL && (
            <p
              className="mt-5 text-[12px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              iOS build is in review with Apple. The web terminal runs on your phone today.
            </p>
          )}
        </section>

        {/* ── Device rail ── */}
        <section className="mt-12 pb-4">
          <div className="flex gap-5 sm:gap-7 overflow-x-auto px-6 sm:px-10 pb-6 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SCREENS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 w-[210px] sm:w-[240px] snap-center group"
                aria-label={`Jump to the ${s.tab} screen`}
              >
                <PhoneFrame
                  src={s.src}
                  alt={`Helm for iPhone, the ${s.tab} screen`}
                  priority={i < 2}
                />
                <p
                  className="mt-3 text-center text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {s.tab}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* ── Screen by screen ── */}
        <section className="max-w-[1100px] mx-auto px-3 sm:px-4 lg:px-6 mt-10">
          {SCREENS.map((s, i) => (
            <div
              key={s.id}
              id={s.id}
              className="scroll-mt-20 border-t border-[var(--color-border-subtle)] py-16 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center"
            >
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="max-w-[280px] mx-auto md:mx-0">
                  <PhoneFrame src={s.src} alt={`Helm for iPhone, the ${s.tab} screen`} />
                </div>
              </div>

              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                <p className="type-eyebrow text-[var(--color-gold)] mb-3">{s.eyebrow}</p>
                <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-[1.1] text-[var(--color-text-primary)] mb-4">
                  {s.title}
                </h2>
                <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-6">
                  {s.body}
                </p>
                <ul className="space-y-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-3 text-[14px] text-[var(--color-text-secondary)]">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-gold)]"
                      />
                      <span className="leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>

        {/* ── What it cannot do ── */}
        <section className="max-w-[1100px] mx-auto px-3 sm:px-4 lg:px-6 mt-6 mb-4">
          <div className="border-t border-[var(--color-border-subtle)] pt-14">
            <p className="type-eyebrow text-[var(--color-gold)] mb-3">Permissions</p>
            <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-[1.1] text-[var(--color-text-primary)] mb-4">
              What the app cannot do
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mb-8">
              Brokerage connections run through Plaid and are read only. This is not a setting you
              turn on. The access Helm is granted does not include the ability to do any of it.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                'Place a trade, of any size, in any account',
                'Move, transfer or withdraw a single dollar',
                'Change anything at your brokerage',
              ].map((line) => (
                <div
                  key={line}
                  className="sovereign-card rounded px-5 py-4 flex gap-3 items-start"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[3px] text-[var(--color-negative-text)] text-[15px] font-bold"
                  >
                    &times;
                  </span>
                  <p className="text-[14px] text-[var(--color-text-secondary)] leading-snug">
                    {line}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-[1100px] mx-auto px-3 sm:px-4 lg:px-6 mt-16 mb-20">
          <div className="sovereign-card rounded text-center p-8 md:p-12">
            <h2 className="text-[26px] sm:text-[32px] font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
              Start on the web. The phone follows.
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] mb-7 max-w-lg mx-auto leading-relaxed">
              Same account, same book, same brief. Connect a brokerage or type in what you hold, and
              Helm reads it. Free to start.
            </p>
            <Link
              href="/signup"
              className="inline-block px-6 py-3 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
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
