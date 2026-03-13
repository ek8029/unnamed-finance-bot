'use client';

import { useEffect, useMemo, useState } from 'react';
import { TaxIntelligence } from '@/components/dashboard/tax-intelligence';
import {
  FileText, TrendingDown, Calendar, Lightbulb, X,
  AlertTriangle, CheckCircle2, ArrowRight, Scissors,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/hooks/use-format';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/contexts/toast-context';
import { useTaxData, useTaxOpportunities } from '@/hooks/use-financial-data';
import type { TaxOpportunity } from '@/hooks/use-financial-data';

// ── Tax Opportunity Card ──

function OpportunityCard({
  opp,
  formatCurrency,
  onDismiss,
}: {
  opp: TaxOpportunity;
  formatCurrency: (n: number) => string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid rgba(248, 113, 113, 0.20)',
      }}
    >
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-[var(--color-negative)]" />
          <span className="type-caption text-[var(--color-negative)]">Loss Harvesting Opportunity</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Position info */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{opp.ticker}</span>
            <span className="text-[11px] text-[var(--color-text-muted)] ml-2" style={{ fontFamily: 'var(--font-mono)' }}>
              {opp.securityName}
            </span>
          </div>
          <span className="type-eyebrow text-[var(--color-text-muted)]">{opp.sector}</span>
        </div>
        <div className="flex items-center gap-6 mt-2">
          <div>
            <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Cost Basis</div>
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)] font-tabular">
              {formatCurrency(opp.costBasis)}
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
          <div>
            <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Current Value</div>
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)] font-tabular">
              {formatCurrency(opp.currentValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Loss + Savings highlight */}
      <div className="grid grid-cols-2 gap-px bg-[var(--color-border-subtle)]">
        <div className="bg-[var(--color-bg-surface)] px-5 py-3">
          <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Unrealized Loss</div>
          <div className="type-data text-[var(--color-negative)] font-tabular">
            {formatCurrency(opp.unrealizedLoss)}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            {opp.lossPct.toFixed(1)}% decline
          </div>
        </div>
        <div className="bg-[var(--color-bg-surface)] px-5 py-3">
          <div className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">Est. Tax Savings</div>
          <div className="type-data text-[var(--color-positive)] font-tabular">
            {formatCurrency(opp.estimatedSavings)}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            at 32% combined rate
          </div>
        </div>
      </div>

      {/* Replacement suggestion */}
      {opp.replacement && (
        <div className="px-5 py-3 border-t border-[var(--color-border-subtle)]" style={{ background: 'rgba(184, 145, 74, 0.03)' }}>
          <div className="type-eyebrow text-[var(--color-gold)] mb-1">Suggested Swap</div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{opp.replacement.ticker}</span>
            <span className="text-[12px] text-[var(--color-text-secondary)]">— {opp.replacement.name}</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{opp.replacement.reason}</p>
        </div>
      )}

      {/* Wash sale status */}
      <div className="px-5 py-2.5 border-t border-[var(--color-border-subtle)] flex items-center gap-2">
        {opp.washSaleRisk ? (
          <>
            <AlertTriangle className="w-3 h-3 text-[var(--color-warning)]" />
            <span className="text-[11px] text-[var(--color-warning)]" style={{ fontFamily: 'var(--font-mono)' }}>
              Wash sale risk: {opp.washSaleDetail}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3 text-[var(--color-positive)]" />
            <span className="text-[11px] text-[var(--color-positive)]" style={{ fontFamily: 'var(--font-mono)' }}>
              No recent sales — wash sale safe
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function TaxesPage() {
  const { formatCurrency } = useFormat();
  const { taxEstimate, optimizationTasks, loading: apiLoading, error } = useTaxData();
  const { report: harvestReport, loading: harvestLoading } = useTaxOpportunities();

  const { success } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});
  const [dismissedOpps, setDismissedOpps] = useState<Set<string>>(new Set());

  const taxData = useMemo(() => ({
    estimated_income_tax: taxEstimate?.estimatedIncomeTax || 0,
    short_term_capital_gains: taxEstimate?.shortTermCapitalGains || 0,
    long_term_capital_gains: taxEstimate?.longTermCapitalGains || 0,
    deductions_identified: taxEstimate?.deductionsIdentified || 0,
    estimated_quarterly_payment: taxEstimate?.estimatedQuarterlyPayment || 0,
    optimization_suggestions: optimizationTasks?.map(t => t.title) || [],
  }), [taxEstimate, optimizationTasks]);

  const totalTaxLiability = taxEstimate?.totalEstimatedTax || 0;

  const potentialSavings = (optimizationTasks?.reduce((sum, task) => {
    return sum + (task.potentialSavings || 0);
  }, 0) || 0) + (harvestReport?.totalEstimatedSavings || 0);

  useEffect(() => {
    const raw = localStorage.getItem('helm-tax-tasks');
    if (raw) {
      try { setCompletedTasks(JSON.parse(raw)); } catch { setCompletedTasks({}); }
    }
    const dismissed = localStorage.getItem('helm-tax-dismissed');
    if (dismissed) {
      try { setDismissedOpps(new Set(JSON.parse(dismissed))); } catch { /* ignore */ }
    }
  }, []);

  const loading = apiLoading;

  const saveTasks = (next: Record<number, boolean>) => {
    setCompletedTasks(next);
    localStorage.setItem('helm-tax-tasks', JSON.stringify(next));
  };

  const toggleTask = (index: number) => {
    const next = { ...completedTasks, [index]: !completedTasks[index] };
    saveTasks(next);
  };

  const dismissOpp = (ticker: string) => {
    const next = new Set(dismissedOpps);
    next.add(ticker);
    setDismissedOpps(next);
    localStorage.setItem('helm-tax-dismissed', JSON.stringify([...next]));
  };

  const visibleOpps = harvestReport?.opportunities.filter(o => !dismissedOpps.has(o.ticker)) || [];

  const timelineData = useMemo(
    () => [
      { label: 'Q1', value: totalTaxLiability * 0.22 },
      { label: 'Q2', value: totalTaxLiability * 0.48 },
      { label: 'Q3', value: totalTaxLiability * 0.72 },
      { label: 'Q4', value: totalTaxLiability },
    ],
    [totalTaxLiability]
  );

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="type-h1">Tax Intelligence</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          AI-powered tax planning and optimization recommendations
        </p>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
              <CardDescription>Estimated Tax Liability</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-32" /> : (
              <>
                <CardTitle className="type-data text-3xl text-[var(--color-negative)]">
                  {formatCurrency(totalTaxLiability)}
                </CardTitle>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">For tax year 2024</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-[var(--color-positive)]" />
              <CardDescription>Potential Savings</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-32" /> : (
              <>
                <CardTitle className="type-data text-3xl text-[var(--color-positive)]">
                  {formatCurrency(potentialSavings)}
                </CardTitle>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Through optimization</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
              <CardDescription>Next Quarterly Payment</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-32" /> : (
              <>
                <CardTitle className="type-data text-3xl">
                  {formatCurrency(taxData.estimated_quarterly_payment)}
                </CardTitle>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Due April 15, 2024</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Scissors className="w-4 h-4 text-[var(--color-gold)]" />
              <CardDescription>Harvesting Opportunities</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {harvestLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <CardTitle className="type-data text-3xl">
                  {harvestReport?.opportunityCount || 0}
                </CardTitle>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Positions with losses</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tax-Loss Harvesting Section ── */}
      {(harvestLoading || (harvestReport && harvestReport.opportunityCount > 0)) && (
        <div className="space-y-4">
          {/* Harvest Summary Card */}
          {!harvestLoading && harvestReport && harvestReport.opportunityCount > 0 && (
            <div
              className="rounded-sm overflow-hidden"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-gold-border)' }}
            >
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-[var(--color-gold)]" />
                  <span className="type-h2">Tax-Loss Harvesting</span>
                </div>
                <span className="type-eyebrow text-[var(--color-text-muted)]">
                  {harvestReport.opportunityCount} {harvestReport.opportunityCount === 1 ? 'opportunity' : 'opportunities'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[var(--color-border-subtle)]">
                <div className="bg-[var(--color-bg-surface)] px-5 py-4 text-center">
                  <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Total Harvestable Losses</div>
                  <div className="type-data text-xl text-[var(--color-negative)] font-tabular">
                    {formatCurrency(harvestReport.totalHarvestableLoss)}
                  </div>
                </div>
                <div className="bg-[var(--color-bg-surface)] px-5 py-4 text-center">
                  <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Est. Tax Savings</div>
                  <div className="type-data text-xl text-[var(--color-positive)] font-tabular">
                    {formatCurrency(harvestReport.totalEstimatedSavings)}
                  </div>
                </div>
                <div className="bg-[var(--color-bg-surface)] px-5 py-4 text-center">
                  <div className="type-eyebrow text-[var(--color-text-muted)] mb-1">Combined Tax Rate</div>
                  <div className="type-data text-xl font-tabular">
                    {(harvestReport.taxRate * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Individual opportunity cards */}
          {harvestLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-sm bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] p-5 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleOpps.map((opp) => (
                <OpportunityCard
                  key={opp.ticker}
                  opp={opp}
                  formatCurrency={formatCurrency}
                  onDismiss={() => dismissOpp(opp.ticker)}
                />
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-[var(--color-text-muted)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
            This is not tax advice. Tax-loss harvesting involves risks and may not be suitable for all investors. Consult a qualified tax professional before making any tax-related decisions. Wash sale rules apply for 30 days before and after a sale.
          </p>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Tax Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tax Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>2024 Tax Breakdown</CardTitle>
              <CardDescription>Estimated tax liability by category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)]">
                  <div>
                    <p className="type-h3">Estimated Income Tax</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Federal and state income tax</p>
                  </div>
                  <span className="type-data text-lg">{formatCurrency(taxData.estimated_income_tax)}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)]">
                  <div>
                    <p className="type-h3">Short-Term Capital Gains</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Taxed as ordinary income</p>
                  </div>
                  <span className="type-data text-lg">{formatCurrency(taxData.short_term_capital_gains)}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)]">
                  <div>
                    <p className="type-h3">Long-Term Capital Gains</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Preferential tax rate applies</p>
                  </div>
                  <span className="type-data text-lg">{formatCurrency(taxData.long_term_capital_gains)}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--color-positive)]/5 rounded-lg border border-[var(--color-positive)]/30">
                  <div>
                    <p className="type-h3 text-[var(--color-positive)]">Identified Deductions</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Reduces taxable income</p>
                  </div>
                  <span className="type-data text-lg text-[var(--color-positive)]">
                    -{formatCurrency(taxData.deductions_identified)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="type-h3">Total Estimated Liability</span>
                  <span className="type-data text-2xl text-[var(--color-negative)]">
                    {formatCurrency(totalTaxLiability)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax liability over time */}
          <Card>
            <CardHeader>
              <CardTitle>Tax liability over time</CardTitle>
              <CardDescription>Mock quarterly trajectory to visualize upcoming obligations.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-secondary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `$${(Number(value) / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border-base)',
                          borderRadius: '4px',
                          color: 'var(--color-text-primary)',
                        }}
                        labelStyle={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '11px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-warning)"
                        fill="var(--color-warning)"
                        fillOpacity={0.16}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Optimization Suggestions as tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Tax optimization tasks</CardTitle>
              <CardDescription>Turn Helm&apos;s ideas into concrete next steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(optimizationTasks || []).map((task, index) => {
                const completed = completedTasks[index];

                return (
                  <button
                    key={task.id || index}
                    type="button"
                    onClick={() => toggleTask(index)}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      completed
                        ? 'border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-muted)] line-through'
                        : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="w-4 h-4 text-[var(--color-gold)]" />
                          <Badge variant="gold" className="text-[10px]">
                            {task.priority || 'Task'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                      {task.potentialSavings && task.potentialSavings > 0 && (
                        <div className="text-right">
                          <p className="type-data text-sm text-[var(--color-positive)]">
                            {formatCurrency(task.potentialSavings)}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-secondary)]">
                            potential savings
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {(!optimizationTasks || optimizationTasks.length === 0) && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
                  No optimization tasks available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tax Intelligence Widget */}
        <div className="space-y-6">
          <TaxIntelligence
            taxData={taxData}
            onCategorySelect={setSelectedCategory}
          />

          {/* Quarterly Payment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2024 Quarterly Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { quarter: 'Q1 2024', date: 'April 15, 2024', status: 'Due Soon', color: 'red' },
                { quarter: 'Q2 2024', date: 'June 17, 2024', status: 'Upcoming', color: 'yellow' },
                { quarter: 'Q3 2024', date: 'September 16, 2024', status: 'Upcoming', color: 'gray' },
                { quarter: 'Q4 2024', date: 'January 15, 2025', status: 'Upcoming', color: 'gray' },
              ].map((payment) => (
                <div key={payment.quarter} className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-lg">
                  <div>
                    <p className="type-h3 text-sm">{payment.quarter}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{payment.date}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      payment.color === 'red'
                        ? 'bg-[var(--color-negative)]/10 text-[var(--color-negative)] border-[var(--color-negative)]/40'
                        : payment.color === 'yellow'
                        ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/40'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]'
                    }`}
                  >
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tax Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tax Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['Form 1099-B', 'Form 1099-DIV', 'Form 1099-INT', 'W-2 Form'].map((doc) => (
                <div
                  key={doc}
                  className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-lg hover:bg-[var(--color-bg-overlay)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{doc}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Ready
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary of next steps */}
      <Card variant="outline">
        <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="type-h3 mb-1">Recommended next steps</p>
            <p className="type-body text-[var(--color-text-secondary)]">
              Review harvesting opportunities, pick 1-2 optimization tasks, and share a summary with your advisor.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] type-label text-sm hover:border-[var(--color-border-strong)]"
              onClick={() => success('Advisor summary ready', 'Export flow not implemented in this prototype')}
            >
              Export tax report
            </button>
            <button
              className="px-4 py-2 rounded-md bg-[var(--color-gold)] text-[var(--color-text-inverse)] type-label text-sm hover:bg-[var(--color-gold-hi)]"
              onClick={() => success('Advisor handoff noted', 'Share this view with your tax professional')}
            >
              Talk to an advisor
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Simple category detail drawer */}
      {selectedCategory && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setSelectedCategory(null)}
          />
          <div className="w-full max-w-md bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)] shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-base)]">
              <div>
                <p className="type-caption text-[var(--color-text-secondary)] mb-1">Tax assumptions</p>
                <h2 className="type-h2 capitalize">{selectedCategory.replace('_', ' ')}</h2>
              </div>
              <button
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                onClick={() => setSelectedCategory(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
              <p>
                These numbers assume stable income, current portfolio mix, and no additional large one-time events.
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Federal marginal bracket approximated from your mock income level.</li>
                <li>State taxes simplified into a single effective rate.</li>
                <li>Capital gains based on realised events in this mock portfolio.</li>
              </ul>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                All figures are placeholders for demo purposes and should not be used for real decisions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
