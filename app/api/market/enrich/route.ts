import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getBatchTickerDetails,
  getUpcomingDividends,
  getRecentSplits,
  mapSicToSector,
} from '@/lib/polygon';

/**
 * POST /api/market/enrich
 *
 * Enriches market data for the user's holdings:
 * 1. Securities metadata (sector, industry, description, logo) from Polygon ticker details
 * 2. Upcoming dividends → market_events
 * 3. Recent/upcoming stock splits → market_events
 *
 * Only fetches ticker details for securities missing sector data to avoid
 * unnecessary API calls on subsequent refreshes.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's holdings with their security IDs
    const { data: holdings } = await supabase
      .from('holdings')
      .select('ticker, security_id')
      .eq('user_id', user.id);

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings to enrich' });
    }

    const uniqueTickers = [...new Set(
      holdings.map(h => h.ticker).filter(Boolean) as string[]
    )];
    const securityIds = [...new Set(
      holdings.map(h => h.security_id).filter(Boolean) as string[]
    )];

    const result = {
      securitiesEnriched: 0,
      dividendsFound: 0,
      splitsFound: 0,
      errors: [] as string[],
    };

    // ---------------------------------------------------------------
    // 1. Enrich securities with missing sector/industry data
    // ---------------------------------------------------------------
    if (securityIds.length > 0) {
      const { data: securities } = await supabase
        .from('securities')
        .select('id, ticker, sector, industry, logo_url')
        .in('id', securityIds);

      // Only fetch details for securities missing sector
      const needsEnrichment = (securities || []).filter(
        s => !s.sector && s.ticker && !s.ticker.includes('-USD')
      );

      if (needsEnrichment.length > 0) {
        const tickers = needsEnrichment.map(s => s.ticker);
        const detailsMap = await getBatchTickerDetails(tickers);

        for (const sec of needsEnrichment) {
          const details = detailsMap.get(sec.ticker.toUpperCase());
          if (!details) continue;

          const sector = mapSicToSector(details.sic_description) || null;

          const { error: updateError } = await supabase
            .from('securities')
            .update({
              sector,
              industry: details.sic_description || null,
              logo_url: details.icon_url || details.logo_url || null,
            })
            .eq('id', sec.id);

          if (updateError) {
            result.errors.push(`enrich:${sec.ticker}`);
          } else {
            result.securitiesEnriched++;
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // 2. Fetch upcoming dividends → market_events
    // ---------------------------------------------------------------
    try {
      const dividends = await getUpcomingDividends(uniqueTickers, 90);

      if (dividends.length > 0) {
        // Deduplicate against existing events
        const { data: existingDivs } = await supabase
          .from('market_events')
          .select('ticker, event_date')
          .eq('event_type', 'dividend')
          .in('ticker', dividends.map(d => d.ticker));

        const existingKeys = new Set(
          (existingDivs || []).map(e => `${e.ticker}:${e.event_date}`)
        );

        const newDividends = dividends.filter(
          d => !existingKeys.has(`${d.ticker}:${d.ex_dividend_date}`)
        );

        if (newDividends.length > 0) {
          const freqLabel = (f: number) => {
            if (f === 4) return 'quarterly';
            if (f === 12) return 'monthly';
            if (f === 2) return 'semi-annual';
            if (f === 1) return 'annual';
            return '';
          };

          const inserts = newDividends.map(d => ({
            event_type: 'dividend' as const,
            ticker: d.ticker,
            event_date: d.ex_dividend_date,
            title: `${d.ticker} ex-dividend date`,
            description: `$${d.cash_amount.toFixed(4)}/share ${freqLabel(d.frequency)} dividend. Pay date: ${d.pay_date || 'TBD'}.`,
            metadata: {
              cash_amount: d.cash_amount,
              currency: d.currency,
              pay_date: d.pay_date,
              record_date: d.record_date,
              declaration_date: d.declaration_date,
              frequency: d.frequency,
              dividend_type: d.dividend_type,
            },
            impact_level: 'medium' as const,
          }));

          const { error } = await supabase.from('market_events').insert(inserts);
          if (error) {
            result.errors.push('dividends_insert');
            console.error('Error inserting dividends:', error);
          } else {
            result.dividendsFound = newDividends.length;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dividends:', error);
      result.errors.push('dividends_fetch');
    }

    // ---------------------------------------------------------------
    // 3. Fetch recent/upcoming splits → market_events
    // ---------------------------------------------------------------
    try {
      const splits = await getRecentSplits(uniqueTickers, 90);

      if (splits.length > 0) {
        const { data: existingSplits } = await supabase
          .from('market_events')
          .select('ticker, event_date')
          .eq('event_type', 'split')
          .in('ticker', splits.map(s => s.ticker));

        const existingKeys = new Set(
          (existingSplits || []).map(e => `${e.ticker}:${e.event_date}`)
        );

        const newSplits = splits.filter(
          s => !existingKeys.has(`${s.ticker}:${s.execution_date}`)
        );

        if (newSplits.length > 0) {
          const inserts = newSplits.map(s => ({
            event_type: 'split' as const,
            ticker: s.ticker,
            event_date: s.execution_date,
            title: `${s.ticker} ${s.split_to}-for-${s.split_from} stock split`,
            description: `Each share becomes ${s.split_to / s.split_from} shares. Execution date: ${s.execution_date}.`,
            metadata: {
              split_from: s.split_from,
              split_to: s.split_to,
              ratio: s.split_to / s.split_from,
            },
            impact_level: 'high' as const,
          }));

          const { error } = await supabase.from('market_events').insert(inserts);
          if (error) {
            result.errors.push('splits_insert');
            console.error('Error inserting splits:', error);
          } else {
            result.splitsFound = newSplits.length;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching splits:', error);
      result.errors.push('splits_fetch');
    }

    return NextResponse.json({
      success: true,
      ...result,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Error enriching market data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
