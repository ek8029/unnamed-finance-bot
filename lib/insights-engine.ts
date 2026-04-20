import {
  TAX_RATE,
  TAX_INSIGHT_HIGH_PRIORITY_LOSS,
  CONCENTRATION_THRESHOLDS,
  SPENDING_SPIKE_FACTOR,
  SPENDING_SPIKE_MIN_DOLLARS,
  CREDIT_CARD_ALERT_THRESHOLD,
  CREDIT_CARD_APR,
  HYSA_APY,
  IDLE_CASH_MONTHS,
  IDLE_CASH_HIGH_PRIORITY,
  STRONG_SAVINGS_RATE,
  ANNUAL_LOSS_DEDUCTION_CAP,
} from '@/lib/financial-config';
import { formatCategoryName } from '@/lib/utils';
import { detectRecurringCharges, persistRecurringCharges, toMonthlyAmount } from '@/lib/recurring-detection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

interface InsightCandidate {
  insight_type: 'spending' | 'portfolio' | 'market' | 'tax' | 'credit' | 'subscription';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommended_action?: string;
  explanation?: string;
  estimated_impact_amount?: number;
  confidence_score?: number;
  source_type: 'rule_based';
  related_entity_type?: string;
  related_entity_ids?: string[];
}

function normalizeInsightTitle(title: string): string {
  return title
    .replace(/\$[\d,]+(\.\d+)?/g, '$X')
    .replace(/\d+(\.\d+)?%/g, 'X%');
}

function groupSpending(
  transactions: { amount: number; category_name: string | null }[],
): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const t of transactions) {
    const amt = Number(t.amount);
    if (amt >= 0) continue;
    const cat = t.category_name || 'uncategorized';
    groups[cat] = (groups[cat] || 0) + Math.abs(amt);
  }
  return groups;
}

function getMonthStart(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().split('T')[0];
}

function getMonthEnd(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return d.toISOString().split('T')[0];
}

export async function generateInsights(
  supabase: AnyClient,
  userId: string,
): Promise<number> {
  try {
    const [accountsRes, holdingsRes, currentTxRes, prevTxRes, existingInsightsRes] =
      await Promise.all([
        supabase
          .from('linked_accounts')
          .select('id, account_type, current_balance, account_name')
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('holdings')
          .select(
            'id, ticker, total_value, total_cost_basis, unrealised_gain_loss, shares, current_price',
          )
          .eq('user_id', userId),
        supabase
          .from('transactions')
          .select('id, amount, category_name, merchant_name, description, transaction_date')
          .eq('user_id', userId)
          .gte('transaction_date', getMonthStart(0))
          .lte('transaction_date', getMonthEnd(0)),
        supabase
          .from('transactions')
          .select('id, amount, category_name, merchant_name, description, transaction_date')
          .eq('user_id', userId)
          .gte('transaction_date', getMonthStart(-1))
          .lte('transaction_date', getMonthEnd(-1)),
        supabase
          .from('insights')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .eq('is_dismissed', false)
          .eq('is_archived', false)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

    const accounts = accountsRes.data || [];
    const holdings = holdingsRes.data || [];
    const currentTx = currentTxRes.data || [];
    const prevTx = prevTxRes.data || [];

    const existingByNorm = new Map<string, string[]>();
    for (const i of (existingInsightsRes.data || []) as { id: string; title: string }[]) {
      const norm = normalizeInsightTitle(i.title);
      if (!existingByNorm.has(norm)) existingByNorm.set(norm, []);
      existingByNorm.get(norm)!.push(i.id);
    }

    const candidates: InsightCandidate[] = [];

    // Rule 1: Spending spikes by category
    const currentSpending = groupSpending(currentTx);
    const prevSpending = groupSpending(prevTx);

    for (const [category, currentAmt] of Object.entries(currentSpending)) {
      const prevAmt = prevSpending[category] || 0;
      if (prevAmt > 0 && currentAmt > prevAmt * SPENDING_SPIKE_FACTOR && currentAmt - prevAmt > SPENDING_SPIKE_MIN_DOLLARS) {
        const increase = Math.round(((currentAmt - prevAmt) / prevAmt) * 100);
        const displayName = formatCategoryName(category);
        candidates.push({
          insight_type: 'spending',
          priority: increase > 100 ? 'high' : 'medium',
          title: `${displayName} spending up ${increase}%`,
          description: `You've spent $${currentAmt.toFixed(0)} on ${displayName.toLowerCase()} this month, up from $${prevAmt.toFixed(0)} last month.`,
          recommended_action: `Review your recent ${displayName.toLowerCase()} transactions to identify any unexpected charges.`,
          estimated_impact_amount: currentAmt - prevAmt,
          confidence_score: 0.9,
          source_type: 'rule_based',
        });
      }
    }

    // Rule 2: Portfolio concentration
    const totalPortfolio = holdings.reduce(
      (s: number, h: { total_value: number }) => s + Number(h.total_value), 0,
    );
    if (totalPortfolio > 0) {
      for (const h of holdings) {
        const weight = Number(h.total_value) / totalPortfolio;
        if (weight > CONCENTRATION_THRESHOLDS.critical / 100 && holdings.length > 1) {
          candidates.push({
            insight_type: 'portfolio',
            priority: weight > 0.5 ? 'high' : 'medium',
            title: `${h.ticker} is ${Math.round(weight * 100)}% of your portfolio`,
            description: `A single position making up more than ${CONCENTRATION_THRESHOLDS.critical}% of your portfolio increases risk. ${h.ticker} currently represents $${Number(h.total_value).toLocaleString()} of your $${totalPortfolio.toLocaleString()} portfolio.`,
            recommended_action: `Consider diversifying by reducing your ${h.ticker} position or adding to other holdings.`,
            confidence_score: 0.95,
            source_type: 'rule_based',
            related_entity_type: 'holding',
            related_entity_ids: [h.id],
          });
        }
      }
    }

    // Rule 3: Tax-loss harvesting (with $3,000 annual cap per IRC §1211(b))
    const losers = holdings.filter(
      (h: { unrealised_gain_loss: number | null }) =>
        h.unrealised_gain_loss != null && Number(h.unrealised_gain_loss) < 0,
    );
    if (losers.length > 0) {
      const totalLoss = losers.reduce(
        (s: number, h: { unrealised_gain_loss: number }) =>
          s + Math.abs(Number(h.unrealised_gain_loss)),
        0,
      );
      // Cap the deductible amount at $3,000 against ordinary income per IRC §1211(b).
      // Losses first offset capital gains dollar-for-dollar (no limit), then up to
      // $3,000 of ordinary income. Excess carries forward per IRC §1212(b).
      const ANNUAL_CAP = ANNUAL_LOSS_DEDUCTION_CAP;
      const deductibleThisYear = Math.min(totalLoss, ANNUAL_CAP);
      const estimatedSavings = Math.round(deductibleThisYear * TAX_RATE);
      const carryforward = Math.max(0, totalLoss - ANNUAL_CAP);
      const tickers = losers.map((h: { ticker: string }) => h.ticker).join(', ');

      let description = `You have $${totalLoss.toLocaleString()} in unrealized losses across ${tickers}.`;
      if (totalLoss > ANNUAL_CAP) {
        description += ` Up to $${ANNUAL_CAP.toLocaleString()} can offset ordinary income this year (IRC §1211(b)), ` +
          `saving an estimated $${estimatedSavings.toLocaleString()} at your ${(TAX_RATE * 100).toFixed(0)}% rate. ` +
          `The remaining $${carryforward.toLocaleString()} carries forward to future years.`;
      } else {
        description += ` This could save an estimated $${estimatedSavings.toLocaleString()} at your ${(TAX_RATE * 100).toFixed(0)}% combined rate.`;
      }

      candidates.push({
        insight_type: 'tax',
        priority: totalLoss > TAX_INSIGHT_HIGH_PRIORITY_LOSS ? 'high' : 'medium',
        title: `$${estimatedSavings.toLocaleString()} in potential tax savings`,
        description,
        recommended_action: `Review selling ${tickers} to harvest losses, then reinvest in similar but not "substantially identical" assets to maintain exposure. ` +
          `Important: do NOT repurchase the same security within 30 days or you will trigger a wash sale (IRC §1091). ` +
          `This is not tax advice — consult a qualified tax professional before acting.`,
        estimated_impact_amount: estimatedSavings,
        confidence_score: 0.85,
        source_type: 'rule_based',
        related_entity_type: 'holding',
        related_entity_ids: losers.map((h: { id: string }) => h.id),
      });
    }

    // Rule 4: Idle cash detection
    const cashAccounts = accounts.filter(
      (a: { account_type: string; current_balance: number }) =>
        (a.account_type === 'checking' || a.account_type === 'savings') &&
        Number(a.current_balance) > 0,
    );
    const totalCash = cashAccounts.reduce(
      (s: number, a: { current_balance: number }) => s + Number(a.current_balance), 0,
    );
    const monthlyExpenses = currentTx
      .filter((t: { amount: number }) => Number(t.amount) < 0)
      .reduce((s: number, t: { amount: number }) => s + Math.abs(Number(t.amount)), 0);

    if (monthlyExpenses > 0 && totalCash > monthlyExpenses * IDLE_CASH_MONTHS) {
      const excess = totalCash - monthlyExpenses * IDLE_CASH_MONTHS;
      candidates.push({
        insight_type: 'spending',
        priority: excess > IDLE_CASH_HIGH_PRIORITY ? 'high' : 'medium',
        title: `$${excess.toLocaleString()} idle cash could be working harder`,
        description: `You have $${totalCash.toLocaleString()} in cash accounts - about ${Math.round(totalCash / monthlyExpenses)} months of expenses. After keeping a ${IDLE_CASH_MONTHS}-month emergency fund ($${Math.round(monthlyExpenses * IDLE_CASH_MONTHS).toLocaleString()}), $${excess.toLocaleString()} could earn more in a high-yield savings account or short-term investments.`,
        recommended_action: `Consider moving excess cash to a high-yield savings account or short-term Treasury bills.`,
        estimated_impact_amount: Math.round(excess * HYSA_APY),
        confidence_score: 0.8,
        source_type: 'rule_based',
      });
    }

    // Rule 5: High credit card balances
    const creditCards = accounts.filter(
      (a: { account_type: string }) => a.account_type === 'credit_card',
    );
    for (const card of creditCards) {
      const balance = Math.abs(Number(card.current_balance));
      if (balance > CREDIT_CARD_ALERT_THRESHOLD) {
        candidates.push({
          insight_type: 'credit',
          priority: balance > CREDIT_CARD_ALERT_THRESHOLD * 2 ? 'high' : 'medium',
          title: `${card.account_name} balance is $${balance.toLocaleString()}`,
          description: `Carrying a high credit card balance incurs significant interest charges. At a typical ${(CREDIT_CARD_APR * 100).toFixed(0)}% APR, this costs roughly $${Math.round(balance * CREDIT_CARD_APR / 12).toLocaleString()}/month in interest.`,
          recommended_action: `Prioritize paying down this balance. Consider a balance transfer to a 0% APR card if available.`,
          estimated_impact_amount: Math.round(balance * CREDIT_CARD_APR),
          confidence_score: 0.85,
          source_type: 'rule_based',
          related_entity_type: 'account',
          related_entity_ids: [card.id],
        });
      }
    }

    // Rule 6: Unusual large transactions
    for (const t of currentTx) {
      const amt = Math.abs(Number(t.amount));
      if (amt > 500 && Number(t.amount) < 0) {
        const merchantTx = [...currentTx, ...prevTx].filter(
          (tx: { merchant_name: string | null; id: string }) =>
            tx.merchant_name === t.merchant_name && tx.id !== t.id,
        );
        const avgMerchant = merchantTx.length > 0
          ? merchantTx.reduce((s: number, tx: { amount: number }) => s + Math.abs(Number(tx.amount)), 0) / merchantTx.length
          : 0;

        if (merchantTx.length > 0 && amt > avgMerchant * 2.5) {
          candidates.push({
            insight_type: 'spending',
            priority: 'medium',
            title: `Unusual charge: $${amt.toFixed(0)} at ${t.merchant_name || t.description}`,
            description: `This transaction is ${Math.round(amt / avgMerchant)}x your typical spend at ${t.merchant_name || t.description} (usually ~$${avgMerchant.toFixed(0)}).`,
            recommended_action: `Verify this charge is legitimate. If unexpected, contact your bank.`,
            confidence_score: 0.7,
            source_type: 'rule_based',
            related_entity_type: 'transaction',
            related_entity_ids: [t.id],
          });
        }
      }
    }

    // Rule 7: Strong savings rate recognition
    if (monthlyExpenses > 0) {
      const monthlyIncome = currentTx
        .filter((t: { amount: number }) => Number(t.amount) > 0)
        .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
      const savingsRate = monthlyIncome > 0 ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0;

      if (savingsRate > STRONG_SAVINGS_RATE) {
        candidates.push({
          insight_type: 'spending',
          priority: 'low',
          title: `Strong savings rate: ${Math.round(savingsRate * 100)}%`,
          description: `You're saving ${Math.round(savingsRate * 100)}% of your income this month - well above the recommended 20%. Keep it up.`,
          confidence_score: 0.95,
          source_type: 'rule_based',
        });
      }
    }

    // Rule 8: Recurring charge / subscription insights
    try {
      const recurringCharges = await detectRecurringCharges(supabase, userId);

      if (recurringCharges.length > 0) {
        // Persist detected charges to recurring_transactions table
        await persistRecurringCharges(supabase, userId, recurringCharges);
      }

      for (const charge of recurringCharges) {
        // 8a: Price increase alert
        if (charge.price_increased && charge.previous_amount !== null) {
          candidates.push({
            insight_type: 'subscription',
            priority: 'medium',
            title: `${charge.merchant_name} raised from $${charge.previous_amount.toFixed(2)} to $${charge.latest_amount.toFixed(2)}`,
            description: `${charge.merchant_name} increased by ${charge.price_change_pct}% — from $${charge.previous_amount.toFixed(2)} to $${charge.latest_amount.toFixed(2)} per ${charge.frequency === 'biweekly' ? 'cycle' : charge.frequency.replace('ly', '')}. This adds ~$${(toMonthlyAmount(charge.latest_amount - charge.previous_amount, charge.frequency) * 12).toFixed(0)}/year to your recurring costs.`,
            recommended_action: `Review whether ${charge.merchant_name} still provides enough value at the new price, or consider alternatives.`,
            estimated_impact_amount: Math.round(toMonthlyAmount(charge.latest_amount - charge.previous_amount, charge.frequency) * 12),
            confidence_score: 0.85,
            source_type: 'rule_based',
          });
        }

        // 8b: New recurring charge detected (exactly 2 occurrences = just confirmed as recurring)
        if (charge.is_new) {
          candidates.push({
            insight_type: 'subscription',
            priority: 'low',
            title: `New ${charge.frequency} charge: $${charge.average_amount.toFixed(2)} to ${charge.merchant_name}`,
            description: `A new ${charge.frequency} charge of $${charge.average_amount.toFixed(2)} to ${charge.merchant_name} has been detected. That's ~$${(toMonthlyAmount(charge.average_amount, charge.frequency) * 12).toFixed(0)}/year.`,
            recommended_action: `Verify this is a subscription you intended to keep.`,
            estimated_impact_amount: Math.round(toMonthlyAmount(charge.average_amount, charge.frequency) * 12),
            confidence_score: 0.75,
            source_type: 'rule_based',
          });
        }

        // 8c: Upcoming large recurring charge (annual/quarterly, amount > $50, due within 7 days)
        const nextDate = new Date(charge.next_expected_date);
        const today = new Date();
        const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (
          daysUntil >= 0 &&
          daysUntil <= 7 &&
          charge.average_amount > 50 &&
          (charge.frequency === 'annual' || charge.frequency === 'quarterly')
        ) {
          candidates.push({
            insight_type: 'subscription',
            priority: 'medium',
            title: `${charge.frequency === 'annual' ? 'Annual' : 'Quarterly'} charge of $${charge.average_amount.toFixed(0)} from ${charge.merchant_name} expected ${daysUntil === 0 ? 'today' : `in ~${daysUntil} day${daysUntil === 1 ? '' : 's'}`}`,
            description: `Your ${charge.frequency} charge of $${charge.average_amount.toFixed(2)} from ${charge.merchant_name} is expected ${daysUntil === 0 ? 'today' : `in approximately ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}. Make sure the funds are available.`,
            recommended_action: `Review whether you still need ${charge.merchant_name}. If not, cancel before the charge hits.`,
            estimated_impact_amount: Math.round(charge.average_amount),
            confidence_score: 0.8,
            source_type: 'rule_based',
          });
        }
      }
    } catch (recurringError) {
      console.error('[insights-engine] Rule 8 (recurring detection) error:', recurringError);
      // Non-fatal: other rules still produce insights
    }

    const newInsights: InsightCandidate[] = [];
    const staleIds: string[] = [];

    for (const c of candidates) {
      const norm = normalizeInsightTitle(c.title);
      const existingIds = existingByNorm.get(norm);
      if (!existingIds || existingIds.length === 0) {
        newInsights.push(c);
        existingByNorm.set(norm, []);
      } else {
        staleIds.push(...existingIds);
        newInsights.push(c);
        existingByNorm.set(norm, []);
      }
    }

    if (staleIds.length > 0) {
      await supabase
        .from('insights')
        .update({ is_dismissed: true })
        .in('id', staleIds)
        .eq('user_id', userId);
    }

    if (newInsights.length > 0) {
      const inserts = newInsights.map(insight => ({
        user_id: userId,
        ...insight,
      }));

      const { error: insertError } = await supabase.from('insights').insert(inserts);

      if (insertError) {
        console.error('[insights-engine] Error inserting insights:', insertError);
        return 0;
      }
    }

    await supabase
      .from('insights')
      .update({ is_dismissed: true })
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())
      .eq('is_dismissed', false);

    return newInsights.length;
  } catch (error) {
    console.error(`[insights-engine] Error generating insights for ${userId}:`, error);
    return 0;
  }
}
