// GET /api/tax/first-read
//
// THE FIRST DETERMINISTIC NUMBER, AT THE MOMENT IT IS WORTH THE MOST.
//
// Connecting a brokerage is the largest ask in the product and it currently
// pays out in nothing. `exchange-public-token` writes the item and the accounts
// and returns; holdings arrive later, on a webhook, and the person is dropped on
// a dashboard that cannot yet tell them anything. The one figure Helm computes
// that is arithmetic rather than judgment — the harvestable loss — sits two
// navigations away on /dashboard/taxes, and most people never go looking.
//
// This is the headline of that report and nothing else, shaped so a screen can
// poll it while the first sync is still running.
//
// THREE STATES, BECAUSE TWO WOULD LIE.
//
// A user who has connected but whose holdings have not landed yet has zero rows
// in `holdings`, which is byte-identical to a user who holds nothing. Rendering
// that as "$0 harvestable" tells someone Helm read their book and found nothing
// in it, seconds after they handed over their brokerage, when in truth Helm has
// not read anything at all. So `syncing` is reported separately and the caller
// is expected to keep waiting rather than draw a zero.
//
// A genuine zero is still an answer and is reported as `ready` with the position
// count attached, so the screen can say what was actually examined.
//
// Errors 500 rather than returning zeros, for the same reason: a failed query is
// not a finding. lib/tax-analysis carries the same rule one layer down.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTaxReport } from '@/lib/tax-analysis';

export const dynamic = 'force-dynamic';

export interface FirstRead {
  /** `syncing`: connected, holdings not in yet. `empty`: nothing connected at
   *  all. `ready`: holdings were read, and the figures below are real. */
  state: 'syncing' | 'empty' | 'ready';
  /** Positions actually read. The denominator for anything the screen claims. */
  positions: number;
  accounts: number;
  /** Absolute harvestable loss, in dollars. Positive: it is stated as an amount
   *  of loss, not as a negative gain, so the copy never has to explain a sign. */
  harvestable: number;
  opportunityCount: number;
  /** Estimated year-one saving after the IRC §1211(b) cap, which is the honest
   *  number: the uncapped one overstates what this year is actually worth. */
  savings: number;
  /** Loss still deductible this year before the cap bites. */
  remainingDeductible: number;
  /** MUST be rendered wherever the figures are. Helm is not an RIA. */
  disclaimer: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Counted head-only: this endpoint is polled every couple of seconds during
    // a sync and has no business pulling every row to find out whether any exist.
    const [holdings, accounts] = await Promise.all([
      supabase.from('holdings').select('ticker', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('linked_accounts').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_active', true),
    ]);
    if (holdings.error) throw holdings.error;

    const positions = holdings.count ?? 0;
    const accountCount = accounts.count ?? 0;

    if (positions === 0) {
      const base: FirstRead = {
        // An account with no positions yet is mid-sync. No accounts at all means
        // nothing was ever connected, which is a different screen entirely.
        state: accountCount > 0 ? 'syncing' : 'empty',
        positions: 0, accounts: accountCount,
        harvestable: 0, opportunityCount: 0, savings: 0, remainingDeductible: 0,
        disclaimer: null,
      };
      return NextResponse.json(base);
    }

    const report = await generateTaxReport(user.id);

    const body: FirstRead = {
      state: 'ready',
      positions,
      accounts: accountCount,
      harvestable: Math.abs(report.totalHarvestableLoss),
      opportunityCount: report.opportunityCount,
      savings: report.annualCap.cappedSavings,
      remainingDeductible: report.annualCap.remainingDeductibleLoss,
      disclaimer: report.disclaimer,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('first-read failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
