import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLatestPrice, type PolygonPrice } from '@/lib/polygon';
import { rateLimit } from '@/lib/rate-limit';

type VixLevel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

interface HoldingRow {
  ticker: string;
  total_value: number;
  day_change_pct: number;
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

function formatIndex(data: PolygonPrice | null) {
  if (!data) return null;
  const changePct = data.open > 0 ? ((data.close - data.open) / data.open) * 100 : 0;
  return { price: data.close, changePct: Math.round(changePct * 100) / 100 };
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
      .order('total_value', { ascending: false });

    const holdings: HoldingRow[] = (rawHoldings || []).map((h: Record<string, unknown>) => ({
      ticker: h.ticker as string,
      total_value: Number(h.total_value),
      day_change_pct: Number(h.day_change_pct),
      shares: Number(h.shares),
      current_price: Number(h.current_price),
      portfolio_allocation_pct: Number(h.portfolio_allocation_pct),
      security: h.security as HoldingRow['security'],
    }));

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

    const movers = [...holdingsWithImpact]
      .sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact))
      .slice(0, 3)
      .map((h) => ({
        ticker: h.ticker,
        name: h.security?.security_name || h.ticker,
        changePct: Math.round(h.day_change_pct * 10000) / 100,
        dollarImpact: Math.round(h.dollarImpact * 100) / 100,
      }));

    const sectorMap = new Map<string, { weight: number; weightedChange: number }>();
    for (const h of holdings) {
      const sector = h.security?.sector || 'Other';
      const existing = sectorMap.get(sector) || { weight: 0, weightedChange: 0 };
      existing.weight += h.portfolio_allocation_pct;
      existing.weightedChange += h.portfolio_allocation_pct * h.day_change_pct;
      sectorMap.set(sector, existing);
    }

    const sectorHeat = Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        sector,
        weight: Math.round(data.weight * 100) / 100,
        changePct: data.weight > 0
          ? Math.round((data.weightedChange / data.weight) * 10000) / 100
          : 0,
      }))
      .sort((a, b) => b.weight - a.weight);

    let market: {
      spy: { price: number; changePct: number } | null;
      qqq: { price: number; changePct: number } | null;
      vix: { price: number; level: VixLevel } | null;
      treasury10y: null;
    } = { spy: null, qqq: null, vix: null, treasury10y: null };

    try {
      const [spyData, qqqData, vixData] = await Promise.allSettled([
        getLatestPrice('SPY'),
        getLatestPrice('QQQ'),
        getLatestPrice('VIXY'),
      ]);

      const spy = spyData.status === 'fulfilled' ? spyData.value : null;
      const qqq = qqqData.status === 'fulfilled' ? qqqData.value : null;
      const vix = vixData.status === 'fulfilled' ? vixData.value : null;

      market = {
        spy: formatIndex(spy),
        qqq: formatIndex(qqq),
        vix: vix ? { price: vix.close, level: classifyVix(vix.close) } : null,
        treasury10y: null,
      };
    } catch (err) {
      console.error('[brief] Market data fetch failed:', err);
    }

    const { start, end } = getWeekBounds();
    const userTickers = holdings.map((h) => h.ticker);

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

    return NextResponse.json(
      {
        portfolio: {
          totalValue: Math.round(totalValue * 100) / 100,
          overnightChange: Math.round(overnightChange * 100) / 100,
          overnightChangePct: Math.round(overnightChangePct * 100) / 100,
        },
        market,
        movers,
        sectorHeat,
        earningsThisWeek,
        dividendsThisWeek,
      },
      {
        headers: { 'Cache-Control': 'private, max-age=300' },
      },
    );
  } catch (error) {
    console.error('[brief] Daily brief error:', error);
    return NextResponse.json({ error: 'Failed to generate daily brief' }, { status: 500 });
  }
}
