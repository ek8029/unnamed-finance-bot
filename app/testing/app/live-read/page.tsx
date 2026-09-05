// Lab shell · Live Read. FirstRead generalised: the whole book read as a
// streamed sequence of real steps, each line printed when its work finishes,
// with the real clock and the real server time. On demand here; at the connect
// moment in the product.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { LiveRead } from './live-read';

export const metadata = { title: 'Live Read · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LabLiveReadPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');
  if (!email) {
    return <p className="text-[14px] text-[#8A8A8A] m-0">Pick an account in the sidebar to run a live read on a real book.</p>;
  }
  return <LiveRead key={email} email={email} />;
}
