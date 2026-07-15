import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { resolveSector } from '@/lib/portfolio-analysis';
import { getFullTickerData } from '@/lib/financial-data';
import { buildFactorReport, type EnrichedHolding } from '@/lib/factor-lens';

// Cap how many holdings we enrich with a data-API call, to bound provider
// usage. The rest are passed through without metrics and reported as partial.
const MAX_ENRICHED = 30;

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await hasThesisAccess(user.id, user.email);
    if (!allowed) {
      return NextResponse.json({ error: 'Pro required' }, { status: 403 });
    }

    // Mirror /api/holdings: lots joined to securities, ordered by value.
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select(`
        *,
        security:securities(security_name, asset_class, sector, exchange)
      `)
      .eq('user_id', user.id)
      .order('total_value', { ascending: false });

    if (holdingsError) {
      console.error('factor-lens: holdings fetch failed', holdingsError);
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ report: null, empty: true });
    }

    // Aggregate lots by ticker (same collapse as /api/holdings).
    const tickerMap = new Map<string, {
      ticker: string;
      totalValue: number;
      dayChangePct: number | null;
      unrealisedPct: number | null;
      sector?: string;
    }>();

    for (const h of holdings) {
      const ticker = h.ticker as string;
      const value = Number(h.total_value || 0);
      const existing = tickerMap.get(ticker);
      if (existing) {
        existing.totalValue += value;
        if (existing.dayChangePct == null && h.day_change_pct != null) {
          existing.dayChangePct = Number(h.day_change_pct) * 100;
        }
        if (existing.unrealisedPct == null && h.unrealised_gain_loss_pct != null) {
          existing.unrealisedPct = Number(h.unrealised_gain_loss_pct);
        }
      } else {
        const resolved = resolveSector(ticker, h.security?.sector, holdings);
        tickerMap.set(ticker, {
          ticker,
          totalValue: value,
          dayChangePct: h.day_change_pct != null ? Number(h.day_change_pct) * 100 : null,
          unrealisedPct: h.unrealised_gain_loss_pct != null ? Number(h.unrealised_gain_loss_pct) : null,
          sector: resolved === 'Unknown' ? undefined : resolved,
        });
      }
    }

    const aggregated = [...tickerMap.values()].sort((a, b) => b.totalValue - a.totalValue);
    const toEnrich = aggregated.slice(0, MAX_ENRICHED);

    // Enrich the top holdings with fundamentals (Finazon + EDGAR, no OpenAI).
    // Chunked, not one big Promise.all: a full-parallel burst 429s both SEC
    // (~10 req/s) and Finazon, which blanked size/style/quality for most
    // holdings. Chunks of 5 with a short breather stay under both limits.
    const ENRICH_BATCH = 5;
    const enrichOne = async (agg: (typeof toEnrich)[number]): Promise<EnrichedHolding> => {
        try {
          const data = await getFullTickerData(agg.ticker);
          const m = data.financials?.metric ?? {};
          const marketCapM = data.profile?.marketCapitalization; // millions
          return {
            ticker: agg.ticker,
            totalValue: agg.totalValue,
            dayChangePct: agg.dayChangePct,
            unrealisedPct: agg.unrealisedPct,
            sector: agg.sector ?? null,
            marketCapB: marketCapM != null && marketCapM > 0 ? marketCapM / 1000 : null,
            pe: m['peBasicExclExtraTTM'] ?? null,
            pb: m['pbQuarterly'] ?? null,
            ps: m['psTTM'] ?? null,
            roe: m['roeTTM'] ?? null,
            debtToEquity: m['totalDebtToEquityQuarterly'] ?? m['debtEquityQuarterly'] ?? null,
          };
        } catch (e) {
          console.error(`factor-lens: enrich failed for ${agg.ticker}`, e);
          return {
            ticker: agg.ticker,
            totalValue: agg.totalValue,
            dayChangePct: agg.dayChangePct,
            unrealisedPct: agg.unrealisedPct,
            sector: agg.sector ?? null,
          };
        }
    };

    const enrichedTop: EnrichedHolding[] = [];
    for (let i = 0; i < toEnrich.length; i += ENRICH_BATCH) {
      const chunk = toEnrich.slice(i, i + ENRICH_BATCH);
      enrichedTop.push(...(await Promise.all(chunk.map(enrichOne))));
      if (i + ENRICH_BATCH < toEnrich.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Holdings beyond the cap pass through without metrics (partial).
    const rest: EnrichedHolding[] = aggregated.slice(MAX_ENRICHED).map((agg) => ({
      ticker: agg.ticker,
      totalValue: agg.totalValue,
      dayChangePct: agg.dayChangePct,
      unrealisedPct: agg.unrealisedPct,
      sector: agg.sector ?? null,
    }));

    const report = buildFactorReport([...enrichedTop, ...rest]);

    return NextResponse.json({ report, empty: false }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('factor-lens route error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
