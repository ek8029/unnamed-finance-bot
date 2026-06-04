import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTickerSectorOverride } from '@/lib/polygon';
import { getQuote } from '@/lib/financial-data';
import { rateLimit } from '@/lib/rate-limit';
import { getSourceTier } from '@/lib/news-quality';
import { getUserTier } from '@/lib/tier';
import { getUnderlyingExposure } from '@/lib/etf-holdings';

type VixLevel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

interface HoldingRow {
  ticker: string;
  total_value: number;
  day_change_pct: number; // null from DB is coerced to 0 — "no data" treated as "no change" for portfolio aggregation
  shares: number;
  current_price: number;
  portfolio_allocation_pct: number;
  security: { security_name: string; sector: string } | null;
}

function classifyVix(price: number): VixLevel {
  if (price > 30) return 'extreme_fear';
  if (price > 25) return 'fear';
  if (price > 18) return 'neutral';
  if (price > 12) return 'greed';
  return 'extreme_greed';
}

// formatIndex removed — all market data now uses Finnhub getQuote() for real-time prices

function resolveSector(ticker: string): string {
  return getTickerSectorOverride(ticker) || 'Diversified';
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: endOfWeek.toISOString().split('T')[0],
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = rateLimit(`brief:${user.id}`, 10, 60);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: limited.retryAfterSeconds },
        { status: 429 },
      );
    }

    const { data: rawHoldings } = await supabase
      .from('holdings')
      .select('ticker, total_value, day_change_pct, shares, current_price, portfolio_allocation_pct, security:securities(security_name, sector)')
      .eq('user_id', user.id)
      .gt('total_value', 0)
      .gt('shares', 0)
      .order('total_value', { ascending: false });

    const rawParsed: HoldingRow[] = (rawHoldings || []).map((h: Record<string, unknown>) => ({
      ticker: h.ticker as string,
      total_value: Number(h.total_value),
      day_change_pct: Number(h.day_change_pct) || 0, // null → 0: no data means assume no change
      shares: Number(h.shares),
      current_price: Number(h.current_price),
      portfolio_allocation_pct: Number(h.portfolio_allocation_pct),
      security: h.security as HoldingRow['security'],
    }));

    const mergedMap = new Map<string, HoldingRow>();
    for (const h of rawParsed) {
      const existing = mergedMap.get(h.ticker);
      if (existing) {
        const combinedValue = existing.total_value + h.total_value;
        const w1 = existing.total_value / (combinedValue || 1);
        const w2 = h.total_value / (combinedValue || 1);
        existing.total_value = combinedValue;
        existing.shares += h.shares;
        existing.day_change_pct = existing.day_change_pct * w1 + h.day_change_pct * w2;
        existing.portfolio_allocation_pct += h.portfolio_allocation_pct;
      } else {
        mergedMap.set(h.ticker, { ...h });
      }
    }
    const holdings = [...mergedMap.values()];

    const totalValue = holdings.reduce((sum, h) => sum + h.total_value, 0);

    const holdingsWithImpact = holdings.map((h) => {
      const dollarImpact = (h.day_change_pct !== 0 && h.day_change_pct !== -1)
        ? (h.total_value * h.day_change_pct) / (1 + h.day_change_pct)
        : (h.day_change_pct === -1 ? -h.total_value : 0);
      return { ...h, dollarImpact };
    });

    const overnightChange = holdingsWithImpact.reduce((sum, h) => sum + h.dollarImpact, 0);
    const previousValue = totalValue - overnightChange;
    const overnightChangePct = previousValue > 0
      ? (overnightChange / previousValue) * 100
      : 0;

    const significantMovers = [...holdingsWithImpact]
      .filter((h) => Math.abs(h.day_change_pct) >= 0.01)
      .sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact));

    const movers = significantMovers.slice(0, 8).map((h) => ({
        ticker: h.ticker,
        name: h.security?.security_name || h.ticker,
        sector: resolveSector(h.ticker),
        changePct: Math.round(h.day_change_pct * 10000) / 100,
        dollarImpact: Math.round(h.dollarImpact * 100) / 100,
      }));

    const allHoldings = holdingsWithImpact.map((h) => ({
      ticker: h.ticker,
      name: h.security?.security_name || h.ticker,
      sector: resolveSector(h.ticker),
      changePct: Math.round(h.day_change_pct * 10000) / 100,
      dollarImpact: Math.round(h.dollarImpact * 100) / 100,
    }));

    const sectorMap = new Map<string, { weight: number; weightedChange: number; tickers: Set<string> }>();
    for (const h of holdings) {
      const sector = resolveSector(h.ticker);
      const existing = sectorMap.get(sector) || { weight: 0, weightedChange: 0, tickers: new Set<string>() };
      existing.weight += h.portfolio_allocation_pct;
      existing.weightedChange += h.portfolio_allocation_pct * h.day_change_pct;
      existing.tickers.add(h.ticker);
      sectorMap.set(sector, existing);
    }


    const sectorHeat = Array.from(sectorMap.entries())
      .filter(([, data]) => data.tickers.size > 0 && data.weight >= 1)
      .map(([sector, data]) => ({
        sector,
        weight: Math.round(data.weight * 100) / 100,
        changePct: data.weight > 0
          ? Math.round((data.weightedChange / data.weight) * 10000) / 100
          : 0,
        tickers: [...data.tickers],
      }))
      .sort((a, b) => b.weight - a.weight);

    let market: {
      spy: { price: number; changePct: number } | null;
      qqq: { price: number; changePct: number } | null;
      vix: { price: number; level: VixLevel } | null;
      treasury: { price: number; changePct: number } | null;
    } = { spy: null, qqq: null, vix: null, treasury: null };

    try {
      // All 4 use Finnhub getQuote() for real-time intraday data
      // (getLatestPrice from Polygon only returns previous day close)
      const [spyData, qqqData, vixyData, tltData] = await Promise.allSettled([
        getQuote('SPY'),
        getQuote('QQQ'),
        getQuote('VIXY'),
        getQuote('TLT'),
      ]);

      const spyQ = spyData.status === 'fulfilled' ? spyData.value : null;
      const qqqQ = qqqData.status === 'fulfilled' ? qqqData.value : null;
      const vixy = vixyData.status === 'fulfilled' ? vixyData.value : null;
      const tlt = tltData.status === 'fulfilled' ? tltData.value : null;

      market = {
        spy: spyQ && spyQ.c > 0 ? { price: spyQ.c, changePct: spyQ.dp ?? 0 } : null,
        qqq: qqqQ && qqqQ.c > 0 ? { price: qqqQ.c, changePct: qqqQ.dp ?? 0 } : null,
        vix: vixy && vixy.c > 0 ? { price: vixy.c, level: classifyVix(vixy.c) } : null,
        treasury: tlt && tlt.c > 0 ? { price: tlt.c, changePct: tlt.dp ?? 0 } : null,
      };
    } catch (err) {
      console.error('[brief] Market data fetch failed:', err);
    }

    const { start, end } = getWeekBounds();
    const userTickers = holdings.map((h) => h.ticker);

    // Expand tickers to include ETF underlying stocks for news matching
    const expandedTickers = new Set(userTickers);
    for (const ticker of userTickers) {
      const underlyings = getUnderlyingExposure(ticker, 0, 0); // weights don't matter for ticker matching
      for (const u of underlyings) {
        expandedTickers.add(u.ticker);
      }
    }
    const expandedTickerList = [...expandedTickers];

    let earningsThisWeek: { ticker: string; reportDate: string; portfolioWeight: number }[] = [];
    let dividendsThisWeek: { ticker: string; exDate: string }[] = [];

    if (userTickers.length > 0) {
      const [earningsResult, dividendsResult] = await Promise.all([
        supabase
          .from('market_events')
          .select('ticker, event_date')
          .eq('event_type', 'earnings')
          .in('ticker', userTickers)
          .gte('event_date', start)
          .lte('event_date', end),
        supabase
          .from('market_events')
          .select('ticker, event_date')
          .eq('event_type', 'dividend')
          .in('ticker', userTickers)
          .gte('event_date', start)
          .lte('event_date', end),
      ]);

      const allocationMap = new Map(holdings.map((h) => [h.ticker, h.portfolio_allocation_pct]));

      earningsThisWeek = (earningsResult.data || []).map((e) => ({
        ticker: e.ticker,
        reportDate: e.event_date,
        portfolioWeight: allocationMap.get(e.ticker) || 0,
      }));

      dividendsThisWeek = (dividendsResult.data || []).map((d) => ({
        ticker: d.ticker,
        exDate: d.event_date,
      }));
    }

    const spyChangePct = market.spy?.changePct ?? null;
    const vsBenchmark = spyChangePct !== null
      ? Math.round((overnightChangePct - spyChangePct) * 100) / 100
      : null;

        // ── Fetch pre-generated AI digest ──
    const { data: digestRow } = await supabase
      .from('brief_digests')
      .select('digest, generated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    // ── Fetch market news: position-relevant + general ──
    const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [positionNewsResult, generalNewsResult] = await Promise.all([
      // News about tickers the user holds (directly or via ETFs)
      expandedTickerList.length > 0
        ? supabase
            .from('market_news')
            .select('id, title, summary, source, url, published_at, primary_ticker, sentiment')
            .in('primary_ticker', expandedTickerList)
            .gte('published_at', oneDayAgo)
            .order('published_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
      // General market news (not tied to a specific ticker)
      supabase
        .from('market_news')
        .select('id, title, summary, source, url, published_at, primary_ticker, sentiment')
        .gte('published_at', oneDayAgo)
        .order('published_at', { ascending: false })
        .limit(10),
    ]);

    // Build holdings lookup for "Impact on You" context on news items
    const holdingsLookup = new Map<string, { totalValue: number; portfolioWeight: number }>();
    for (const h of holdings) {
      const upper = h.ticker.toUpperCase();
      const existing = holdingsLookup.get(upper);
      if (existing) {
        existing.totalValue += h.total_value;
        existing.portfolioWeight += h.portfolio_allocation_pct;
      } else {
        holdingsLookup.set(upper, {
          totalValue: h.total_value,
          portfolioWeight: h.portfolio_allocation_pct,
        });
      }
    }

    const tier = await getUserTier(user.id);
    const isPro = tier === 'pro';

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const positionNews = (positionNewsResult.data || []).filter(n => {
      const key = n.url || n.id;
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    }).map(n => {
      const ticker = n.primary_ticker;
      const holding = ticker ? holdingsLookup.get(ticker.toUpperCase()) : null;
      return {
        id: n.id,
        title: n.title,
        summary: n.summary,
        source: n.source,
        url: n.url,
        publishedAt: n.published_at,
        ticker,
        sentiment: n.sentiment,
        isHolding: true,
        sourceTier: getSourceTier(n.source),
        positionValue: holding?.totalValue ?? null,
        portfolioWeight: holding?.portfolioWeight ?? null,
        impactNote: holding
          ? `You hold $${Math.round(holding.totalValue).toLocaleString()} of ${ticker} (${holding.portfolioWeight.toFixed(1)}% of portfolio)`
          : null,
      };
    });

    // General news: exclude articles already in position news (only for Pro,
    // since free users don't see positionNews and would otherwise lose articles)
    const positionNewsIds = new Set(positionNews.map(n => n.id));
    const generalSeenUrls = isPro ? seenUrls : new Set<string>();
    const generalNews = (generalNewsResult.data || []).filter(n => {
      const key = n.url || n.id;
      if (generalSeenUrls.has(key)) return false;
      generalSeenUrls.add(key);
      return true;
    })
      .filter(n => isPro ? !positionNewsIds.has(n.id) : true)
      .slice(0, 6)
      .map(n => {
        const ticker = n.primary_ticker;
        const holding = ticker ? holdingsLookup.get(ticker.toUpperCase()) : null;
        return {
          id: n.id,
          title: n.title,
          summary: n.summary,
          source: n.source,
          url: n.url,
          publishedAt: n.published_at,
          ticker,
          sentiment: n.sentiment,
          isHolding: false,
          sourceTier: getSourceTier(n.source),
          positionValue: holding?.totalValue ?? null,
          portfolioWeight: holding?.portfolioWeight ?? null,
          impactNote: holding
            ? `You hold $${Math.round(holding.totalValue).toLocaleString()} of ${ticker} (${holding.portfolioWeight.toFixed(1)}% of portfolio)`
            : null,
        };
      });

    return NextResponse.json(
      {
        portfolio: {
          totalValue: Math.round(totalValue * 100) / 100,
          overnightChange: Math.round(overnightChange * 100) / 100,
          overnightChangePct: Math.round(overnightChangePct * 100) / 100,
          vsBenchmark,
        },
        market,
        movers,
        allHoldings,
        sectorHeat,
        earningsThisWeek,
        dividendsThisWeek,
        // Free: hide position-specific news
        positionNews: isPro ? positionNews : [],
        generalNews,
        // Free: hide AI digest
        digest: isPro ? (digestRow?.digest ?? null) : null,
        digestGeneratedAt: isPro ? (digestRow?.generated_at ?? null) : null,
        isPro,
      },
      {
        headers: { 'Cache-Control': 'private, max-age=60' },
      },
    );
  } catch (error) {
    console.error('[brief] Daily brief error:', error);
    return NextResponse.json({ error: 'Failed to generate daily brief' }, { status: 500 });
  }
}
