import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getBatchPrices } from '@/lib/polygon';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all unique tickers from the user's holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('id, ticker, security_id, shares, total_cost_basis, current_price')
      .eq('user_id', user.id);

    if (holdingsError) {
      console.error('Error fetching holdings:', holdingsError);
      return NextResponse.json(
        { error: 'Failed to fetch holdings' },
        { status: 500 }
      );
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No holdings to update',
        updated: 0,
      });
    }

    const uniqueTickers = [...new Set(holdings.map(h => h.ticker))];

    // 2. Fetch latest prices from Polygon
    const priceMap = await getBatchPrices(uniqueTickers);

    if (priceMap.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prices returned from Polygon — API key may not be set or market data unavailable',
        updated: 0,
      });
    }

    // 3. Build a map of ticker -> security_id for market_prices inserts
    const tickerSecurityMap = new Map<string, string>();
    for (const h of holdings) {
      if (h.security_id && h.ticker) {
        tickerSecurityMap.set(h.ticker.toUpperCase(), h.security_id);
      }
    }

    const updatedTickers: string[] = [];
    const errors: string[] = [];

    // 4. Update each holding and its associated security
    for (const holding of holdings) {
      const ticker = holding.ticker?.toUpperCase();
      if (!ticker) continue;

      const price = priceMap.get(ticker);
      if (!price) continue;

      const currentPrice = price.close;
      const shares = Number(holding.shares);
      const totalCostBasis = Number(holding.total_cost_basis);
      const totalValue = shares * currentPrice;
      const unrealisedGainLoss = totalValue - totalCostBasis;
      const unrealisedGainLossPct =
        totalCostBasis > 0 ? unrealisedGainLoss / totalCostBasis : 0;

      // Calculate day change % from previous close (open vs close as approximation)
      // Polygon prev endpoint returns the previous trading day's data
      const dayChangePct =
        price.open > 0 ? (price.close - price.open) / price.open : 0;

      // Update the holding row
      const { error: updateError } = await supabase
        .from('holdings')
        .update({
          current_price: currentPrice,
          total_value: totalValue,
          unrealised_gain_loss: unrealisedGainLoss,
          unrealised_gain_loss_pct: unrealisedGainLossPct,
          day_change_pct: dayChangePct,
        })
        .eq('id', holding.id);

      if (updateError) {
        console.error(`Error updating holding ${holding.id}:`, updateError);
        errors.push(`holding:${holding.ticker}`);
        continue;
      }

      updatedTickers.push(ticker);
    }

    // 5. Update securities table (batch by unique ticker)
    for (const [ticker, price] of priceMap.entries()) {
      const securityId = tickerSecurityMap.get(ticker);
      if (!securityId) continue;

      const { error: secError } = await supabase
        .from('securities')
        .update({ current_price: price.close })
        .eq('id', securityId);

      if (secError) {
        console.error(`Error updating security ${ticker}:`, secError);
        errors.push(`security:${ticker}`);
      }
    }

    // 6. Upsert into market_prices table
    const priceInserts = [];
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
      const { error: upsertError } = await supabase
        .from('market_prices')
        .upsert(priceInserts, {
          onConflict: 'security_id,price_date',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('Error upserting market_prices:', upsertError);
        errors.push('market_prices_upsert');
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedTickers.length,
      tickers: updatedTickers,
      pricesRecorded: priceInserts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error refreshing market prices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
