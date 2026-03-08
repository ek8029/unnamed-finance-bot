import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: holdings, error } = await supabase
      .from('holdings')
      .select(`
        *,
        security:securities(security_name, asset_class, sector, exchange)
      `)
      .eq('user_id', user.id)
      .order('total_value', { ascending: false });

    if (error) {
      console.error('Error fetching holdings:', error);
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const transformedHoldings = holdings?.map(holding => ({
      id: holding.id,
      user_id: holding.user_id,
      ticker: holding.ticker,
      asset_name: holding.security?.security_name || holding.ticker,
      shares: holding.shares,
      current_price: holding.current_price,
      total_value: holding.total_value,
      day_change_percentage: holding.day_change_pct * 100, // Convert decimal to percentage
      portfolio_allocation: holding.portfolio_allocation_pct,
      sector: holding.security?.sector,
      asset_class: holding.security?.asset_class,
      cost_basis: holding.average_cost_basis,
      unrealised_gain: holding.unrealised_gain_loss,
    }));

    // Calculate portfolio allocation breakdown
    const totalValue = holdings?.reduce((sum, h) => sum + Number(h.total_value), 0) || 0;

    const allocation = holdings?.reduce((acc, h) => {
      const sector = h.security?.sector || 'Other';
      if (!acc[sector]) {
        acc[sector] = { name: sector, value: 0, percentage: 0 };
      }
      acc[sector].value += Number(h.total_value);
      return acc;
    }, {} as Record<string, { name: string; value: number; percentage: number }>);

    // Calculate percentages
    if (allocation) {
      for (const key of Object.keys(allocation)) {
        allocation[key].percentage = totalValue > 0 ? (allocation[key].value / totalValue) * 100 : 0;
      }
    }

    return NextResponse.json({
      holdings: transformedHoldings,
      allocation: allocation ? Object.values(allocation) : [],
      totalValue,
    });
  } catch (error) {
    console.error('Error in holdings route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
