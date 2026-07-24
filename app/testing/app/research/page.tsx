// Lab shell · Research. The grounded analyst on the shell's shared account.
// key={email} forces a clean remount when the account switches, so no state
// leaks between books.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { ResearchLab } from '@/app/testing/research/research-lab';

export const metadata = { title: 'Research · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LabResearchPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');

  if (!email) {
    return (
      <p className="text-[14px] text-[#8A8A8A] m-0">
        Pick an account in the sidebar to open the research tab on a real book.
      </p>
    );
  }
  return <ResearchLab key={email} initialEmail={email} embedded />;
}
