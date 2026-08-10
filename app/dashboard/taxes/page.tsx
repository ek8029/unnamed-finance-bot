'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown,
  Sparkles, Link2,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaxData, useTaxOpportunities } from '@/hooks/use-financial-data';
import type { TaxOpportunity, RealizedTransaction, TaxHarvestReport } from '@/hooks/use-financial-data';
import { thesisTlhNote } from '@/lib/thesis-conviction';
import { cn } from '@/lib/utils';
import { DemoConnectCta } from '@/components/demo/demo-connect-cta';
import { Form8949Preview } from '@/components/dashboard/form-8949-preview';
import { TierLock } from '@/components/tier-lock';
import { usePreview } from '@/lib/preview-context';
import { tierAtLeast } from '@/lib/tier-shared';
import { TaxTeaser } from '@/components/tax-teaser';
import { TAX_RATE, LTCG_RATE_DEFAULT, ANNUAL_LOSS_DEDUCTION_CAP } from '@/lib/financial-config';
import { estimateTaxOnRealizedGains } from '@/lib/tax-math';

// ── Constants ──

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const TNUM: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };
const CURRENT_YEAR = new Date().getFullYear();

// Card surface used across the screen (Sovereign Architect default).
const CARD: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-base)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
};

// ── Quarter helpers ──

interface QuarterData {
  label: string;
  range: string;
  gains: number;
  losses: number;
  net: number;
  status: 'past' | 'in-progress' | 'upcoming';
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

function getQuarterStatus(q: number): 'past' | 'in-progress' | 'upcoming' {
  const current = getCurrentQuarter();
  if (q < current) return 'past';
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
          <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
            ST Gains
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-gold)' }} />
          <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
            LT Gains
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-positive)' }} />
          <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
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
        <div key={i} className="rounded-md p-5 animate-pulse" style={CARD}>
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
    <div className="rounded-md overflow-hidden" style={CARD}>
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

// ── Centered-panel empty states (shared "Connect your brokerage" vocabulary) ──

function ConnectEmpty() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-6 py-10">
      <div className="max-w-[460px] text-center">
        <div
          className="mx-auto mb-[22px] inline-flex h-[60px] w-[60px] items-center justify-center rounded-[14px]"
          style={{ background: 'rgba(230,185,77,0.06)', border: '1px solid rgba(230,185,77,0.18)' }}
        >
          <Link2 size={26} className="text-[var(--color-gold)]" strokeWidth={1.6} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.025em] leading-[1.1] text-[var(--color-text-primary)] mb-3">
          Connect your brokerage
        </h1>
        <p className="text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
          Helm reads your tax lots over a read-only connection, then tracks realized gains and
          flags harvesting candidates here, each screened against a 30-day wash-sale lookback.
          Link an account to get started.
        </p>
      </div>
    </div>
  );
}

function NoHarvestEmpty() {
  return (
    <div className="flex items-center justify-center px-6 py-16">
      <div className="max-w-[460px] text-center">
        <div
          className="mx-auto mb-[22px] inline-flex h-[60px] w-[60px] items-center justify-center rounded-[14px]"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}
        >
          <CheckCircle2 size={26} className="text-[var(--color-positive)]" strokeWidth={1.6} />
        </div>
        <h2 className="text-[24px] font-bold tracking-[-0.025em] leading-[1.1] text-[var(--color-text-primary)] mb-3">
          No harvestable losses right now
        </h2>
        <p className="text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
          Helm scans your lots daily and flags harvesting candidates here the moment they
          appear, each screened against a 30-day wash-sale lookback.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function TaxesPage() {
  const { tier } = usePreview();
  const entitled = tierAtLeast(tier, 'pro');

  // A free account sees its real harvestable figure first, then the locked
  // detail underneath. Hiding the number entirely meant the one deterministic
  // dollar amount in the product was invisible to everyone deciding whether to
  // pay for it.
  if (!entitled) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
        <TaxTeaser />
        <div className="mt-6">
          <TierLock
            required="pro"
            surface="/dashboard/taxes"
            label="Which lots, and what the wash-sale rules do to them"
            blurb="The figure above is yours either way. Pro shows the positions behind it, screens them against 30-day wash-sale windows across every account at once, and gives you a Form 8949 worksheet you can reconcile against your 1099-B."
          >
            <TaxesContent />
          </TierLock>
        </div>
      </main>
    );
  }

  return <TaxesContent />;
}

function TaxesContent() {
  const { formatCurrency } = useFormat();
  const { dataState } = usePreview();
  const { data: taxData, loading: taxLoading } = useTaxData();
  const { report: harvestReport, loading: harvestLoading } = useTaxOpportunities();

  const loading = taxLoading || harvestLoading;

  // Rates and the §1211(b) cap the report actually applied. Reading the module
  // constants here would put a different number on screen than in the math for
  // any user who set a bracket or a filing status.
  const ordinaryRate = harvestReport?.taxRate ?? TAX_RATE;
  const ltcgRate = harvestReport?.ltcgRate ?? LTCG_RATE_DEFAULT;
  const lossCap = harvestReport?.annualCap.annualDeductionCap ?? ANNUAL_LOSS_DEDUCTION_CAP;
  const ratesAreYours = harvestReport?.ratesFromSettings ?? false;
  const filingStatus = harvestReport?.filingStatus ?? null;

  // ── Derived calculations ──

  const estimatedTaxDue = useMemo(() => {
    if (!taxData) return 0;
    const stNet = taxData.realized.shortTermGains + taxData.realized.shortTermLosses;
    const ltNet = taxData.realized.longTermGains + taxData.realized.longTermLosses;
    // One implementation of IRC §1222(11) netting, shared with the engine.
    return estimateTaxOnRealizedGains({ stNet, ltNet, ordinaryRate, ltcgRate });
  }, [taxData, ordinaryRate, ltcgRate]);

  const realizedGains = useMemo(() => {
    if (!taxData) return 0;
    return taxData.realized.shortTermGains + taxData.realized.longTermGains;
  }, [taxData]);

  const realizedLosses = useMemo(() => {
    if (!taxData) return 0;
    return taxData.realized.shortTermLosses + taxData.realized.longTermLosses;
  }, [taxData]);

  const realizedYTD = useMemo(() => {
    if (!taxData) return 0;
    return taxData.realized.netRealized;
  }, [taxData]);

  // Derive harvestable totals from the pro report.
  const totalHarvestable = useMemo(() => {
    if (harvestReport) return harvestReport.totalHarvestableLoss;
    if (!taxData) return 0;
    return Math.abs(taxData.unrealized.totalLosses);
  }, [harvestReport, taxData]);

  const washSafeCount = useMemo(() => {
    if (!harvestReport) return 0;
    return harvestReport.opportunities.filter((o) => !o.washSaleRisk).length;
  }, [harvestReport]);

  const washConflictCount = useMemo(() => {
    if (!harvestReport) return 0;
    return harvestReport.opportunities.filter((o) => o.washSaleRisk).length;
  }, [harvestReport]);

  // Lead with conviction: broken-thesis losses first (the exit and the tax move point
  // the same way), then weakening, then intact, then no signal. Stable sort keeps the
  // server order within a tier, so non-thesis users see the unchanged ordering.
  const sortedOpportunities = useMemo(() => {
    if (!harvestReport) return [];
    const rank = (s?: string) => (s === 'broken' ? 0 : s === 'weakening' ? 1 : s === 'intact' ? 2 : 3);
    return [...harvestReport.opportunities].sort((a, b) => rank(a.thesisStatus) - rank(b.thesisStatus));
  }, [harvestReport]);

  const brokenHarvests = useMemo(
    () => sortedOpportunities.filter((o) => o.thesisStatus === 'broken'),
    [sortedOpportunities],
  );

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
    return Math.min(Math.abs(net), lossCap);
  }, [taxData, lossCap]);

  // ST / LT net breakdowns
  const shortTermNet = shortTermGains + shortTermLosses;
  const longTermNet = longTermGains + longTermLosses;

  // Realized transactions table toggle
  const [showRealizedTx, setShowRealizedTx] = useState(false);

  // ── Empty: connect your brokerage ───────────────────────────────────────
  // No realized data and no harvest report and nothing loading → not connected.
  // Also driven by the preview Empty toggle for localhost demos.
  const hasNoData =
    dataState === 'empty' ||
    (!loading && !taxData && !harvestReport);

  if (hasNoData) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-6" aria-label="Tax Center">
        <ConnectEmpty />
      </main>
    );
  }

  const harvestCount = harvestReport?.opportunityCount ?? 0;

  return (
    <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8 max-w-6xl" aria-label="Tax Center">
      <DemoConnectCta
        headline="These harvestable losses are samples. What are yours?"
        sub="Connect your accounts to surface your real tax-loss harvesting opportunities and wash-sale risk, tracked all year."
      />

      {/* ─── 1. Header ─── */}
      {loading ? (
        <HeaderSkeleton />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2.5">
            {/* Eyebrow */}
            <div
              className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]"
              style={MONO}
            >
              ✦ Tax center · Pro
            </div>

            {/* Giant headline */}
            <h1 className="text-[22px] sm:text-[30px] md:text-[36px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] leading-[1.08]">
              Keep more of what you earn
            </h1>

            {/* Subtitle */}
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
              Helm tracks your tax lots and monitors wash-sale risk across your connected accounts.{' '}
              <a
                href="/tools/tlh-calculator"
                className="text-[var(--color-gold)] hover:underline font-medium"
              >
                Try the TLH calculator
              </a>
            </p>
          </div>

          {/* Year selector */}
          <div
            className="flex gap-[5px] text-[12px] tracking-[0.06em] shrink-0"
            style={MONO}
            role="group"
            aria-label="Tax year"
          >
            <span
              className="px-3 py-[7px] rounded-[5px] border border-[var(--color-border-base)] text-[var(--color-text-muted)]"
            >
              {CURRENT_YEAR - 1}
            </span>
            <span
              className="px-3 py-[7px] rounded-[5px] text-[var(--color-gold)]"
              style={{ background: 'rgba(230,185,77,0.1)', border: '1px solid rgba(230,185,77,0.25)' }}
              aria-current="true"
            >
              {CURRENT_YEAR}
            </span>
            <span
              className="px-3 py-[7px] rounded-[5px] border border-[var(--color-border-base)] text-[var(--color-text-muted)]"
            >
              Projected
            </span>
          </div>
        </div>
      )}

      {/* ─── 2. Realized summary (4-cell strip) ─── */}
      {loading ? (
        <GridSkeleton />
      ) : (
        <section
          aria-label="Realized summary"
          className="grid grid-cols-2 lg:grid-cols-4 rounded-md overflow-hidden"
          style={CARD}
        >
          {/* Realized gains · YTD */}
          <div className="p-[16px_18px] border-b lg:border-b-0 lg:border-r border-[var(--color-border-subtle)]">
            <div
              className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-[9px]"
              style={MONO}
            >
              Realized gains · YTD
            </div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[var(--color-positive)]" style={{ ...TNUM, ...MONO }}>
              +{formatCurrency(realizedGains)}
            </div>
          </div>

          {/* Realized losses · YTD */}
          <div className="p-[16px_18px] border-b lg:border-b-0 lg:border-r border-[var(--color-border-subtle)]">
            <div
              className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-[9px]"
              style={MONO}
            >
              Realized losses · YTD
            </div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[var(--color-negative-text)]" style={{ ...TNUM, ...MONO }}>
              {formatCurrency(realizedLosses)}
            </div>
          </div>

          {/* Net realized */}
          <div className="p-[16px_18px] border-r border-[var(--color-border-subtle)] lg:border-r">
            <div
              className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-[9px]"
              style={MONO}
            >
              Net realized
            </div>
            <div
              className={cn(
                'text-[20px] sm:text-[24px] font-bold',
                realizedYTD >= 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-negative-text)]',
              )}
              style={{ ...TNUM, ...MONO }}
            >
              {realizedYTD >= 0 ? '' : ''}
              {formatCurrency(realizedYTD)}
              <span className="ml-2 align-middle text-[12px] text-[var(--color-text-muted)] font-medium">
                {lotCount} lot{lotCount !== 1 ? 's' : ''} closed
              </span>
            </div>
          </div>

          {/* Est. tax owed */}
          <div className="p-[16px_18px]">
            <div
              className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-warning-text)] mb-[9px]"
              style={MONO}
            >
              ⚠ Est. tax owed
            </div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[var(--color-warning-text)]" style={{ ...TNUM, ...MONO }}>
              {formatCurrency(estimatedTaxDue)}
            </div>
          </div>
        </section>
      )}

      {/* ─── 2b. $3K Deduction Tracker (IRC §1211(b)) ─── */}
      {!loading && (
        <section aria-label="Ordinary income deduction tracker">
          <div className="rounded-md p-5" style={CARD}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
              <span
                className="text-[12px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                style={MONO}
              >
                §1211(b) Ordinary Income Offset
              </span>
              <span
                className="text-[14px] font-semibold text-[var(--color-text-primary)]"
                style={{ ...TNUM, ...MONO }}
              >
                {formatCurrency(deductionUsed)} of {formatCurrency(lossCap)}
                <span className="text-[10px] text-[var(--color-text-muted)] font-normal ml-1.5">
                  {filingStatus ? `· ${filingStatus}` : '· assumed'}
                </span>
              </span>
            </div>
            <div className="w-full h-2.5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-sm motion-safe:transition-all motion-safe:duration-300"
                style={{
                  width: `${Math.min((deductionUsed / lossCap) * 100, 100)}%`,
                  background: deductionUsed >= lossCap ? 'var(--color-gold)' : 'var(--color-positive)',
                }}
              />
            </div>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-2.5" style={MONO}>
              {deductionUsed >= lossCap
                ? `Cap reached — excess losses carry forward to TY ${CURRENT_YEAR + 1} per IRC §1212(b).`
                : deductionUsed > 0
                  ? `Net capital losses offset capital gains without limit, then up to ${formatCurrency(lossCap)} of ordinary income per year (IRC §1211(b): $3,000, or $1,500 married filing separately). ${filingStatus ? `Using your "${filingStatus}" filing status.` : 'Helm assumes $3,000 — set your filing status in Settings.'} ${formatCurrency(Math.max(0, lossCap - deductionUsed))} remaining; the excess carries forward indefinitely under IRC §1212(b).`
                  : 'No net capital losses to offset ordinary income this year.'}
            </p>

            <TaxProfilePrompt ratesAreYours={ratesAreYours} filingStatus={filingStatus} />

            <NettingOrder
              shortTermNet={shortTermNet}
              longTermNet={longTermNet}
              formatCurrency={formatCurrency}
            />

            <CarryforwardBank
              carryforward={carryoverLoss}
              formatCurrency={formatCurrency}
            />
          </div>
        </section>
      )}

      {/* ─── 3.9 Broken-thesis harvest callout (thesis users) ─── */}
      {!loading && brokenHarvests.length > 0 && (
        <BrokenThesisCallout opps={brokenHarvests} formatCurrency={formatCurrency} />
      )}

      {/* ─── 4. Tax-loss harvesting panel (gold-tinted) ─── */}
      {loading ? (
        <TableSkeleton />
      ) : harvestReport && harvestCount > 0 ? (
        <section
          aria-label="Tax-loss harvesting"
          className="rounded-lg overflow-hidden"
          style={{
            background: 'rgba(230,185,77,0.02)',
            border: '1px solid rgba(230,185,77,0.15)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Panel header: title + Available harvest */}
          <div
            className="px-5 sm:px-[22px] py-[18px] flex items-center justify-between gap-4"
            style={{ borderBottom: '1px solid rgba(230,185,77,0.1)' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                <span
                  className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--color-gold)]"
                  style={MONO}
                >
                  Tax-loss harvesting
                </span>
              </div>
              <div className="text-[15px] text-[var(--color-text-muted)] mt-1">
                {harvestCount} lot{harvestCount !== 1 ? 's' : ''} sitting on losses
                {washConflictCount > 0
                  ? ` · ${washConflictCount} wash-sale conflict${washConflictCount !== 1 ? 's' : ''} flagged`
                  : ' · none flagged by the 30-day lookback'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
                style={MONO}
              >
                Available harvest
              </div>
              <div
                className="text-[22px] sm:text-[24px] font-bold text-[var(--color-positive)] mt-0.5"
                style={{ ...TNUM, ...MONO }}
              >
                {formatCurrency(Math.abs(totalHarvestable))}
              </div>
            </div>
          </div>

          {/* Table column headers (desktop) */}
          <div
            className="hidden md:grid px-5 py-2.5 border-b border-[var(--color-border-subtle)]"
            style={{
              gridTemplateColumns: '72px 1fr 80px 96px 96px 104px 96px 100px 80px',
              gap: '8px',
              background: 'rgba(255,255,255,0.015)',
            }}
          >
            {['Symbol', 'Name', 'Shares', 'Basis', 'Mkt Value', 'Unrealized', 'Est. Saving', 'Wash Sale', 'Term'].map(
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
          {sortedOpportunities.map((opp: TaxOpportunity) => (
            <HarvestRow
              key={opp.ticker}
              opp={opp}
              ordinaryRate={ordinaryRate}
              ltcgRate={ltcgRate}
              formatCurrency={formatCurrency}
            />
          ))}

          {/* Panel footer: §1211(b) waterfall + Harvest CTA */}
          <div
            className="px-5 sm:px-[22px] py-[14px] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
            style={{ borderTop: '1px solid rgba(230,185,77,0.1)' }}
            aria-live="polite"
          >
            <HarvestLadder
              report={harvestReport}
              lotCount={washSafeCount}
              formatCurrency={formatCurrency}
            />
            <a
              href="/tools/tlh-calculator"
              className="self-start sm:self-auto px-4 py-[9px] rounded-[5px] text-[10px] font-bold uppercase tracking-[0.12em] motion-safe:transition-[filter] motion-safe:duration-150 hover:brightness-[1.08]"
              style={{ background: 'var(--color-gold)', color: '#0A0A0A', ...MONO }}
            >
              Harvest {formatCurrency(Math.abs(totalHarvestable))}
            </a>
          </div>
        </section>
      ) : (
        <NoHarvestEmpty />
      )}

      {/* ─── 4b. Retirement Account Losses (Ineligible) ─── */}
      {!loading && harvestReport && harvestReport.retirementPositions && harvestReport.retirementPositions.length > 0 && (
        <section
          aria-label="Retirement account losses"
          className="rounded-md overflow-hidden"
          style={CARD}
        >
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <span
                className="text-[12px] uppercase tracking-[0.15em] font-bold text-[var(--color-text-muted)]"
                style={MONO}
              >
                Retirement Account Losses
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-[var(--color-text-secondary)]"
                style={MONO}
              >
                {harvestReport.retirementPositions.length}
              </span>
            </div>
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
              Not eligible for tax-loss harvesting
            </span>
          </div>
          <div className="px-5 py-3 bg-[var(--color-bg-elevated)]/30 border-b border-[var(--color-border-subtle)]">
            <p className="text-[14px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
              These positions are in tax-advantaged accounts (IRA, 401k, Roth, etc.). Losses in retirement accounts cannot be used for tax-loss harvesting because gains and losses within these accounts are not taxable events.
            </p>
          </div>
          {harvestReport.retirementPositions.map((pos) => (
            <div
              key={`${pos.ticker}-${pos.accountName}`}
              className="px-4 sm:px-5 py-3.5 border-b border-[var(--color-border-subtle)] opacity-60"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-1.5 flex-wrap">
                <span className="text-[15px] font-bold text-[var(--color-text-muted)]" style={MONO}>
                  {pos.ticker}
                </span>
                <span className="text-[14px] sm:text-[15px] text-[var(--color-text-muted)] truncate flex-1 min-w-[60px]">
                  {pos.securityName}
                </span>
                {pos.accountSubtype && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', ...MONO }}
                  >
                    {pos.accountSubtype.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-x-4">
                <div>
                  <span className="text-[12px] text-[var(--color-text-muted)] block" style={MONO}>Shares</span>
                  <span className="text-[14px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>{pos.shares.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[var(--color-text-muted)] block" style={MONO}>Unrealized</span>
                  <span className="text-[14px] text-[var(--color-negative)]/60 tabular-nums" style={MONO}>{formatCurrency(pos.unrealizedLoss)}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[var(--color-text-muted)] block" style={MONO}>Tax Savings</span>
                  <span className="text-[14px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>$0 (exempt)</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ─── 5. Realized this year + Estimated tax by holding period ─── */}
      {!loading && (
        <section aria-label="Realized lots and estimated tax" className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Realized this year */}
          <div className="rounded-lg p-5 sm:p-[20px_22px]" style={CARD}>
            <div
              className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-3.5"
              style={MONO}
            >
              Realized this year
            </div>
            {taxData && taxData.realized.transactions.length > 0 ? (
              <div className="flex flex-col">
                {taxData.realized.transactions.slice(0, 6).map((tx, i) => {
                  const isGain = tx.gainLoss >= 0;
                  const dateLabel = new Date(tx.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
                  return (
                    <div
                      key={`${tx.ticker}-${tx.date}-${i}`}
                      className={cn(
                        'py-3 grid items-center gap-3.5',
                        i > 0 && 'border-t border-[var(--color-border-subtle)]',
                      )}
                      style={{ gridTemplateColumns: '1fr auto auto' }}
                    >
                      <div className="min-w-0">
                        <span
                          className="text-[15px] font-bold"
                          style={{ color: isGain ? 'var(--color-gold)' : 'var(--color-negative-text)', ...MONO }}
                        >
                          {tx.ticker}
                        </span>{' '}
                        <span className="text-[12px] text-[var(--color-text-muted)]">
                          · sold {tx.shares.toLocaleString()} sh · {dateLabel}
                        </span>
                      </div>
                      <span
                        className="text-[9px] uppercase tracking-[0.08em] shrink-0"
                        style={{
                          color: tx.gainLossType === 'short_term'
                            ? 'var(--color-warning-text)'
                            : 'var(--color-text-muted)',
                          ...MONO,
                        }}
                      >
                        {tx.gainLossType === 'short_term' ? 'Short-term' : 'Long-term'}
                      </span>
                      <span
                        className={cn(
                          'text-[15px] font-semibold tabular-nums text-right shrink-0',
                          isGain ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]',
                        )}
                        style={MONO}
                      >
                        {isGain ? '+' : ''}{formatCurrency(tx.gainLoss)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[15px] text-[var(--color-text-muted)] py-2" style={MONO}>
                No realized transactions yet this year.
              </p>
            )}
          </div>

          {/* Estimated tax by holding period */}
          <div className="rounded-lg p-5 sm:p-[20px_22px]" style={CARD}>
            <div
              className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-4"
              style={MONO}
            >
              Estimated tax · by holding period
            </div>
            <HoldingPeriodBars
              longTermNet={longTermNet}
              shortTermNet={shortTermNet}
              ordinaryRate={ordinaryRate}
              ltcgRate={ltcgRate}
              formatCurrency={formatCurrency}
            />
            <div className="mt-[18px] pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>
                After harvesting {formatCurrency(Math.abs(totalHarvestable))}
              </span>
              <span
                className="text-[15px] font-bold text-[var(--color-positive)] tabular-nums"
                style={MONO}
              >
                {harvestReport && harvestReport.totalEstimatedSavings > 0
                  ? `−${formatCurrency(harvestReport.totalEstimatedSavings)} owed`
                  : `${formatCurrency(estimatedTaxDue)} owed`}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── 5b. Short-Term vs Long-Term Breakdown ─── */}
      {!loading && (
        <section aria-label="Short-term vs long-term breakdown" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Short-term card */}
          <div className="rounded-md p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-sm" style={{ background: '#5B8DEF' }} />
              <span
                className="text-[12px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                style={MONO}
              >
                Short-Term Realized
              </span>
              <span
                className="ml-auto text-[14px] text-[var(--color-text-muted)]"
                style={MONO}
              >
                {ratesAreYours ? 'your' : 'assumed'} {(ordinaryRate * 100).toFixed(0)}% rate
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Gains</span>
                <span className="text-[14px] font-semibold text-[var(--color-positive)]" style={{ ...TNUM, ...MONO }}>
                  +{formatCurrency(shortTermGains)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Losses</span>
                <span className="text-[14px] font-semibold text-[var(--color-negative)]" style={{ ...TNUM, ...MONO }}>
                  {formatCurrency(shortTermLosses)}
                </span>
              </div>
              <div className="pt-1.5 mt-1 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Net</span>
                  <span
                    className={cn(
                      'text-[15px] font-bold',
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
          <div className="rounded-md p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-gold)' }} />
              <span
                className="text-[12px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                style={MONO}
              >
                Long-Term Realized
              </span>
              <span
                className="ml-auto text-[14px] text-[var(--color-text-muted)]"
                style={MONO}
              >
                {ratesAreYours ? 'your' : 'assumed'} {(ltcgRate * 100).toFixed(0)}% rate
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Gains</span>
                <span className="text-[14px] font-semibold text-[var(--color-positive)]" style={{ ...TNUM, ...MONO }}>
                  +{formatCurrency(longTermGains)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Losses</span>
                <span className="text-[14px] font-semibold text-[var(--color-negative)]" style={{ ...TNUM, ...MONO }}>
                  {formatCurrency(longTermLosses)}
                </span>
              </div>
              <div className="pt-1.5 mt-1 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Net</span>
                  <span
                    className={cn(
                      'text-[15px] font-bold',
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

      {/* ─── 6. Quarter Strip ─── */}
      {loading ? (
        <GridSkeleton />
      ) : (
        <section aria-label="Quarterly breakdown" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quarters.map((q) => {
            const isActive = q.status === 'in-progress';
            const statusColor =
              q.status === 'past'
                ? 'text-[var(--color-positive)]'
                : q.status === 'in-progress'
                  ? 'text-[var(--color-gold)]'
                  : 'text-[var(--color-text-muted)]';
            const statusLabel =
              q.status === 'past' ? 'Complete' : q.status === 'in-progress' ? 'In progress' : 'Upcoming';

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
                  <span className="text-[15px] font-bold text-[var(--color-text-primary)]">
                    {q.label}
                  </span>
                  <span className={cn('text-[10px] uppercase tracking-wider font-semibold', statusColor)} style={MONO}>
                    {statusLabel}
                  </span>
                </div>

                <p className="text-[14px] text-[var(--color-text-muted)] mb-3" style={MONO}>
                  {q.range}
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Gains</span>
                    <span className="text-[14px] font-semibold text-[var(--color-positive)]" style={TNUM}>
                      +{formatCurrency(q.gains)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Losses</span>
                    <span className="text-[14px] font-semibold text-[var(--color-negative)]" style={TNUM}>
                      {formatCurrency(q.losses)}
                    </span>
                  </div>
                  <div className="pt-1 mt-1 border-t border-[var(--color-border-subtle)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>Net</span>
                      <span
                        className={cn(
                          'text-[15px] font-bold',
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

      {/* ─── 6b. Realized Transactions Detail ─── */}
      {!loading && taxData && taxData.realized.transactions.length > 0 && (
        <section aria-label="Realized transactions">
          <div className="rounded-md overflow-hidden" style={CARD}>
            <button
              onClick={() => setShowRealizedTx((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-[var(--color-border-subtle)] cursor-pointer hover:bg-white/[0.02] motion-safe:transition-colors motion-safe:duration-100"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[12px] uppercase tracking-[0.15em] font-bold text-[var(--color-text-primary)]"
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
                        <span className="text-[14px] text-[var(--color-text-secondary)] tabular-nums" style={MONO}>
                          {tx.date}
                        </span>
                        <span className="text-[15px] font-bold text-[var(--color-text-primary)]" style={MONO}>
                          {tx.ticker}
                        </span>
                        <span />
                        <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
                          {formatCurrency(tx.proceeds)}
                        </span>
                        <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
                          {formatCurrency(tx.costBasis)}
                        </span>
                        <span
                          className={cn(
                            'text-[14px] font-semibold tabular-nums',
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
                            <span className="text-[15px] font-bold text-[var(--color-text-primary)]" style={MONO}>
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
                          <span className="text-[14px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>
                            {tx.date}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-x-4">
                          <div>
                            <span className="text-[14px] text-[var(--color-text-muted)] block" style={MONO}>Proceeds</span>
                            <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>{formatCurrency(tx.proceeds)}</span>
                          </div>
                          <div>
                            <span className="text-[14px] text-[var(--color-text-muted)] block" style={MONO}>Basis</span>
                            <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>{formatCurrency(tx.costBasis)}</span>
                          </div>
                          <div>
                            <span className="text-[14px] text-[var(--color-text-muted)] block" style={MONO}>Gain/Loss</span>
                            <span
                              className={cn(
                                'text-[14px] font-semibold tabular-nums',
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

      {/* ─── 7. Form 8949 Preview ─── */}
      {!loading && (
        <div id="form-8949-section">
          <Form8949Preview />
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[12px] text-[var(--color-text-muted)] text-center leading-relaxed max-w-3xl mx-auto" style={MONO}>
        {harvestReport?.disclaimer
          ?? 'Estimates only, not tax advice. Helm Terminal is not a registered tax advisor, CPA, or tax return preparer. Consult a qualified tax professional before acting.'}
      </p>
    </main>
  );
}

// ── The §1211(b) harvest ladder ──
//
// A single "estimated savings" figure hides the mechanism and reads as a
// worthless number: $960 on $305,427 of losses looks broken until you see that
// the other $302,427 is banked and offsets future gains without limit. The
// gain-offset row is the uncapped lever — when the user has realized gains it
// fills and the headline jumps, which is the feature teaching itself.

function HarvestLadder({
  report,
  lotCount,
  formatCurrency,
}: {
  report: TaxHarvestReport;
  lotCount: number;
  formatCurrency: (n: number) => string;
}) {
  const cap = report.annualCap;
  const found = Math.abs(report.totalHarvestableLoss);
  const rows: { label: string; amount: number; note: string; emphasis: boolean }[] = [
    {
      label: 'Offsets realized gains this year',
      amount: cap.gainsOffset,
      note: cap.gainsOffset > 0 ? 'no limit — IRC §1211(b)' : 'no limit, but you have no realized gains yet',
      emphasis: true,
    },
    {
      label: 'Deducts against ordinary income',
      amount: cap.ordinaryIncomeOffset,
      note: report.filingStatus
        ? `annual cap ${formatCurrency(cap.annualDeductionCap)} for ${report.filingStatus}`
        : `annual cap ${formatCurrency(cap.annualDeductionCap)} (assumed; $1,500 if married filing separately)`,
      emphasis: false,
    },
    {
      label: 'Carries forward to future years',
      amount: cap.estimatedCarryforward,
      note: 'never expires — IRC §1212(b)',
      emphasis: false,
    },
  ];

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[12px] text-[var(--color-text-secondary)]" style={MONO}>
          Harvestable losses found
        </span>
        <span className="text-[15px] font-semibold text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {formatCurrency(found)}
          <span className="text-[11px] text-[var(--color-text-muted)] font-normal ml-2">
            {lotCount} position{lotCount !== 1 ? 's' : ''}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5 pl-3" style={{ borderLeft: '1px solid var(--color-border-subtle)' }}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                'text-[11px] leading-snug',
                r.emphasis ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]',
              )}
              style={MONO}
            >
              {r.label}
              <span className="text-[10px] text-[var(--color-text-muted)] ml-1.5">· {r.note}</span>
            </span>
            <span
              className={cn(
                'text-[12px] tabular-nums shrink-0',
                r.amount > 0 ? 'text-[var(--color-text-primary)] font-semibold' : 'text-[var(--color-text-muted)]',
              )}
              style={MONO}
            >
              {formatCurrency(r.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2.5 text-[11px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
        Estimated tax reduced this year:{' '}
        <span className="text-[var(--color-positive)] font-semibold">
          {formatCurrency(report.totalEstimatedSavings)}
        </span>{' '}
        at {report.ratesFromSettings ? 'your' : 'an assumed'} {(report.taxRate * 100).toFixed(0)}% ordinary and{' '}
        {(report.ltcgRate * 100).toFixed(0)}% long-term rate.
        {cap.baselineSavings > 0 && (
          <>
            {' '}You already have {formatCurrency(cap.baselineSavings)} of that from losses realized earlier this
            year, so the figure above is what harvesting adds.
          </>
        )}
      </div>
    </div>
  );
}

// ── Estimated-tax-by-holding-period bars ──

function HoldingPeriodBars({
  longTermNet,
  shortTermNet,
  ordinaryRate,
  ltcgRate,
  formatCurrency,
}: {
  longTermNet: number;
  shortTermNet: number;
  ordinaryRate: number;
  ltcgRate: number;
  formatCurrency: (n: number) => string;
}) {
  // IRC §1222(11): a net loss in one character absorbs the other BEFORE any
  // rate applies. Flooring each side at zero and taxing it independently made
  // this card contradict the netted estimate printed inches below it.
  const totalTax = estimateTaxOnRealizedGains({
    stNet: shortTermNet,
    ltNet: longTermNet,
    ordinaryRate,
    ltcgRate,
  });
  const grossTax =
    Math.max(0, longTermNet) * ltcgRate + Math.max(0, shortTermNet) * ordinaryRate;
  const share = grossTax > 0 ? totalTax / grossTax : 0;
  const ltTax = Math.max(0, longTermNet) * ltcgRate * share;
  const stTax = Math.max(0, shortTermNet) * ordinaryRate * share;
  const maxTax = Math.max(ltTax, stTax, 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Long-term */}
      <div>
        <div className="flex justify-between mb-[7px]">
          <span className="text-[14px] text-[var(--color-text-secondary)]">
            Long-term gains · {(ltcgRate * 100).toFixed(0)}% rate
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text-primary)]" style={MONO}>
            {formatCurrency(ltTax)}
          </span>
        </div>
        <div className="h-1.5 rounded-[3px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div
            className="h-full"
            style={{ width: `${Math.min((ltTax / maxTax) * 100, 100)}%`, background: 'var(--color-positive)' }}
          />
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-[5px]" style={MONO}>
          {longTermNet > 0
            ? `${formatCurrency(longTermNet)} net long-term gain, after netting against short-term`
            : `${formatCurrency(longTermNet)} net long-term loss — offsets short-term gain first`}
        </div>
      </div>

      {/* Short-term */}
      <div>
        <div className="flex justify-between mb-[7px]">
          <span className="text-[14px] text-[var(--color-text-secondary)]">
            Short-term gains · {(ordinaryRate * 100).toFixed(0)}% rate
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text-primary)]" style={MONO}>
            {formatCurrency(stTax)}
          </span>
        </div>
        <div className="h-1.5 rounded-[3px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div
            className="h-full"
            style={{ width: `${Math.min((stTax / maxTax) * 100, 100)}%`, background: 'var(--color-warning-text)' }}
          />
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-[5px]" style={MONO}>
          {formatCurrency(shortTermNet)} taxed at ordinary income
        </div>
      </div>
    </div>
  );
}

// ── Tax profile prompt ──
//
// Settings drives the ordinary rate, the derived §1(h) band, and the §1211(b)
// cap. Until a user fills it in, every figure on this page is priced at Helm's
// defaults, and an MFS filer is shown twice the deduction the statute allows.
// The page labels those numbers "assumed" but never said they were fixable.
// Disappears once both are set.

function TaxProfilePrompt({
  ratesAreYours,
  filingStatus,
}: {
  ratesAreYours: boolean;
  filingStatus: string | null;
}) {
  if (ratesAreYours && filingStatus) return null;

  const missing = !ratesAreYours && !filingStatus
    ? 'your tax bracket and filing status'
    : !ratesAreYours
      ? 'your tax bracket'
      : 'your filing status';

  const consequence = !filingStatus
    ? 'Filing status sets the annual deduction limit, which is $1,500 rather than $3,000 if you file separately from your spouse.'
    : 'Your bracket sets the rate applied to short-term gains and losses, and the long-term rate derived from it.';

  return (
    <div
      className="mt-4 pt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      style={{ borderTop: '1px solid var(--color-border-subtle)' }}
    >
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
        <span className="text-[var(--color-gold)]">These figures use assumed rates.</span>{' '}
        Helm does not know {missing}. {consequence}
      </p>
      <a
        href="/dashboard/settings#tax"
        className="self-start sm:self-auto shrink-0 text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--color-gold)] hover:underline"
        style={MONO}
      >
        Set them &rarr;
      </a>
    </div>
  );
}

// ── Netting order (IRC §1222(11)) ──
//
// Two users with identical losses get different savings, and the headline looks
// arbitrary until you can see why: losses hit their OWN character first, and
// only the leftover crosses over. Short-term gain is taxed at the ordinary rate,
// so which side absorbs a loss decides what it is worth.

function NettingOrder({
  shortTermNet,
  longTermNet,
  formatCurrency,
}: {
  shortTermNet: number;
  longTermNet: number;
  formatCurrency: (n: number) => string;
}) {
  if (shortTermNet === 0 && longTermNet === 0) return null;

  const crossover =
    shortTermNet < 0 && longTermNet > 0
      ? `Your net short-term loss offsets long-term gain next, so ${formatCurrency(Math.min(Math.abs(shortTermNet), longTermNet))} of that gain is absorbed before any preferential rate applies.`
      : longTermNet < 0 && shortTermNet > 0
        ? `Your net long-term loss offsets short-term gain next, so ${formatCurrency(Math.min(Math.abs(longTermNet), shortTermNet))} of ordinary-rate gain is absorbed.`
        : 'Nothing crosses over: neither character is a net loss this year.';

  const col = (label: string, value: number, rateNote: string) => (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]" style={MONO}>
        {label}
      </div>
      <div
        className={cn(
          'text-[14px] font-semibold tabular-nums mt-0.5',
          value >= 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-negative)]',
        )}
        style={MONO}
      >
        {value >= 0 ? '+' : ''}{formatCurrency(value)}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5" style={MONO}>
        {rateNote}
      </div>
    </div>
  );

  return (
    <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-2.5" style={MONO}>
        Netting order · IRC §1222(11)
      </div>
      <div className="flex gap-5">
        {col('Short-term net', shortTermNet, 'ordinary rate')}
        {col('Long-term net', longTermNet, 'preferential rate')}
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-2.5" style={MONO}>
        Each character nets against itself first. {crossover}
      </p>
    </div>
  );
}

// ── Carryforward bank (IRC §1212(b)) ──
//
// The number that compounds. Losses beyond the annual cap are not lost — they
// carry indefinitely and keep their character. Helm does not read prior-year
// returns, so it says what it knows and names the gap rather than showing a
// bank that looks complete and is not.

function CarryforwardBank({
  carryforward,
  formatCurrency,
}: {
  carryforward: number;
  formatCurrency: (n: number) => string;
}) {
  if (carryforward <= 0) return null;
  return (
    <div className="mt-3.5 pt-3.5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]" style={MONO}>
          Carryforward bank · IRC §1212(b)
        </span>
        <span className="text-[14px] font-semibold text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {formatCurrency(carryforward)}
        </span>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-1.5" style={MONO}>
        Carried to future years from this year&rsquo;s net loss. It never expires and keeps its short-term or
        long-term character, so it offsets future gains of the same kind first. Helm does not read your prior
        returns, so carryovers from earlier years are not included here.
      </p>
    </div>
  );
}

// ── Holding-period clock (IRC §1222(3)) ──
//
// A short-term loss is worth MORE than a long-term one, because it absorbs
// short-term gain at the ordinary rate first. So a lot about to cross the
// one-year line is the opposite of the usual "hold for the discount" intuition,
// and nothing else in the product says so. States arithmetic, never a directive.

function HoldingPeriodClock({
  opp,
  ordinaryRate,
  ltcgRate,
  formatCurrency,
}: {
  opp: TaxOpportunity;
  ordinaryRate: number;
  ltcgRate: number;
  formatCurrency: (n: number) => string;
}) {
  const days = opp.daysToLongTerm;
  if (days == null) {
    return (
      <span>
        Helm has no acquisition date for this lot, so its holding period is unknown and the estimate above
        uses the long-term rate. Check your 1099-B.
      </span>
    );
  }
  if (days === 0) {
    return (
      <span>
        Held more than one year, so this is a long-term loss (IRC §1222(4)). It offsets long-term gain first,
        at an assumed {(ltcgRate * 100).toFixed(0)}%.
      </span>
    );
  }

  const loss = Math.abs(opp.unrealizedLoss);
  const delta = loss * (ordinaryRate - ltcgRate);
  return (
    <span>
      {days} day{days === 1 ? '' : 's'} to long-term
      {opp.longTermFrom ? ` (${opp.longTermFrom})` : ''}. While it stays short-term this loss offsets
      short-term gain at an assumed {(ordinaryRate * 100).toFixed(0)}% instead of {(ltcgRate * 100).toFixed(0)}%,
      a difference of about {formatCurrency(delta)} on {formatCurrency(loss)} of loss. Unlike a gain, a loss is
      worth more while it is short-term.
    </span>
  );
}

// ── Wash-sale window (IRC §1091) ──
//
// The 61-day window is symmetric and users only ever hear about the forward
// half. A strip makes the shape of the rule visible: 30 days before the sale,
// the sale, 30 days after.

function WashSaleWindow({ state }: { state: 'none' | 'advisory' | 'flagged' }) {
  const color =
    state === 'flagged' ? 'var(--color-warning-text)'
      : state === 'advisory' ? 'var(--color-gold)'
        : 'var(--color-positive)';
  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-1" aria-hidden="true">
        <div className="h-1 flex-1 rounded-l-[2px]" style={{ background: color, opacity: 0.35 }} />
        <div className="w-1.5 h-2.5 rounded-[1px] shrink-0" style={{ background: color }} />
        <div className="h-1 flex-1 rounded-r-[2px]" style={{ background: color, opacity: 0.18 }} />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--color-text-muted)]" style={MONO}>
        <span>30 days before · Helm checks this half</span>
        <span>sale</span>
        <span>30 days after · Helm cannot see this half</span>
      </div>
    </div>
  );
}

// ── Conviction helpers (thesis-aware TLH) ──

const CONVICTION_COLOR: Record<'intact' | 'weakening' | 'broken', string> = {
  intact: '#4ADE80',
  weakening: '#E6B94D',
  broken: '#F87171',
};

// Row-level conviction chip: surfaces the thesis status without needing to expand.
function ConvictionChip({ status }: { status: 'intact' | 'weakening' | 'broken' }) {
  const c = CONVICTION_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] uppercase tracking-wider font-semibold shrink-0"
      style={{ background: `${c}1A`, color: c, ...MONO }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      Thesis {status}
    </span>
  );
}

// Tax-center hero: when a harvestable loss sits on a broken thesis, the exit and the
// tax move point the same direction. Leads the section with that and a verbatim cite.
function BrokenThesisCallout({
  opps,
  formatCurrency,
}: {
  opps: TaxOpportunity[];
  formatCurrency: (n: number) => string;
}) {
  const lead = opps[0];
  const tickers = opps.map((o) => o.ticker);
  const totalSavings = opps.reduce((s, o) => s + o.estimatedSavings, 0);
  const red = CONVICTION_COLOR.broken;
  return (
    <section
      aria-label="Broken-thesis harvest opportunities"
      className="rounded-md p-5"
      style={{
        background: 'rgba(248,113,113,0.04)',
        border: '1px solid rgba(248,113,113,0.25)',
        borderLeft: `3px solid ${red}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4" style={{ color: red }} />
        <span className="text-[12px] uppercase tracking-[0.15em] font-bold" style={{ color: red, ...MONO }}>
          Conviction Alert
        </span>
      </div>
      <p className="text-[15px] text-[var(--color-text-primary)] leading-relaxed font-medium">
        {opps.length === 1 ? (
          <>
            This harvestable loss is on a <span style={{ color: red }}>broken thesis</span> ({tickers[0]}).
          </>
        ) : (
          <>
            {opps.length} harvestable losses are on <span style={{ color: red }}>broken theses</span> ({tickers.join(', ')}).
          </>
        )}{' '}
        When the thesis is broken, the exit and the tax move point the same direction. Estimated saving{' '}
        {formatCurrency(totalSavings)}.
      </p>
      {lead.thesisCite && (
        <blockquote
          className="mt-3 pl-3 text-[15px] text-[var(--color-text-secondary)] leading-relaxed"
          style={{ borderLeft: '2px solid rgba(248,113,113,0.4)' }}
        >
          &ldquo;{lead.thesisCite.excerpt}&rdquo;
          <span className="block mt-1 text-[12px] text-[var(--color-text-muted)]" style={MONO}>
            {lead.thesisCite.sourceTitle}
            {lead.thesisCite.publishedAt ? ` · ${lead.thesisCite.publishedAt.slice(0, 10)}` : ''}
            {' · '}
            {lead.ticker}
          </span>
        </blockquote>
      )}
    </section>
  );
}

// ── Harvest row component ──

function HarvestRow({
  opp,
  ordinaryRate,
  ltcgRate,
  formatCurrency,
}: {
  opp: TaxOpportunity;
  ordinaryRate: number;
  ltcgRate: number;
  formatCurrency: (n: number) => string;
}) {
  const washState: 'none' | 'advisory' | 'flagged' =
    opp.washSaleSeverity ?? (opp.washSaleRisk ? 'flagged' : 'none');
  const isWashSafe = washState !== 'flagged';
  const washBadge = washState === 'flagged' ? 'Wash-sale' : washState === 'advisory' ? 'Check' : 'No conflict';
  const [expanded, setExpanded] = useState(false);

  const washSaleDetailText = opp.washSaleDetail
    ?? (isWashSafe
      ? 'Helm found no purchase of this security, or of one we treat as related, in your linked accounts in the last 30 days. '
        + 'That is not a wash-sale clearance. IRC §1091 also disallows the loss if a substantially identical security is acquired in the 30 days AFTER the sale, '
        + 'by your IRA or Roth IRA (Rev. Rul. 2008-5, where the loss is permanently disallowed and is not added to basis), by your spouse, in an account you have not linked, '
        + 'or through automatic dividend reinvestment. Helm cannot see those.'
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
          'hover:bg-white/[0.02]',
        )}
        style={{
          gridTemplateColumns: '72px 1fr 80px 96px 96px 104px 96px 100px 80px',
          gap: '8px',
          boxShadow: opp.thesisStatus ? `inset 3px 0 0 ${CONVICTION_COLOR[opp.thesisStatus]}` : undefined,
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Symbol */}
        <span className="text-[15px] font-bold text-[var(--color-gold)]" style={MONO}>
          {opp.ticker}
        </span>

        {/* Name + conviction. overflow-hidden keeps the shrink-0 chip clipping
            inside this column instead of rendering over the Shares/Basis cells. */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className="text-[15px] text-[var(--color-text-secondary)] truncate">
            {opp.securityName}
          </span>
          {opp.thesisStatus && <ConvictionChip status={opp.thesisStatus} />}
        </div>

        {/* Shares */}
        <span className="text-[15px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {opp.shares.toLocaleString()}
        </span>

        {/* Basis */}
        <span className="text-[15px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {formatCurrency(opp.costBasis)}
        </span>

        {/* Market value */}
        <span className="text-[15px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
          {formatCurrency(opp.currentValue)}
        </span>

        {/* Unrealized */}
        <span className="text-[15px] font-semibold text-[var(--color-negative)] tabular-nums" style={MONO}>
          {formatCurrency(opp.unrealizedLoss)}
        </span>

        {/* Est. saving */}
        <span className="block text-right text-[15px] font-semibold text-[var(--color-positive)] tabular-nums" style={MONO}>
          {formatCurrency(opp.estimatedSavings)}
        </span>

        {/* Wash sale status — clickable to expand detail */}
        <button
          type="button"
          onClick={handleExpandToggle}
          className="flex items-center gap-1 cursor-pointer"
          aria-expanded={expanded}
          aria-label={`${washBadge} — show wash sale detail for ${opp.ticker}`}
        >
          {isWashSafe ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[9px] uppercase tracking-[0.1em] font-bold"
              style={{
                background: washState === 'advisory' ? 'rgba(230, 185, 77, 0.08)' : 'rgba(74, 222, 128, 0.08)',
                color: washState === 'advisory' ? 'var(--color-gold)' : 'var(--color-positive)',
                border: washState === 'advisory' ? '1px solid rgba(230,185,77,0.2)' : '1px solid rgba(74,222,128,0.2)',
                ...MONO,
              }}
            >
              {washBadge}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[9px] uppercase tracking-[0.1em] font-bold"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: 'var(--color-warning-text)',
                border: '1px solid rgba(245,158,11,0.2)',
                ...MONO,
              }}
            >
              Wash-sale
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
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] uppercase tracking-wider font-semibold"
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
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] uppercase tracking-wider font-semibold"
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
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] uppercase tracking-wider font-semibold"
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
            borderLeft: `3px solid ${washState === 'flagged' ? 'var(--color-warning-text)' : washState === 'advisory' ? 'var(--color-gold)' : 'var(--color-positive)'}`,
            background: washState === 'none' ? 'rgba(74, 222, 128, 0.03)' : 'rgba(251, 191, 36, 0.03)',
          }}
        >
          <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed" style={MONO}>
            <span className="font-semibold text-[var(--color-text-primary)]">What this means: </span>
            {washSaleDetailText}
          </p>
          <WashSaleWindow state={washState} />
          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed mt-2.5" style={MONO}>
            <span className="font-semibold text-[var(--color-text-secondary)]">Holding period: </span>
            <HoldingPeriodClock
              opp={opp}
              ordinaryRate={ordinaryRate}
              ltcgRate={ltcgRate}
              formatCurrency={formatCurrency}
            />
          </p>
        </div>
      )}

      {/* Thesis-aware harvest note (desktop) */}
      {expanded && opp.thesisStatus && (
        <div
          className="hidden md:block px-5 py-3 border-b border-[var(--color-border-subtle)]"
          style={{
            borderLeft: `3px solid ${opp.thesisStatus === 'broken' ? '#F87171' : opp.thesisStatus === 'weakening' ? '#E6B94D' : '#4ADE80'}`,
            background: opp.thesisStatus === 'broken' ? 'rgba(248,113,113,0.03)' : opp.thesisStatus === 'weakening' ? 'rgba(230,185,77,0.03)' : 'rgba(74,222,128,0.03)',
          }}
        >
          <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed" style={MONO}>
            {thesisTlhNote(opp.thesisStatus)}
          </p>
        </div>
      )}

      {/* Mobile card */}
      <div
        className="md:hidden px-4 py-3.5 border-b border-[var(--color-border-subtle)] motion-safe:transition-colors motion-safe:duration-100"
        style={{ boxShadow: opp.thesisStatus ? `inset 3px 0 0 ${CONVICTION_COLOR[opp.thesisStatus]}` : undefined }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 sm:gap-3 mb-2.5 flex-wrap">
          <span className="text-[15px] font-bold text-[var(--color-gold)]" style={MONO}>
            {opp.ticker}
          </span>
          {opp.thesisStatus && <ConvictionChip status={opp.thesisStatus} />}
          <span className="text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] truncate flex-1 min-w-[60px]">
            {opp.securityName}
          </span>
          {/* Holding period badge (mobile) */}
          {opp.holdingPeriod === 'short_term' ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] uppercase tracking-wider font-semibold shrink-0"
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
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] uppercase tracking-wider font-semibold shrink-0"
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
            aria-label={`${washBadge} — show wash sale detail for ${opp.ticker}`}
          >
            {isWashSafe ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[9px] uppercase tracking-[0.1em] font-bold"
                style={{
                  background: washState === 'advisory' ? 'rgba(230, 185, 77, 0.08)' : 'rgba(74, 222, 128, 0.08)',
                  color: washState === 'advisory' ? 'var(--color-gold)' : 'var(--color-positive)',
                  border: washState === 'advisory' ? '1px solid rgba(230,185,77,0.2)' : '1px solid rgba(74,222,128,0.2)',
                  ...MONO,
                }}
              >
                {washBadge}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[9px] uppercase tracking-[0.1em] font-bold"
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: 'var(--color-warning-text)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  ...MONO,
                }}
              >
                Wash-sale
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
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Shares</span>
            <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
              {opp.shares.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Basis</span>
            <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
              {formatCurrency(opp.costBasis)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Mkt Value</span>
            <span className="text-[14px] text-[var(--color-text-primary)] tabular-nums" style={MONO}>
              {formatCurrency(opp.currentValue)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Unrealized</span>
            <span className="text-[14px] font-semibold text-[var(--color-negative)] tabular-nums" style={MONO}>
              {formatCurrency(opp.unrealizedLoss)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Est. saving</span>
            <span className="text-[14px] font-semibold text-[var(--color-positive)] tabular-nums" style={MONO}>
              {formatCurrency(opp.estimatedSavings)}
            </span>
          </div>
        </div>

        {/* Expandable wash sale detail banner (mobile) */}
        {expanded && washSaleDetailText && (
          <div
            className="mt-2.5 ml-[26px] px-3 py-2.5 rounded-sm"
            style={{
              borderLeft: `3px solid ${washState === 'flagged' ? 'var(--color-warning-text)' : washState === 'advisory' ? 'var(--color-gold)' : 'var(--color-positive)'}`,
              background: washState === 'none' ? 'rgba(74, 222, 128, 0.03)' : 'rgba(251, 191, 36, 0.03)',
            }}
          >
            <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed" style={MONO}>
              <span className="font-semibold text-[var(--color-text-primary)]">What this means: </span>
              {washSaleDetailText}
            </p>
            <WashSaleWindow state={washState} />
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed mt-2.5" style={MONO}>
              <span className="font-semibold text-[var(--color-text-secondary)]">Holding period: </span>
              <HoldingPeriodClock
                opp={opp}
                ordinaryRate={ordinaryRate}
                ltcgRate={ltcgRate}
                formatCurrency={formatCurrency}
              />
            </p>
          </div>
        )}

        {/* Thesis-aware harvest note (mobile) */}
        {expanded && opp.thesisStatus && (
          <div
            className="mt-2.5 ml-[26px] px-3 py-2.5 rounded-sm"
            style={{
              borderLeft: `3px solid ${opp.thesisStatus === 'broken' ? '#F87171' : opp.thesisStatus === 'weakening' ? '#E6B94D' : '#4ADE80'}`,
              background: opp.thesisStatus === 'broken' ? 'rgba(248,113,113,0.03)' : opp.thesisStatus === 'weakening' ? 'rgba(230,185,77,0.03)' : 'rgba(74,222,128,0.03)',
            }}
          >
            <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed" style={MONO}>
              {thesisTlhNote(opp.thesisStatus)}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
