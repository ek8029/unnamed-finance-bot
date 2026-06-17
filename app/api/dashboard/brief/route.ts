import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTickerSectorOverride } from '@/lib/market-classify';
import { getQuote } from '@/lib/financial-data';
import { rateLimit } from '@/lib/rate-limit';
import { getUserTier } from '@/lib/tier';
import { getUnderlyingExposure } from '@/lib/etf-holdings';
import { composeThesisBrief } from '@/lib/thesis-brief';
import { hasThesisAccess } from '@/lib/thesis-access-server';

type VixLevel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

interface HoldingRow {
  ticker: string;
  total_value: number;
  day_change_pct: number; // null from DB is coerced to 0 -- "no data" treated as "no change" for portfolio aggregation
  shares: number;
  current_price: number;
  portfolio_allocation_pct: number;
  security: { security_name: string; sector: string } | null;
}

// Thresholds calibrated for VIXY ETF price (not the VIX index).
// VIXY trades lower than VIX due to contango decay in VIX futures.
function classifyVix(vixyPrice: number): VixLevel {
  if (vixyPrice > 25) return 'extreme_fear';
  if (vixyPrice > 20) return 'fear';
  if (vixyPrice > 15) return 'neutral';
  if (vixyPrice > 10) return 'greed';
  return 'extreme_greed';
}

// formatIndex removed -- all market data now uses Finnhub getQuote() for real-time prices

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
      day_change_pct: Number(h.day_change_pct) || 0, // null -> 0: no data means assume no change
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

    let earningsThisWeek: { ticker: string; reportDate: string; portfolioWeight: number }[] = [];
    let dividendsThisWeek: { ticker: string; exDate: string; cashAmount: number | null; payDate: string | null }[] = [];

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
          .select('ticker, event_date, metadata')
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
        cashAmount: d.metadata?.cash_amount ?? null,
        payDate: d.metadata?.pay_date ?? null,
      }));
    }

    const spyChangePct = market.spy?.changePct ?? null;
    const vsBenchmark = spyChangePct !== null
      ? Math.round((overnightChangePct - spyChangePct) * 100) / 100
      : null;

    // -- Fetch pre-generated AI digest --
    const { data: digestRow } = await supabase
      .from('brief_digests')
      .select('digest, generated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const tier = await getUserTier(user.id);
    const isPro = tier === 'pro';

    // -- Thesis intelligence queries --
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: trackedTheses } = await supabase
      .from('theses')
      .select('id, ticker, last_scanned_at')
      .eq('user_id', user.id)
      .eq('tracked', true);

    const thesisRows = trackedTheses || [];
    const thesisIds = thesisRows.map((t) => t.id);

    // Build allocation lookup from already-merged holdings
    const allocationLookup = new Map<string, number>(
      holdings.map((h) => [h.ticker.toUpperCase(), h.portfolio_allocation_pct]),
    );

    let pillarSummary: {
      intact: number;
      weakening: number;
      broken: number;
      unverified: number;
      positions: number;
      lastScannedAt: string | null;
    } = { intact: 0, weakening: 0, broken: 0, unverified: 0, positions: thesisRows.length, lastScannedAt: null };

    let thesisIntelligence: {
      ticker: string;
      pillarClaim: string;
      verdict: string;
      materiality: string;
      why: string;
      whatItMeans: string;
      consider: string | null;
      statusChanged: boolean;
      sources: { excerpt: string; sourceTitle: string; sourceUrl: string | null; sourcePublishedAt: string | null }[];
    }[] = [];

    if (thesisIds.length > 0) {
      // Compute lastScannedAt from tracked theses
      const validDates = thesisRows
        .map((t) => t.last_scanned_at)
        .filter((d): d is string => d !== null);
      pillarSummary.lastScannedAt = validDates.length > 0
        ? validDates.reduce((a, b) => (a > b ? a : b))
        : null;

      // Fetch confirmed pillars for all tracked theses
      const { data: pillarsData } = await supabase
        .from('thesis_pillars')
        .select('id, thesis_id, claim, status, status_override, status_changed_at')
        .eq('user_id', user.id)
        .in('thesis_id', thesisIds)
        .eq('confirmed', true);

      const pillars = pillarsData || [];

      // Count pillars by effective status
      for (const p of pillars) {
        const effectiveStatus: string = p.status_override ?? p.status;
        if (effectiveStatus === 'intact') pillarSummary.intact += 1;
        else if (effectiveStatus === 'weakening') pillarSummary.weakening += 1;
        else if (effectiveStatus === 'broken') pillarSummary.broken += 1;
        else pillarSummary.unverified += 1;
      }

      const pillarIds = pillars.map((p) => p.id);

      if (pillarIds.length > 0) {
        // Build lookup maps for evidence ranking
        const pillarById = new Map(pillars.map((p) => [p.id, p]));
        const thesisTickerById = new Map(thesisRows.map((t) => [t.id, t.ticker]));

        const { data: evidenceData } = await supabase
          .from('pillar_evidence')
          .select('id, pillar_id, verdict, materiality, source_title, source_url, source_published_at, excerpt, why, what_it_means, consider')
          .eq('user_id', user.id)
          .in('pillar_id', pillarIds)
          .eq('is_backfill', false)
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false });

        const evidence = evidenceData || [];

        // Rank: material first, then position allocation desc, take top 3
        const materialityRank = (m: string) => (m === 'material' ? 1 : 0);

        const tickerOf = (pillarId: string) => {
          const pillar = pillarById.get(pillarId);
          return pillar ? thesisTickerById.get(pillar.thesis_id) : undefined;
        };
        const allocOf = (pillarId: string) => {
          const ticker = tickerOf(pillarId);
          return ticker ? (allocationLookup.get(ticker.toUpperCase()) ?? 0) : 0;
        };
        const pubMs = (ev: (typeof evidence)[number]) => (ev.source_published_at ? Date.parse(ev.source_published_at) : 0);

        // Group evidence by pillar (the "reason"). Keep the top 3 pillars: a pillar ranks
        // by its strongest piece (material first), then by position weight. Within a pillar,
        // pieces are ordered material-first then most recent and capped, so a reason backed
        // by several articles is one titled group with multiple receipts, not the same title
        // repeated. The UI renders the claim once per pillar (showPillarClaim on the first).
        const MAX_PILLARS = 3;
        const MAX_PER_PILLAR = 3;
        const evSort = (a: (typeof evidence)[number], b: (typeof evidence)[number]) => {
          const mDiff = materialityRank(b.materiality) - materialityRank(a.materiality);
          return mDiff !== 0 ? mDiff : pubMs(b) - pubMs(a);
        };
        const byPillar = new Map<string, (typeof evidence)[number][]>();
        for (const ev of evidence) {
          const arr = byPillar.get(ev.pillar_id) ?? [];
          arr.push(ev);
          byPillar.set(ev.pillar_id, arr);
        }
        for (const arr of byPillar.values()) arr.sort(evSort);
        const topPillars = [...byPillar.entries()]
          .sort(([, ea], [, eb]) => {
            const mDiff = materialityRank(eb[0].materiality) - materialityRank(ea[0].materiality);
            return mDiff !== 0 ? mDiff : allocOf(eb[0].pillar_id) - allocOf(ea[0].pillar_id);
          })
          .slice(0, MAX_PILLARS);

        thesisIntelligence = topPillars.map(([pillarId, arr]) => {
          const primary = arr[0];
          const pillar = pillarById.get(pillarId);
          const ticker = pillar ? (thesisTickerById.get(pillar.thesis_id) ?? '') : '';
          const statusChangedAt = pillar?.status_changed_at ?? null;
          const statusChanged = statusChangedAt !== null
            && new Date(statusChangedAt) >= new Date(oneDayAgo);
          return {
            ticker,
            pillarClaim: pillar?.claim ?? '',
            verdict: primary.verdict,
            materiality: primary.materiality,
            why: primary.why,
            whatItMeans: primary.what_it_means,
            consider: primary.consider ?? null,
            statusChanged,
            sources: arr.slice(0, MAX_PER_PILLAR).map((ev) => ({
              excerpt: ev.excerpt,
              sourceTitle: ev.source_title,
              sourceUrl: ev.source_url ?? null,
              sourcePublishedAt: ev.source_published_at ?? null,
            })),
          };
        });
      }
    }

    // -- Macro strip: top-tier market movers from last 24h --
    const { data: macroNewsData } = await supabase
      .from('market_news')
      .select('title, url, published_at')
      .eq('macro_tier', 'mover')
      .gte('published_at', oneDayAgo)
      .order('published_at', { ascending: false })
      .limit(2);

    const equityPct = Math.min(
      100,
      Math.round(holdings.reduce((sum, h) => sum + h.portfolio_allocation_pct, 0)),
    );
    const exposureLine = holdings.length > 0
      ? `Your portfolio is ${equityPct}% equities.`
      : null;

    const macroStrip = (macroNewsData || []).map((n) => ({
      headline: n.title,
      sourceUrl: n.url ?? null,
      exposureLine,
    }));

    // Proactive thesis brief: honest headline + 14-day "what moved" (replay-based).
    // Gated to allowlisted accounts while the thesis layer is unlaunched.
    const thesisEnabled = await hasThesisAccess(user.id, user.email);
    const thesisBrief = thesisEnabled ? await composeThesisBrief(supabase, user.id) : undefined;

    return NextResponse.json(
      {
        portfolio: {
          totalValue: Math.round(totalValue * 100) / 100,
          overnightChange: Math.round(overnightChange * 100) / 100,
          overnightChangePct: Math.round(overnightChangePct * 100) / 100,
          vsBenchmark,
          // Honest framing: before the 9:30 ET open (and on weekends) the
          // day_change_pct values describe the PREVIOUS trading session,
          // not an overnight move.
          changeLabel: (() => {
            const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const day = et.getDay();
            const beforeOpen = et.getHours() < 9 || (et.getHours() === 9 && et.getMinutes() < 30);
            return day === 0 || day === 6 || beforeOpen ? 'Last session' : 'Portfolio today';
          })(),
        },
        market,
        movers,
        allHoldings,
        sectorHeat,
        earningsThisWeek,
        dividendsThisWeek,
        positionNews: [],
        generalNews: [],
        // Free: hide AI digest
        digest: isPro ? (digestRow?.digest ?? null) : null,
        digestGeneratedAt: isPro ? (digestRow?.generated_at ?? null) : null,
        isPro,
        pillarSummary,
        thesisIntelligence,
        thesisBrief,
        thesisEnabled,
        macroStrip,
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
