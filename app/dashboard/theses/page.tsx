// /dashboard/theses — the terminal table is the default (council verdict
// 2026-07-27: table wins, absorbing the shared-forces band; trouble-first;
// receipts one click down). The branch is on STATE, not preference: a user
// with no theses lands on the classic page, which owns onboarding and
// drafting; everyone else gets the table. Classic stays reachable at
// /dashboard/theses/classic as the creation wizard and escape hatch.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { ThesesV2Body } from '@/components/testing/theses-v2-body';
import { ClassicThesesPage } from '@/components/thesis/classic-theses-page';

export const metadata = { title: 'Theses' };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export default async function ThesesDefaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session (middleware normally catches this) or no entitlement: the
  // classic page renders the right gate/upsell itself.
  if (!user?.email || !(await hasThesisAccess(user.id, user.email))) {
    return <ClassicThesesPage />;
  }

  // Tracked theses only: /api/thesis/seed writes draft rows before the user
  // confirms, and an abandoned draft must not eject a new user out of the
  // classic onboarding into a table showing an unscanned "steady" row.
  const { count } = await supabase
    .from('theses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('tracked', true);

  // Zero theses: onboarding/drafting live on classic. The table would be an
  // empty band and dead columns — a state problem, not a view preference.
  if (!count) return <ClassicThesesPage />;

  return (
    <main className="mx-auto px-4 sm:px-7 py-[26px] pb-[60px] max-w-[1240px]">
      <div className="mb-3 flex items-center gap-4">
        <Link
          href="/dashboard/theses/classic"
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          style={MONO}
        >
          classic view
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
