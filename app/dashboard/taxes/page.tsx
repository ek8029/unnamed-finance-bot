'use client';

import { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Scissors, ArrowRight,
  AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaxData, useTaxOpportunities } from '@/hooks/use-financial-data';
import type { TaxPosition, TaxOpportunity } from '@/hooks/use-financial-data';
import { cn } from '@/lib/utils';

// ── Helpers ──

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const TNUM: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };

type PLFilter = 'all' | 'gains' | 'losses';

// ── Tax-Loss Harvesting Opportunity Card ──

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
      style={{ background: 'var(--color-bg-surface)', border: '1px solid rgba(248, 113, 113, 0.20)' }}
    >
      <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-[var(--color-negative)]" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-negative)]" style={MONO}>
            Loss Harvesting Opportunity
          </span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{opp.ticker}</span>
            <span className="text-[11px] text-[var(--color-text-muted)] ml-2" style={MONO}>{opp.securityName}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>{opp.sector}</span>
        </div>
        <div className="flex items-center gap-6 mt-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5" style={MONO}>Cost Basis</div>
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]" style={TNUM}>{formatCurrency(opp.costBasis)}</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5" style={MONO}>Current Value</div>
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]" style={TNUM}>{formatCurrency(opp.currentValue)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[var(--color-border-subtle)]">
        <div className="bg-[var(--color-bg-surface)] px-5 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5" style={MONO}>Unrealized Loss</div>
          <div className="text-base font-bold text-[var(--color-negative)]" style={TNUM}>{formatCurrency(opp.unrealizedLoss)}</div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={MONO}>{opp.lossPct.toFixed(1)}% decline</div>
        </div>
        <div className="bg-[var(--color-bg-surface)] px-5 py-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5" style={MONO}>Est. Tax Savings</div>
          <div className="text-base font-bold text-[var(--color-positive)]" style={TNUM}>{formatCurrency(opp.estimatedSavings)}</div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={MONO}>at 32% combined rate</div>
        </div>
      </div>

      {opp.replacement && (
        <div className="px-5 py-3 border-t border-[var(--color-border-subtle)]" style={{ background: 'rgba(184, 145, 74, 0.03)' }}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-gold)] mb-1 font-semibold" style={MONO}>Suggested Swap</div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{opp.replacement.ticker}</span>
            <span className="text-[12px] text-[var(--color-text-secondary)]">— {opp.replacement.name}</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{opp.replacement.reason}</p>
        </div>
      )}

      <div className="px-5 py-2.5 border-t border-[var(--color-border-subtle)] flex items-center gap-2">
        {opp.washSaleRisk ? (
          <>
            <AlertTriangle className="w-3 h-3 text-[var(--color-warning)]" />
            <span className="text-[11px] text-[var(--color-warning)]" style={MONO}>Wash sale risk: {opp.washSaleDetail}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3 text-[var(--color-positive)]" />
            <span className="text-[11px] text-[var(--color-positive)]" style={MONO}>No recent sales — wash sale safe</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Position Row ──

function PositionRow({ pos, formatCurrency }: { pos: TaxPosition; formatCurrency: (n: number) => string }) {
  const isGain = pos.gainLoss >= 0;
  const barMax = 100;
  const barWidth = Math.min(Math.abs(pos.gainLossPct), barMax);

  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--color-border-subtle)] last:border-0">
      <div className="w-16 shrink-0">
        <span className="text-sm font-bold text-[var(--color-text-primary)]">{pos.ticker}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[var(--color-text-muted)] truncate" style={MONO}>{pos.name}</span>
          <span className={cn('text-xs font-semibold', isGain ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')} style={TNUM}>
            {isGain ? '+' : ''}{formatCurrency(pos.gainLoss)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', isGain ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-negative)]')}
              style={{ width: `${barWidth}%`, opacity: 0.6 }}
            />
          </div>
          <span className={cn('text-[10px] font-medium w-14 text-right', isGain ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')} style={TNUM}>
            {isGain ? '+' : ''}{pos.gainLossPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="w-20 text-right shrink-0">
        <div className="text-[11px] text-[var(--color-text-secondary)]" style={TNUM}>{formatCurrency(pos.currentValue)}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]" style={TNUM}>basis {formatCurrency(pos.costBasis)}</div>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function TaxesPage() {
  const { formatCurrency } = useFormat();
  const { data: taxData, loading: taxLoading } = useTaxData();
  const { report: harvestReport, loading: harvestLoading } = useTaxOpportunities();

  const [plFilter, setPlFilter] = useState<PLFilter>('all');
  const [dismissedOpps, setDismissedOpps] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('helm-tax-dismissed');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [sellOrderExpanded, setSellOrderExpanded] = useState(false);

  const loading = taxLoading;

  const dismissOpp = (ticker: string) => {
    const next = new Set(dismissedOpps);
    next.add(ticker);
    setDismissedOpps(next);
    localStorage.setItem('helm-tax-dismissed', JSON.stringify([...next]));
  };

  const visibleOpps = harvestReport?.opportunities.filter(o => !dismissedOpps.has(o.ticker)) || [];

  // ── Filtered positions ──
  const filteredPositions = useMemo(() => {
    if (!taxData) return [];
    const positions = taxData.unrealized.positions;
    if (plFilter === 'gains') return positions.filter(p => p.gainLoss > 0);
    if (plFilter === 'losses') return positions.filter(p => p.gainLoss < 0);
    return positions;
  }, [taxData, plFilter]);

  // ── Tax-efficient sell order (losses first, then smallest gains) ──
  const sellOrder = useMemo(() => {
    if (!taxData) return [];
    return [...taxData.unrealized.positions].sort((a, b) => a.gainLoss - b.gainLoss);
  }, [taxData]);

  const gainCount = taxData?.unrealized.positions.filter(p => p.gainLoss > 0).length ?? 0;
  const lossCount = taxData?.unrealized.positions.filter(p => p.gainLoss < 0).length ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">Tax Center</h1>
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          Actionable tax intelligence computed from your portfolio positions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-sm p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Unrealized Gains</span>
          </div>
          {loading ? <Skeleton className="h-7 w-24" /> : (
            <p className="text-xl font-bold text-[var(--color-positive)]" style={TNUM}>
              {formatCurrency(taxData?.unrealized.totalGains ?? 0)}
            </p>
          )}
        </div>

        <div className="rounded-sm p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-[var(--color-negative)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Unrealized Losses</span>
          </div>
          {loading ? <Skeleton className="h-7 w-24" /> : (
            <p className="text-xl font-bold text-[var(--color-negative)]" style={TNUM}>
              {formatCurrency(taxData?.unrealized.totalLosses ?? 0)}
            </p>
          )}
        </div>

        <div className="rounded-sm p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-gold-border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Scissors className="w-3.5 h-3.5 text-[var(--color-gold)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Harvestable Savings</span>
          </div>
          {harvestLoading ? <Skeleton className="h-7 w-24" /> : (
            <p className="text-xl font-bold text-[var(--color-gold)]" style={TNUM}>
              {formatCurrency(harvestReport?.totalEstimatedSavings ?? 0)}
            </p>
          )}
        </div>

        <div className="rounded-sm p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Realized YTD</span>
          </div>
          {loading ? <Skeleton className="h-7 w-24" /> : (
            <>
              <p className={cn('text-xl font-bold', (taxData?.realized.netRealized ?? 0) >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')} style={TNUM}>
                {formatCurrency(taxData?.realized.netRealized ?? 0)}
              </p>
              {(taxData?.realized.transactionCount ?? 0) > 0 && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5" style={MONO}>
                  {taxData!.realized.transactionCount} transaction{taxData!.realized.transactionCount !== 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Tax-Loss Harvesting ── */}
      {(harvestLoading || (harvestReport && harvestReport.opportunityCount > 0)) && (
        <div className="space-y-3">
          {!harvestLoading && harvestReport && harvestReport.opportunityCount > 0 && (
            <div className="rounded-sm overflow-hidden" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-gold-border)' }}>
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-[var(--color-gold)]" />
                  <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">Tax-Loss Harvesting</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>
                  {harvestReport.opportunityCount} {harvestReport.opportunityCount === 1 ? 'opportunity' : 'opportunities'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[var(--color-border-subtle)]">
                <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Total Harvestable</div>
                  <div className="text-lg font-bold text-[var(--color-negative)]" style={TNUM}>{formatCurrency(harvestReport.totalHarvestableLoss)}</div>
                </div>
                <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Est. Tax Savings</div>
                  <div className="text-lg font-bold text-[var(--color-positive)]" style={TNUM}>{formatCurrency(harvestReport.totalEstimatedSavings)}</div>
                </div>
                <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Tax Rate</div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]" style={TNUM}>{(harvestReport.taxRate * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          )}

          {harvestLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-sm bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] p-5 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleOpps.map((opp) => (
                <OpportunityCard key={opp.ticker} opp={opp} formatCurrency={formatCurrency} onDismiss={() => dismissOpp(opp.ticker)} />
              ))}
            </div>
          )}

          <p className="text-[10px] text-[var(--color-text-muted)] text-center" style={MONO}>
            Not tax advice. Consult a qualified tax professional. Wash sale rules apply for 30 days before and after a sale.
          </p>
        </div>
      )}

      {/* ── Unrealized Gains & Losses ── */}
      <div className="rounded-sm overflow-hidden" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
          <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">Unrealized P&L by Position</span>
          <div className="flex gap-1 p-0.5 rounded bg-white/5 border border-white/5">
            {([
              { key: 'all' as PLFilter, label: 'All', count: taxData?.unrealized.positions.length ?? 0 },
              { key: 'gains' as PLFilter, label: 'Gains', count: gainCount },
              { key: 'losses' as PLFilter, label: 'Losses', count: lossCount },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setPlFilter(f.key)}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] transition-colors',
                  plFilter === f.key
                    ? 'bg-[var(--color-gold)] text-black font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
                style={MONO}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        <div className="px-5">
          {loading ? (
            <div className="py-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredPositions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
              {plFilter === 'gains' ? 'No positions with unrealized gains.' :
               plFilter === 'losses' ? 'No positions with unrealized losses.' :
               'No positions with cost basis data.'}
            </p>
          ) : (
            filteredPositions.map(pos => (
              <PositionRow key={pos.ticker} pos={pos} formatCurrency={formatCurrency} />
            ))
          )}
        </div>

        {!loading && taxData && taxData.unrealized.positions.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>Net unrealized</span>
            <span className={cn('text-sm font-bold', taxData.unrealized.netUnrealized >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')} style={TNUM}>
              {taxData.unrealized.netUnrealized >= 0 ? '+' : ''}{formatCurrency(taxData.unrealized.netUnrealized)}
            </span>
          </div>
        )}
      </div>

      {/* ── Tax-Efficient Sell Order ── */}
      {!loading && sellOrder.length > 0 && (
        <div className="rounded-sm overflow-hidden" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
          <button
            onClick={() => setSellOrderExpanded(!sellOrderExpanded)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div>
              <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">Tax-Efficient Sell Order</span>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                If you need to raise cash, sell in this order to minimize tax impact
              </p>
            </div>
            {sellOrderExpanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            )}
          </button>

          {sellOrderExpanded && (
            <div className="border-t border-[var(--color-border-subtle)]">
              {sellOrder.map((pos, i) => {
                const isLoss = pos.gainLoss < 0;
                return (
                  <div
                    key={pos.ticker}
                    className="px-5 py-3 flex items-center gap-4 border-b border-[var(--color-border-subtle)] last:border-0"
                  >
                    <span className="text-[11px] text-[var(--color-text-muted)] w-5 text-right" style={MONO}>{i + 1}</span>
                    <span className="text-sm font-bold text-[var(--color-text-primary)] w-16">{pos.ticker}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-[var(--color-text-muted)] truncate" style={MONO}>{pos.name}</span>
                    </div>
                    <span className={cn('text-xs font-semibold', isLoss ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')} style={TNUM}>
                      {isLoss ? 'Harvest loss' : `+${formatCurrency(pos.gainLoss)} tax event`}
                    </span>
                    <div className={cn(
                      'px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold',
                      isLoss
                        ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]'
                        : i < sellOrder.length * 0.3
                          ? 'bg-[var(--color-positive)]/10 text-[var(--color-positive)]'
                          : i < sellOrder.length * 0.7
                            ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                            : 'bg-[var(--color-negative)]/10 text-[var(--color-negative)]',
                    )} style={MONO}>
                      {isLoss ? 'Sell first' : i < sellOrder.length * 0.3 ? 'Low impact' : i < sellOrder.length * 0.7 ? 'Moderate' : 'High impact'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Realized Capital Gains YTD ── */}
      <div className="rounded-sm overflow-hidden" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <span className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">Realized Capital Gains — {new Date().getFullYear()}</span>
        </div>

        {loading ? (
          <div className="px-5 py-4">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (taxData?.realized.transactionCount ?? 0) === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">No realized gains or losses this year</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1" style={MONO}>
              Capital gains will appear here when you sell positions
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--color-border-subtle)]">
              <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Short-Term Gains</div>
                <div className="text-sm font-bold text-[var(--color-positive)]" style={TNUM}>{formatCurrency(taxData!.realized.shortTermGains)}</div>
              </div>
              <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Short-Term Losses</div>
                <div className="text-sm font-bold text-[var(--color-negative)]" style={TNUM}>{formatCurrency(taxData!.realized.shortTermLosses)}</div>
              </div>
              <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Long-Term Gains</div>
                <div className="text-sm font-bold text-[var(--color-positive)]" style={TNUM}>{formatCurrency(taxData!.realized.longTermGains)}</div>
              </div>
              <div className="bg-[var(--color-bg-surface)] px-5 py-3.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1" style={MONO}>Long-Term Losses</div>
                <div className="text-sm font-bold text-[var(--color-negative)]" style={TNUM}>{formatCurrency(taxData!.realized.longTermLosses)}</div>
              </div>
            </div>

            {taxData!.realized.transactions.length > 0 && (
              <div className="border-t border-[var(--color-border-subtle)]">
                <div className="px-5 py-2 bg-white/[0.02] flex items-center gap-4 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>
                  <span className="w-14">Date</span>
                  <span className="w-14">Ticker</span>
                  <span className="flex-1">Type</span>
                  <span className="w-24 text-right">Gain/Loss</span>
                </div>
                {taxData!.realized.transactions.slice(0, 20).map((tx, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center gap-4 border-t border-[var(--color-border-subtle)]">
                    <span className="text-[11px] text-[var(--color-text-muted)] w-14" style={MONO}>
                      {new Date(tx.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] w-14">{tx.ticker}</span>
                    <span className="text-[11px] text-[var(--color-text-muted)] flex-1" style={MONO}>
                      {tx.gainLossType === 'short_term' ? 'Short-term' : 'Long-term'}
                    </span>
                    <span className={cn('text-xs font-semibold w-24 text-right', tx.gainLoss >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')} style={TNUM}>
                      {tx.gainLoss >= 0 ? '+' : ''}{formatCurrency(tx.gainLoss)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[var(--color-text-muted)] text-center leading-relaxed" style={MONO}>
        All figures are based on your connected portfolio data and are for informational purposes only.
        This is not tax advice. Consult a qualified tax professional before making tax-related decisions.
      </p>
    </div>
  );
}
