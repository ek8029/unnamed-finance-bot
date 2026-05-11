import { getBatchPrices, getBatchTickerDetails, getUpcomingDividends, getRecentSplits, getTickerNews, scoreSentiment, mapSicToSector, getTickerSectorOverride } from '@/lib/polygon';
import { detectPrimaryTicker } from '@/lib/news-primary-ticker';
import { refreshFinnhubNews as _refreshFinnhubNews } from '@/lib/finnhub-news';
import { RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from '@/lib/financial-config';

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
    log.push('[prices] No prices returned from Polygon');
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
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('id, user_id, total_value');

    if (!allHoldings || allHoldings.length === 0) return;

    const userHoldings = new Map<string, { id: string; total_value: number }[]>();
    for (const h of allHoldings as { id: string; user_id: string; total_value: number }[]) {
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
      .eq('ticker_symbol', 'SPY')
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

  const tickers = [...new Set(
    holdingRows.map((h: { ticker: string }) => h.ticker).filter(Boolean)
  )] as string[];

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
      const detailsMap = await getBatchTickerDetails(
        needsEnrichment.map((s: { ticker: string }) => s.ticker)
      );

      for (const sec of needsEnrichment) {
        const details = detailsMap.get(sec.ticker.toUpperCase());
        if (!details) continue;

        await supabase
          .from('securities')
          .update({
            sector: mapSicToSector(details.sic_description) || null,
            industry: details.sic_description || null,
            logo_url: details.icon_url || details.logo_url || null,
          })
          .eq('id', sec.id);
        enriched++;
      }
    }
  }
  log.push(`[enrich] Enriched ${enriched} securities with sector/industry data`);

  const dividends = await getUpcomingDividends(tickers, 90);
  let divsInserted = 0;
  if (dividends.length > 0) {
    const { data: existing } = await supabase
      .from('market_events')
      .select('ticker, event_date')
      .eq('event_type', 'dividend')
      .in('ticker', dividends.map(d => d.ticker));

    const existingKeys = new Set(
      (existing || []).map((e: { ticker: string; event_date: string }) => `${e.ticker}:${e.event_date}`)
    );

    const newDivs = dividends.filter(
      d => !existingKeys.has(`${d.ticker}:${d.ex_dividend_date}`)
    );

    if (newDivs.length > 0) {
      const inserts = newDivs.map(d => ({
        event_type: 'dividend',
        ticker: d.ticker,
        event_date: d.ex_dividend_date,
        title: `${d.ticker} ex-dividend date`,
        description: `$${d.cash_amount.toFixed(4)}/share dividend. Pay date: ${d.pay_date || 'TBD'}.`,
        metadata: { cash_amount: d.cash_amount, pay_date: d.pay_date, frequency: d.frequency },
        impact_level: 'medium',
      }));

      const { error } = await supabase.from('market_events').insert(inserts);
      if (!error) divsInserted = newDivs.length;
    }
  }
  log.push(`[enrich] Found ${divsInserted} new dividend events`);

  const splits = await getRecentSplits(tickers, 90);
  let splitsInserted = 0;
  if (splits.length > 0) {
    const { data: existing } = await supabase
      .from('market_events')
      .select('ticker, event_date')
      .eq('event_type', 'split')
      .in('ticker', splits.map(s => s.ticker));

    const existingKeys = new Set(
      (existing || []).map((e: { ticker: string; event_date: string }) => `${e.ticker}:${e.event_date}`)
    );

    const newSplits = splits.filter(
      s => !existingKeys.has(`${s.ticker}:${s.execution_date}`)
    );

    if (newSplits.length > 0) {
      const inserts = newSplits.map(s => ({
        event_type: 'split',
        ticker: s.ticker,
        event_date: s.execution_date,
        title: `${s.ticker} ${s.split_to}-for-${s.split_from} stock split`,
        description: `Each share becomes ${s.split_to / s.split_from} shares.`,
        metadata: { split_from: s.split_from, split_to: s.split_to, ratio: s.split_to / s.split_from },
        impact_level: 'high',
      }));

      const { error } = await supabase.from('market_events').insert(inserts);
      if (!error) splitsInserted = newSplits.length;
    }
  }
  log.push(`[enrich] Found ${splitsInserted} new split events`);
}

export async function refreshMarketNews(supabase: AnyClient, log: string[]) {
  const { data: holdingRows } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (!holdingRows || holdingRows.length === 0) {
    log.push('[news] No holdings for news fetch');
    return;
  }

  const tickers = [...new Set(
    holdingRows.map((h: { ticker: string }) => h.ticker).filter(Boolean)
  )] as string[];

  const secIds = [...new Set(
    holdingRows.map((h: { security_id: string }) => h.security_id).filter(Boolean)
  )] as string[];

  const tickerSectorMap = new Map<string, string>();
  const tickerNameMap = new Map<string, string>();
  if (secIds.length > 0) {
    const { data: securities } = await supabase
      .from('securities')
      .select('ticker, sector, security_name')
      .in('id', secIds);
    for (const s of (securities || []) as { ticker: string; sector: string | null; security_name: string | null }[]) {
      const upperTicker = s.ticker?.toUpperCase();
      if (!upperTicker) continue;
      if (s.sector) tickerSectorMap.set(upperTicker, s.sector);
      if (s.security_name) tickerNameMap.set(upperTicker, s.security_name);
    }
  }

  const articles = await getTickerNews(tickers, 30);
  if (articles.length === 0) {
    log.push('[news] No articles from Polygon');
    return;
  }

  const urls = articles.map(a => a.article_url).filter(Boolean);
  const { data: existing } = await supabase
    .from('market_news')
    .select('url')
    .in('url', urls);

  const existingUrls = new Set((existing || []).map((a: { url: string }) => a.url));
  const newArticles = articles.filter(a => a.article_url && !existingUrls.has(a.article_url));

  if (newArticles.length === 0) {
    log.push(`[news] All ${articles.length} articles already exist`);
    return;
  }

  const inserts = newArticles.map(article => {
    const sentiment = scoreSentiment(`${article.title} ${article.description}`);
    const sectors = [...new Set(
      article.tickers
        .map(t => tickerSectorMap.get(t.toUpperCase()))
        .filter(Boolean)
    )];
    const primaryTicker = detectPrimaryTicker(
      article.title,
      article.description,
      article.tickers,
      tickerNameMap,
    );

    return {
      title: article.title,
      summary: article.description || null,
      content: null,
      url: article.article_url,
      image_url: article.image_url || null,
      source: article.source?.name || null,
      author: article.author || null,
      published_at: article.published_utc || new Date().toISOString(),
      tickers: article.tickers,
      primary_ticker: primaryTicker,
      sectors: sectors.length > 0 ? sectors : null,
      sentiment,
    };
  });

  const { error } = await supabase.from('market_news').insert(inserts);
  if (error) {
    log.push(`[news] Insert failed: ${error.message}`);
  } else {
    log.push(`[news] Inserted ${newArticles.length} new articles (${articles.length - newArticles.length} duplicates skipped)`);
  }
}

/**
 * Refresh news from Finnhub for all tickers held across all users.
 * Complements refreshMarketNews (Polygon) as a second news source.
 */
export async function refreshMarketNewsFinnhub(supabase: AnyClient, log: string[]) {
  const { data: holdingRows } = await supabase
    .from('holdings')
    .select('ticker')
    .neq('ticker', 'UNKNOWN');

  if (!holdingRows || holdingRows.length === 0) {
    log.push('[finnhub-news] No holdings for news fetch');
    return;
  }

  const tickers = [...new Set(
    holdingRows.map((h: { ticker: string }) => h.ticker).filter(Boolean)
  )] as string[];

  await _refreshFinnhubNews(supabase, tickers, log);
}
