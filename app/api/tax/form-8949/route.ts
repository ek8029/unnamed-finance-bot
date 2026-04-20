import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/tier';
import { NextResponse } from 'next/server';

// ── Types ──

interface Form8949Row {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  adjustment: number;
  gainLoss: number;
}

interface Form8949Part {
  label: string;
  subtitle: string;
  rows: Form8949Row[];
  totalProceeds: number;
  totalCostBasis: number;
  totalAdjustment: number;
  totalGainLoss: number;
}

interface Form8949Response {
  taxYear: number;
  generatedAt: string;
  partI: Form8949Part;
  partII: Form8949Part;
  grandTotalProceeds: number;
  grandTotalCostBasis: number;
  grandTotalGainLoss: number;
  transactionCount: number;
}

// ── Helpers ──

function formatDateMMDDYYYY(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function buildDescription(shares: number, ticker: string): string {
  const sharesStr = shares % 1 === 0
    ? shares.toLocaleString('en-US')
    : shares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `${sharesStr} sh ${ticker}`;
}

function buildPart(
  label: string,
  subtitle: string,
  rows: Form8949Row[],
): Form8949Part {
  return {
    label,
    subtitle,
    rows,
    totalProceeds: rows.reduce((s, r) => s + r.proceeds, 0),
    totalCostBasis: rows.reduce((s, r) => s + r.costBasis, 0),
    totalAdjustment: rows.reduce((s, r) => s + r.adjustment, 0),
    totalGainLoss: rows.reduce((s, r) => s + r.gainLoss, 0),
  };
}

// ── Route ──

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pro tier check
    const { allowed } = await requirePro(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Pro subscription required', code: 'PRO_REQUIRED' },
        { status: 403 },
      );
    }

    const currentYear = new Date().getFullYear();

    // Fetch all sell transactions for the current tax year
    const { data: sells, error: queryError } = await supabase
      .from('capital_gains')
      .select('ticker, transaction_date, shares, proceeds, cost_basis, gain_loss, gain_loss_type')
      .eq('user_id', user.id)
      .eq('tax_year', currentYear)
      .eq('transaction_type', 'sell')
      .order('transaction_date', { ascending: true });

    if (queryError) {
      console.error('Form 8949 query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch capital gains' }, { status: 500 });
    }

    const transactions = sells ?? [];

    // Try to find the earliest buy date per ticker for date_acquired
    const tickers = [...new Set(transactions.map(t => t.ticker))];
    const buyDates: Record<string, string> = {};

    if (tickers.length > 0) {
      const { data: buys } = await supabase
        .from('capital_gains')
        .select('ticker, transaction_date')
        .eq('user_id', user.id)
        .eq('transaction_type', 'buy')
        .in('ticker', tickers)
        .order('transaction_date', { ascending: true });

      if (buys) {
        for (const buy of buys) {
          if (!buyDates[buy.ticker]) {
            buyDates[buy.ticker] = buy.transaction_date;
          }
        }
      }
    }

    // Split into short-term and long-term
    const shortTermRows: Form8949Row[] = [];
    const longTermRows: Form8949Row[] = [];

    for (const tx of transactions) {
      const row: Form8949Row = {
        description: buildDescription(Number(tx.shares), tx.ticker),
        dateAcquired: buyDates[tx.ticker]
          ? formatDateMMDDYYYY(buyDates[tx.ticker])
          : 'Various',
        dateSold: formatDateMMDDYYYY(tx.transaction_date),
        proceeds: Number(tx.proceeds ?? 0),
        costBasis: Number(tx.cost_basis ?? 0),
        adjustment: 0,
        gainLoss: Number(tx.gain_loss ?? 0),
      };

      if (tx.gain_loss_type === 'short_term') {
        shortTermRows.push(row);
      } else {
        longTermRows.push(row);
      }
    }

    const partI = buildPart(
      'Part I',
      'Short-term capital gains and losses -- Assets held one year or less',
      shortTermRows,
    );

    const partII = buildPart(
      'Part II',
      'Long-term capital gains and losses -- Assets held more than one year',
      longTermRows,
    );

    const response: Form8949Response = {
      taxYear: currentYear,
      generatedAt: new Date().toISOString(),
      partI,
      partII,
      grandTotalProceeds: partI.totalProceeds + partII.totalProceeds,
      grandTotalCostBasis: partI.totalCostBasis + partII.totalCostBasis,
      grandTotalGainLoss: partI.totalGainLoss + partII.totalGainLoss,
      transactionCount: transactions.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in form-8949 route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
