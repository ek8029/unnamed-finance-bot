// /testing/app — the lab shell. Everything built on /testing, browsable as if
// it were the product: a dashboard-style sidebar, one persistent account
// (cookie, picked once), and the new surfaces as pages. Dev only; reads
// arbitrary accounts via the service client, so it 404s in production like the
// rest of /testing.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { AccountPicker } from './account-picker';
import { LabNav } from './lab-nav';

export const metadata = { title: 'Helm · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export default async function LabShellLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();

  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');

  return (
    <div className="min-h-dvh bg-[#060606] flex">
      {/* sidebar — the product's chrome, lab edition */}
      <aside className="w-[230px] shrink-0 border-r border-white/[0.06] flex flex-col sticky top-0 h-dvh">
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
          <Link href="/testing/app" className="block">
            <span className="text-[17px] font-bold tracking-[0.02em] text-[#FAFAFA]">HELM</span>
            <span className="ml-2 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
              Lab
            </span>
          </Link>
          <p className="mt-1.5 text-[10.5px] leading-[1.5] text-[#6A6A6A] m-0">
            The next version of the terminal, on real data. Dev only.
          </p>
        </div>

        <LabNav email={email} />

        <div className="mt-auto p-4 space-y-3 border-t border-white/[0.06]">
          <AccountPicker current={email} />
          <Link href="/testing" className="block text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
            ← experiment index
          </Link>
        </div>
      </aside>

      {/* content */}
      <main className="flex-1 min-w-0 px-5 sm:px-8 py-8">
        <div className="max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
