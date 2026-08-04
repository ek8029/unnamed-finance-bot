import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { grantFirstConnectTrial } from '@/lib/grant-connect-trial';
import { getQuote } from '@/lib/financial-data';

/**
 * POST /api/portfolio/manual
 *
 * Add or replace manual holdings for the current user.
 * Body: { holdings: [{ ticker, shares, costBasis? }] }
 *
 * Creates a "Manual Portfolio" linked_account if one doesn't exist,
 * upserts securities, and inserts holdings with live prices.
 */
// Serial quote lookups with retries across up to 50 rows can exceed the
// default 60s — a timeout mid-insert plus a resubmit duplicated every lot.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const holdings = body.holdings;

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json({ error: 'Holdings array required' }, { status: 400 });
    }

    if (holdings.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 holdings' }, { status: 400 });
    }

    // Validate each holding
    for (const h of holdings) {
      if (!h.ticker || typeof h.ticker !== 'string') {
        return NextResponse.json({ error: 'Each holding needs a ticker' }, { status: 400 });
      }
      if (!h.shares || typeof h.shares !== 'number' || h.shares <= 0) {
        return NextResponse.json({ error: `Invalid shares for ${h.ticker}` }, { status: 400 });
      }
    }

    const serviceClient = await createServiceClient();

    // Find or create manual institution
    const { data: institution } = await serviceClient
      .from('institutions')
      .select('id')
      .eq('slug', 'manual-portfolio')
      .maybeSingle();

    if (!institution) {
      return NextResponse.json({ error: 'Manual portfolio institution not found. Run migration 037.' }, { status: 500 });
    }

    // Find or create manual linked_account for this user
    let { data: account } = await serviceClient
      .from('linked_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', institution.id)
      .eq('source', 'manual')
      .maybeSingle();

    if (!account) {
      const { data: newAccount, error: accountError } = await serviceClient
        .from('linked_accounts')
        .insert({
          user_id: user.id,
          institution_id: institution.id,
          account_name: 'Manual Portfolio',
          account_type: 'brokerage',
          source: 'manual',
          is_active: true,
          sync_status: 'healthy',
        })
        .select('id')
        .maybeSingle();

      if (accountError || !newAccount) {
        console.error('[manual-portfolio] Failed to create account:', accountError);
        return NextResponse.json({ error: 'Failed to create manual account' }, { status: 500 });
      }
      account = newAccount;
    }

    // Each submission adds new lots — no delete, no upsert
    const results = [];
    let totalPortfolioValue = 0;

    for (const h of holdings) {
      const ticker = h.ticker.toUpperCase().trim();
      const shares = Number(h.shares);
      const costBasis = h.costBasis ? Number(h.costBasis) : null;

      // Fetch live quote — retry up to 3 times with increasing delay
      let currentPrice = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 3000));
          const quote = await getQuote(ticker);
          currentPrice = quote?.c || 0;
          if (currentPrice > 0) break;
        } catch (err) {
          console.error(`[manual-portfolio] Quote attempt ${attempt + 1} failed for ${ticker}:`, err instanceof Error ? err.message : err);
        }
      }

      if (currentPrice === 0) {
        results.push({ ticker, error: 'Could not fetch price' });
        continue;
      }

      // Upsert security
      await serviceClient
        .from('securities')
        .upsert(
          { ticker, security_name: ticker, security_type: 'equity', current_price: currentPrice },
          { onConflict: 'ticker' },
        );

      // Get security ID
      const { data: security } = await serviceClient
        .from('securities')
        .select('id')
        .eq('ticker', ticker)
        .maybeSingle();

      if (!security) {
        results.push({ ticker, error: 'Failed to create security' });
        continue;
      }

      const totalValue = shares * currentPrice;
      const totalCostBasis = costBasis ? shares * costBasis : null;
      const unrealisedGainLoss = totalCostBasis ? totalValue - totalCostBasis : null;
      const unrealisedGainLossPct = totalCostBasis && totalCostBasis > 0
        ? ((totalValue - totalCostBasis) / totalCostBasis)
        : null;

      totalPortfolioValue += totalValue;

      const { error: holdingError } = await serviceClient
        .from('holdings')
        .insert({
          user_id: user.id,
          account_id: account.id,
          security_id: security.id,
          ticker,
          shares,
          current_price: currentPrice,
          total_value: totalValue,
          average_cost_basis: costBasis,
          total_cost_basis: totalCostBasis,
          unrealised_gain_loss: unrealisedGainLoss,
          unrealised_gain_loss_pct: unrealisedGainLossPct,
        });

      if (holdingError) {
        console.error(`[manual-portfolio] Failed to insert ${ticker}:`, holdingError);
        results.push({ ticker, error: 'Failed to save' });
        continue;
      }

      results.push({ ticker, shares, currentPrice, totalValue, success: true });
    }

    // Include existing holdings in total for allocation calc
    const { data: allHoldings } = await serviceClient
      .from('holdings')
      .select('ticker, total_value')
      .eq('user_id', user.id)
      .eq('account_id', account.id);

    // Recalculate total portfolio value from all lots
    if (allHoldings) {
      totalPortfolioValue = allHoldings.reduce((sum, h) => sum + (Number(h.total_value) || 0), 0);
    }

    const successCount = results.filter(r => r.success).length;

    // Same 14-day Pro trial the Plaid path grants. Manual entry is real activation,
    // and without it these users stay free, which silently hides the Pro-gated
    // thesis layer (hasThesisAccess -> requirePro) during onboarding. Idempotent
    // and non-blocking, so repeat submissions never restart the clock or fail here.
    if (successCount > 0) {
      await grantFirstConnectTrial(user.id, 'manual');
    }

    return NextResponse.json({
      success: true,
      added: successCount,
      failed: results.filter(r => !r.success),
      totalPortfolioValue,
    });
  } catch (error) {
    console.error('[manual-portfolio] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/portfolio/manual
 *
 * Returns current manual holdings for the user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    const { data: institution } = await serviceClient
      .from('institutions')
      .select('id')
      .eq('slug', 'manual-portfolio')
      .maybeSingle();

    if (!institution) {
      return NextResponse.json({ holdings: [] });
    }

    const { data: account } = await serviceClient
      .from('linked_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', institution.id)
      .eq('source', 'manual')
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ holdings: [] });
    }

    const { data: holdings } = await serviceClient
      .from('holdings')
      .select('ticker, shares, average_cost_basis, current_price, total_value')
      .eq('user_id', user.id)
      .eq('account_id', account.id)
      .order('total_value', { ascending: false });

    return NextResponse.json({
      holdings: (holdings || []).map(h => ({
        ticker: h.ticker,
        shares: Number(h.shares),
        costBasis: h.average_cost_basis ? Number(h.average_cost_basis) : null,
        currentPrice: Number(h.current_price),
        totalValue: Number(h.total_value),
      })),
    });
  } catch (error) {
    console.error('[manual-portfolio] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
