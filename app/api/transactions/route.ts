import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatCategoryName, guessCategoryGroup } from '@/lib/utils';
import { summarizeCashFlow } from '@/lib/cash-flow';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    // Filters
    const search = searchParams.get('search') || '';
    const accountId = searchParams.get('account_id') || '';
    const category = searchParams.get('category') || ''; // category display name
    const categoryGroup = searchParams.get('category_group') || ''; // group-level filter
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const type = searchParams.get('type') || ''; // 'income' | 'expense'

    // --- First: get all user's transactions to build category list ---
    // We fetch distinct category info from the user's actual data
    const { data: allUserTx } = await supabase
      .from('transactions')
      .select('category_id, category_name')
      .eq('user_id', user.id)
      .not('category_name', 'is', null)
      .limit(500);

    // Build the real category options from actual transaction data
    const categoryCountMap = new Map<string, { name: string; group: string; count: number; filterValue: string }>();

    // Get category details for any category_ids that exist
    const categoryIds = new Set<string>();
    for (const t of allUserTx || []) {
      if (t.category_id) categoryIds.add(t.category_id);
    }

    let categoryLookup = new Map<string, { name: string; category_group: string }>();
    if (categoryIds.size > 0) {
      const { data: catData } = await supabase
        .from('transaction_categories')
        .select('id, name, category_group')
        .in('id', Array.from(categoryIds));

      if (catData) {
        categoryLookup = new Map(catData.map(c => [c.id, { name: c.name, category_group: c.category_group || 'Other' }]));
      }
    }

    // Build category options from actual transactions
    for (const t of allUserTx || []) {
      let displayName: string;
      let group: string;
      let filterValue: string;

      if (t.category_id && categoryLookup.has(t.category_id)) {
        const cat = categoryLookup.get(t.category_id)!;
        displayName = cat.name;
        group = cat.category_group;
        // For DB categories, filter by the raw category_name stored on the transaction
        // (which may differ from the DB name), so use the category_name if available
        filterValue = t.category_name || cat.name;
      } else if (t.category_name) {
        // Raw Plaid category - format it nicely
        displayName = formatCategoryName(t.category_name);
        group = guessCategoryGroup(t.category_name);
        filterValue = t.category_name;
      } else {
        displayName = 'Uncategorized';
        group = 'Other';
        filterValue = '__uncategorized__';
      }

      const key = filterValue.toLowerCase();
      if (categoryCountMap.has(key)) {
        categoryCountMap.get(key)!.count++;
      } else {
        categoryCountMap.set(key, { name: displayName, group, count: 1, filterValue });
      }
    }

    // Sort categories: by group then by name
    const categoryOptions = Array.from(categoryCountMap.values())
      .sort((a, b) => {
        const groupCmp = a.group.localeCompare(b.group);
        if (groupCmp !== 0) return groupCmp;
        return a.name.localeCompare(b.name);
      })
      .map(c => ({
        id: c.filterValue,
        name: c.name,
        category_group: c.group,
        count: c.count,
      }));

    // Also build group-level options
    const groupCounts = new Map<string, number>();
    for (const c of categoryCountMap.values()) {
      groupCounts.set(c.group, (groupCounts.get(c.group) || 0) + c.count);
    }
    const groupOptions = Array.from(groupCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));

    // --- Build the main query ---
    let query = supabase
      .from('transactions')
      .select(`
        *,
        account:linked_accounts(id, account_name, account_type, institution:institutions(name)),
        category:transaction_categories(id, name, category_group, icon, color)
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    const sanitizedSearch = search.replace(/[^a-zA-Z0-9 \-]/g, '').trim();
    if (sanitizedSearch) {
      query = query.or(`description.ilike.%${sanitizedSearch}%,merchant_name.ilike.%${sanitizedSearch}%`);
    }
    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (category) {
      if (category === '__uncategorized__') {
        query = query.is('category_name', null).is('category_id', null);
      } else {
        // Match the raw category_name field (case-insensitive)
        query = query.ilike('category_name', category);
      }
    }
    if (categoryGroup) {
      // Get all category_name values that belong to this group
      const namesInGroup = Array.from(categoryCountMap.values())
        .filter(c => c.group === categoryGroup)
        .map(c => c.filterValue);
      if (namesInGroup.length > 0) {
        query = query.in('category_name', namesInGroup);
      }
    }
    if (dateFrom) {
      query = query.gte('transaction_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('transaction_date', dateTo);
    }
    if (type === 'income') {
      query = query.gt('amount', 0);
    } else if (type === 'expense') {
      query = query.lt('amount', 0);
    }

    const { data: transactions, error: txError, count } = await query;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // --- Investment transactions (trades, dividends, fees) ---
    // Skipped when category filters are active — investment rows have no categories.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let investmentTx: any[] = [];
    let investmentCount = 0;
    if (!category && !categoryGroup) {
      let invQuery = supabase
        .from('investment_transactions')
        .select(`
          *,
          account:linked_accounts(id, account_name, account_type, institution:institutions(name))
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (sanitizedSearch) {
        invQuery = invQuery.or(`name.ilike.%${sanitizedSearch}%,ticker.ilike.%${sanitizedSearch}%`);
      }
      if (accountId) {
        invQuery = invQuery.eq('account_id', accountId);
      }
      if (dateFrom) {
        invQuery = invQuery.gte('transaction_date', dateFrom);
      }
      if (dateTo) {
        invQuery = invQuery.lte('transaction_date', dateTo);
      }
      if (type === 'income') {
        invQuery = invQuery.gt('amount', 0);
      } else if (type === 'expense') {
        invQuery = invQuery.lt('amount', 0);
      }

      const { data: invData, error: invError, count: invCount } = await invQuery;
      if (invError) {
        console.error('Error fetching investment transactions:', invError);
      } else {
        investmentTx = invData || [];
        investmentCount = invCount || 0;
      }
    }

    // --- Summary stats (with same filters) ---
    let summaryQuery = supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id);

    if (sanitizedSearch) {
      summaryQuery = summaryQuery.or(`description.ilike.%${sanitizedSearch}%,merchant_name.ilike.%${sanitizedSearch}%`);
    }
    if (accountId) {
      summaryQuery = summaryQuery.eq('account_id', accountId);
    }
    if (category) {
      if (category === '__uncategorized__') {
        summaryQuery = summaryQuery.is('category_name', null).is('category_id', null);
      } else {
        summaryQuery = summaryQuery.ilike('category_name', category);
      }
    }
    if (categoryGroup) {
      const namesInGroup = Array.from(categoryCountMap.values())
        .filter(c => c.group === categoryGroup)
        .map(c => c.filterValue);
      if (namesInGroup.length > 0) {
        summaryQuery = summaryQuery.in('category_name', namesInGroup);
      }
    }
    if (dateFrom) {
      summaryQuery = summaryQuery.gte('transaction_date', dateFrom);
    }
    if (dateTo) {
      summaryQuery = summaryQuery.lte('transaction_date', dateTo);
    }
    if (type === 'income') {
      summaryQuery = summaryQuery.gt('amount', 0);
    } else if (type === 'expense') {
      summaryQuery = summaryQuery.lt('amount', 0);
    }

    const { data: allFiltered } = await summaryQuery.limit(10000);

    // Investment cash rows for the summary (same filters). Skipped under category
    // filters, mirroring the list — investment rows carry no categories. Trades
    // (buy/sell) are dropped inside summarizeCashFlow, not here.
    let investmentFiltered: { amount: number | string; transaction_type: string | null }[] = [];
    if (!category && !categoryGroup) {
      let invSummaryQuery = supabase
        .from('investment_transactions')
        .select('amount, transaction_type')
        .eq('user_id', user.id);

      if (sanitizedSearch) {
        invSummaryQuery = invSummaryQuery.ilike('name', `%${sanitizedSearch}%`);
      }
      if (accountId) {
        invSummaryQuery = invSummaryQuery.eq('account_id', accountId);
      }
      if (dateFrom) {
        invSummaryQuery = invSummaryQuery.gte('transaction_date', dateFrom);
      }
      if (dateTo) {
        invSummaryQuery = invSummaryQuery.lte('transaction_date', dateTo);
      }
      if (type === 'income') {
        invSummaryQuery = invSummaryQuery.gt('amount', 0);
      } else if (type === 'expense') {
        invSummaryQuery = invSummaryQuery.lt('amount', 0);
      }

      const { data: invSummaryData } = await invSummaryQuery.limit(10000);
      investmentFiltered = invSummaryData || [];
    }

    const { totalIncome, totalExpenses, netFlow } = summarizeCashFlow([
      ...(allFiltered ?? []),
      ...investmentFiltered,
    ]);

    // --- Fetch account filter options ---
    const { data: accountsData } = await supabase
      .from('linked_accounts')
      .select('id, account_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('account_name');

    // Transform transactions
    const transformed = (transactions || []).map(t => ({
      id: t.id,
      amount: Number(t.amount),
      date: t.transaction_date,
      posted_date: t.posted_date,
      description: t.description,
      merchant_name: t.merchant_name,
      category_name: t.category?.name || (t.category_name ? formatCategoryName(t.category_name) : null),
      category_raw: t.category_name,
      category_group: t.category?.category_group || (t.category_name ? guessCategoryGroup(t.category_name) : null),
      category_color: t.category?.color || null,
      account_name: t.account?.account_name || null,
      account_type: t.account?.account_type || null,
      institution_name: t.account?.institution?.name || null,
      is_pending: t.is_pending,
    }));

    // Transform investment transactions into the same shape the UI consumes
    const investmentTransformed = investmentTx.map(t => ({
      id: t.id,
      kind: 'investment' as const,
      amount: Number(t.amount),
      date: t.transaction_date,
      posted_date: null,
      description: t.name || t.ticker || 'Investment transaction',
      merchant_name: t.ticker || null,
      category_name: null,
      category_raw: null,
      category_group: null,
      category_color: null,
      account_name: t.account?.account_name || null,
      account_type: t.account?.account_type || null,
      institution_name: t.account?.institution?.name || null,
      is_pending: false,
      ticker: t.ticker || null,
      transaction_type: t.transaction_type || null,
      quantity: t.quantity != null ? Number(t.quantity) : null,
      price: t.price != null ? Number(t.price) : null,
    }));

    // Merge bank + investment rows, newest first, keep the page size
    const merged = [...transformed, ...investmentTransformed]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit);

    const totalCount = (count || 0) + investmentCount;

    return NextResponse.json({
      transactions: merged,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalIncome,
        totalExpenses,
        netFlow,
        transactionCount: totalCount,
      },
      filters: {
        accounts: accountsData || [],
        categories: categoryOptions,
        groups: groupOptions,
      },
    });
  } catch (error) {
    console.error('Error in transactions route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, category_id, category_name } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (category_id !== undefined) updates.category_id = category_id;
    if (category_name !== undefined) updates.category_name = category_name;

    const { error: updateError } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in transactions PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
