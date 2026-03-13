import { createClient } from '@/lib/supabase/server';
import { getPortfolioSummary } from '@/lib/portfolio-analysis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentYear = new Date().getFullYear();

    // Fetch portfolio + realized gains concurrently
    const [portfolioSummary, capitalGainsResult] = await Promise.all([
      getPortfolioSummary(user.id),
      supabase
        .from('capital_gains')
        .select('ticker, transaction_type, transaction_date, shares, price_per_share, cost_basis, proceeds, gain_loss, gain_loss_type')
        .eq('user_id', user.id)
        .eq('tax_year', currentYear)
        .order('transaction_date', { ascending: false }),
    ]);

    // ── Unrealized P&L from live holdings ──
    const positions = portfolioSummary.holdings
      .filter(h => h.unrealizedGainLoss != null && h.totalCostBasis != null)
      .map(h => ({
        ticker: h.ticker,
        name: h.securityName,
        shares: h.shares,
        costBasis: h.totalCostBasis!,
        currentValue: h.totalValue,
        gainLoss: h.unrealizedGainLoss!,
        gainLossPct: (h.unrealizedGainLossPct ?? 0) * 100,
        sector: h.sector,
        allocationPct: h.allocationPct,
      }))
      .sort((a, b) => Math.abs(b.gainLoss) - Math.abs(a.gainLoss));

    const totalUnrealizedGains = positions
      .filter(p => p.gainLoss > 0)
      .reduce((s, p) => s + p.gainLoss, 0);

    const totalUnrealizedLosses = positions
      .filter(p => p.gainLoss < 0)
      .reduce((s, p) => s + p.gainLoss, 0);

    // ── Realized capital gains from transactions ──
    const capitalGains = capitalGainsResult.data || [];
    const sells = capitalGains.filter(g => g.transaction_type === 'sell');

    const shortTermGains = sells
      .filter(g => g.gain_loss_type === 'short_term' && (g.gain_loss ?? 0) > 0)
      .reduce((s, g) => s + Number(g.gain_loss || 0), 0);

    const shortTermLosses = sells
      .filter(g => g.gain_loss_type === 'short_term' && (g.gain_loss ?? 0) < 0)
      .reduce((s, g) => s + Number(g.gain_loss || 0), 0);

    const longTermGains = sells
      .filter(g => g.gain_loss_type === 'long_term' && (g.gain_loss ?? 0) > 0)
      .reduce((s, g) => s + Number(g.gain_loss || 0), 0);

    const longTermLosses = sells
      .filter(g => g.gain_loss_type === 'long_term' && (g.gain_loss ?? 0) < 0)
      .reduce((s, g) => s + Number(g.gain_loss || 0), 0);

    const realizedTransactions = sells.map(g => ({
      ticker: g.ticker,
      date: g.transaction_date,
      shares: g.shares,
      proceeds: g.proceeds,
      costBasis: g.cost_basis,
      gainLoss: Number(g.gain_loss || 0),
      gainLossType: g.gain_loss_type as 'short_term' | 'long_term',
    }));

    return NextResponse.json({
      unrealized: {
        totalGains: totalUnrealizedGains,
        totalLosses: totalUnrealizedLosses,
        netUnrealized: totalUnrealizedGains + totalUnrealizedLosses,
        positions,
      },
      realized: {
        shortTermGains,
        shortTermLosses,
        longTermGains,
        longTermLosses,
        netRealized: shortTermGains + shortTermLosses + longTermGains + longTermLosses,
        transactionCount: sells.length,
        transactions: realizedTransactions,
      },
    });
  } catch (error) {
    console.error('Error in tax route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
