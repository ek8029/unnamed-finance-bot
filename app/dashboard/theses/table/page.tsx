// /dashboard/theses/table — the terminal-table theses view (v3.2) on the real
// site, for the signed-in user (or the lab-impersonated account on localhost).
// Server-rendered; statuses come from the scoring pipeline with judged story
// grouping, receipts behind every line. The classic page keeps onboarding,
// drafting and per-thesis history; this is the dense read-it-in-one-screen
// view. Promote to the default after it earns it.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { ThesesV2Body } from '@/components/testing/theses-v2-body';

export const metadata = { title: 'Theses · Table' };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export default async function ThesesTablePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login');

  if (!(await hasThesisAccess(user.id, user.email))) {
    // Same entitlement as the rest of the thesis layer; the classic page owns
    // the upsell, so route there instead of duplicating it.
    redirect('/dashboard/theses');
  }

  return (
    <main className="mx-auto px-4 sm:px-7 py-[26px] pb-[60px] max-w-[1240px]">
      <div className="mb-3 flex items-center gap-4">
        <Link
          href="/dashboard/theses/classic"
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          style={MONO}
        >
          ← classic view
        </Link>
        <Link
          href="/dashboard/theses/overview"
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          style={MONO}
        >
          overview view
        </Link>
      </div>
      <ThesesV2Body email={user.email} labTags={false} />
    </main>
  );
}
