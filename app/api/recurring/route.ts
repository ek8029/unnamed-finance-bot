import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET: Fetch detected recurring transactions
 * POST: Run detection algorithm on user's transaction history
 */

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: recurring, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('average_amount', { ascending: true });

    if (error) {
      console.error('Error fetching recurring:', error);
      return NextResponse.json({ error: 'Failed to fetch recurring transactions' }, { status: 500 });
    }

    const items = (recurring || []).map(r => ({
      id: r.id,
      merchant: r.merchant_name,
      description: r.description,
      amount: Number(r.average_amount),
      frequency: r.frequency,
      category: r.category_name,
      lastDate: r.last_date,
      nextExpected: r.next_expected_date,
      occurrences: r.occurrence_count,
      isSubscription: r.is_subscription,
    }));

    // Separate expenses (subscriptions) from income
    const expenses = items.filter(r => r.amount < 0);
    const income = items.filter(r => r.amount > 0);

    // Only sum expenses for the cost total
    const monthlyExpenseTotal = expenses.reduce((sum, r) => {
      return sum + Math.abs(toMonthly(r.amount, r.frequency));
    }, 0);

    const monthlyIncomeTotal = income.reduce((sum, r) => {
      return sum + toMonthly(r.amount, r.frequency);
    }, 0);

    return NextResponse.json({
      recurring: items,
      expenses,
      income,
      summary: {
        expenseCount: expenses.length,
        incomeCount: income.length,
        monthlyExpenseTotal: Math.round(monthlyExpenseTotal * 100) / 100,
        monthlyIncomeTotal: Math.round(monthlyIncomeTotal * 100) / 100,
        annualExpenseTotal: Math.round(monthlyExpenseTotal * 12 * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error in recurring route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear old detected recurring before re-detecting
    await supabase
      .from('recurring_transactions')
      .delete()
      .eq('user_id', user.id);

    // Fetch last 6 months of transactions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, amount, merchant_name, description, category_name, transaction_date')
      .eq('user_id', user.id)
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: true });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: 'Failed to analyze transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ success: true, detected: 0 });
    }

    // Group transactions by merchant + sign (income vs expense separately)
    const merchantGroups = new Map<string, {
      amounts: number[]; // preserve sign: negative = expense, positive = income
      dates: Date[];
      category: string | null;
      description: string;
      isExpense: boolean;
    }>();

    for (const t of transactions) {
      const merchant = t.merchant_name || t.description;
      if (!merchant) continue;

      const amount = Number(t.amount);
      const isExpense = amount < 0;
      const key = normalizeMerchant(merchant) + (isExpense ? ':expense' : ':income');

      const existing = merchantGroups.get(key);
      if (existing) {
        existing.amounts.push(amount);
        existing.dates.push(new Date(t.transaction_date));
        if (!existing.category && t.category_name) existing.category = t.category_name;
      } else {
        merchantGroups.set(key, {
          amounts: [amount],
          dates: [new Date(t.transaction_date)],
          category: t.category_name,
          description: merchant,
          isExpense,
        });
      }
    }

    // Detect recurring patterns
    const detected: {
      merchant_name: string;
      description: string;
      average_amount: number;
      frequency: string;
      category_name: string | null;
      last_date: string;
      next_expected_date: string;
      occurrence_count: number;
      is_subscription: boolean;
    }[] = [];

    for (const [, group] of merchantGroups) {
      // Need at least 2 occurrences
      if (group.dates.length < 2) continue;

      // Check if amounts are consistent (within 20% of average absolute value)
      const absAmounts = group.amounts.map(a => Math.abs(a));
      const avgAbsAmount = absAmounts.reduce((s, a) => s + a, 0) / absAmounts.length;
      if (avgAbsAmount < 1) continue; // Skip trivially small amounts

      const amountConsistent = absAmounts.every(a =>
        Math.abs(a - avgAbsAmount) / avgAbsAmount < 0.25
      );
      if (!amountConsistent && avgAbsAmount > 5) continue;

      // Detect frequency from date intervals
      const sortedDates = [...group.dates].sort((a, b) => a.getTime() - b.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const days = Math.round(
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      if (intervals.length === 0) continue;

      const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
      const frequency = detectFrequency(avgInterval, intervals);
      if (!frequency) continue;

      const lastDate = sortedDates[sortedDates.length - 1];
      const nextDate = computeNextDate(lastDate, frequency);

      // Preserve the sign: negative for expenses, positive for income
      const avgAmount = group.amounts.reduce((s, a) => s + a, 0) / group.amounts.length;

      detected.push({
        merchant_name: group.description,
        description: group.description,
        average_amount: Math.round(avgAmount * 100) / 100,
        frequency,
        category_name: group.category,
        last_date: lastDate.toISOString().split('T')[0],
        next_expected_date: nextDate.toISOString().split('T')[0],
        occurrence_count: group.dates.length,
        is_subscription: group.isExpense, // Only expenses are "subscriptions"
      });
    }

    // Insert detected recurring transactions
    if (detected.length > 0) {
      for (const r of detected) {
        await supabase
          .from('recurring_transactions')
          .upsert({
            user_id: user.id,
            ...r,
            is_active: true,
          }, {
            onConflict: 'user_id,merchant_name,frequency',
          });
      }
    }

    return NextResponse.json({
      success: true,
      detected: detected.length,
    });
  } catch (error) {
    console.error('Error detecting recurring transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- Helper functions ---

function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectFrequency(avgDays: number, intervals: number[]): string | null {
  // Check consistency: intervals should be within 35% of average
  const consistent = intervals.every(i => Math.abs(i - avgDays) / Math.max(avgDays, 1) < 0.35);
  if (!consistent && intervals.length > 2) return null;

  if (avgDays >= 5 && avgDays <= 10) return 'weekly';
  if (avgDays >= 12 && avgDays <= 18) return 'biweekly';
  if (avgDays >= 25 && avgDays <= 38) return 'monthly';
  if (avgDays >= 80 && avgDays <= 110) return 'quarterly';
  if (avgDays >= 340 && avgDays <= 400) return 'annual';

  return null;
}

function computeNextDate(lastDate: Date, frequency: string): Date {
  const next = new Date(lastDate);
  switch (frequency) {
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'biweekly': next.setDate(next.getDate() + 14); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
    case 'annual': next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount * 4.33;
    case 'biweekly': return amount * 2.17;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'annual': return amount / 12;
    default: return amount;
  }
}
