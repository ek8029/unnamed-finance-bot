import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getQuote } from '@/lib/financial-data';
import { recentlyRateLimited } from '@/lib/finazon';
import { isImportRequestId, manualHoldingId } from '@/lib/manual-import';

/**
 * POST /api/portfolio/manual
 *
 * Add manual holdings for the current user; replay an identified request safely.
 * Body: { requestId?: UUID, holdings: [{ ticker, shares, costBasis? }] }
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
    // A recovery draft belongs to the user who started it, even if another
    // account signs in in the same browser before its next request.
    if (body.expectedUserId !== undefined && body.expectedUserId !== user.id) {
      return NextResponse.json({ error: 'Sign in to the account that started this save.', code: 'AUTH_ACCOUNT_CHANGED' }, { status: 409 });
    }
    const holdings = body.holdings;
    const requestId = body.requestId;
    if (requestId !== undefined && !isImportRequestId(requestId)) {
      return NextResponse.json({ error: 'Invalid import request ID' }, { status: 400 });
    }

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json({ error: 'Holdings array required' }, { status: 400 });
    }

    if (holdings.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 holdings' }, { status: 400 });
    }

    // The live schema keeps one position per user/account/security. Classify
    // duplicate input tickers before inserting any rows, never merge quantities.
    const tickerCounts = new Map<string, number>();
    // Validate each holding
    for (const h of holdings) {
      if (!h?.ticker || typeof h.ticker !== 'string' || !h.ticker.trim()) {
        return NextResponse.json({ error: 'Each holding needs a ticker' }, { status: 400 });
      }
      if (typeof h.shares !== 'number' || !Number.isFinite(h.shares) || h.shares <= 0) {
        return NextResponse.json({ error: `Invalid shares for ${h.ticker}` }, { status: 400 });
      }
      if (h.costBasis != null && (typeof h.costBasis !== 'number' || !Number.isFinite(h.costBasis) || h.costBasis < 0)) {
        return NextResponse.json({ error: `Invalid cost basis for ${h.ticker}` }, { status: 400 });
      }
      const ticker = h.ticker.trim().toUpperCase();
      tickerCounts.set(ticker, (tickerCounts.get(ticker) ?? 0) + 1);
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

    // Indexed requests are replayable; existing positions are edited separately.
    const results = [];
    let totalPortfolioValue = 0;

    for (const [rowIndex, h] of holdings.entries()) {
      const ticker = h.ticker.toUpperCase().trim();
      const shares = Number(h.shares);
      const costBasis = h.costBasis == null ? null : Number(h.costBasis);
      const holdingId = requestId ? manualHoldingId(user.id, requestId, rowIndex) : null;
      // A prior response may have been lost after this row was committed. Read
      // by its stable ID before looking up another quote or adding another lot.
      if (holdingId) {
        const { data: prior, error: priorError } = await serviceClient.from('holdings')
          .select('id, shares, current_price, total_value').eq('id', holdingId).eq('user_id', user.id).maybeSingle();
        if (priorError) return NextResponse.json({ error: 'Could not confirm an earlier save. Retry the same import request.' }, { status: 503 });
        if (prior) {
          results.push({ ticker, rowIndex, shares: prior.shares, currentPrice: prior.current_price, totalValue: prior.total_value, success: true });
          continue;
        }
      }

      if ((tickerCounts.get(ticker) ?? 0) > 1) {
        results.push({ ticker, rowIndex, code: 'DUPLICATE_TICKER', error: `Enter ${ticker} once. A manual account keeps one position per ticker.`, retryable: false });
        continue;
      }

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
        // A ticker Helm already tracks survives a vendor outage, because the
        // quote falls back to market_prices. A ticker nobody holds has no such
        // row, so a rate-limited minute is indistinguishable from a symbol that
        // does not exist, and the user was told their real listed ticker could
        // not be found. Say which one it actually was.
        results.push({
          ticker, rowIndex,
          error: recentlyRateLimited() ? 'Price lookup is rate limited' : 'Could not fetch price',
          retryable: recentlyRateLimited(),
        });
        continue;
      }

      // The column is asset_class. There is no security_type on this table, so
      // this upsert had been failing with PGRST204 on every call, and because
      // supabase-js reports that in `error` rather than throwing, nothing
      // noticed. A ticker already in `securities` survived anyway, since the
      // select below still found the existing row, which is why manual entry
      // worked for popular names and failed for anything new. A user wrote in
      // that CAVA and PSX "aren't showing".
      const { data: security, error: securityError } = await serviceClient
        .from('securities')
        .upsert(
          { ticker, security_name: ticker, asset_class: 'equity', current_price: currentPrice },
          { onConflict: 'ticker' },
        )
        .select('id')
        .maybeSingle();

      if (securityError || !security) {
        console.error(`[manual-portfolio] securities upsert failed for ${ticker}:`, securityError);
        results.push({ ticker, rowIndex, error: 'Could not save that security', retryable: true });
        continue;
      }

      const totalValue = shares * currentPrice;
      const totalCostBasis = costBasis === null ? null : shares * costBasis;
      const unrealisedGainLoss = totalCostBasis === null ? null : totalValue - totalCostBasis;
      const unrealisedGainLossPct = totalCostBasis && totalCostBasis > 0
        ? ((totalValue - totalCostBasis) / totalCostBasis)
        : null;

      totalPortfolioValue += totalValue;

      const { error: holdingError } = await serviceClient
        .from('holdings')
        .insert({
          ...(holdingId ? { id: holdingId } : {}),
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
        // Two identical requests can pass the earlier read together. The
        // holdings primary key selects one insert; the other confirms it.
        if (holdingId && holdingError.code === '23505') {
          const { data: prior, error: priorError } = await serviceClient.from('holdings').select('id')
            .eq('id', holdingId).eq('user_id', user.id).maybeSingle();
          if (priorError) return NextResponse.json({ error: 'Could not confirm an earlier save. Retry the same import request.' }, { status: 503 });
          if (prior) { results.push({ ticker, rowIndex, shares, currentPrice, totalValue, success: true }); continue; }
        }
        if (holdingError.code === '23505') {
          const { data: existing, error: existingError } = await serviceClient.from('holdings')
            .select('id').eq('user_id', user.id).eq('account_id', account.id).eq('security_id', security.id).maybeSingle();
          if (existingError) return NextResponse.json({ error: 'Could not confirm the existing position. Retry the same import request.' }, { status: 503 });
          if (existing) {
            results.push({ ticker, rowIndex, code: 'EXISTING_POSITION', error: `${ticker} is already in your manual portfolio. Edit the existing position to change shares or cost basis.`, retryable: false });
            continue;
          }
        }
        console.error(`[manual-portfolio] Failed to insert ${ticker}:`, holdingError);
        // A network/transport error can follow a committed insert. Do not
        // label that row unsaved: the caller must replay the identical IDs.
        if (holdingId && !/^[0-9A-Z]{5}$/.test(holdingError.code ?? '')) {
          return NextResponse.json({ error: 'A save could not be confirmed. Retry the same import request.' }, { status: 503 });
        }
        results.push({ ticker, rowIndex, error: 'Failed to save', retryable: true });
        continue;
      }

      results.push({ ticker, rowIndex, shares, currentPrice, totalValue, success: true });
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

    // No automatic trial here any more; see the Plaid exchange route. Free
    // accounts can reach the thesis layer directly, so nothing needs unlocking.

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
      .select('id, account_subtype')
      .eq('user_id', user.id)
      .eq('institution_id', institution.id)
      .eq('source', 'manual')
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ holdings: [], accountType: null });
    }

    // Back to the key the UI offers, not the stored subtype. An account made
    // before this existed has subtype null, which is reported as null rather
    // than "taxable": nobody has actually answered the question yet.
    const accountType = account.account_subtype
      ? Object.keys(MANUAL_ACCOUNT_TYPES).find(
          (k) => MANUAL_ACCOUNT_TYPES[k].subtype === account.account_subtype,
        ) ?? null
      : null;

    const { data: holdings } = await serviceClient
      .from('holdings')
      .select('id, ticker, shares, average_cost_basis, current_price, total_value')
      .eq('user_id', user.id)
      .eq('account_id', account.id)
      .order('total_value', { ascending: false });

    return NextResponse.json({
      holdings: (holdings || []).map(h => ({
        id: h.id,
        ticker: h.ticker,
        shares: Number(h.shares),
        costBasis: h.average_cost_basis == null ? null : Number(h.average_cost_basis),
        currentPrice: Number(h.current_price),
        totalValue: Number(h.total_value),
      })),
      accountType,
    });
  } catch (error) {
    console.error('[manual-portfolio] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Editing what you typed ──
//
// POST only ever appended ("Each submission adds new lots — no delete, no
// upsert"), so a typo was permanent and a correction produced a duplicate lot.
// A support email from a real user on 2026-09-02 asked how to fix one. There was
// no answer, so these exist.
//
// Both handlers resolve the caller's OWN manual account first and scope every
// write to it. A Plaid-sourced holding can never be reached from here: those
// rows belong to the brokerage feed and editing them would put Helm's numbers
// out of step with the custodian's.

/** The caller's manual account, or null when they have never used manual entry. */
async function manualAccountId(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  opts: { create?: boolean } = {},
): Promise<string | null> {
  const { data: institution } = await serviceClient
    .from('institutions')
    .select('id')
    .eq('slug', 'manual-portfolio')
    .maybeSingle();
  if (!institution) return null;

  const { data: account } = await serviceClient
    .from('linked_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('institution_id', institution.id)
    .eq('source', 'manual')
    .maybeSingle();
  if (account) return account.id;
  if (!opts.create) return null;

  // Same row POST would have made on the first save. Created early only when
  // the user has said something about the book, so it is never a stray.
  const { data: made, error } = await serviceClient
    .from('linked_accounts')
    .insert({
      user_id: userId,
      institution_id: institution.id,
      account_name: 'Manual Portfolio',
      account_type: 'brokerage',
      source: 'manual',
      is_active: true,
      sync_status: 'healthy',
    })
    .select('id')
    .maybeSingle();
  if (error) console.error('[manual-portfolio] create account error:', error);
  return made?.id ?? null;
}

/**
 * Allocation percentages are a share of the whole book, so removing or resizing
 * one lot makes every other row's percentage wrong. The daily sweep would fix it
 * tomorrow; a user watching their own screen should not have to wait.
 */
async function recalcUserAllocations(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
): Promise<void> {
  const { data: rows } = await serviceClient
    .from('holdings')
    .select('id, total_value')
    .eq('user_id', userId);
  const total = (rows || []).reduce((sum, r) => sum + Number(r.total_value || 0), 0);
  if (total <= 0) return;
  for (const r of rows || []) {
    await serviceClient
      .from('holdings')
      .update({ portfolio_allocation_pct: Math.round((Number(r.total_value || 0) / total) * 10000) / 100 })
      .eq('id', r.id);
  }
}

/** DELETE /api/portfolio/manual?id=<holdingId> — remove one manually entered lot. */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const serviceClient = await createServiceClient();
    const accountId = await manualAccountId(serviceClient, user.id);
    if (!accountId) return NextResponse.json({ error: 'No manual portfolio' }, { status: 404 });

    const { data: deleted, error } = await serviceClient
      .from('holdings')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .select('ticker')
      .maybeSingle();

    if (error) {
      console.error('[manual-portfolio] DELETE error:', error);
      return NextResponse.json({ error: 'Failed to remove holding' }, { status: 500 });
    }
    // Not found means it was not theirs, or not manual. Same answer either way.
    if (!deleted) return NextResponse.json({ error: 'Holding not found' }, { status: 404 });

    await recalcUserAllocations(serviceClient, user.id);
    return NextResponse.json({ removed: deleted.ticker });
  } catch (error) {
    console.error('[manual-portfolio] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * What kind of account the hand-entered book is. Nothing downstream reads this
 * as a label: `isRetirementAccount` turns it into one boolean that decides
 * whether a loss is harvestable, whether the position reaches Form 8949, and
 * whether the Tax Center counts it at all. A manual account had no subtype and
 * a name matching nothing, so every hand-entered book was assumed taxable and
 * people holding an IRA were shown a harvest they cannot take.
 *
 * The name is set alongside the subtype on purpose. `isRetirementAccount` falls
 * back to a name regex precisely because Plaid so often leaves subtype null, and
 * a book that reads "Manual Portfolio (Roth IRA)" is right by either path.
 */
const MANUAL_ACCOUNT_TYPES: Record<string, { subtype: string; label: string }> = {
  taxable: { subtype: 'brokerage', label: 'Manual Portfolio' },
  traditional_ira: { subtype: 'traditional_ira', label: 'Manual Portfolio (Traditional IRA)' },
  roth_ira: { subtype: 'roth_ira', label: 'Manual Portfolio (Roth IRA)' },
  '401k': { subtype: '401k', label: 'Manual Portfolio (401k)' },
  hsa: { subtype: 'hsa', label: 'Manual Portfolio (HSA)' },
  '529': { subtype: '529', label: 'Manual Portfolio (529)' },
};

/** PATCH /api/portfolio/manual — change one lot, or the account type of the book. */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null) as {
      id?: string; shares?: unknown; costBasis?: unknown; accountType?: unknown;
    } | null;

    // Setting the account type addresses the book, not a lot, so it carries no
    // id. Done before the id check so it does not need a holding to exist:
    // someone should be able to say "this is my Roth" before typing anything in.
    if (body?.accountType !== undefined && !body.id) {
      const choice = MANUAL_ACCOUNT_TYPES[String(body.accountType)];
      if (!choice) return NextResponse.json({ error: 'Unknown account type' }, { status: 400 });

      const serviceClient = await createServiceClient();
      const accountId = await manualAccountId(serviceClient, user.id, { create: true });
      if (!accountId) return NextResponse.json({ error: 'No manual portfolio' }, { status: 404 });

      const { error } = await serviceClient
        .from('linked_accounts')
        .update({ account_subtype: choice.subtype, account_name: choice.label })
        .eq('id', accountId)
        .eq('user_id', user.id)
        .eq('source', 'manual');
      if (error) {
        console.error('[manual-portfolio] account type error:', error);
        return NextResponse.json({ error: 'Failed to set account type' }, { status: 500 });
      }
      return NextResponse.json({ updated: true, accountType: String(body.accountType) });
    }

    if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const patch: Record<string, number | null> = {};
    if (body.shares !== undefined) {
      const shares = Number(body.shares);
      if (!Number.isFinite(shares) || shares <= 0) {
        return NextResponse.json({ error: 'Shares must be a positive number' }, { status: 400 });
      }
      patch.shares = shares;
    }
    if (body.costBasis !== undefined) {
      if (body.costBasis === null || body.costBasis === '') {
        patch.average_cost_basis = null;
      } else {
        const cost = Number(body.costBasis);
        if (!Number.isFinite(cost) || cost < 0) {
          return NextResponse.json({ error: 'Cost basis must be zero or more' }, { status: 400 });
        }
        patch.average_cost_basis = cost;
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
    }

    const serviceClient = await createServiceClient();
    const accountId = await manualAccountId(serviceClient, user.id);
    if (!accountId) return NextResponse.json({ error: 'No manual portfolio' }, { status: 404 });

    const { data: existing } = await serviceClient
      .from('holdings')
      .select('id, current_price, shares')
      .eq('id', body.id)
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Holding not found' }, { status: 404 });

    // A share change moves the position's value, and the value feeds allocation,
    // exposure and the tax numbers. Recompute it here rather than leaving the
    // row internally inconsistent until the next price sweep.
    if (patch.shares !== undefined) {
      patch.total_value = Number(patch.shares) * Number(existing.current_price || 0);
    }

    const { error } = await serviceClient.from('holdings').update(patch).eq('id', existing.id);
    if (error) {
      console.error('[manual-portfolio] PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
    }

    await recalcUserAllocations(serviceClient, user.id);
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error('[manual-portfolio] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
