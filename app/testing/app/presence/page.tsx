// Lab shell · Overview presence. The overview's top area with the agent's
// present tense folded into the caption under net worth, one delta line, and
// nothing added. Real data for the shell's account via dev impersonation.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { PresenceOverview } from './presence-overview';

export const metadata = { title: 'Overview presence · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LabPresencePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');
  if (!email) {
    return <p className="text-[14px] text-[#8A8A8A] m-0">Pick an account in the sidebar to see the overview on a real book.</p>;
  }
  return <PresenceOverview key={email} email={email} />;
}
