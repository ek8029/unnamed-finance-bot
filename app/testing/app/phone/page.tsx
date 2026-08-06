// Lab shell · The app, as a phone.
//
// Mockup for the iOS decision: the agent's inbox, rendered at iPhone size on the
// lab's shared account. Real findings, real book, no seeded rows. Dev only.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { PhoneAppMock } from '@/components/testing/phone-app-mock';

export const metadata = { title: 'Phone · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LabPhonePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');

  if (!email) {
    return (
      <p className="text-[14px] text-[#8A8A8A] m-0">
        Pick an account in the sidebar to see its book through the phone mockup.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#FAFAFA]">The app, as a phone</h1>
        <p className="mt-2 m-0 max-w-[640px] text-[13.5px] leading-[1.6] text-[#8A8A8A]">
          The agent&apos;s inbox at iPhone size, on a real book. Switch the profile to watch
          findings appear and disappear as the rules change. Switch to the lock screen to read
          the push copy on its own, which is the only thing most people will ever see.
        </p>
      </header>
      <PhoneAppMock email={email} />
    </div>
  );
}
