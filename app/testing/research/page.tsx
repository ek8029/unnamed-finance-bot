// /testing/research — the research tab rebuilt as a grounded analyst.
//
// Dev only (404s in production). The engine reads a real account's agent
// findings + book via the service client, so this must never exist in prod.
// Pass ?email= to preselect the account (kept out of code so the public repo
// carries no real address).

import { notFound } from 'next/navigation';
import { ResearchLab } from './research-lab';

export const metadata = { title: 'Research', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ResearchTestingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { email } = await searchParams;
  return <ResearchLab initialEmail={email?.trim() ?? ''} />;
}
