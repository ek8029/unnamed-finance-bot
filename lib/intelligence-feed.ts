/**
 * Proactive AI Intelligence Feed.
 * Generates daily personalized insights based on portfolio,
 * market events, transactions, and financial data.
 * Results are cached 1 hour per user.
 */

import { createClient } from '@/lib/supabase/server';
import { getPortfolioSummary, type PortfolioSummary } from '@/lib/portfolio-analysis';
import { generateTaxReport } from '@/lib/tax-analysis';
import { generateEarningsReport } from '@/lib/earnings-analysis';
import { SECTOR_CONCENTRATION_THRESHOLD, CACHE_TTL } from '@/lib/financial-config';

// ── Types ──

export interface InsightMetric {
  label: string;
  value: string;
}

export type InsightSource =
  | 'concentration'
  | 'tax'
  | 'earnings'
  | 'cash_flow'
  | 'market'
  | 'performance'
  | 'rebalancing';

// Sources available on the free "basic alerts" tier
export const FREE_INSIGHT_SOURCES: InsightSource[] = ['cash_flow', 'performance'];

export interface FeedInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'info' | 'action';
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  detail: string;
  metrics: InsightMetric[];
  suggestedFollowUp: string;
  source: InsightSource;
  createdAt: string;
}

// ── Cache (1-hour TTL per user) ──

const feedCache = new Map<string, { data: FeedInsight[]; expiry: number }>();
const FEED_CACHE_TTL = CACHE_TTL.intelligenceFeed;

function getCachedFeed(userId: string): FeedInsight[] | null {
  const entry = feedCache.get(userId);
  if (entry && Date.now() < entry.expiry) return entry.data;
  if (entry) feedCache.delete(userId);
  return null;
}

function setCachedFeed(userId: string, data: FeedInsight[]) {
  feedCache.set(userId, { data, expiry: Date.now() + FEED_CACHE_TTL });
}

// ── Helpers ──

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function makeId(): string {
  return `ins_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const timestamp = () => new Date().toISOString();

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const TYPE_ORDER: Record<string, number> = { risk: 0, action: 1, opportunity: 2, info: 3 };

// ═══════════════════════════════════════════
// Insight Generators (each returns 0-3 insights)
// ═══════════════════════════════════════════

// 1. Concentration alerts — positions above threshold
function concentrationAlerts(portfolio: PortfolioSummary): FeedInsight[] {
  const insights: FeedInsight[] = [];

  for (const alert of portfolio.concentrationAlerts.slice(0, 3)) {
    const priority = alert.severity === 'critical' ? 'high' : alert.severity === 'high' ? 'medium' : 'low';
    const trimAmount = alert.totalValue - portfolio.totalValue * (alert.threshold / 100);

    insights.push({
      id: makeId(),
      type: 'risk',
      priority,
      source: 'concentration',
      title: `${alert.ticker} concentration above ${alert.threshold}%`,
      summary: `${alert.ticker} is ${alert.allocationPct.toFixed(1)}% of your portfolio ($${fmt(alert.totalValue)}). A 20% decline in this position equals $${fmt(alert.totalValue * 0.2)}.`,
      detail: `A position this size at ${alert.allocationPct.toFixed(1)}% carries concentrated single-stock risk. A 20% decline in ${alert.ticker} equals $${fmt(alert.totalValue * 0.2)}. The difference between this position and a ${alert.threshold}% allocation is $${fmt(Math.max(0, trimAmount))}.`,
      metrics: [
        { label: 'Allocation', value: `${alert.allocationPct.toFixed(1)}%` },
        { label: 'Position Value', value: `$${fmt(alert.totalValue)}` },
      ],
      suggestedFollowUp: `What is my concentration risk in ${alert.ticker}?`,
      createdAt: timestamp(),
    });
  }

  return insights;
}

// 2. Tax-loss harvesting opportunities
async function taxOpportunities(userId: string): Promise<FeedInsight[]> {
  const report = await generateTaxReport(userId);
  if (report.opportunities.length === 0) return [];

  const insights: FeedInsight[] = [];

  if (report.opportunities.length >= 2) {
    insights.push({
      id: makeId(),
      type: 'opportunity',
      source: 'tax',
      priority: report.totalEstimatedSavings > 500 ? 'high' : 'medium',
      title: `$${fmt(report.totalEstimatedSavings)} in potential tax savings identified`,
      summary: `${report.opportunityCount} positions are at unrealized losses totaling $${fmt(Math.abs(report.totalHarvestableLoss))}. At a ${(report.taxRate * 100).toFixed(0)}% combined rate, that maps to roughly $${fmt(report.totalEstimatedSavings)} in offsettable tax. Not tax advice.`,
      detail: `Tax-loss harvesting is a strategy some investors use to offset realized gains with realized losses. At a ${(report.taxRate * 100).toFixed(0)}% combined rate, $${fmt(Math.abs(report.totalHarvestableLoss))} in losses maps to roughly $${fmt(report.totalEstimatedSavings)}. Not tax advice.`,
      metrics: [
        { label: 'Total Losses', value: `$${fmt(Math.abs(report.totalHarvestableLoss))}` },
        { label: 'Est. Savings', value: `$${fmt(report.totalEstimatedSavings)}` },
      ],
      suggestedFollowUp: `Which of my positions are at an unrealized loss?`,
      createdAt: timestamp(),
    });
  } else {
    const top = report.opportunities[0];
    insights.push({
      id: makeId(),
      type: 'opportunity',
      source: 'tax',
      priority: top.estimatedSavings > 200 ? 'medium' : 'low',
      title: `Unrealized loss flagged: ${top.ticker}`,
      summary: `${top.ticker} is at an unrealized loss of $${fmt(Math.abs(top.unrealizedLoss))} (${top.lossPct.toFixed(1)}% below cost basis). Tax-loss harvesting is a strategy some investors use to offset gains. Not tax advice.`,
      detail: top.replacement
        ? `${top.replacement.ticker} (${top.replacement.name}) is another ${top.sector} security. Some investors use similar-exposure securities to stay invested while realizing a loss.${top.washSaleRisk ? ' Wash sale risk detected on this pairing.' : ''} Not tax advice.`
        : 'No similar-exposure security identified for this position. Not tax advice.',
      metrics: [
        { label: 'Unrealized Loss', value: `$${fmt(Math.abs(top.unrealizedLoss))}` },
        { label: 'Tax Savings', value: `$${fmt(top.estimatedSavings)}` },
      ],
      suggestedFollowUp: `Which of my positions are at an unrealized loss?`,
      createdAt: timestamp(),
    });
  }

  return insights.slice(0, 2);
}

// 3. Earnings preview — upcoming earnings for holdings
async function earningsPreview(userId: string): Promise<FeedInsight[]> {
  const report = await generateEarningsReport(userId);
  const insights: FeedInsight[] = [];

  if (report.upcoming.length > 0) {
    const nextEvent = report.upcoming[0];
    const multiple = report.upcoming.length > 1;

    insights.push({
      id: makeId(),
      type: 'info',
      source: 'earnings',
      priority: nextEvent.position.allocationPct > 10 ? 'high' : 'medium',
      title: multiple
        ? `${report.upcoming.length} holdings report earnings soon`
        : `${nextEvent.ticker} reports earnings ${nextEvent.date}`,
      summary: multiple
        ? `${report.upcoming.map(e => e.ticker).join(', ')} have upcoming earnings. Total exposure: $${fmt(report.totalUpcomingExposure)}.`
        : `${nextEvent.companyName} reports ${nextEvent.time === 'before_open' ? 'before open' : nextEvent.time === 'after_close' ? 'after close' : ''} on ${nextEvent.date}. Your position: $${fmt(nextEvent.position.totalValue)}.`,
      detail: multiple
        ? `Combined exposure: $${fmt(report.totalUpcomingExposure)}. 5% beat scenario: +$${fmt(report.upcoming.reduce((s, e) => s + e.beatImpact5pct, 0))}. 5% miss: -$${fmt(Math.abs(report.upcoming.reduce((s, e) => s + e.missImpact5pct, 0)))}.`
        : `5% beat: +$${fmt(nextEvent.beatImpact5pct)}. 5% miss: -$${fmt(Math.abs(nextEvent.missImpact5pct))}. Consensus EPS: ${nextEvent.epsEstimate != null ? `$${nextEvent.epsEstimate.toFixed(2)}` : 'N/A'}.`,
      metrics: [
        { label: 'Exposure', value: `$${fmt(multiple ? report.totalUpcomingExposure : nextEvent.position.totalValue)}` },
        { label: '5% Beat', value: `+$${fmt(multiple ? report.upcoming.reduce((s, e) => s + e.beatImpact5pct, 0) : nextEvent.beatImpact5pct)}` },
      ],
      suggestedFollowUp: multiple
        ? 'What is my total dollar exposure into upcoming earnings?'
        : `What is my dollar exposure into ${nextEvent.ticker} earnings?`,
      createdAt: timestamp(),
    });
  }

  // Recent notable results
  if (report.recent.length > 0) {
    const notable = report.recent.filter(r => Math.abs(r.surprisePct || 0) > 5);
    if (notable.length > 0) {
      const top = notable[0];
      insights.push({
        id: makeId(),
        type: top.beat ? 'info' : 'risk',
        source: 'earnings',
        priority: Math.abs(top.estimatedImpact) > 500 ? 'medium' : 'low',
        title: `${top.ticker} ${top.beat ? 'beat' : 'missed'} earnings by ${Math.abs(top.surprisePct || 0).toFixed(1)}%`,
        summary: `${top.companyName} reported EPS $${top.epsActual?.toFixed(2)} vs $${top.epsEstimate?.toFixed(2)} expected.`,
        detail: top.actualDollarImpact != null
          ? `Actual impact on your position: ${top.actualDollarImpact >= 0 ? '+' : ''}$${fmt(top.actualDollarImpact)} (${top.actualPostEarningsMove?.toFixed(1)}% move).`
          : `Estimated impact on your $${fmt(top.position.totalValue)} position: ${top.estimatedImpact >= 0 ? '+' : ''}$${fmt(top.estimatedImpact)}.`,
        metrics: [
          { label: 'EPS Surprise', value: `${(top.surprisePct || 0) >= 0 ? '+' : ''}${(top.surprisePct || 0).toFixed(1)}%` },
          { label: 'Impact', value: `${(top.actualDollarImpact ?? top.estimatedImpact) >= 0 ? '+' : '-'}$${fmt(Math.abs(top.actualDollarImpact ?? top.estimatedImpact))}` },
        ],
        suggestedFollowUp: `Analyze ${top.ticker}'s earnings results. What does this mean for my position going forward?`,
        createdAt: timestamp(),
      });
    }
  }

  return insights.slice(0, 2);
}

// 4. Cash flow anomalies — large charges, income deposits
async function cashFlowAnomalies(userId: string): Promise<FeedInsight[]> {
  const supabase = await createClient();
  const insights: FeedInsight[] = [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('amount, description, merchant_name, transaction_date, category_name')
    .eq('user_id', userId)
    .gte('transaction_date', sevenDaysAgo)
    .order('amount', { ascending: true });

  if (!recentTx || recentTx.length === 0) return [];

  // Large expenses (> $500)
  const largeExpenses = recentTx.filter(tx => tx.amount < -500);
  if (largeExpenses.length > 0) {
    const biggest = largeExpenses[0];
    insights.push({
      id: makeId(),
      type: 'info',
      source: 'cash_flow',
      priority: Math.abs(biggest.amount) > 2000 ? 'medium' : 'low',
      title: `Large charge: $${fmt(Math.abs(biggest.amount))}`,
      summary: `${biggest.merchant_name || biggest.description || 'Unknown merchant'} charged $${fmt(Math.abs(biggest.amount))} on ${biggest.transaction_date}.${biggest.category_name ? ` Category: ${biggest.category_name}.` : ''}`,
      detail: largeExpenses.length > 1
        ? `${largeExpenses.length} large transactions (>$500) this week totaling $${fmt(largeExpenses.reduce((s, t) => s + Math.abs(t.amount), 0))}.`
        : 'Review if this charge is expected.',
      metrics: [
        { label: 'Amount', value: `$${fmt(Math.abs(biggest.amount))}` },
        { label: 'Date', value: biggest.transaction_date },
      ],
      suggestedFollowUp: 'Show me my recent large transactions. Am I spending more than usual?',
      createdAt: timestamp(),
    });
  }

  // Income deposits (> $1,000)
  const incomeDeposits = recentTx.filter(tx => tx.amount > 1000);
  if (incomeDeposits.length > 0) {
    const total = incomeDeposits.reduce((s, t) => s + t.amount, 0);
    insights.push({
      id: makeId(),
      type: 'info',
      source: 'cash_flow',
      priority: 'low',
      title: `$${fmt(total)} in deposits this week`,
      summary: `${incomeDeposits.length} deposit${incomeDeposits.length > 1 ? 's' : ''} totaling $${fmt(total)} in the past 7 days.`,
      detail: incomeDeposits.map(d => `${d.merchant_name || d.description || 'Deposit'}: $${fmt(d.amount)}`).join('. '),
      metrics: [
        { label: 'Deposits', value: `${incomeDeposits.length}` },
        { label: 'Total', value: `$${fmt(total)}` },
      ],
      suggestedFollowUp: 'How much uninvested cash is in my accounts?',
      createdAt: timestamp(),
    });
  }

  return insights.slice(0, 2);
}

// 5. Market event impact — sector-level momentum detection
function marketEventImpact(portfolio: PortfolioSummary): FeedInsight[] {
  const insights: FeedInsight[] = [];

  for (const sector of portfolio.sectorExposure) {
    if (sector.sector === 'Unknown') continue;

    const sectorHoldings = sector.holdings
      .map(h => portfolio.holdings.find(ph => ph.ticker === h.ticker))
      .filter(Boolean);

    const withChanges = sectorHoldings.filter(h => h!.dayChangePct != null);
    if (withChanges.length < 2) continue;

    const avgChange = withChanges.reduce((s, h) => s + (h!.dayChangePct! * 100), 0) / withChanges.length;

    if (Math.abs(avgChange) > 2) {
      const dollarImpact = sector.totalValue * (avgChange / 100);
      insights.push({
        id: makeId(),
        type: avgChange < 0 ? 'risk' : 'info',
        source: 'market',
        priority: Math.abs(avgChange) > 3 ? 'medium' : 'low',
        title: `${sector.sector} sector ${avgChange > 0 ? 'rallying' : 'declining'} ${Math.abs(avgChange).toFixed(1)}%`,
        summary: `Your ${sector.sector} holdings (${sector.holdings.map(h => h.ticker).join(', ')}) moved an average of ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}% today. Impact: ${dollarImpact > 0 ? '+' : ''}$${fmt(Math.abs(dollarImpact))}.`,
        detail: `This sector is ${sector.allocationPct.toFixed(1)}% of your portfolio ($${fmt(sector.totalValue)}).`,
        metrics: [
          { label: 'Avg. Move', value: `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%` },
          { label: 'Your Exposure', value: `$${fmt(sector.totalValue)}` },
        ],
        suggestedFollowUp: `Why is the ${sector.sector} sector ${avgChange > 0 ? 'up' : 'down'} today? What is my dollar exposure to it?`,
        createdAt: timestamp(),
      });
    }
  }

  return insights.slice(0, 2);
}

// 6. Performance highlights — notable gainers, losers, big daily movers
function performanceHighlights(portfolio: PortfolioSummary): FeedInsight[] {
  const insights: FeedInsight[] = [];

  // Best performer
  if (portfolio.largestGainer && (portfolio.largestGainer.unrealizedGainLoss ?? 0) > 100) {
    const g = portfolio.largestGainer;
    insights.push({
      id: makeId(),
      type: 'info',
      source: 'performance',
      priority: (g.unrealizedGainLoss ?? 0) > 1000 ? 'medium' : 'low',
      title: `${g.ticker} is your best performer`,
      summary: `${g.securityName} is up $${fmt(g.unrealizedGainLoss!)} (${((g.unrealizedGainLossPct ?? 0) * 100).toFixed(1)}%) from cost basis.${g.dayChangePct != null ? ` Today: ${(g.dayChangePct * 100) >= 0 ? '+' : ''}${(g.dayChangePct * 100).toFixed(2)}%.` : ''}`,
      detail: `${g.shares} shares @ $${g.currentPrice.toFixed(2)} = $${fmt(g.totalValue)} (${g.allocationPct.toFixed(1)}% of portfolio).`,
      metrics: [
        { label: 'Unrealized Gain', value: `+$${fmt(g.unrealizedGainLoss!)}` },
        { label: 'Return', value: `+${((g.unrealizedGainLossPct ?? 0) * 100).toFixed(1)}%` },
      ],
      suggestedFollowUp: `What would the tax impact be if my ${g.ticker} position were sold?`,
      createdAt: timestamp(),
    });
  }

  // Worst performer
  if (portfolio.largestLoser && (portfolio.largestLoser.unrealizedGainLoss ?? 0) < -100) {
    const l = portfolio.largestLoser;
    insights.push({
      id: makeId(),
      type: 'risk',
      source: 'performance',
      priority: Math.abs(l.unrealizedGainLoss ?? 0) > 1000 ? 'medium' : 'low',
      title: `${l.ticker} is your worst performer`,
      summary: `${l.securityName} is down $${fmt(Math.abs(l.unrealizedGainLoss!))} (${((l.unrealizedGainLossPct ?? 0) * 100).toFixed(1)}%) from cost basis.`,
      detail: `${l.shares} shares @ $${l.currentPrice.toFixed(2)} = $${fmt(l.totalValue)} (${l.allocationPct.toFixed(1)}% of portfolio).`,
      metrics: [
        { label: 'Unrealized Loss', value: `-$${fmt(Math.abs(l.unrealizedGainLoss!))}` },
        { label: 'Return', value: `${((l.unrealizedGainLossPct ?? 0) * 100).toFixed(1)}%` },
      ],
      suggestedFollowUp: `What would the tax impact be if my ${l.ticker} position were sold?`,
      createdAt: timestamp(),
    });
  }

  // Big daily mover
  const bigMovers = portfolio.holdings
    .filter(h => h.dayChangePct != null && Math.abs(h.dayChangePct * 100) > 3)
    .sort((a, b) => Math.abs(b.dayChangePct ?? 0) - Math.abs(a.dayChangePct ?? 0))
    .slice(0, 1);

  for (const mover of bigMovers) {
    const pct = mover.dayChangePct! * 100;
    const dollarMove = mover.totalValue * mover.dayChangePct!;
    insights.push({
      id: makeId(),
      type: pct > 0 ? 'info' : 'risk',
      source: 'performance',
      priority: Math.abs(pct) > 5 ? 'medium' : 'low',
      title: `${mover.ticker} moved ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% today`,
      summary: `${mover.securityName} ${pct > 0 ? 'gained' : 'lost'} ${Math.abs(pct).toFixed(1)}% today, a ${dollarMove >= 0 ? '+' : ''}$${fmt(Math.abs(dollarMove))} impact on your portfolio.`,
      detail: `Current price: $${mover.currentPrice.toFixed(2)}. Position: $${fmt(mover.totalValue)} (${mover.allocationPct.toFixed(1)}% allocation).`,
      metrics: [
        { label: 'Day Change', value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` },
        { label: 'Dollar Impact', value: `${dollarMove >= 0 ? '+' : '-'}$${fmt(Math.abs(dollarMove))}` },
      ],
      suggestedFollowUp: `Why did ${mover.ticker} move ${Math.abs(pct).toFixed(1)}% today? Any news I should know about?`,
      createdAt: timestamp(),
    });
  }

  return insights.slice(0, 3);
}

// 7. Rebalancing suggestions — sector overweight, low diversification
function rebalancingSuggestions(portfolio: PortfolioSummary): FeedInsight[] {
  const insights: FeedInsight[] = [];

  // Flag sectors above threshold
  for (const sector of portfolio.sectorExposure) {
    if (sector.allocationPct > SECTOR_CONCENTRATION_THRESHOLD && sector.sector !== 'Unknown') {
      insights.push({
        id: makeId(),
        type: 'risk',
        source: 'rebalancing',
        priority: sector.allocationPct > SECTOR_CONCENTRATION_THRESHOLD + 10 ? 'high' : 'medium',
        title: `${sector.sector} sector is ${sector.allocationPct.toFixed(0)}% of portfolio`,
        summary: `Your ${sector.sector} exposure ($${fmt(sector.totalValue)}) is ${sector.allocationPct.toFixed(1)}%. Diversification guidelines suggest <30-40% in any single sector.`,
        detail: `Holdings: ${sector.holdings.map(h => `${h.ticker} ($${fmt(h.value)})`).join(', ')}. A 20% sector decline would cost $${fmt(sector.totalValue * 0.2)}.`,
        metrics: [
          { label: 'Sector Weight', value: `${sector.allocationPct.toFixed(1)}%` },
          { label: '20% Drop Impact', value: `-$${fmt(sector.totalValue * 0.2)}` },
        ],
        suggestedFollowUp: `What is my dollar exposure to the ${sector.sector} sector?`,
        createdAt: timestamp(),
      });
    }
  }

  // Low diversification
  if (portfolio.positionCount > 0 && portfolio.positionCount < 5) {
    insights.push({
      id: makeId(),
      type: 'action',
      source: 'rebalancing',
      priority: 'medium',
      title: `Portfolio has only ${portfolio.positionCount} position${portfolio.positionCount > 1 ? 's' : ''}`,
      summary: `With ${portfolio.positionCount} holding${portfolio.positionCount > 1 ? 's' : ''}, a single earnings miss or sector downturn has outsized impact on your portfolio.`,
      detail: 'Portfolios with fewer than 5 positions carry higher idiosyncratic risk. Broad-market and international ETFs are common diversification tools. This is information, not a recommendation to buy any specific security.',
      metrics: [
        { label: 'Positions', value: `${portfolio.positionCount}` },
        { label: 'Top Holding', value: `${portfolio.topHolding?.allocationPct.toFixed(1) ?? 0}%` },
      ],
      suggestedFollowUp: 'How concentrated is my portfolio by position count?',
      createdAt: timestamp(),
    });
  }

  return insights.slice(0, 2);
}

// ═══════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════

export async function generateDailyInsights(userId: string): Promise<FeedInsight[]> {
  const cached = getCachedFeed(userId);
  if (cached) return cached;

  const portfolio = await getPortfolioSummary(userId);

  if (portfolio.positionCount === 0) {
    const txInsights = await cashFlowAnomalies(userId);
    setCachedFeed(userId, txInsights);
    return txInsights;
  }

  // Async generators run concurrently
  const [taxInsights, earningsInsights, txInsights] = await Promise.all([
    taxOpportunities(userId),
    earningsPreview(userId),
    cashFlowAnomalies(userId),
  ]);

  // Sync generators
  const concInsights = concentrationAlerts(portfolio);
  const mktInsights = marketEventImpact(portfolio);
  const perfInsights = performanceHighlights(portfolio);
  const rebalInsights = rebalancingSuggestions(portfolio);

  const all = [
    ...concInsights,
    ...taxInsights,
    ...earningsInsights,
    ...txInsights,
    ...mktInsights,
    ...perfInsights,
    ...rebalInsights,
  ];

  // Sort: high → medium → low, then risk → action → opportunity → info
  all.sort((a, b) => {
    const priDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priDiff !== 0) return priDiff;
    return (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3);
  });

  setCachedFeed(userId, all);
  return all;
}
