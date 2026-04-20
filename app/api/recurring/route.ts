import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  detectRecurringCharges,
  persistRecurringCharges,
  toMonthlyAmount,
} from '@/lib/recurring-detection';

/**
 * GET /api/recurring
 * Returns persisted recurring transactions for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`recurring-get:${user.id}`, 30, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    const { data: recurring, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('average_amount', { ascending: true });

    if (error) {
      console.error('[recurring] Error fetching:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recurring transactions' },
        { status: 500 },
      );
    }

    const items = (recurring || []).map((r: {
      id: string;
      merchant_name: string;
      description: string;
      average_amount: number;
      frequency: string;
      category_name: string | null;
      last_date: string;
      next_expected_date: string;
      occurrence_count: number;
      is_subscription: boolean;
      price_change_pct: number | null;
    }) => ({
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
      priceChangePct: r.price_change_pct !== null ? Number(r.price_change_pct) : null,
    }));

    const monthlyTotal = items.reduce((sum: number, r: { amount: number; frequency: string }) => {
      return sum + toMonthlyAmount(r.amount, r.frequency as Parameters<typeof toMonthlyAmount>[1]);
    }, 0);

    return NextResponse.json({
      recurring: items,
      summary: {
        count: items.length,
        monthlyTotal: Math.round(monthlyTotal * 100) / 100,
        annualTotal: Math.round(monthlyTotal * 12 * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[recurring] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/recurring
 * Run the detection algorithm on the user's transaction history.
 * Clears stale entries and persists newly detected recurring charges.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`recurring-detect:${user.id}`, 5, 600);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    // Mark all existing detections as inactive before re-detecting
    await supabase
      .from('recurring_transactions')
      .update({ is_active: false })
      .eq('user_id', user.id);

    const charges = await detectRecurringCharges(supabase, user.id);
    const persisted = await persistRecurringCharges(supabase, user.id, charges);

    return NextResponse.json({
      success: true,
      detected: charges.length,
      persisted,
    });
  } catch (error) {
    console.error('[recurring] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
