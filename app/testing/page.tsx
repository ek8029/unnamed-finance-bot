// /testing — permanent design-lab hub. Every in-flight feature idea gets a slot
// here so it can be evaluated against REAL data without touching the dashboard,
// fighting auth, or shipping anything to users. Dev-only (404s in production).

import { notFound } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Testing', robots: { index: false, follow: false } };

const EXPERIMENTS = [
  {
    href: '/testing/app/ledger',
    title: 'Agent presence · Ledger, Live Read, overview caption',
    date: '2026-09-05',
    blurb:
      'Three tenses on one spine. The brief as a dated record with receipts and an AHEAD block, the connect moment as a streamed read with real timestamps, and the overview caption carrying the present tense instead of a fourth strip. Zero LLM. Spec: docs/superpowers/specs/2026-09-05-agent-presence-options.md',
  },
  {
    href: '/testing/vix16',
    title: 'VIX ÷ 16 · the priced day',
    date: '2026-08-23',
    blurb:
      'The rule of 16 placed on the real brief surfaces: the VIX cell gets a ±% priced-day subline, the hero sentence compares your move with the day options priced, and a band module draws both on one scale. Research: docs/vix-rule-of-16.md. Blocked in prod by VIXY-printed-as-VIX; Cboe delayed JSON fixes it free.',
  },
  {
    href: '/testing/app',
    title: 'Lab shell · browse it like the product',
    date: '2026-07-24',
    blurb:
      'Everything new behind one dashboard-style shell: sidebar, one persistent account (picked once, cookie), Research and Theses v2 as pages, deep-dive labs a click away. The closest thing to walking the next version of the site.',
  },
  {
    href: '/testing/research',
    title: 'Research · grounded analyst',
    date: '2026-07-23',
    blurb:
      'The research tab rebuilt to answer from what the agent already found (catches, memos, cross-thesis risk, actions) plus the real book and live prices. Every claim shows its receipt, nothing invented. Pass ?email= to pick the account.',
  },
  {
    href: '/testing/theses',
    title: 'Theses v2 · a real account',
    date: '2026-07-23',
    blurb:
      'A whole account’s theses through the v2 model — standings, then each thesis collapsed into mechanisms with a corroboration ladder and receipts. Pass ?email= to pick the account.',
  },
  {
    href: '/testing/thesis-v2',
    title: 'Thesis Intelligence v2',
    date: '2026-07-22',
    blurb:
      'The scoring pipeline instead of the social one, collapsed into mechanisms with a corroboration ladder. Every quote real. Spec: docs/superpowers/specs/2026-07-21-thesis-intelligence-v2.md',
  },
  {
    href: '/testing/thesis-v2/compare',
    title: 'Thesis v2 · engine comparison',
    date: '2026-07-22',
    blurb:
      'The shipped status engine beside the v2 ladder over identical evidence, with every contradiction they were handed. 7 of 80 pillars change. Some of them the shipped engine gets right.',
  },
  {
    href: '/testing/exposure',
    title: 'True Exposure before/after',
    date: '2026-07-22',
    blurb:
      'A real book through the pre-fix logic (10% concentration filter, HYNX and AMAU unmapped) beside the shipped logic. Pass ?email= to pick the account.',
  },
  {
    href: '/testing/onboarding',
    title: 'Value-first onboarding (v2)',
    date: '2026-07-20',
    blurb:
      'Every screen of the new onboarding, jumpable, running on your own connected account. Real scan, real accounts and holdings, real theses. Zero writes, no throwaway signup needed.',
  },
];

export default function TestingIndex() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-dvh bg-[#060606] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={{ fontFamily: 'var(--font-mono)' }}>
          Design lab
        </div>
        <h1 className="mt-3 text-[34px] font-bold tracking-tight text-[#FAFAFA]">Testing</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#8A8A8A]">
          Scratch space for evaluating features against real data before they touch the product. Dev only, never indexed, never shipped.
        </p>

        <div className="mt-10 space-y-3">
          {EXPERIMENTS.map((e) => (
            <Link key={e.href} href={e.href}
              className="block rounded-lg border border-white/[0.07] bg-[#0B0B0B] p-5 hover:border-white/[0.14] transition-colors">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] font-semibold text-[#FAFAFA]">{e.title}</span>
                <span className="text-[11px] text-[#6A6A6A] shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>{e.date}</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#8A8A8A] m-0">{e.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
