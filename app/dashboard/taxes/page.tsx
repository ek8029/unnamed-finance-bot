import { useEffect, useMemo, useState } from 'react';
import { TaxIntelligence } from '@/components/dashboard/tax-intelligence';
import { mockTaxIntelligence } from '@/lib/mock-data';
import { FileText, TrendingDown, Calendar, Lightbulb, DollarSign, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/contexts/toast-context';

export default function TaxesPage() {
  const totalTaxLiability =
    mockTaxIntelligence.estimated_income_tax +
    mockTaxIntelligence.short_term_capital_gains +
    mockTaxIntelligence.long_term_capital_gains -
    mockTaxIntelligence.deductions_identified;

  const potentialSavings = mockTaxIntelligence.optimization_suggestions.reduce((sum, suggestion) => {
    const match = suggestion.match(/\$([0-9,]+)/);
    return match ? sum + parseInt(match[1].replace(',', '')) : sum;
  }, 0);

  const { success } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('helm-tax-tasks');
    if (raw) {
      try {
        setCompletedTasks(JSON.parse(raw));
      } catch {
        setCompletedTasks({});
      }
    }
    const timeout = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  const saveTasks = (next: Record<number, boolean>) => {
    setCompletedTasks(next);
    localStorage.setItem('helm-tax-tasks', JSON.stringify(next));
  };

  const toggleTask = (index: number) => {
    const next = { ...completedTasks, [index]: !completedTasks[index] };
    saveTasks(next);
  };

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
        <p className="type-body text-helm-secondary">
          AI-powered tax planning and optimization recommendations
        </p>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-helm-muted" />
              <CardDescription>Estimated Tax Liability</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <CardTitle className="type-data text-3xl text-helm-negative">
                  {formatCurrency(totalTaxLiability)}
                </CardTitle>
                <p className="text-sm text-helm-secondary mt-1">For tax year 2024</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-helm-positive" />
              <CardDescription>Potential Savings</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <CardTitle className="type-data text-3xl text-helm-positive">
                  {formatCurrency(potentialSavings)}
                </CardTitle>
                <p className="text-sm text-helm-secondary mt-1">Through optimization</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-helm-muted" />
              <CardDescription>Next Quarterly Payment</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <CardTitle className="type-data text-3xl">
                  {formatCurrency(mockTaxIntelligence.estimated_quarterly_payment)}
                </CardTitle>
                <p className="text-sm text-helm-secondary mt-1">Due April 15, 2024</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-helm-gold" />
              <CardDescription>Optimization Ideas</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <CardTitle className="type-data text-3xl">
                  {mockTaxIntelligence.optimization_suggestions.length}
                </CardTitle>
                <p className="text-sm text-helm-secondary mt-1">Available strategies</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
                <div className="flex items-center justify-between p-4 bg-helm-elevated rounded-lg border border-helm-border-subtle">
                  <div>
                    <p className="type-h3">Estimated Income Tax</p>
                    <p className="text-sm text-helm-secondary">Federal and state income tax</p>
                  </div>
                  <span className="type-data text-lg">
                    {formatCurrency(mockTaxIntelligence.estimated_income_tax)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-helm-elevated rounded-lg border border-helm-border-subtle">
                  <div>
                    <p className="type-h3">Short-Term Capital Gains</p>
                    <p className="text-sm text-helm-secondary">Taxed as ordinary income</p>
                  </div>
                  <span className="type-data text-lg">
                    {formatCurrency(mockTaxIntelligence.short_term_capital_gains)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-helm-elevated rounded-lg border border-helm-border-subtle">
                  <div>
                    <p className="type-h3">Long-Term Capital Gains</p>
                    <p className="text-sm text-helm-secondary">Preferential tax rate applies</p>
                  </div>
                  <span className="type-data text-lg">
                    {formatCurrency(mockTaxIntelligence.long_term_capital_gains)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-helm-positive/5 rounded-lg border border-helm-positive/30">
                  <div>
                    <p className="type-h3 text-helm-positive">Identified Deductions</p>
                    <p className="text-sm text-helm-secondary">Reduces taxable income</p>
                  </div>
                  <span className="type-data text-lg text-helm-positive">
                    -{formatCurrency(mockTaxIntelligence.deductions_identified)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-helm-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="type-h3">Total Estimated Liability</span>
                  <span className="type-data text-2xl text-helm-negative">
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
              <CardDescription>Turn Helm’s ideas into concrete next steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTaxIntelligence.optimization_suggestions.map((suggestion, index) => {
                const savingsMatch = suggestion.match(/\$([0-9,]+)/);
                const savings = savingsMatch ? parseInt(savingsMatch[1].replace(/,/g, ''), 10) : 0;
                const completed = completedTasks[index];

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleTask(index)}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      completed
                        ? 'border-helm-border-subtle bg-helm-base text-helm-muted line-through'
                        : 'border-helm-border-base bg-helm-elevated hover:border-helm-border-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="w-4 h-4 text-helm-gold" />
                          <Badge variant="gold" className="text-[10px]">
                            Task {index + 1}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          {suggestion.split(' - ')[0]}
                        </p>
                      </div>
                      {savings > 0 && (
                        <div className="text-right">
                          <p className="type-data text-sm text-helm-positive">
                            {formatCurrency(savings)}
                          </p>
                          <p className="text-[10px] text-helm-secondary">
                            potential savings
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tax Intelligence Widget */}
        <div className="space-y-6">
          <TaxIntelligence
            taxData={mockTaxIntelligence}
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
                <div key={payment.quarter} className="flex items-center justify-between p-3 bg-helm-elevated rounded-lg">
                  <div>
                    <p className="type-h3 text-sm">{payment.quarter}</p>
                    <p className="text-xs text-helm-secondary">{payment.date}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      payment.color === 'red'
                        ? 'bg-helm-negative/10 text-helm-negative border-helm-negative/40'
                        : payment.color === 'yellow'
                        ? 'bg-helm-warning/10 text-helm-warning border-helm-warning/40'
                        : 'bg-helm-elevated text-helm-secondary border-helm-border-subtle'
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
                  className="flex items-center justify-between p-3 bg-helm-elevated rounded-lg hover:bg-helm-overlay cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-helm-muted" />
                    <span className="text-sm font-medium text-helm-platinum">{doc}</span>
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
            <p className="type-body text-helm-secondary">
              Use this mock data to understand how Helm could frame your tax posture: review liability, pick 1–2
              optimization tasks, and share a summary with your advisor.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-md border border-helm-border-base bg-helm-elevated type-label text-sm hover:border-helm-border-strong"
              onClick={() => success('Advisor summary ready', 'Export flow not implemented in this prototype')}
            >
              Export tax report
            </button>
            <button
              className="px-4 py-2 rounded-md bg-helm-gold text-helm-base type-label text-sm hover:bg-helm-gold-hi"
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
          <div className="w-full max-w-md bg-helm-surface border-l border-helm-border-base shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between px-6 py-4 border-b border-helm-border-base">
              <div>
                <p className="type-caption text-helm-secondary mb-1">Tax assumptions</p>
                <h2 className="type-h2 capitalize">{selectedCategory.replace('_', ' ')}</h2>
              </div>
              <button
                className="p-2 text-helm-secondary hover:text-helm-platinum"
                onClick={() => setSelectedCategory(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm text-helm-secondary">
              <p>
                These numbers assume stable income, current portfolio mix, and no additional large one‑time events.
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Federal marginal bracket approximated from your mock income level.</li>
                <li>State taxes simplified into a single effective rate.</li>
                <li>Capital gains based on realised events in this mock portfolio.</li>
              </ul>
              <p className="text-[11px] text-helm-muted">
                All figures are placeholders for demo purposes and should not be used for real decisions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
