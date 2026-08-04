import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/tier';
import { isRetirementAccount } from '@/lib/tax-analysis';
import { NextResponse } from 'next/server';

// ── Types ──

interface Form8949Row {
  description: string;
  /** Column (b). Empty string when Helm has no acquisition record on or before
   *  the sale date — never a fabricated or post-disposition date. */
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  /** Column (g). null = NOT COMPUTED. Helm does not calculate wash-sale or any
   *  other adjustment, and printing 0.00 asserts there is none. */
  adjustment: number | null;
  /** Column (f) adjustment code. Always empty until (g) is actually computed. */
  code: string;
  gainLoss: number;
  /** True when column (b) is unknown, so the row needs 1099-B reconciliation. */
  acquisitionUnknown: boolean;
  /** True when proceeds or basis is missing in the feed; excluded from totals. */
  incomplete: boolean;
}

interface Form8949Part {
  label: string;
  subtitle: string;
  /** Part I box A/B/C or Part II box D/E/F. Helm receives no Form 1099-B, so it
   *  can only assert the "not reported to you on Form 1099-B" box. */
  box: 'C' | 'F';
  boxNote: string;
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
  /** Rows dropped from the totals because the feed was missing proceeds or basis. */
  incompleteCount: number;
  /** Sells whose holding period was not classified; reported as short-term. */
  unclassifiedCount: number;
  /** Retirement-account dispositions excluded — they do not belong on Form 8949. */
  retirementExcludedCount: number;
  /** Rows with no account link, so their tax status could not be verified. */
  unlinkedAccountCount: number;
  caveats: string[];
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
  box: 'C' | 'F',
  rows: Form8949Row[],
): Form8949Part {
  const counted = rows.filter((r) => !r.incomplete);
  return {
    label,
    subtitle,
    box,
    boxNote: `Box ${box} assumed: transactions not reported to you on Form 1099-B. `
      + 'Helm does not receive your 1099-B and cannot tell whether basis was reported to the IRS. '
      + `If your broker did report these, the correct box is ${box === 'C' ? 'A or B' : 'D or E'}.`,
    rows,
    totalProceeds: counted.reduce((s, r) => s + r.proceeds, 0),
    totalCostBasis: counted.reduce((s, r) => s + r.costBasis, 0),
    totalAdjustment: 0,
    totalGainLoss: counted.reduce((s, r) => s + r.gainLoss, 0),
  };
}

/**
 * Which tax year to report.
 *
 * Form 8949 reports dispositions for the year of the return being filed. During
 * filing season the year a user needs is the PRIOR one, so defaulting to the
 * server's current calendar year made the filable year unreachable and showed a
 * year that cannot be filed yet. An explicit ?year= overrides.
 */
function resolveTaxYear(param: string | null): number {
  const now = new Date();
  if (param && /^\d{4}$/.test(param)) {
    const y = Number(param);
    if (y >= 2000 && y <= now.getFullYear()) return y;
  }
  // Through the April filing deadline, default to the completed year.
  const beforeDeadline = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() <= 15);
  return beforeDeadline ? now.getFullYear() - 1 : now.getFullYear();
}

// ── Route ──

export async function GET(request: Request) {
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

    const taxYear = resolveTaxYear(new URL(request.url).searchParams.get('year'));

    // Fetch all sell transactions for the reported tax year
    const { data: sells, error: queryError } = await supabase
      .from('capital_gains')
      .select(`
        ticker, transaction_date, shares, proceeds, cost_basis, gain_loss, gain_loss_type,
        account_id, account:linked_accounts(account_name, account_subtype)
      `)
      .eq('user_id', user.id)
      .eq('tax_year', taxYear)
      .eq('transaction_type', 'sell')
      .order('transaction_date', { ascending: true });

    if (queryError) {
      console.error('Form 8949 query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch capital gains' }, { status: 500 });
    }

    // IRC §408(e)(1): retirement accounts are exempt from tax, so dispositions
    // inside them are not reported on Form 8949 or Schedule D. Rows with no
    // account link cannot be classified — they stay in, and the artifact says so
    // rather than silently assuming they were taxable.
    type SellRow = (typeof sells extends (infer R)[] | null ? R : never);
    const allSells = (sells ?? []) as SellRow[];
    let retirementExcludedCount = 0;
    let unlinkedAccountCount = 0;
    const transactions = allSells.filter((tx) => {
      const rel = (tx as { account?: unknown }).account ?? null;
      const acc = (Array.isArray(rel) ? rel[0] : rel) as
        | { account_name?: string | null; account_subtype?: string | null }
        | null;
      if (!acc) {
        unlinkedAccountCount++;
        return true;
      }
      if (isRetirementAccount(acc.account_subtype ?? null, acc.account_name ?? null)) {
        retirementExcludedCount++;
        return false;
      }
      return true;
    });

    // Every recorded acquisition date per ticker. Column (b) must describe the
    // lot actually disposed of; taking the earliest buy on record stamped a
    // 2019 date on a 2026 sale of a 2025 lot, and in a sell-then-re-enter case
    // could even print an acquisition date AFTER the disposition date.
    const tickers = [...new Set(transactions.map(t => t.ticker))];
    const buyDates: Record<string, string[]> = {};

    if (tickers.length > 0) {
      const { data: buys } = await supabase
        .from('capital_gains')
        .select('ticker, transaction_date')
        .eq('user_id', user.id)
        .eq('transaction_type', 'buy')
        .in('ticker', tickers)
        .order('transaction_date', { ascending: true });

      for (const buy of buys ?? []) {
        (buyDates[buy.ticker] ??= []).push(buy.transaction_date);
      }
    }

    /** Column (b) per the Form 8949 instructions: a single acquisition date when
     *  exactly one lot could have supplied the shares, VARIOUS when several
     *  could, and blank when Helm has no record on or before the sale. */
    function resolveDateAcquired(ticker: string, soldOn: string): { value: string; unknown: boolean } {
      const priorBuys = (buyDates[ticker] ?? []).filter((d) => d <= soldOn);
      if (priorBuys.length === 0) return { value: '', unknown: true };
      if (priorBuys.length === 1) return { value: formatDateMMDDYYYY(priorBuys[0]), unknown: false };
      return { value: 'VARIOUS', unknown: false };
    }

    // Split into short-term and long-term
    const shortTermRows: Form8949Row[] = [];
    const longTermRows: Form8949Row[] = [];
    let unclassifiedCount = 0;
    let incompleteCount = 0;

    for (const tx of transactions) {
      const acquired = resolveDateAcquired(tx.ticker, tx.transaction_date);
      const proceeds = tx.proceeds == null ? null : Number(tx.proceeds);
      const costBasis = tx.cost_basis == null ? null : Number(tx.cost_basis);
      const incomplete = proceeds == null || costBasis == null;
      if (incomplete) incompleteCount++;

      const row: Form8949Row = {
        description: buildDescription(Number(tx.shares), tx.ticker),
        dateAcquired: acquired.value,
        dateSold: formatDateMMDDYYYY(tx.transaction_date),
        proceeds: proceeds ?? 0,
        costBasis: costBasis ?? 0,
        adjustment: null,
        code: '',
        // Column (h) is (d) − (e) + (g) per the instructions, not a separately
        // stored aggregate that can disagree with the two columns above it.
        gainLoss: incomplete ? 0 : (proceeds as number) - (costBasis as number),
        acquisitionUnknown: acquired.unknown,
        incomplete,
      };

      // A missing or unrecognised classification is reported as SHORT-term.
      // Defaulting to long-term applied the §1(h) preferential rate to gain that
      // may not qualify — an understatement of tax on the user's own return.
      if (tx.gain_loss_type === 'long_term') {
        longTermRows.push(row);
      } else {
        if (tx.gain_loss_type !== 'short_term') unclassifiedCount++;
        shortTermRows.push(row);
      }
    }

    const partI = buildPart(
      'Part I',
      'Short-term capital gains and losses -- Assets held one year or less',
      'C',
      shortTermRows,
    );

    const partII = buildPart(
      'Part II',
      'Long-term capital gains and losses -- Assets held more than one year',
      'F',
      longTermRows,
    );

    const caveats = [
      'This is a worksheet, not a filed Form 8949. Reconcile every row against your Form 1099-B.',
      'Column (f) codes and column (g) adjustments are NOT computed, including wash-sale code W. '
        + 'If you had a wash sale this year, the disallowed loss is missing from these figures.',
      'Box selection is assumed (Part I box C, Part II box F) because Helm does not receive your 1099-B '
        + 'and cannot tell whether basis was reported to the IRS.',
      'Specific-lot identification is not implemented. Column (b) is derived from your transaction feed, '
        + 'not from lot-level acquisition records.',
    ];
    if (retirementExcludedCount > 0) {
      caveats.push(
        `${retirementExcludedCount} disposition${retirementExcludedCount === 1 ? '' : 's'} inside a retirement `
        + 'account were excluded. IRC §408(e)(1) exempts those accounts, so their trades do not belong on '
        + 'Form 8949 or Schedule D.',
      );
    }
    if (unlinkedAccountCount > 0) {
      caveats.push(
        `${unlinkedAccountCount} row${unlinkedAccountCount === 1 ? ' has' : 's have'} no account link, so Helm `
        + 'cannot tell whether the trade happened in a taxable or a tax-advantaged account. Remove any '
        + 'IRA, 401(k), HSA or 529 activity by hand.',
      );
    }
    if (unclassifiedCount > 0) {
      caveats.push(
        `${unclassifiedCount} transaction${unclassifiedCount === 1 ? ' has' : 's have'} no holding period `
        + 'in your feed and are reported in Part I as short-term. Verify against your 1099-B.',
      );
    }
    if (incompleteCount > 0) {
      caveats.push(
        `${incompleteCount} transaction${incompleteCount === 1 ? ' is' : 's are'} missing proceeds or cost `
        + 'basis and are excluded from the totals below.',
      );
    }

    const response: Form8949Response = {
      taxYear,
      generatedAt: new Date().toISOString(),
      partI,
      partII,
      grandTotalProceeds: partI.totalProceeds + partII.totalProceeds,
      grandTotalCostBasis: partI.totalCostBasis + partII.totalCostBasis,
      grandTotalGainLoss: partI.totalGainLoss + partII.totalGainLoss,
      transactionCount: transactions.length,
      incompleteCount,
      unclassifiedCount,
      retirementExcludedCount,
      unlinkedAccountCount,
      caveats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in form-8949 route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
