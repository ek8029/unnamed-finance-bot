import { computePortfolioLookthrough } from '@/lib/etf-holdings';
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
import { estimateCappedTlhSavings } from '@/lib/tax-analysis';
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
        // All open insights (any age): the supersede must catch stale duplicates of any
        // age, else normalized-title pile-ups (e.g. TLH cards whose $ amount drifts each
        // run) accumulate once they age past a time window.
        supabase
          .from('insights')
          .select('id, title')
          .eq('user_id', userId)
          .eq('is_dismissed', false)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
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

    // Collapse pre-existing duplicates of one normalized title (orphan pile-ups left by
    // earlier runs before this dedup was fixed): keep the newest, dismiss the rest.
    const orphanStaleIds: string[] = [];
    for (const [norm, ids] of existingByNorm) {
      if (ids.length > 1) {
        orphanStaleIds.push(...ids.slice(1));
        existingByNorm.set(norm, [ids[0]]);
      }
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

    // Rule 2: Portfolio concentration (with ETF look-through)
    const totalPortfolio = holdings.reduce(
      (s: number, h: { total_value: number }) => s + Number(h.total_value), 0,
    );
    if (totalPortfolio > 0) {
      // Compute look-through: aggregate direct + indirect exposure via ETFs/leveraged products
      const lookthrough = computePortfolioLookthrough(
        holdings.map((h: { ticker: string; total_value: number }) => ({ ticker: h.ticker, totalValue: Number(h.total_value) })),
        totalPortfolio,
      );

      // Check direct holdings (original behavior)
      for (const h of holdings) {
        const directWeight = Number(h.total_value) / totalPortfolio;
        const ltEntry = lookthrough.get(h.ticker.toUpperCase());
        const totalWeight = ltEntry ? ltEntry.totalWeight / 100 : directWeight;
        const hasIndirect = ltEntry && ltEntry.indirectWeight > 0;

        if (totalWeight > CONCENTRATION_THRESHOLDS.critical / 100 && holdings.length > 1) {
          const pctDisplay = Math.round(totalWeight * 100);
          const sources = hasIndirect ? ` (${ltEntry.sources.join(', ')})` : '';
          candidates.push({
            insight_type: 'portfolio',
            priority: totalWeight > 0.5 ? 'high' : 'medium',
            title: `${h.ticker} is ${pctDisplay}% of your portfolio${hasIndirect ? ' (including ETF exposure)' : ''}`,
            description: hasIndirect
              ? `Your total ${h.ticker} exposure is ${pctDisplay}% when including indirect holdings through ETFs and leveraged products${sources}. Direct position: $${Number(h.total_value).toLocaleString()}.`
              : `A single position making up more than ${CONCENTRATION_THRESHOLDS.critical}% of your portfolio increases risk. ${h.ticker} currently represents $${Number(h.total_value).toLocaleString()} of your $${totalPortfolio.toLocaleString()} portfolio.`,
            recommended_action: `Single-position concentration above ${CONCENTRATION_THRESHOLDS.critical}% increases idiosyncratic risk. This ${h.ticker} figure of ${pctDisplay}%${hasIndirect ? ' reflects combined direct and ETF holdings' : ''} is above that level.`,
            confidence_score: 0.95,
            source_type: 'rule_based',
            related_entity_type: 'holding',
            related_entity_ids: [h.id],
          });
        }
      }

      // Check for hidden concentration: stocks only exposed via ETFs (not held directly)
      for (const [ticker, entry] of lookthrough) {
        const isDirectlyHeld = holdings.some((h: { ticker: string }) => h.ticker.toUpperCase() === ticker);
        if (!isDirectlyHeld && entry.totalWeight > CONCENTRATION_THRESHOLDS.critical) {
          candidates.push({
            insight_type: 'portfolio',
            priority: entry.totalWeight > 40 ? 'high' : 'medium',
            title: `Hidden ${ticker} exposure: ${Math.round(entry.totalWeight)}% via ETFs`,
            description: `You don't hold ${ticker} directly, but your ETF holdings give you ${Math.round(entry.totalWeight)}% effective exposure through ${entry.sources.join(', ')}.`,
            recommended_action: `Combined ETF holdings give ${Math.round(entry.totalWeight)}% effective ${ticker} exposure through ${entry.sources.join(', ')}, above the ${CONCENTRATION_THRESHOLDS.critical}% single-name concentration threshold.`,
            confidence_score: 0.90,
            source_type: 'rule_based',
            related_entity_type: 'holding',
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
      // ONE TLH formula everywhere: the capped math from tax-analysis (gains
      // offset dollar-for-dollar + $3,000 ordinary-income cap, IRC §1211(b)).
      // This headline previously used uncapped loss × rate and disagreed with
      // the brief and the tax center for the same user.
      const { data: ytdGains } = await supabase
        .from('capital_gains')
        .select('gain_loss')
        .eq('user_id', userId)
        .eq('tax_year', new Date().getFullYear())
        .eq('transaction_type', 'sell');
      const ytdNetRealized = (ytdGains ?? []).reduce(
        (s: number, g: { gain_loss: number | null }) => s + Number(g.gain_loss || 0),
        0,
      );
      const capped = estimateCappedTlhSavings({ totalLoss, ytdNetRealized, taxRate: TAX_RATE });
      const estimatedSavings = Math.round(capped.cappedSavings);
      const carryforward = Math.round(capped.estimatedCarryforward);
      const tickers = losers.map((h: { ticker: string }) => h.ticker).join(', ');

      let description = `You have $${totalLoss.toLocaleString()} in unrealized losses across ${tickers}.`;
      description += ` Applied against this year's realized gains plus the $${ANNUAL_LOSS_DEDUCTION_CAP.toLocaleString()} income deduction (IRC §1211(b)), ` +
        `that is an estimated $${estimatedSavings.toLocaleString()} in offsettable tax at a ${(TAX_RATE * 100).toFixed(0)}% rate.`;
      if (carryforward > 0) {
        description += ` About $${carryforward.toLocaleString()} would carry forward to future years.`;
      }

      candidates.push({
        insight_type: 'tax',
        priority: totalLoss > TAX_INSIGHT_HIGH_PRIORITY_LOSS ? 'high' : 'medium',
        title: `$${estimatedSavings.toLocaleString()} in potential tax savings`,
        description,
        recommended_action: `These positions (${tickers}) are at unrealized losses totaling $${totalLoss.toLocaleString()}. ` +
          `Tax-loss harvesting is a strategy investors use to offset gains. ` +
          `Wash-sale rule: repurchasing a substantially identical security within 30 days disallows the loss (IRC §1091). ` +
          `Not tax advice, consult a professional.`,
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
        recommended_action: `$${excess.toLocaleString()} exceeds a ${IDLE_CASH_MONTHS}-month buffer. High-yield savings and short-term Treasuries are options some investors use for idle cash.`,
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
          recommended_action: `At ${(CREDIT_CARD_APR * 100).toFixed(0)}% APR this balance accrues ~$${Math.round(balance * CREDIT_CARD_APR / 12).toLocaleString()}/mo in interest. Balance-transfer cards with introductory 0% APR periods exist.`,
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
    const updates: { id: string; fields: InsightCandidate }[] = [];

    for (const c of candidates) {
      const norm = normalizeInsightTitle(c.title);
      const existingIds = existingByNorm.get(norm);
      if (!existingIds || existingIds.length === 0) {
        newInsights.push(c);
        existingByNorm.set(norm, []);
      } else {
        // Refresh the existing active row in place. Preserves created_at — the true age of
        // the opportunity (e.g. a tax loss harvestable for days) — instead of the old
        // delete+reinsert, which reset the "X min ago" clock on every run. Drop any dupes.
        const [keepId, ...dupeIds] = existingIds;
        updates.push({ id: keepId, fields: c });
        if (dupeIds.length > 0) staleIds.push(...dupeIds);
        existingByNorm.set(norm, []);
      }
    }

    // Hard-delete superseded duplicates rather than marking them dismissed. Insights are
    // regenerated every run, so dismissing piled up hundreds of dead rows per user.
    const allStaleIds = [...new Set([...staleIds, ...orphanStaleIds])];
    if (allStaleIds.length > 0) {
      await supabase
        .from('insights')
        .delete()
        .in('id', allStaleIds)
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

    // Refresh content of insights that persist across runs (amount/description) without
    // touching created_at, so the displayed age stays honest.
    for (const u of updates) {
      const { error: updateError } = await supabase
        .from('insights')
        .update({ ...u.fields })
        .eq('id', u.id)
        .eq('user_id', userId);
      if (updateError) console.error('[insights-engine] Error refreshing insight:', updateError);
    }

    await supabase
      .from('insights')
      .update({ is_dismissed: true })
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())
      .eq('is_dismissed', false);

    return newInsights.length + updates.length;
  } catch (error) {
    console.error(`[insights-engine] Error generating insights for ${userId}:`, error);
    return 0;
  }
}
