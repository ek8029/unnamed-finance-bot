/**
 * Recurring Charge Detection Engine
 *
 * Analyzes 90 days of transaction history to identify recurring charges
 * (subscriptions, memberships, utilities, etc.). Detects frequency,
 * price increases, and forecasts next expected charge dates.
 *
 * Used by:
 *   - POST /api/recurring (detection endpoint)
 *   - lib/insights-engine.ts Rule 8 (subscription insights)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ── Types ──

export interface RecurringCharge {
  merchant_name: string;
  description: string;
  average_amount: number;
  latest_amount: number;
  previous_amount: number | null;
  frequency: RecurringFrequency;
  category_name: string | null;
  last_date: string;
  next_expected_date: string;
  occurrence_count: number;
  price_increased: boolean;
  price_change_pct: number | null;
  is_new: boolean;
}

export type RecurringFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

interface TransactionRow {
  id: string;
  amount: number;
  merchant_name: string | null;
  description: string;
  category_name: string | null;
  transaction_date: string;
}

interface MerchantGroup {
  amounts: number[];
  dates: Date[];
  category: string | null;
  displayName: string;
}

// ── Constants ──

/** Minimum occurrences to consider a charge recurring. */
const MIN_OCCURRENCES = 2;

/** Price increase threshold (5%) to flag as price_increased. */
const PRICE_INCREASE_THRESHOLD = 0.05;

/** Maximum amount variance (25%) to consider charges from the same subscription. */
const AMOUNT_VARIANCE_THRESHOLD = 0.25;

/** Interval consistency tolerance (35%) for frequency detection. */
const INTERVAL_CONSISTENCY_THRESHOLD = 0.35;

/** Frequency detection ranges (in days). */
const FREQUENCY_RANGES: Record<RecurringFrequency, [number, number]> = {
  weekly: [5, 9],
  biweekly: [12, 16],
  monthly: [25, 35],
  quarterly: [80, 110],
  annual: [350, 380],
};

/** Days to add for next-date calculation by frequency. */
const FREQUENCY_OFFSETS: Record<RecurringFrequency, { type: 'days' | 'months' | 'years'; value: number }> = {
  weekly: { type: 'days', value: 7 },
  biweekly: { type: 'days', value: 14 },
  monthly: { type: 'months', value: 1 },
  quarterly: { type: 'months', value: 3 },
  annual: { type: 'years', value: 1 },
};

// ── Public API ──

/**
 * Detect recurring charges from a user's transaction history.
 *
 * Queries the last 90 days of expense transactions, groups by normalized
 * merchant name, identifies periodic patterns, and returns detected
 * recurring charges with price-change analysis.
 */
export async function detectRecurringCharges(
  supabase: AnyClient,
  userId: string,
): Promise<RecurringCharge[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, amount, merchant_name, description, category_name, transaction_date')
    .eq('user_id', userId)
    .gte('transaction_date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('transaction_date', { ascending: true });

  if (error) {
    console.error('[recurring-detection] Error fetching transactions:', error);
    return [];
  }

  if (!transactions || transactions.length === 0) return [];

  // Only analyze expenses (negative amounts)
  const expenses = (transactions as TransactionRow[]).filter(
    (t) => Number(t.amount) < 0,
  );

  const merchantGroups = groupByMerchant(expenses);
  const detected: RecurringCharge[] = [];

  // Track what's new: charges detected for the first time (2 occurrences only)
  for (const [, group] of merchantGroups) {
    if (group.dates.length < MIN_OCCURRENCES) continue;

    const avgAmount =
      group.amounts.reduce((s, a) => s + a, 0) / group.amounts.length;
    if (avgAmount < 1) continue;

    // Check amount consistency (skip if wildly varying and > $5)
    if (avgAmount > 5) {
      const amountConsistent = group.amounts.every(
        (a) => Math.abs(a - avgAmount) / avgAmount < AMOUNT_VARIANCE_THRESHOLD,
      );
      if (!amountConsistent) continue;
    }

    const frequency = detectFrequency(group.dates);
    if (!frequency) continue;

    const sortedDates = [...group.dates].sort((a, b) => a.getTime() - b.getTime());
    const sortedAmounts = sortAmountsByDate(group.amounts, group.dates);

    const latestAmount = sortedAmounts[sortedAmounts.length - 1];
    const previousAmount =
      sortedAmounts.length >= 2 ? sortedAmounts[sortedAmounts.length - 2] : null;

    // Price increase detection
    let priceIncreased = false;
    let priceChangePct: number | null = null;
    if (previousAmount !== null && previousAmount > 0) {
      const changePct = (latestAmount - previousAmount) / previousAmount;
      if (changePct > PRICE_INCREASE_THRESHOLD) {
        priceIncreased = true;
        priceChangePct = Math.round(changePct * 10000) / 100; // e.g. 48.39
      }
    }

    const lastDate = sortedDates[sortedDates.length - 1];
    const nextExpected = computeNextDate(lastDate, frequency);

    detected.push({
      merchant_name: group.displayName,
      description: group.displayName,
      average_amount: Math.round(avgAmount * 100) / 100,
      latest_amount: Math.round(latestAmount * 100) / 100,
      previous_amount: previousAmount !== null ? Math.round(previousAmount * 100) / 100 : null,
      frequency,
      category_name: group.category,
      last_date: lastDate.toISOString().split('T')[0],
      next_expected_date: nextExpected.toISOString().split('T')[0],
      occurrence_count: group.dates.length,
      price_increased: priceIncreased,
      price_change_pct: priceChangePct,
      is_new: group.dates.length === MIN_OCCURRENCES,
    });
  }

  return detected;
}

/**
 * Persist detected recurring charges to the recurring_transactions table.
 * Upserts by (user_id, merchant_name, frequency) to avoid duplicates.
 */
export async function persistRecurringCharges(
  supabase: AnyClient,
  userId: string,
  charges: RecurringCharge[],
): Promise<number> {
  if (charges.length === 0) return 0;

  let persisted = 0;
  for (const charge of charges) {
    const { error } = await supabase
      .from('recurring_transactions')
      .upsert(
        {
          user_id: userId,
          merchant_name: charge.merchant_name,
          description: charge.description,
          average_amount: charge.average_amount,
          frequency: charge.frequency,
          category_name: charge.category_name,
          last_date: charge.last_date,
          next_expected_date: charge.next_expected_date,
          occurrence_count: charge.occurrence_count,
          is_active: true,
          is_subscription: true,
          price_change_pct: charge.price_change_pct,
        },
        { onConflict: 'user_id,merchant_name,frequency' },
      );

    if (error) {
      console.error(
        `[recurring-detection] Error upserting ${charge.merchant_name}:`,
        error,
      );
    } else {
      persisted++;
    }
  }

  return persisted;
}

// ── Internal Helpers ──

/**
 * Normalize merchant name for grouping.
 * Strips numbers, dates, special characters, and collapses whitespace.
 */
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d{2,}/g, '')           // strip sequences of 2+ digits (dates, IDs)
    .replace(/[^a-z\s]/g, '')         // strip non-alpha except spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/** Group expense transactions by normalized merchant name. */
function groupByMerchant(
  transactions: TransactionRow[],
): Map<string, MerchantGroup> {
  const groups = new Map<string, MerchantGroup>();

  for (const t of transactions) {
    const merchant = t.merchant_name || t.description;
    if (!merchant) continue;

    const key = normalizeMerchant(merchant);
    if (!key) continue;

    const amount = Math.abs(Number(t.amount));
    const date = new Date(t.transaction_date);

    const existing = groups.get(key);
    if (existing) {
      existing.amounts.push(amount);
      existing.dates.push(date);
      if (!existing.category && t.category_name) existing.category = t.category_name;
    } else {
      groups.set(key, {
        amounts: [amount],
        dates: [date],
        category: t.category_name,
        displayName: merchant, // preserve original casing from first occurrence
      });
    }
  }

  return groups;
}

/**
 * Detect frequency from a set of transaction dates.
 * Returns null if no consistent periodic pattern is found.
 */
function detectFrequency(dates: Date[]): RecurringFrequency | null {
  if (dates.length < MIN_OCCURRENCES) return null;

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const days = Math.round(
      (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24),
    );
    intervals.push(days);
  }

  if (intervals.length === 0) return null;

  const avgInterval =
    intervals.reduce((s, i) => s + i, 0) / intervals.length;

  // Check consistency: intervals should cluster around the average
  if (intervals.length > 2) {
    const consistent = intervals.every(
      (i) => Math.abs(i - avgInterval) / Math.max(avgInterval, 1) < INTERVAL_CONSISTENCY_THRESHOLD,
    );
    if (!consistent) return null;
  }

  // Match against known frequency ranges
  for (const [freq, [min, max]] of Object.entries(FREQUENCY_RANGES)) {
    if (avgInterval >= min && avgInterval <= max) {
      return freq as RecurringFrequency;
    }
  }

  return null;
}

/** Compute the next expected charge date from the last date and frequency. */
function computeNextDate(lastDate: Date, frequency: RecurringFrequency): Date {
  const next = new Date(lastDate);
  const offset = FREQUENCY_OFFSETS[frequency];

  switch (offset.type) {
    case 'days':
      next.setDate(next.getDate() + offset.value);
      break;
    case 'months':
      next.setMonth(next.getMonth() + offset.value);
      break;
    case 'years':
      next.setFullYear(next.getFullYear() + offset.value);
      break;
  }

  return next;
}

/** Sort amounts by their corresponding dates (ascending). */
function sortAmountsByDate(amounts: number[], dates: Date[]): number[] {
  const pairs = amounts.map((a, i) => ({ amount: a, date: dates[i] }));
  pairs.sort((a, b) => a.date.getTime() - b.date.getTime());
  return pairs.map((p) => p.amount);
}

/**
 * Convert any frequency amount to its monthly equivalent.
 * Useful for calculating total monthly subscription spend.
 */
export function toMonthlyAmount(
  amount: number,
  frequency: RecurringFrequency,
): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'biweekly':
      return amount * 2.17;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'annual':
      return amount / 12;
  }
}
