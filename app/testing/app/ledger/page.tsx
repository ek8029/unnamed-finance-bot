// Lab shell · The Ledger. The brief restructured as a dated record: what the
// crons did overnight (with receipts), what is ahead, then the prose as one
// entry. Real rows for the shell's account, zero LLM on this page.

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Ledger } from './ledger';

export const metadata = { title: 'Ledger · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LabLedgerPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const email = decodeURIComponent(jar.get('helm_lab_email')?.value ?? '');
  if (!email) {
    return <p className="text-[14px] text-[#8A8A8A] m-0">Pick an account in the sidebar to open the ledger on a real book.</p>;
  }
  return <Ledger key={email} email={email} />;
}
