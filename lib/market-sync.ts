import { getBatchPrices } from '@/lib/finazon';
import { refreshRssNews, refreshFilingEvents } from '@/lib/free-news';
import { mapSicToSector, getTickerSectorOverride } from '@/lib/market-classify';
import { getCompanyProfileEdgar } from '@/lib/edgar';
import { RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from '@/lib/financial-config';
import type { UsageLedger } from '@/lib/ai/pricing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function refreshMarketPrices(
  supabase: AnyClient,
  log: string[],
): Promise<number> {
  const { data: holdingTickers, error } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (error || !holdingTickers) {
    log.push('[prices] Failed to fetch tickers from holdings');
    return 0;
  }

  const uniqueTickers = [...new Set(
    holdingTickers.map((h: { ticker: string }) => String(h.ticker)).filter(Boolean)
  )] as string[];

  if (uniqueTickers.length === 0) {
    log.push('[prices] No tickers to refresh');
    return 0;
  }

  const tickerSecurityMap = new Map<string, string>();
  for (const h of holdingTickers as { ticker: string; security_id: string }[]) {
    if (h.security_id && h.ticker) {
      tickerSecurityMap.set(h.ticker.toUpperCase(), h.security_id);
    }
  }

  log.push(`[prices] Refreshing prices for ${uniqueTickers.length} ticker(s)`);

  const priceMap = await getBatchPrices(uniqueTickers);

  if (priceMap.size === 0) {
    log.push('[prices] No prices returned from Finazon');
    return 0;
  }

  const relevantSecurityIds = uniqueTickers
    .map(t => tickerSecurityMap.get(t.toUpperCase()))
    .filter((id): id is string => Boolean(id));

  const prevCloseMap = new Map<string, number>();
  if (relevantSecurityIds.length > 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentPrices } = await supabase
      .from('market_prices')
      .select('security_id, price_date, close')
      .in('security_id', relevantSecurityIds)
      .gte('price_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('price_date', { ascending: false })
      .limit(relevantSecurityIds.length * 7);

    const pricesBySecurity = new Map<string, { price_date: string; close: number }[]>();
    for (const p of recentPrices || []) {
      const existing = pricesBySecurity.get(p.security_id) || [];
      existing.push({ price_date: p.price_date, close: Number(p.close) });
      pricesBySecurity.set(p.security_id, existing);
    }

    for (const ticker of uniqueTickers) {
      const securityId = tickerSecurityMap.get(ticker.toUpperCase());
      if (!securityId) continue;

      const newPrice = priceMap.get(ticker.toUpperCase());
      if (!newPrice) continue;

      const prices = pricesBySecurity.get(securityId) || [];
      const prevPrice = prices.find(p => p.price_date < newPrice.date);
      if (prevPrice?.close) {
        prevCloseMap.set(ticker.toUpperCase(), prevPrice.close);
      }
    }
  }

  const now = new Date().toISOString();
  const priceInserts: {
    security_id: string;
    ticker: string;
    price_date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];

  const holdingUpdates: {
    holdingId: string;
    ticker: string;
    currentPrice: number;
    totalValue: number;
    unrealisedGainLoss: number | null;
    unrealisedGainLossPct: number | null;
    dayChangePct: number | null;
  }[] = [];

  const { data: allHoldingsForUpdate } = await supabase
    .from('holdings')
    .select('id, ticker, shares, total_cost_basis, security_id');

  for (const holding of allHoldingsForUpdate || []) {
    const ticker = holding.ticker?.toUpperCase();
    if (!ticker) continue;

    const price = priceMap.get(ticker);
    if (!price) continue;

    const shares = Number(holding.shares);
    const hasCostBasis = holding.total_cost_basis != null;
    const totalCostBasis = hasCostBasis ? Number(holding.total_cost_basis) : 0;
    const totalValue = shares * price.close;
    const unrealisedGainLoss = hasCostBasis ? totalValue - totalCostBasis : null;
    const unrealisedGainLossPct =
      hasCostBasis && totalCostBasis > 0 ? (totalValue - totalCostBasis) / totalCostBasis : null;

    const prevClose = prevCloseMap.get(ticker);
    const dayChangePct = prevClose && prevClose > 0
      ? (price.close - prevClose) / prevClose
      : (price.open > 0 ? (price.close - price.open) / price.open : null);

    holdingUpdates.push({
      holdingId: holding.id,
      ticker,
      currentPrice: price.close,
      totalValue,
      unrealisedGainLoss,
      unrealisedGainLossPct,
      dayChangePct,
    });
  }

  const holdingResults = await Promise.allSettled(holdingUpdates.map(u =>
    supabase
      .from('holdings')
      .update({
        current_price: u.currentPrice,
        total_value: u.totalValue,
        unrealised_gain_loss: u.unrealisedGainLoss,
        unrealised_gain_loss_pct: u.unrealisedGainLossPct,
        day_change_pct: u.dayChangePct,
        last_updated_at: now,
      })
      .eq('id', u.holdingId)
  ));
  const holdingFailures = holdingResults.filter(r =>
    r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)
  );
  if (holdingFailures.length > 0) {
    console.error(`[prices] ${holdingFailures.length} holding updates failed`);
  }

  const securityResults = await Promise.allSettled(
    Array.from(priceMap.entries())
      .filter(([ticker]) => tickerSecurityMap.has(ticker))
      .map(([ticker, price]) =>
        supabase
          .from('securities')
          .update({ current_price: price.close, last_updated_at: now })
          .eq('id', tickerSecurityMap.get(ticker)!)
      )
  );
  const securityFailures = securityResults.filter(r =>
    r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)
  );
  if (securityFailures.length > 0) {
    console.error(`[prices] ${securityFailures.length} security updates failed`);
  }

  for (const [ticker, price] of priceMap.entries()) {
    const securityId = tickerSecurityMap.get(ticker);
    if (!securityId) continue;
    priceInserts.push({
      security_id: securityId,
      ticker,
      price_date: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
    });
  }

  if (priceInserts.length > 0) {
    await supabase
      .from('market_prices')
      .upsert(priceInserts, {
        onConflict: 'security_id,price_date',
        ignoreDuplicates: false,
      });
  }

  // NOTE: Allocation percentages are NOT computed here because this function
  // operates on ALL users' holdings (service-role client bypasses RLS).
  // Per-user allocation is handled by recalcAllocations() which correctly
  // groups by user_id before computing percentages.

  const updated = holdingUpdates.length;
  log.push(`[prices] Updated ${updated}/${uniqueTickers.length} ticker prices`);
  return updated;
}

export async function recalcAllocations(supabase: AnyClient, log: string[]) {
  try {
    // This is a GLOBAL read across every user's holdings, and PostgREST caps an
    // unbounded select at 1000 rows and returns them without complaint. Past
    // that ceiling the tail of the table simply vanished: allocations for the
    // users in it were computed from a partial book, or never recomputed at
    // all, with no error anywhere. Page explicitly instead.
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 200; // 200k holdings — a backstop, not a real limit
    const allHoldings: { id: string; user_id: string; total_value: number }[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('holdings')
        .select('id, user_id, total_value')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('[allocations] holdings page fetch failed:', error.message);
        return;
      }
      if (!data || data.length === 0) break;
      allHoldings.push(...(data as { id: string; user_id: string; total_value: number }[]));
      if (data.length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) {
        console.error('[allocations] hit the page cap — some holdings were not reallocated');
      }
    }

    if (allHoldings.length === 0) return;

    const userHoldings = new Map<string, { id: string; total_value: number }[]>();
    for (const h of allHoldings) {
      const existing = userHoldings.get(h.user_id) || [];
      existing.push({ id: h.id, total_value: Number(h.total_value) });
      userHoldings.set(h.user_id, existing);
    }

    for (const [, holdings] of userHoldings) {
      const total = holdings.reduce((s, h) => s + h.total_value, 0);
      if (total <= 0) continue;

      const allocResults = await Promise.allSettled(holdings.map(h => {
        const pct = (h.total_value / total) * 100;
        return supabase
          .from('holdings')
          .update({ portfolio_allocation_pct: Math.round(pct * 100) / 100 })
          .eq('id', h.id);
      }));
      const allocFailures = allocResults.filter(r =>
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)
      );
      if (allocFailures.length > 0) {
        console.error(`[allocations] ${allocFailures.length} allocation updates failed`);
      }
    }

    log.push(`[allocations] Recalculated for ${userHoldings.size} user(s)`);
  } catch (error) {
    console.error('[market-sync] Error recalculating allocations:', error);
  }
}

export async function updatePortfolioPerformance(
  supabase: AnyClient,
  userId: string,
) {
  const { data: holdings } = await supabase
    .from('holdings')
    .select('id, ticker, security_id, total_value, day_change_pct, shares, current_price')
    .eq('user_id', userId);

  if (!holdings || holdings.length === 0) return;

  const totalPortfolioValue = holdings.reduce(
    (s: number, h: { total_value: number }) => s + Number(h.total_value), 0
  );
  if (totalPortfolioValue <= 0) return;

  const return1d = holdings.reduce((s: number, h: { total_value: number; day_change_pct: number | null }) => {
    const weight = Number(h.total_value) / totalPortfolioValue;
    return s + weight * (Number(h.day_change_pct) || 0);
  }, 0);

  const securityIds = [...new Set(
    holdings.map((h: { security_id: string }) => h.security_id).filter(Boolean)
  )];

  let historicalPrices: { security_id: string; price_date: string; close: number }[] = [];
  if (securityIds.length > 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data } = await supabase
      .from('market_prices')
      .select('security_id, price_date, close')
      .in('security_id', securityIds)
      .gte('price_date', oneYearAgo.toISOString().split('T')[0])
      .order('price_date', { ascending: true });

    historicalPrices = data || [];
  }

  const priceHistory = new Map<string, { date: string; close: number }[]>();
  for (const p of historicalPrices) {
    const existing = priceHistory.get(p.security_id) || [];
    existing.push({ date: p.price_date, close: Number(p.close) });
    priceHistory.set(p.security_id, existing);
  }

  function computeReturn(days: number): number | null {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetStr = targetDate.toISOString().split('T')[0];

    let pastValue = 0;
    let currentValue = 0;
    let matched = 0;

    for (const h of holdings!) {
      const history = priceHistory.get(h.security_id);
      if (!history || history.length === 0) continue;

      const pastEntry = [...history].reverse().find(p => p.date <= targetStr);
      if (!pastEntry) continue;

      pastValue += Number(h.shares) * pastEntry.close;
      currentValue += Number(h.total_value);
      matched++;
    }

    if (matched < holdings!.length / 2 || pastValue <= 0) return null;
    return (currentValue - pastValue) / pastValue;
  }

  const return1w = computeReturn(7);
  const return1m = computeReturn(30);
  const return3m = computeReturn(90);
  const return6m = computeReturn(180);
  const return1y = computeReturn(365);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const daysSinceYearStart = Math.round(
    (Date.now() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const returnYtd = computeReturn(daysSinceYearStart);

  const hhi = holdings.reduce((s: number, h: { total_value: number }) => {
    const weight = Number(h.total_value) / totalPortfolioValue;
    return s + weight * weight;
  }, 0);
  const diversificationScore = Math.min(1, 1 - hhi);

  let assetClassAllocation: Record<string, number> = {};
  if (securityIds.length > 0) {
    const { data: securities } = await supabase
      .from('securities')
      .select('id, asset_class')
      .in('id', securityIds);

    const assetClassMap = new Map<string, string>();
    for (const s of securities || []) {
      assetClassMap.set(s.id, s.asset_class || 'other');
    }

    for (const h of holdings) {
      const assetClass = assetClassMap.get(h.security_id) || 'other';
      const pct = (Number(h.total_value) / totalPortfolioValue) * 100;
      assetClassAllocation[assetClass] = (assetClassAllocation[assetClass] || 0) + pct;
    }
  }

  let volatility: number | null = null;
  let sharpeRatio: number | null = null;

  const allDates = new Set<string>();
  for (const [, history] of priceHistory) {
    for (const p of history) allDates.add(p.date);
  }
  const sortedDates = [...allDates].sort();

  // Filter to holdings with price history (skip crypto, etc.)
  const pricedHoldings = holdings.filter((h: { security_id: string }) => {
    const hist = priceHistory.get(h.security_id);
    return hist && hist.length >= 20;
  });

  if (sortedDates.length >= 20 && pricedHoldings.length > 0) {
    const dailyValues: number[] = [];
    for (const date of sortedDates) {
      let pv = 0;
      let allFound = true;
      for (const h of pricedHoldings) {
        const history = priceHistory.get(h.security_id)!;
        const entry = history.find(p => p.date === date);
        if (!entry) { allFound = false; break; }
        pv += Number(h.shares) * entry.close;
      }
      if (allFound && pv > 0) dailyValues.push(pv);
    }

    if (dailyValues.length >= 20) {
      const dailyReturns: number[] = [];
      for (let i = 1; i < dailyValues.length; i++) {
        dailyReturns.push((dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1]);
      }

      const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (dailyReturns.length - 1);
      const dailyVol = Math.sqrt(variance);
      volatility = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);

      const riskFreeDaily = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
      const excessReturn = meanReturn - riskFreeDaily;
      sharpeRatio = dailyVol > 0 ? (excessReturn / dailyVol) * Math.sqrt(TRADING_DAYS_PER_YEAR) : null;
    }
  }

  // Beta: covariance(portfolio, SPY) / variance(SPY)
  let betaValue: number | null = null;
  if (sortedDates.length >= 20) {
    // Find SPY security_id
    const { data: spySec } = await supabase
      .from('securities')
      .select('id')
      .eq('ticker', 'SPY')
      .maybeSingle();

    if (spySec?.id) {
      const { data: spyPrices } = await supabase
        .from('market_prices')
        .select('price_date, close')
        .eq('security_id', spySec.id)
        .gte('price_date', sortedDates[0])
        .order('price_date', { ascending: true });

      if (spyPrices && spyPrices.length >= 20) {
        const spyMap = new Map<string, number>();
        for (const p of spyPrices) spyMap.set(p.price_date, Number(p.close));

        // Build aligned daily returns for portfolio + SPY
        const portfolioReturns: number[] = [];
        const spyReturns: number[] = [];
        let prevPortfolio: number | null = null;
        let prevSpy: number | null = null;

        for (const date of sortedDates) {
          let pv = 0;
          let allFound = true;
          for (const h of pricedHoldings) {
            const history = priceHistory.get(h.security_id)!;
            const entry = history.find(p => p.date === date);
            if (!entry) { allFound = false; break; }
            pv += Number(h.shares) * entry.close;
          }
          const spyClose = spyMap.get(date);
          if (!allFound || pv <= 0 || !spyClose) { prevPortfolio = null; prevSpy = null; continue; }

          if (prevPortfolio !== null && prevSpy !== null) {
            portfolioReturns.push((pv - prevPortfolio) / prevPortfolio);
            spyReturns.push((spyClose - prevSpy) / prevSpy);
          }
          prevPortfolio = pv;
          prevSpy = spyClose;
        }

        if (portfolioReturns.length >= 15) {
          const meanP = portfolioReturns.reduce((s, r) => s + r, 0) / portfolioReturns.length;
          const meanS = spyReturns.reduce((s, r) => s + r, 0) / spyReturns.length;
          let cov = 0;
          let varS = 0;
          for (let i = 0; i < portfolioReturns.length; i++) {
            cov += (portfolioReturns[i] - meanP) * (spyReturns[i] - meanS);
            varS += (spyReturns[i] - meanS) ** 2;
          }
          betaValue = varS > 0 ? cov / varS : null;
        }
      }
    }
  }

  const { error: perfError } = await supabase.from('portfolio_performance').insert({
    user_id: userId,
    return_1d_pct: return1d,
    return_1w_pct: return1w,
    return_1m_pct: return1m,
    return_3m_pct: return3m,
    return_6m_pct: return6m,
    return_ytd_pct: returnYtd,
    return_1y_pct: return1y,
    sharpe_ratio: sharpeRatio,
    beta: betaValue,
    volatility,
    diversification_score: diversificationScore,
    asset_class_allocation: assetClassAllocation,
  });

  if (perfError) {
    console.warn('[market-sync] portfolio_performance insert failed:', perfError.message);
  }
}

export async function enrichMarketData(supabase: AnyClient, log: string[]) {
  const { data: holdingRows } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (!holdingRows || holdingRows.length === 0) {
    log.push('[enrich] No holdings to enrich');
    return;
  }

  const securityIds = [...new Set(
    holdingRows.map((h: { security_id: string }) => h.security_id).filter(Boolean)
  )] as string[];

  let enriched = 0;
  if (securityIds.length > 0) {
    const { data: securities } = await supabase
      .from('securities')
      .select('id, ticker, sector')
      .in('id', securityIds);

    for (const sec of (securities || []) as { id: string; ticker: string; sector: string | null }[]) {
      const override = getTickerSectorOverride(sec.ticker);
      if (override && override !== sec.sector) {
        await supabase.from('securities').update({ sector: override }).eq('id', sec.id);
        enriched++;
      }
    }

    const needsEnrichment = (securities || []).filter(
      (s: { sector: string | null; ticker: string }) => !s.sector && !getTickerSectorOverride(s.ticker) && s.ticker && !s.ticker.includes('-USD')
    );

    if (needsEnrichment.length > 0) {
      for (const sec of needsEnrichment) {
        const profile = await getCompanyProfileEdgar(sec.ticker);
        if (!profile?.sicDescription) continue;

        await supabase
          .from('securities')
          .update({
            sector: mapSicToSector(profile.sicDescription) || null,
            industry: profile.sicDescription || null,
          })
          .eq('id', sec.id);
        enriched++;
      }
    }
  }
  log.push(`[enrich] Enriched ${enriched} securities with sector/industry data`);

  // Dividend/split events: no provider after the Polygon migration
  // (Finazon us_stocks_essential has no corporate actions endpoint).
  log.push('[enrich] Dividend/split events skipped — no corporate actions provider');
}


/**
 * Market news + events refresh from free, license-clean sources:
 * Nasdaq per-ticker RSS headlines and SEC EDGAR 8-K filings.
 */
export async function refreshMarketNews(supabase: AnyClient, log: string[], options?: { classifyMacro?: boolean; classifySubjects?: boolean; ledger?: UsageLedger }) {
  const { data: holdings, error } = await supabase
    .from('holdings')
    .select('ticker')
    .neq('ticker', 'UNKNOWN');

  if (error || !holdings || holdings.length === 0) {
    log.push('[news] No holdings — skipping news refresh');
    return;
  }

  const tickers = [...new Set(
    (holdings as { ticker: string | null }[])
      .map(h => h.ticker)
      .filter((t): t is string => Boolean(t)),
  )];

  await refreshRssNews(supabase, log, tickers, options);
  await refreshFilingEvents(supabase, log, tickers);
}
