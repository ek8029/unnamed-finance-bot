import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface InsightCandidate {
  insight_type: 'spending' | 'portfolio' | 'market' | 'tax' | 'credit';
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

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user data needed for analysis
    const [
      accountsRes,
      holdingsRes,
      recentTxRes,
      prevMonthTxRes,
      existingInsightsRes,
    ] = await Promise.all([
      supabase
        .from('linked_accounts')
        .select('id, account_type, current_balance, account_name')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('holdings')
        .select('id, ticker, total_value, total_cost_basis, unrealised_gain_loss, shares, current_price')
        .eq('user_id', user.id),
      // Current month transactions
      supabase
        .from('transactions')
        .select('id, amount, category_name, merchant_name, description, transaction_date')
        .eq('user_id', user.id)
        .gte('transaction_date', getMonthStart(0))
        .lte('transaction_date', getMonthEnd(0)),
      // Previous month transactions
      supabase
        .from('transactions')
        .select('id, amount, category_name, merchant_name, description, transaction_date')
        .eq('user_id', user.id)
        .gte('transaction_date', getMonthStart(-1))
        .lte('transaction_date', getMonthEnd(-1)),
      // Recent insights (including dismissed/archived) to avoid duplicates
      supabase
        .from('insights')
        .select('title, created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const accounts = accountsRes.data || [];
    const holdings = holdingsRes.data || [];
    const currentTx = recentTxRes.data || [];
    const prevTx = prevMonthTxRes.data || [];
    const existingTitles = new Set((existingInsightsRes.data || []).map(i => i.title));

    const candidates: InsightCandidate[] = [];

    // --- RULE 1: Spending spikes by category ---
    const currentSpending = groupSpending(currentTx);
    const prevSpending = groupSpending(prevTx);

    for (const [category, currentAmt] of Object.entries(currentSpending)) {
      const prevAmt = prevSpending[category] || 0;
      if (prevAmt > 0 && currentAmt > prevAmt * 1.3 && currentAmt - prevAmt > 50) {
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

    // --- RULE 2: Portfolio concentration ---
    const totalPortfolio = holdings.reduce((s, h) => s + Number(h.total_value), 0);
    if (totalPortfolio > 0) {
      for (const h of holdings) {
        const weight = Number(h.total_value) / totalPortfolio;
        if (weight > 0.25 && holdings.length > 1) {
          candidates.push({
            insight_type: 'portfolio',
            priority: weight > 0.5 ? 'high' : 'medium',
            title: `${h.ticker} is ${Math.round(weight * 100)}% of your portfolio`,
            description: `A single position making up more than 25% of your portfolio increases risk. ${h.ticker} currently represents $${Number(h.total_value).toLocaleString()} of your $${totalPortfolio.toLocaleString()} portfolio.`,
            recommended_action: `Consider diversifying by reducing your ${h.ticker} position or adding to other holdings.`,
            confidence_score: 0.95,
            source_type: 'rule_based',
            related_entity_type: 'holding',
            related_entity_ids: [h.id],
          });
        }
      }
    }

    // --- RULE 3: Unrealized losses (tax-loss harvesting) ---
    const losers = holdings.filter(h =>
      h.unrealised_gain_loss && Number(h.unrealised_gain_loss) < -100
    );
    if (losers.length > 0) {
      const totalLoss = losers.reduce((s, h) => s + Math.abs(Number(h.unrealised_gain_loss)), 0);
      const tickers = losers.map(h => h.ticker).join(', ');
      candidates.push({
        insight_type: 'tax',
        priority: totalLoss > 1000 ? 'high' : 'medium',
        title: `$${totalLoss.toLocaleString()} tax-loss harvesting opportunity`,
        description: `You have unrealized losses in ${tickers} that could offset capital gains and reduce your tax bill by up to $${Math.round(totalLoss * 0.25).toLocaleString()}.`,
        recommended_action: `Review selling ${tickers} to harvest losses, then reinvest in similar but not "substantially identical" assets to maintain exposure.`,
        estimated_impact_amount: Math.round(totalLoss * 0.25),
        confidence_score: 0.85,
        source_type: 'rule_based',
        related_entity_type: 'holding',
        related_entity_ids: losers.map(h => h.id),
      });
    }

    // --- RULE 4: Idle cash detection ---
    const cashAccounts = accounts.filter(a =>
      (a.account_type === 'checking' || a.account_type === 'savings') &&
      Number(a.current_balance) > 0
    );
    const totalCash = cashAccounts.reduce((s, a) => s + Number(a.current_balance), 0);
    const monthlyExpenses = currentTx
      .filter(t => Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    // If more than 6 months expenses sitting in cash
    if (monthlyExpenses > 0 && totalCash > monthlyExpenses * 6) {
      const excess = totalCash - (monthlyExpenses * 6);
      candidates.push({
        insight_type: 'spending',
        priority: excess > 10000 ? 'high' : 'medium',
        title: `$${excess.toLocaleString()} idle cash could be working harder`,
        description: `You have $${totalCash.toLocaleString()} in cash accounts — about ${Math.round(totalCash / monthlyExpenses)} months of expenses. After keeping a 6-month emergency fund ($${Math.round(monthlyExpenses * 6).toLocaleString()}), $${excess.toLocaleString()} could earn more in a high-yield savings account or short-term investments.`,
        recommended_action: `Consider moving excess cash to a high-yield savings account (currently ~4-5% APY) or short-term Treasury bills.`,
        estimated_impact_amount: Math.round(excess * 0.045),
        confidence_score: 0.8,
        source_type: 'rule_based',
      });
    }

    // --- RULE 5: High credit utilization ---
    const creditCards = accounts.filter(a => a.account_type === 'credit_card');
    for (const card of creditCards) {
      const balance = Math.abs(Number(card.current_balance));
      // We don't have credit limits in this query, but flag high balances
      if (balance > 5000) {
        candidates.push({
          insight_type: 'credit',
          priority: balance > 10000 ? 'high' : 'medium',
          title: `${card.account_name} balance is $${balance.toLocaleString()}`,
          description: `Carrying a high credit card balance incurs significant interest charges. At a typical 24% APR, this costs roughly $${Math.round(balance * 0.24 / 12).toLocaleString()}/month in interest.`,
          recommended_action: `Prioritize paying down this balance. Consider a balance transfer to a 0% APR card if available.`,
          estimated_impact_amount: Math.round(balance * 0.24),
          confidence_score: 0.85,
          source_type: 'rule_based',
          related_entity_type: 'account',
          related_entity_ids: [card.id],
        });
      }
    }

    // --- RULE 6: Unusual large transactions ---
    for (const t of currentTx) {
      const amt = Math.abs(Number(t.amount));
      if (amt > 500 && Number(t.amount) < 0) {
        // Check if this is unusual for this merchant
        const merchantTx = [...currentTx, ...prevTx].filter(
          tx => tx.merchant_name === t.merchant_name && tx.id !== t.id
        );
        const avgMerchant = merchantTx.length > 0
          ? merchantTx.reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0) / merchantTx.length
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

    // --- RULE 7: Positive savings rate recognition ---
    if (monthlyExpenses > 0) {
      const monthlyIncome = currentTx
        .filter(t => Number(t.amount) > 0)
        .reduce((s, t) => s + Number(t.amount), 0);
      const savingsRate = monthlyIncome > 0 ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0;

      if (savingsRate > 0.3) {
        candidates.push({
          insight_type: 'spending',
          priority: 'low',
          title: `Strong savings rate: ${Math.round(savingsRate * 100)}%`,
          description: `You're saving ${Math.round(savingsRate * 100)}% of your income this month — well above the recommended 20%. Keep it up.`,
          confidence_score: 0.95,
          source_type: 'rule_based',
        });
      }
    }

    // Filter out duplicates (same title as existing recent insights)
    const newInsights = candidates.filter(c => !existingTitles.has(c.title));

    // Insert new insights
    if (newInsights.length > 0) {
      const inserts = newInsights.map(insight => ({
        user_id: user.id,
        ...insight,
      }));

      const { error: insertError } = await supabase
        .from('insights')
        .insert(inserts);

      if (insertError) {
        console.error('Error inserting insights:', insertError);
        return NextResponse.json({ error: 'Failed to save insights' }, { status: 500 });
      }
    }

    // Clean up expired insights
    await supabase
      .from('insights')
      .update({ is_dismissed: true })
      .eq('user_id', user.id)
      .lt('expires_at', new Date().toISOString())
      .eq('is_dismissed', false);

    return NextResponse.json({
      success: true,
      generated: newInsights.length,
      skipped_duplicates: candidates.length - newInsights.length,
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- Helper functions ---

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

function groupSpending(
  transactions: { amount: number; category_name: string | null }[]
): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const t of transactions) {
    const amt = Number(t.amount);
    if (amt >= 0) continue; // Only expenses
    const cat = t.category_name || 'uncategorized';
    groups[cat] = (groups[cat] || 0) + Math.abs(amt);
  }
  return groups;
}

function formatCategoryName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/AND/g, '&')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
