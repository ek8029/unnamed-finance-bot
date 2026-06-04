'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Sparkles, Eye,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaxData, useTaxOpportunities } from '@/hooks/use-financial-data';
import type { TaxOpportunity, RealizedTransaction } from '@/hooks/use-financial-data';
import { cn } from '@/lib/utils';
import { useTier } from '@/hooks/use-tier';
import { ProBlur } from '@/components/pro-blur';
import { Form8949Preview } from '@/components/dashboard/form-8949-preview';
import { TAX_RATE, LTCG_RATE_DEFAULT, ANNUAL_LOSS_DEDUCTION_CAP } from '@/lib/financial-config';

// ── Constants ──

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const TNUM: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };
const CURRENT_YEAR = new Date().getFullYear();

// ── Quarter helpers ──

interface QuarterData {
  label: string;
  range: string;
  gains: number;
  losses: number;
  net: number;
  status: 'filed' | 'in-progress' | 'upcoming';
}

function getQuarter(dateStr: string): number {
  const month = new Date(dateStr + 'T12:00:00').getMonth();
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

function getCurrentQuarter(): number {
  const month = new Date().getMonth();
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

function getQuarterStatus(q: number): 'filed' | 'in-progress' | 'upcoming' {
  const current = getCurrentQuarter();
  if (q < current) return 'filed';
  if (q === current) return 'in-progress';
  return 'upcoming';
}

const QUARTER_RANGES: Record<number, string> = {
  1: 'Jan 1 - Mar 31',
  2: 'Apr 1 - Jun 30',
  3: 'Jul 1 - Sep 30',
  4: 'Oct 1 - Dec 31',
};

function buildQuarterData(transactions: RealizedTransaction[]): QuarterData[] {
  const qMap: Record<number, { gains: number; losses: number }> = {
    1: { gains: 0, losses: 0 },
    2: { gains: 0, losses: 0 },
    3: { gains: 0, losses: 0 },
    4: { gains: 0, losses: 0 },
  };

  for (const tx of transactions) {
    const q = getQuarter(tx.date);
    if (tx.gainLoss >= 0) {
      qMap[q].gains += tx.gainLoss;
    } else {
      qMap[q].losses += tx.gainLoss;
    }
  }

  return [1, 2, 3, 4].map((q) => ({
    label: `Q${q}`,
    range: QUARTER_RANGES[q],
    gains: qMap[q].gains,
    losses: qMap[q].losses,
    net: qMap[q].gains + qMap[q].losses,
    status: getQuarterStatus(q),
  }));
}

// ── Stacked bar component ──

function StackedBar({
  shortTermGains,
  longTermGains,
  dividends,
}: {
  shortTermGains: number;
  longTermGains: number;
  dividends: number;
}) {
  const total = shortTermGains + longTermGains + dividends;
  if (total === 0) return null;

  const stPct = (shortTermGains / total) * 100;
  const ltPct = (longTermGains / total) * 100;
  const divPct = (dividends / total) * 100;

  return (
    <div className="w-full">
      <div className="flex h-2.5 rounded-sm overflow-hidden gap-px">
        {stPct > 0 && (
          <div
            className="h-full rounded-sm"
            style={{ width: `${stPct}%`, background: '#5B8DEF' }}
          />
        )}
        {ltPct > 0 && (
          <div
            className="h-full rounded-sm"
            style={{ width: `${ltPct}%`, background: 'var(--color-gold)' }}
          />
        )}
        {divPct > 0 && (
          <div
            className="h-full rounded-sm"
            style={{ width: `${divPct}%`, background: 'var(--color-positive)' }}
          />
        )}
      </div>
      <div className="flex items-center gap-4 mt-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: '#5B8DEF' }} />
          <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
            ST Gains
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-gold)' }} />
          <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
            LT Gains
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-positive)' }} />
          <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
            Dividends
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loaders ──

function HeaderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-3 w-48 rounded bg-white/5" />
      <div className="h-10 w-[70%] rounded bg-white/5" />
      <div className="h-4 w-[50%] rounded bg-white/5" />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-md p-5 animate-pulse"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
        >
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
    >
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <Skeleton className="h-4 w-48" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-5 py-3.5 border-b border-[var(--color-border-subtle)] flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-32 flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──

export default function TaxesPage() {
  const { formatCurrency } = useFormat();
  const { isPro, loading: tierLoading } = useTier();
  const { data: taxData, loading: taxLoading } = useTaxData();
  const { report: harvestReport, loading: harvestLoading, proRequired } = useTaxOpportunities();

  const [selectedOpps, setSelectedOpps] = useState<Set<string>>(new Set());

  const loading = taxLoading || harvestLoading;

  // ── Derived calculations ──

  const estimatedTaxDue = useMemo(() => {
    if (!taxData) return 0;
    const netRealized = taxData.realized.netRealized;
    if (netRealized <= 0) return 0;
    return netRealized * TAX_RATE;
  }, [taxData]);

  const realizedYTD = useMemo(() => {
    if (!taxData) return 0;
    return taxData.realized.netRealized;
  }, [taxData]);

  // Derive harvestable totals: use pro data if available, else estimate from free taxData
  const totalHarvestable = useMemo(() => {
    if (harvestReport) return harvestReport.totalHarvestableLoss;
    if (!taxData) return 0;
    return Math.abs(taxData.unrealized.totalLosses);
  }, [harvestReport, taxData]);

  const lossPositionCount = useMemo(() => {
    if (harvestReport) return harvestReport.opportunityCount;
    if (!taxData) return 0;
    return taxData.unrealized.positions.filter((p) => p.gainLoss < 0).length;
  }, [harvestReport, taxData]);

  const washSafeCount = useMemo(() => {
    if (!harvestReport) return 0;
    return harvestReport.opportunities.filter((o) => !o.washSaleRisk).length;
  }, [harvestReport]);

  const carryoverLoss = useMemo(() => {
    if (!harvestReport) return 0;
    return harvestReport.annualCap.estimatedCarryforward;
  }, [harvestReport]);

  const quarters = useMemo(() => {
    if (!taxData) return buildQuarterData([]);
    return buildQuarterData(taxData.realized.transactions);
  }, [taxData]);

  const shortTermGains = taxData?.realized.shortTermGains ?? 0;
  const shortTermLosses = taxData?.realized.shortTermLosses ?? 0;
  const longTermGains = taxData?.realized.longTermGains ?? 0;
  const longTermLosses = taxData?.realized.longTermLosses ?? 0;
  const lotCount = taxData?.realized.transactionCount ?? 0;

  // IRC §1211(b): $3,000 ordinary income deduction from net capital losses
  const deductionUsed = useMemo(() => {
    if (!taxData) return 0;
    const net = taxData.realized.netRealized;
    if (net >= 0) return 0; // gains exceed losses, no ordinary income offset
    return Math.min(Math.abs(net), ANNUAL_LOSS_DEDUCTION_CAP);
  }, [taxData]);

  // ST / LT net breakdowns
  const shortTermNet = shortTermGains + shortTermLosses;
  const longTermNet = longTermGains + longTermLosses;

  // Realized transactions table toggle
  const [showRealizedTx, setShowRealizedTx] = useState(false);

  // ── Harvest table selection ──

  const toggleOpp = useCallback((ticker: string) => {
    setSelectedOpps((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
      }
      return next;
    });
  }, []);

  const toggleAllOpps = useCallback(() => {
    if (!harvestReport) return;
    setSelectedOpps((prev) => {
      if (prev.size === harvestReport.opportunities.length) {
        return new Set();
      }
      return new Set(harvestReport.opportunities.map((o) => o.ticker));
    });
  }, [harvestReport]);

  const selectedSavings = useMemo(() => {
    if (!harvestReport) return 0;
    return harvestReport.opportunities
      .filter((o) => selectedOpps.has(o.ticker))
      .reduce((sum, o) => sum + o.estimatedSavings, 0);
  }, [harvestReport, selectedOpps]);

  // (Form 8949 preview is now a separate component below)

  // ── Tier loading / ProGate ──

  if (tierLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-6xl animate-pulse">
        <div className="h-8 bg-[var(--color-bg-elevated)] rounded w-1/4 mb-4" />
        <div className="h-64 bg-[var(--color-bg-elevated)] rounded-xl" />
      </div>
    );
  }

  const showProContent = isPro && !proRequired;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8 max-w-6xl" aria-label="Tax Center">

      {/* ─── 1. Header ─── */}
      {loading ? (
        <HeaderSkeleton />
      ) : (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[var(--color-text-muted)]"
              style={MONO}
            >
              HELM
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">/</span>
            <span
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[var(--color-text-muted)]"
              style={MONO}
            >
              TAX CENTER
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">&middot;</span>
            <span
              className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]"
              style={MONO}
            >
              TY {CURRENT_YEAR}
            </span>
          </div>

          {/* Giant headline */}
          <h1 className="text-[20px] sm:text-[28px] md:text-[36px] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
            You owe an estimated{' '}
            <span className="text-[var(--color-warning-text)]" style={TNUM}>
              {formatCurrency(estimatedTaxDue)}
            </span>{' '}
            in capital gains tax this year.
          </h1>

          {/* Subtitle */}
          <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
            Helm tracks your tax lots and monitors wash-sale risk across your connected accounts.
            Review your quarterly breakdown and harvest opportunities below.{' '}
            <a
              href="/tools/tlh-calculator"
              className="text-[var(--color-gold)] hover:underline font-medium"
            >
              Try the TLH calculator
            </a>
          </p>

          {/* Scroll to Form 8949 */}
          {showProContent && (
            <button
              onClick={() => document.getElementById('form-8949-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-semibold motion-safe:transition-colors motion-safe:duration-150 cursor-pointer"
              style={{
                background: 'var(--color-gold)',
                color: 'var(--color-bg-base)',
              }}
            >
              Preview Form 8949
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ─── 2. Tax Estimate Breakdown (4-col) ─── */}
      {loading ? (
        <GridSkeleton />
      ) : (
        <section aria-label="Tax estimate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Estimated tax due — large card */}
          <div
            className="rounded-md p-5 col-span-1 sm:col-span-2 lg:col-span-1"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <span
              className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
              style={MONO}
            >
              Estimated tax due
            </span>
            <p
              className="text-[20px] sm:text-[28px] md:text-[48px] font-bold tracking-tight text-[var(--color-warning-text)] leading-none mt-2 mb-4"
              style={{ ...TNUM, ...MONO }}
            >
              {formatCurrency(estimatedTaxDue)}
            </p>

            <StackedBar
              shortTermGains={shortTermGains}
              longTermGains={longTermGains}
              dividends={0}
            />
          </div>

          {/* Realized YTD */}
          <div
            className="rounded-md p-5"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <span
              className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
              style={MONO}
            >
              Realized YTD
            </span>
            <p
              className={cn(
                'text-[20px] sm:text-[28px] font-bold tracking-tight leading-none mt-2',
                realizedYTD >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
              )}
              style={{ ...TNUM, ...MONO }}
            >
              {realizedYTD >= 0 ? '+' : ''}
              {formatCurrency(realizedYTD)}
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-2" style={MONO}>
              {lotCount} lot{lotCount !== 1 ? 's' : ''} closed
            </p>
          </div>

          {/* Harvestable */}
          <div
            className="rounded-md p-5"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <span
              className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
              style={MONO}
            >
              Harvestable
            </span>
            <p
              className="text-[20px] sm:text-[28px] font-bold tracking-tight text-[var(--color-warning-text)] leading-none mt-2"
              style={{ ...TNUM, ...MONO }}
            >
              {formatCurrency(Math.abs(totalHarvestable))}
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-2" style={MONO}>
              {showProContent
                ? `${washSafeCount} wash-safe lot${washSafeCount !== 1 ? 's' : ''}`
                : `${lossPositionCount} position${lossPositionCount !== 1 ? 's' : ''} at a loss`}
            </p>
          </div>

          {/* Carryover loss */}
          <div
            className="rounded-md p-5"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <span
              className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
              style={MONO}
            >
              Carryover loss
            </span>
            {showProContent ? (
              <>
                <p
                  className="text-[20px] sm:text-[28px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mt-2"
                  style={{ ...TNUM, ...MONO }}
                >
                  {formatCurrency(carryoverLoss)}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-2" style={MONO}>
                  from TY {CURRENT_YEAR - 1}
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-[22px] font-bold tracking-tight text-[var(--color-text-muted)] leading-none mt-2"
                  style={{ ...TNUM, ...MONO }}
                >
                  —
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-2" style={MONO}>
                  Pro feature
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* ─── 2b. $3K Deduction Tracker (IRC §1211(b)) ─── */}
      {!loading && (
        <section aria-label="Ordinary income deduction tracker">
          <div
            className="rounded-md p-5"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                style={MONO}
              >
                §1211(b) Ordinary Income Offset
              </span>
              <span
                className="text-[12px] font-semibold text-[var(--color-text-primary)]"
                style={{ ...TNUM, ...MONO }}
              >
                {formatCurrency(deductionUsed)} of {formatCurrency(ANNUAL_LOSS_DEDUCTION_CAP)}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-sm motion-safe:transition-all motion-safe:duration-300"
                style={{
                  width: `${Math.min((deductionUsed / ANNUAL_LOSS_DEDUCTION_CAP) * 100, 100)}%`,
                  background: deductionUsed >= ANNUAL_LOSS_DEDUCTION_CAP ? 'var(--color-gold)' : 'var(--color-positive)',
                }}
              />
            </div>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-2.5" style={MONO}>
              {deductionUsed >= ANNUAL_LOSS_DEDUCTION_CAP
                ? `Cap reached — excess losses carry forward to TY ${CURRENT_YEAR + 1} per IRC §1212(b).`
                : deductionUsed > 0
                  ? `Net capital losses offset up to $3,000 of ordinary income. ${formatCurrency(ANNUAL_LOSS_DEDUCTION_CAP - deductionUsed)} remaining.`
                  : 'No net capital losses to offset ordinary income this year.'}
            </p>
          </div>
        </section>
      )}

      {/* ─── 2c. Short-Term vs Long-Term Breakdown ─── */}
      {!loading && (
        <section aria-label="Short-term vs long-term breakdown" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Short-term card */}
          <div
            className="rounded-md p-5"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-sm" style={{ background: '#5B8DEF' }} />
              <span
                className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                style={MONO}
              >
                Short-Term Realized
              </span>
              <span
                className="ml-auto text-[12px] text-[var(--color-text-muted)]"
                style={MONO}
              >
                ~{(TAX_RATE * 100).toFixed(0)}% rate
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Gains</span>
                <span className="text-[12px] font-semibold text-[var(--color-positive)]" style={{ ...TNUM, ...MONO }}>
                  +{formatCurrency(shortTermGains)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Losses</span>
                <span className="text-[12px] font-semibold text-[var(--color-negative)]" style={{ ...TNUM, ...MONO }}>
                  {formatCurrency(shortTermLosses)}
                </span>
              </div>
              <div className="pt-1.5 mt-1 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Net</span>
                  <span
                    className={cn(
                      'text-[14px] font-bold',
                      shortTermNet >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                    )}
                    style={{ ...TNUM, ...MONO }}
                  >
                    {shortTermNet >= 0 ? '+' : ''}{formatCurrency(shortTermNet)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Long-term card */}
          <div
            className="rounded-md p-5"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-gold)' }} />
              <span
                className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                style={MONO}
              >
                Long-Term Realized
              </span>
              <span
                className="ml-auto text-[12px] text-[var(--color-text-muted)]"
                style={MONO}
              >
                ~{(LTCG_RATE_DEFAULT * 100).toFixed(0)}% rate
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Gains</span>
                <span className="text-[12px] font-semibold text-[var(--color-positive)]" style={{ ...TNUM, ...MONO }}>
                  +{formatCurrency(longTermGains)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Losses</span>
                <span className="text-[12px] font-semibold text-[var(--color-negative)]" style={{ ...TNUM, ...MONO }}>
                  {formatCurrency(longTermLosses)}
                </span>
              </div>
              <div className="pt-1.5 mt-1 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Net</span>
                  <span
                    className={cn(
                      'text-[14px] font-bold',
                      longTermNet >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                    )}
                    style={{ ...TNUM, ...MONO }}
                  >
                    {longTermNet >= 0 ? '+' : ''}{formatCurrency(longTermNet)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── 3. Quarter Strip ─── */}
      {loading ? (
        <GridSkeleton />
      ) : (
        <section aria-label="Quarterly breakdown" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quarters.map((q) => {
            const isActive = q.status === 'in-progress';
            const statusColor =
              q.status === 'filed'
                ? 'text-[var(--color-positive)]'
                : q.status === 'in-progress'
                  ? 'text-[var(--color-gold)]'
                  : 'text-[var(--color-text-muted)]';
            const statusLabel =
              q.status === 'filed' ? 'Filed' : q.status === 'in-progress' ? 'In progress' : 'Upcoming';

            return (
              <div
                key={q.label}
                aria-label={`${q.label} — ${statusLabel}`}
                className="rounded-md p-4 motion-safe:transition-colors motion-safe:duration-150"
                style={{
                  background: isActive
                    ? 'rgba(230, 185, 77, 0.04)'
                    : 'var(--color-bg-surface)',
                  border: isActive
                    ? '1px solid rgba(230, 185, 77, 0.2)'
                    : '1px solid var(--color-border-base)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-bold text-[var(--color-text-primary)]">
                    {q.label}
                  </span>
                  <span className={cn('text-[10px] uppercase tracking-wider font-semibold', statusColor)} style={MONO}>
                    {statusLabel}
                  </span>
                </div>

                <p className="text-[12px] text-[var(--color-text-muted)] mb-3" style={MONO}>
                  {q.range}
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Gains</span>
                    <span className="text-[12px] font-semibold text-[var(--color-positive)]" style={TNUM}>
                      +{formatCurrency(q.gains)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Losses</span>
                    <span className="text-[12px] font-semibold text-[var(--color-negative)]" style={TNUM}>
                      {formatCurrency(q.losses)}
                    </span>
                  </div>
                  <div className="pt-1 mt-1 border-t border-[var(--color-border-subtle)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Net</span>
                      <span
                        className={cn(
                          'text-[13px] font-bold',
                          q.net >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                        )}
                        style={TNUM}
                      >
                        {q.net >= 0 ? '+' : ''}
                        {formatCurrency(q.net)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ─── 3b. Realized Transactions Detail ─── */}
      {!loading && taxData && taxData.realized.transactions.length > 0 && (
        <section aria-label="Realized transactions">
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <button
              onClick={() => setShowRealizedTx((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-[var(--color-border-subtle)] cursor-pointer hover:bg-white/[0.02] motion-safe:transition-colors motion-safe:duration-100"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[11px] uppercase tracking-[0.15em] font-bold text-[var(--color-text-primary)]"
                  style={MONO}
                >
                  Realized Transactions
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-[var(--color-text-secondary)]"
                  style={MONO}
                >
                  {taxData.realized.transactions.length}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-[var(--color-text-muted)] motion-safe:transition-transform motion-safe:duration-200',
                  showRealizedTx ? 'rotate-180' : '',
                )}
              />
            </button>

            {showRealizedTx && (
              <>
                {/* Column headers (desktop) */}
                <div
                  className="hidden md:grid px-5 py-2.5 border-b border-[var(--color-border-subtle)]"
                  style={{
                    gridTemplateColumns: '88px 72px 1fr 96px 96px 104px 64px',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.015)',
                  }}
                >
                  {['Date', 'Ticker', '', 'Proceeds', 'Basis', 'Gain/Loss', 'Type'].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium truncate"
                      style={MONO}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Transaction rows */}
                {taxData.realized.transactions.map((tx, i) => {
                  const isGain = tx.gainLoss >= 0;
                  const typeLabel = tx.gainLossType === 'short_term' ? 'ST' : 'LT';
                  return (
                    <div key={`${tx.ticker}-${tx.date}-${i}`}>
                      {/* Desktop row */}
                      <div
                        className="hidden md:grid items-center px-5 py-3 border-b border-[var(--color-border-subtle)]"
                        style={{
                          gridTemplateColumns: '88px 72px 1fr 96px 96px 104px 64px',
                          gap: '8px',
                        }}
                      >
                        <span className="text-[12px] text-[var(--color-text-secondary)] tabular-nums" style={MONO}>
                          {tx.date}
                        </span>
                        <span className="text-[13px] font-bold text-[var(--color-text-primary)]" style={MONO}>
                          {tx.ticker}
                        </span>
                        <span />
                        <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
                          {formatCurrency(tx.proceeds)}
                        </span>
                        <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
                          {formatCurrency(tx.costBasis)}
                        </span>
                        <span
                          className={cn(
                            'text-[12px] font-semibold tabular-nums',
                            isGain ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                          )}
                          style={MONO}
                        >
                          {isGain ? '+' : ''}{formatCurrency(tx.gainLoss)}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold',
                            tx.gainLossType === 'short_term'
                              ? 'bg-[rgba(91,141,239,0.1)] text-[#5B8DEF]'
                              : 'bg-[rgba(230,185,77,0.1)] text-[var(--color-gold)]',
                          )}
                          style={MONO}
                        >
                          {typeLabel}
                        </span>
                      </div>

                      {/* Mobile row */}
                      <div className="md:hidden px-4 py-3.5 border-b border-[var(--color-border-subtle)]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-[var(--color-text-primary)]" style={MONO}>
                              {tx.ticker}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold',
                                tx.gainLossType === 'short_term'
                                  ? 'bg-[rgba(91,141,239,0.1)] text-[#5B8DEF]'
                                  : 'bg-[rgba(230,185,77,0.1)] text-[var(--color-gold)]',
                              )}
                              style={MONO}
                            >
                              {typeLabel}
                            </span>
                          </div>
                          <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>
                            {tx.date}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-x-4">
                          <div>
                            <span className="text-[12px] text-[var(--color-text-muted)] block" style={MONO}>Proceeds</span>
                            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>{formatCurrency(tx.proceeds)}</span>
                          </div>
                          <div>
                            <span className="text-[12px] text-[var(--color-text-muted)] block" style={MONO}>Basis</span>
                            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>{formatCurrency(tx.costBasis)}</span>
                          </div>
                          <div>
                            <span className="text-[12px] text-[var(--color-text-muted)] block" style={MONO}>Gain/Loss</span>
                            <span
                              className={cn(
                                'text-[12px] font-semibold tabular-nums',
                                isGain ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                              )}
                              style={MONO}
                            >
                              {isGain ? '+' : ''}{formatCurrency(tx.gainLoss)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      )}

      {/* ─── 4. Harvest Opportunity Table ─── */}
      {loading ? (
        <TableSkeleton />
      ) : !showProContent ? (
        <ProBlur
          label="Unlock harvest recommendations"
          description={`${lossPositionCount} position${lossPositionCount !== 1 ? 's' : ''} with ${formatCurrency(totalHarvestable)} in harvestable losses found. Upgrade to see specific lots, wash-sale flags, replacement securities, and estimated tax savings.`}
          minHeight="280px"
        >
          {/* Placeholder rows for blur effect */}
          <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
            <div className="px-5 py-4 flex items-center gap-2.5 border-b border-[var(--color-border-subtle)]">
              <Sparkles className="w-4 h-4 text-[var(--color-gold)]" />
              <span className="text-[11px] uppercase tracking-[0.15em] font-bold text-[var(--color-gold)]" style={MONO}>
                Harvest Opportunity
              </span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-[var(--color-text-secondary)]" style={MONO}>
                {lossPositionCount}
              </span>
            </div>
            {Array.from({ length: Math.min(lossPositionCount, 4) }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center gap-4">
                <div className="w-10 h-4 bg-[var(--color-bg-elevated)] rounded" />
                <div className="flex-1 h-4 bg-[var(--color-bg-elevated)] rounded" />
                <div className="w-20 h-4 bg-[var(--color-bg-elevated)] rounded" />
                <div className="w-20 h-4 bg-[var(--color-bg-elevated)] rounded" />
                <div className="w-16 h-4 bg-[var(--color-bg-elevated)] rounded" />
              </div>
            ))}
          </div>
        </ProBlur>
      ) : harvestReport && harvestReport.opportunityCount > 0 ? (
        <section
          aria-label="Harvest opportunities"
          className="rounded-md overflow-hidden"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-base)',
          }}
        >
          {/* Table header bar */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--color-gold)]" />
              <span
                className="text-[11px] uppercase tracking-[0.15em] font-bold text-[var(--color-gold)]"
                style={MONO}
              >
                Harvest Opportunity
              </span>
              <span
                className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-[var(--color-text-secondary)]"
                style={MONO}
              >
                {harvestReport.opportunityCount}
              </span>
            </div>
            {/* Wash sale legend */}
            <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
              <span className="text-[var(--color-positive)]">Clear</span> = safe to harvest
              <span className="mx-1.5">|</span>
              <span className="text-[var(--color-warning-text)]">Conflict</span> = wash sale risk detected
            </span>
          </div>

          {/* Table column headers */}
          <div
            className="hidden md:grid px-5 py-2.5 border-b border-[var(--color-border-subtle)]"
            style={{
              gridTemplateColumns: '32px 72px 1fr 80px 96px 96px 104px 100px 80px',
              gap: '8px',
              background: 'rgba(255,255,255,0.015)',
            }}
          >
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={
                  harvestReport.opportunities.length > 0 &&
                  selectedOpps.size === harvestReport.opportunities.length
                }
                onChange={toggleAllOpps}
                aria-label="Select all harvest opportunities"
                className="w-3.5 h-3.5 rounded-sm border-[var(--color-border-base)] accent-[var(--color-gold)] cursor-pointer"
              />
            </div>
            {['Symbol', 'Name', 'Shares', 'Basis', 'Mkt Value', 'Unrealized', 'Wash Sale', 'Term'].map(
              (h) => (
                <span
                  key={h}
                  className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium truncate"
                  style={MONO}
                >
                  {h}
                </span>
              ),
            )}
          </div>

          {/* Table rows */}
          {harvestReport.opportunities.map((opp: TaxOpportunity) => (
            <HarvestRow
              key={opp.ticker}
              opp={opp}
              selected={selectedOpps.has(opp.ticker)}
              onToggle={() => toggleOpp(opp.ticker)}
              formatCurrency={formatCurrency}
            />
          ))}

          {/* Table footer */}
          <div
            className="px-5 py-3.5 flex items-center justify-between border-t border-[var(--color-border-subtle)]"
            style={{ background: 'rgba(255,255,255,0.02)' }}
            aria-live="polite"
          >
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
              {selectedOpps.size} of {harvestReport.opportunityCount} selected
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
                Est. tax saving
              </span>
              <span
                className="text-[14px] font-bold text-[var(--color-positive)]"
                style={{ ...TNUM, ...MONO }}
              >
                {formatCurrency(selectedSavings)}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <div
          className="rounded-md p-8 text-center"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-base)',
          }}
        >
          <CheckCircle2 className="w-8 h-8 text-[var(--color-positive)] mx-auto mb-3 opacity-60" />
          <p className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">
            No harvest opportunities
          </p>
          <p className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
            All positions are currently at a gain. Tax-loss harvesting opportunities will appear when positions decline below cost basis.
          </p>
        </div>
      )}

      {/* ─── 5. Form 8949 Preview ─── */}
      {!loading && (
        <div id="form-8949-section">
          {showProContent ? (
            <Form8949Preview />
          ) : (
            <ProBlur
              label="Unlock Form 8949 preview"
              description="See your IRS-ready short-term and long-term capital gains breakdown with CSV export."
              minHeight="200px"
            >
              <div className="rounded-md p-6" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}>
                <div className="flex items-center gap-2.5 mb-4">
                  <Eye className="w-4 h-4 text-[var(--color-gold)]" />
                  <span className="text-[11px] uppercase tracking-[0.15em] font-bold text-[var(--color-gold)]" style={MONO}>Form 8949 Preview</span>
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-16 h-4 bg-[var(--color-bg-elevated)] rounded" />
                      <div className="flex-1 h-4 bg-[var(--color-bg-elevated)] rounded" />
                      <div className="w-24 h-4 bg-[var(--color-bg-elevated)] rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </ProBlur>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed max-w-3xl mx-auto" style={MONO}>
        All figures are estimates based on a {(TAX_RATE * 100).toFixed(0)}% blended tax rate and your connected portfolio data.
        This is not tax advice. Wash sale rules (IRC &sect;1091), the $3,000 annual deduction cap (IRC &sect;1211), and
        holding period requirements apply. Consult a qualified tax professional before making tax-related decisions.
      </p>
    </main>
  );
}

// ── Harvest row component ──

function HarvestRow({
  opp,
  selected,
  onToggle,
  formatCurrency,
}: {
  opp: TaxOpportunity;
  selected: boolean;
  onToggle: () => void;
  formatCurrency: (n: number) => string;
}) {
  const isWashSafe = !opp.washSaleRisk;
  const [expanded, setExpanded] = useState(false);

  const washSaleDetailText = opp.washSaleDetail
    ?? (isWashSafe
      ? 'No substantially identical securities detected in your portfolio or recent transactions. Safe to harvest per IRC \u00a71091.'
      : null);

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <>
      {/* Desktop row */}
      <div
        className={cn(
          'hidden md:grid items-center px-5 py-3 border-b border-[var(--color-border-subtle)] motion-safe:transition-colors motion-safe:duration-100 cursor-pointer',
          selected ? 'bg-[rgba(230,185,77,0.04)]' : 'hover:bg-white/[0.02]',
        )}
        style={{
          gridTemplateColumns: '32px 72px 1fr 80px 96px 96px 104px 100px 80px',
          gap: '8px',
        }}
        onClick={onToggle}
      >
        {/* Checkbox */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${opp.ticker} for harvest`}
            className="w-3.5 h-3.5 rounded-sm border-[var(--color-border-base)] accent-[var(--color-gold)] cursor-pointer"
          />
        </div>

        {/* Symbol */}
        <span className="text-[14px] font-bold text-[var(--color-gold)]" style={MONO}>
          {opp.ticker}
        </span>

        {/* Name */}
        <span className="text-[13px] text-[var(--color-text-secondary)] truncate">
          {opp.securityName}
        </span>

        {/* Shares */}
        <span className="text-[13px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {opp.shares.toLocaleString()}
        </span>

        {/* Basis */}
        <span className="text-[13px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {formatCurrency(opp.costBasis)}
        </span>

        {/* Market value */}
        <span className="text-[13px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {formatCurrency(opp.currentValue)}
        </span>

        {/* Unrealized */}
        <span className="text-[13px] font-semibold text-[var(--color-negative)] tabular-nums" style={MONO}>
          {formatCurrency(opp.unrealizedLoss)}
        </span>

        {/* Wash sale status — clickable to expand detail */}
        <button
          type="button"
          onClick={handleExpandToggle}
          className="flex items-center gap-1 cursor-pointer"
          aria-expanded={expanded}
          aria-label={`${isWashSafe ? 'Clear' : 'Conflict'} — show wash sale detail for ${opp.ticker}`}
        >
          {isWashSafe ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-semibold"
              style={{
                background: 'rgba(74, 222, 128, 0.08)',
                color: 'var(--color-positive)',
                ...MONO,
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Clear
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-semibold"
              style={{
                background: 'rgba(251, 191, 36, 0.08)',
                color: 'var(--color-warning-text)',
                ...MONO,
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              Conflict
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-3 h-3 text-[var(--color-text-muted)] motion-safe:transition-transform motion-safe:duration-150',
              expanded ? 'rotate-180' : '',
            )}
          />
        </button>

        {/* Holding period badge (IRC §1222) */}
        <div>
          {opp.holdingPeriod === 'short_term' ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-semibold"
              style={{
                background: 'rgba(251, 146, 60, 0.1)',
                color: 'rgb(251, 146, 60)',
                ...MONO,
              }}
            >
              ST
            </span>
          ) : opp.holdingPeriod === 'long_term' ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-semibold"
              style={{
                background: 'rgba(74, 222, 128, 0.1)',
                color: 'var(--color-positive)',
                ...MONO,
              }}
            >
              LT
            </span>
          ) : (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-semibold"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--color-text-muted)',
                ...MONO,
              }}
            >
              —
            </span>
          )}
        </div>

      </div>

      {/* Expandable wash sale detail banner (desktop) */}
      {expanded && washSaleDetailText && (
        <div
          className="hidden md:block px-5 py-3 border-b border-[var(--color-border-subtle)]"
          style={{
            borderLeft: `3px solid ${opp.washSaleRisk ? 'var(--color-warning-text)' : 'var(--color-positive)'}`,
            background: opp.washSaleRisk ? 'rgba(251, 191, 36, 0.03)' : 'rgba(74, 222, 128, 0.03)',
            marginLeft: '32px',
          }}
        >
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed" style={MONO}>
            <span className="font-semibold text-[var(--color-text-primary)]">What this means: </span>
            {washSaleDetailText}
          </p>
        </div>
      )}

      {/* Mobile card */}
      <div
        className={cn(
          'md:hidden px-4 py-3.5 border-b border-[var(--color-border-subtle)] motion-safe:transition-colors motion-safe:duration-100',
          selected ? 'bg-[rgba(230,185,77,0.04)]' : '',
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${opp.ticker} for harvest`}
            className="w-3.5 h-3.5 rounded-sm border-[var(--color-border-base)] accent-[var(--color-gold)] cursor-pointer shrink-0"
          />
          <span className="text-[14px] font-bold text-[var(--color-gold)]" style={MONO}>
            {opp.ticker}
          </span>
          <span className="text-[13px] text-[var(--color-text-secondary)] truncate flex-1">
            {opp.securityName}
          </span>
          {/* Holding period badge (mobile) */}
          {opp.holdingPeriod === 'short_term' ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-semibold shrink-0"
              style={{
                background: 'rgba(251, 146, 60, 0.1)',
                color: 'rgb(251, 146, 60)',
                ...MONO,
              }}
            >
              ST
            </span>
          ) : opp.holdingPeriod === 'long_term' ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider font-semibold shrink-0"
              style={{
                background: 'rgba(74, 222, 128, 0.1)',
                color: 'var(--color-positive)',
                ...MONO,
              }}
            >
              LT
            </span>
          ) : null}
          {/* Wash sale status pill — clickable to expand (mobile) */}
          <button
            type="button"
            onClick={handleExpandToggle}
            className="inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            aria-expanded={expanded}
            aria-label={`${isWashSafe ? 'Clear' : 'Conflict'} — show wash sale detail for ${opp.ticker}`}
          >
            {isWashSafe ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-semibold"
                style={{
                  background: 'rgba(74, 222, 128, 0.08)',
                  color: 'var(--color-positive)',
                  ...MONO,
                }}
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                Clear
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-semibold"
                style={{
                  background: 'rgba(251, 191, 36, 0.08)',
                  color: 'var(--color-warning-text)',
                  ...MONO,
                }}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Conflict
              </span>
            )}
            <ChevronDown
              className={cn(
                'w-2.5 h-2.5 text-[var(--color-text-muted)] motion-safe:transition-transform motion-safe:duration-150',
                expanded ? 'rotate-180' : '',
              )}
            />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 pl-[26px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>Shares</span>
            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
              {opp.shares.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>Basis</span>
            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
              {formatCurrency(opp.costBasis)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>Mkt Value</span>
            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
              {formatCurrency(opp.currentValue)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>Unrealized</span>
            <span className="text-[12px] font-semibold text-[var(--color-negative)] tabular-nums" style={MONO}>
              {formatCurrency(opp.unrealizedLoss)}
            </span>
          </div>
        </div>

        {/* Expandable wash sale detail banner (mobile) */}
        {expanded && washSaleDetailText && (
          <div
            className="mt-2.5 ml-[26px] px-3 py-2.5 rounded-sm"
            style={{
              borderLeft: `3px solid ${opp.washSaleRisk ? 'var(--color-warning-text)' : 'var(--color-positive)'}`,
              background: opp.washSaleRisk ? 'rgba(251, 191, 36, 0.03)' : 'rgba(74, 222, 128, 0.03)',
            }}
          >
            <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed" style={MONO}>
              <span className="font-semibold text-[var(--color-text-primary)]">What this means: </span>
              {washSaleDetailText}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
