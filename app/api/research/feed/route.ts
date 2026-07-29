// Production research feed: what the agent found on the signed-in user's book,
// plus the value ledger and a plain-English "where you stand".
//
// Read-only and cheap on purpose — every field here is already computed by the
// cron pipeline or derived deterministically, so there is no LLM cost per view.
// Grounded Q&A stays on /testing until the feed proves people pull.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserTier, tierAtLeast } from '@/lib/tier';
import { getPortfolioBrief, getValueLedger } from '@/lib/research/account';
import { getRecentFindings } from '@/lib/research/findings';
import { computeStanding } from '@/lib/research/standing';
import { getLatestNote } from '@/lib/research/analyst-note';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getUserTier(user.id);
  // Pro and up: the rail's first real audience is the handful of pro users
  // (Ben, Paul, the thesis cohort). 200 with locked:true so the client renders
  // nothing instead of an error.
  if (!tierAtLeast(tier, 'pro')) {
    return NextResponse.json({ locked: true, tier });
  }

  const brief = await getPortfolioBrief(supabase, user.id);
  const [findings, ledger, note] = await Promise.all([
    getRecentFindings(supabase, user.id),
    getValueLedger(supabase, user.id, brief),
    getLatestNote(supabase, user.id),
  ]);
  const standing = computeStanding(brief, findings, ledger);

  return NextResponse.json({ locked: false, tier, findings, ledger, standing, note });
}
