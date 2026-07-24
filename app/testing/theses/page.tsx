// /testing/theses — a real account's theses, rendered through the Thesis v2
// model. Standalone lab entry; the body is shared with the lab shell at
// /testing/app/theses. Dev only (404s in production). Pass ?email= to pick the
// account (kept out of code — public repo).

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ThesesV2Body } from '@/components/testing/theses-v2-body';

export const metadata = { title: 'Theses v2', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export default async function ThesesV2Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { email } = await searchParams;
  return (
    <div className="min-h-dvh bg-[#060606] px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/testing" className="inline-flex items-center min-h-[44px] text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
          ← Testing
        </Link>
        <div className="mt-1">
          {email?.trim() ? (
            <ThesesV2Body email={email} />
          ) : (
            <p className="text-[14px] text-[#FAFAFA] m-0">
              Pass an account, e.g. <span style={MONO}>/testing/theses?email=someone@example.com</span> — or use the
              lab shell at <Link href="/testing/app" className="text-[#E6B94D]">/testing/app</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
