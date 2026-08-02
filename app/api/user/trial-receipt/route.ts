// The post-trial receipt: what Helm actually surfaced on this user's book —
// shown by the lapsed-trial banner. Deliberately reachable on the free tier
// (it's the user's own data, and the lapse is exactly when they see it).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPortfolioBrief, getValueLedger } from '@/lib/research/account';
import { getRecentFindings } from '@/lib/research/findings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const brief = await getPortfolioBrief(supabase, user.id);
  const [ledger, findings] = await Promise.all([
    getValueLedger(supabase, user.id, brief),
    getRecentFindings(supabase, user.id, 100),
  ]);

  return NextResponse.json(
    { surfacedTotal: Math.round(ledger.surfacedTotal), findings: findings.length },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
