// /testing — permanent design-lab hub. Every in-flight feature idea gets a slot
// here so it can be evaluated against REAL data without touching the dashboard,
// fighting auth, or shipping anything to users. Dev-only (404s in production).

import { notFound } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Testing', robots: { index: false, follow: false } };

const EXPERIMENTS = [
  {
    href: '/testing/thesis-v2',
    title: 'Thesis Intelligence v2',
    date: '2026-07-21',
    blurb:
      'Two alert lanes, mechanism clustering, realized vs emerging, thesis-relative headlines. Rendered on real approved catches. Spec: docs/superpowers/specs/2026-07-21-thesis-intelligence-v2.md',
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
