// Lab shell · Theses. The v2 mechanism model on the shell's shared account.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { ThesesV2Body } from '@/components/testing/theses-v2-body';

export const metadata = { title: 'Theses · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LabThesesPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');

  if (!email) {
    return (
      <p className="text-[14px] text-[#8A8A8A] m-0">
        Pick an account in the sidebar to see its theses through the v2 model.
      </p>
    );
  }
  return <ThesesV2Body email={email} />;
}
