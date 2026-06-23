import { createClient } from '@/lib/supabase/server';
import { getQuote } from '@/lib/financial-data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { HoldingDetailClient } from './holding-detail-client';

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function HoldingDetailPage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  if (!symbol || symbol.length > 5) notFound();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) notFound();

  // Fetch holding, quote (single Finnhub call), news, transactions, prices in parallel
  const [holdingsResult, quoteResult, newsResult, txResult, pricesResult] = await Promise.all([
    supabase
      .from('holdings')
      .select('*, security:securities(security_name, sector, asset_class, exchange)')
      .eq('user_id', user.id)
      .eq('ticker', symbol),
    getQuote(symbol),
    supabase
      .from('market_news')
      .select('id, title, summary, source, url, published_at, sentiment')
      .contains('tickers', [symbol])
      .order('published_at', { ascending: false })
      .limit(8),
    supabase
      .from('transactions')
      .select('id, amount, transaction_date, description, merchant_name, category_name')
      .eq('user_id', user.id)
      .or(`description.ilike.%${symbol}%,merchant_name.ilike.%${symbol}%`)
      .order('transaction_date', { ascending: false })
      .limit(10),
    supabase
      .from('market_prices')
      .select('price_date, close')
      .eq('ticker', symbol)
      .gte('price_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('price_date', { ascending: true }),
  ]);

  const holdings = holdingsResult.data || [];
  if (holdings.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
        <div className="max-w-[470px] text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Not held
          </div>
          <h1 className="text-[26px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] mb-3">
            No position in {symbol}
          </h1>
          <p className="text-[15px] leading-[1.65] text-[var(--color-text-muted)] mb-6">
            You don&apos;t hold {symbol} in any linked account. You can still run a full AI analysis on it.
          </p>
          <Link
            href={`/dashboard/analyze/${symbol}`}
            className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-gold)] hover:brightness-[1.06] rounded-[7px] text-[#0A0A0A] font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-all"
            style={{ boxShadow: '0 8px 24px rgba(230,185,77,0.25)' }}
          >
            Open analysis for {symbol}
          </Link>
        </div>
      </div>
    );
  }

  // Merge duplicate holdings (same ticker across accounts)
  const totalShares = holdings.reduce((s, h) => s + Number(h.shares), 0);
  const totalValue = holdings.reduce((s, h) => s + Number(h.total_value), 0);
  const totalCostBasis = holdings.reduce((s, h) => s + Number(h.total_cost_basis || 0), 0);
  const unrealizedGL = holdings.reduce((s, h) => s + Number(h.unrealised_gain_loss || 0), 0);
  const unrealizedPct = totalCostBasis > 0 ? (unrealizedGL / totalCostBasis) * 100 : 0;
  const currentPrice = Number(holdings[0].current_price || 0);
  const dayChangePct = Number(holdings[0].day_change_pct || 0) * 100;
  const allocPct = holdings.reduce((s, h) => s + Number(h.portfolio_allocation_pct || 0), 0);
  const security = holdings[0].security;

  const holdingData = {
    ticker: symbol,
    name: security?.security_name || symbol,
    sector: security?.sector || 'Unknown',
    exchange: security?.exchange || '',
    shares: totalShares,
    currentPrice,
    totalValue,
    costBasis: totalCostBasis,
    avgCost: totalShares > 0 ? totalCostBasis / totalShares : 0,
    unrealizedGL,
    unrealizedPct,
    dayChangePct,
    allocPct,
  };

  const priceHistory = (pricesResult.data || []).map(p => ({
    date: p.price_date,
    close: Number(p.close),
  }));

  const news = (newsResult.data || []).map(n => ({
    id: n.id,
    title: n.title,
    summary: n.summary,
    source: n.source,
    url: n.url,
    publishedAt: n.published_at,
    sentiment: n.sentiment,
  }));

  const transactions = (txResult.data || []).map(t => ({
    id: t.id,
    amount: Number(t.amount),
    date: t.transaction_date,
    description: t.description,
    merchantName: t.merchant_name,
  }));

  const quote = quoteResult;

  return (
    <HoldingDetailClient
      holding={holdingData}
      priceHistory={priceHistory}
      news={news}
      transactions={transactions}
      quote={quote}
    />
  );
}
