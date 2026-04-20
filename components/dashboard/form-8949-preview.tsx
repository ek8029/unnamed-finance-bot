'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Download, Copy, Check, ChevronDown, ChevronUp,
  FileText, AlertTriangle, Loader2,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';

// ── Shared style tokens ──

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const TNUM: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };

// ── Types ──

interface Form8949Row {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  adjustment: number;
  gainLoss: number;
}

interface Form8949Part {
  label: string;
  subtitle: string;
  rows: Form8949Row[];
  totalProceeds: number;
  totalCostBasis: number;
  totalAdjustment: number;
  totalGainLoss: number;
}

interface Form8949Data {
  taxYear: number;
  generatedAt: string;
  partI: Form8949Part;
  partII: Form8949Part;
  grandTotalProceeds: number;
  grandTotalCostBasis: number;
  grandTotalGainLoss: number;
  transactionCount: number;
}

// ── CSV generation ──

function generateCSV(data: Form8949Data): string {
  const header = 'Part,Description,Date Acquired,Date Sold,Proceeds,Cost or Other Basis,Adjustment,Gain or Loss';
  const lines: string[] = [header];

  const formatRow = (partLabel: string, row: Form8949Row): string => {
    return [
      `"${partLabel}"`,
      `"${row.description}"`,
      `"${row.dateAcquired}"`,
      `"${row.dateSold}"`,
      row.proceeds.toFixed(2),
      row.costBasis.toFixed(2),
      row.adjustment.toFixed(2),
      row.gainLoss.toFixed(2),
    ].join(',');
  };

  if (data.partI.rows.length > 0) {
    for (const row of data.partI.rows) {
      lines.push(formatRow('Short-Term', row));
    }
    lines.push(formatRow('Short-Term TOTALS', {
      description: '',
      dateAcquired: '',
      dateSold: '',
      proceeds: data.partI.totalProceeds,
      costBasis: data.partI.totalCostBasis,
      adjustment: data.partI.totalAdjustment,
      gainLoss: data.partI.totalGainLoss,
    }));
  }

  if (data.partII.rows.length > 0) {
    for (const row of data.partII.rows) {
      lines.push(formatRow('Long-Term', row));
    }
    lines.push(formatRow('Long-Term TOTALS', {
      description: '',
      dateAcquired: '',
      dateSold: '',
      proceeds: data.partII.totalProceeds,
      costBasis: data.partII.totalCostBasis,
      adjustment: data.partII.totalAdjustment,
      gainLoss: data.partII.totalGainLoss,
    }));
  }

  return lines.join('\n');
}

function downloadCSV(data: Form8949Data) {
  const csv = generateCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `form-8949-TY${data.taxYear}-helm.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Part Table ──

function PartTable({
  part,
  formatCurrency,
}: {
  part: Form8949Part;
  formatCurrency: (n: number) => string;
}) {
  if (part.rows.length === 0) {
    return (
      <div
        className="px-5 py-6 text-center"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        <p className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
          No {part.label === 'Part I' ? 'short-term' : 'long-term'} transactions for this tax year.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Column headers */}
      <div
        className="hidden md:grid px-5 py-2.5 border-b border-[var(--color-border-subtle)]"
        style={{
          gridTemplateColumns: '1.6fr 0.8fr 0.8fr 1fr 1fr 1fr',
          gap: '8px',
          background: 'rgba(255,255,255,0.015)',
        }}
      >
        {[
          '(a) Description',
          '(b) Date acquired',
          '(c) Date sold',
          '(d) Proceeds',
          '(e) Cost basis',
          '(h) Gain or (loss)',
        ].map((h) => (
          <span
            key={h}
            className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium"
            style={MONO}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {part.rows.map((row, i) => (
        <div key={i}>
          {/* Desktop row */}
          <div
            className="hidden md:grid items-center px-5 py-2.5 border-b border-[var(--color-border-subtle)] hover:bg-white/[0.02] motion-safe:transition-colors motion-safe:duration-100"
            style={{
              gridTemplateColumns: '1.6fr 0.8fr 0.8fr 1fr 1fr 1fr',
              gap: '8px',
            }}
          >
            <span className="text-[12px] text-[var(--color-text-primary)] truncate" style={MONO}>
              {row.description}
            </span>
            <span className="text-[12px] text-[var(--color-text-secondary)] tabular-nums" style={MONO}>
              {row.dateAcquired}
            </span>
            <span className="text-[12px] text-[var(--color-text-secondary)] tabular-nums" style={MONO}>
              {row.dateSold}
            </span>
            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums text-right" style={{ ...MONO, ...TNUM }}>
              {formatCurrency(row.proceeds)}
            </span>
            <span className="text-[12px] text-[var(--color-text-primary)] tabular-nums text-right" style={{ ...MONO, ...TNUM }}>
              {formatCurrency(row.costBasis)}
            </span>
            <span
              className={cn(
                'text-[12px] font-semibold tabular-nums text-right',
                row.gainLoss >= 0
                  ? 'text-[var(--color-positive)]'
                  : 'text-[var(--color-negative)]',
              )}
              style={{ ...MONO, ...TNUM }}
            >
              {row.gainLoss >= 0 ? '+' : ''}
              {formatCurrency(row.gainLoss)}
            </span>
          </div>

          {/* Mobile card */}
          <div className="md:hidden px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]" style={MONO}>
                {row.description}
              </span>
              <span
                className={cn(
                  'text-[12px] font-semibold tabular-nums',
                  row.gainLoss >= 0
                    ? 'text-[var(--color-positive)]'
                    : 'text-[var(--color-negative)]',
                )}
                style={{ ...MONO, ...TNUM }}
              >
                {row.gainLoss >= 0 ? '+' : ''}
                {formatCurrency(row.gainLoss)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>Acquired</span>
                <span className="text-[11px] text-[var(--color-text-secondary)] tabular-nums" style={MONO}>
                  {row.dateAcquired}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>Sold</span>
                <span className="text-[11px] text-[var(--color-text-secondary)] tabular-nums" style={MONO}>
                  {row.dateSold}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>Proceeds</span>
                <span className="text-[11px] text-[var(--color-text-primary)] tabular-nums" style={{ ...MONO, ...TNUM }}>
                  {formatCurrency(row.proceeds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>Basis</span>
                <span className="text-[11px] text-[var(--color-text-primary)] tabular-nums" style={{ ...MONO, ...TNUM }}>
                  {formatCurrency(row.costBasis)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Summary totals row */}
      <div
        className="hidden md:grid items-center px-5 py-3 border-b border-[var(--color-border-subtle)]"
        style={{
          gridTemplateColumns: '1.6fr 0.8fr 0.8fr 1fr 1fr 1fr',
          gap: '8px',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--color-text-secondary)]" style={MONO}>
          Totals
        </span>
        <span />
        <span />
        <span className="text-[12px] font-bold text-[var(--color-text-primary)] tabular-nums text-right" style={{ ...MONO, ...TNUM }}>
          {formatCurrency(part.totalProceeds)}
        </span>
        <span className="text-[12px] font-bold text-[var(--color-text-primary)] tabular-nums text-right" style={{ ...MONO, ...TNUM }}>
          {formatCurrency(part.totalCostBasis)}
        </span>
        <span
          className={cn(
            'text-[12px] font-bold tabular-nums text-right',
            part.totalGainLoss >= 0
              ? 'text-[var(--color-positive)]'
              : 'text-[var(--color-negative)]',
          )}
          style={{ ...MONO, ...TNUM }}
        >
          {part.totalGainLoss >= 0 ? '+' : ''}
          {formatCurrency(part.totalGainLoss)}
        </span>
      </div>

      {/* Mobile summary */}
      <div
        className="md:hidden px-4 py-3 border-b border-[var(--color-border-subtle)]"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--color-text-secondary)]" style={MONO}>
            Totals
          </span>
          <span
            className={cn(
              'text-[13px] font-bold tabular-nums',
              part.totalGainLoss >= 0
                ? 'text-[var(--color-positive)]'
                : 'text-[var(--color-negative)]',
            )}
            style={{ ...MONO, ...TNUM }}
          >
            {part.totalGainLoss >= 0 ? '+' : ''}
            {formatCurrency(part.totalGainLoss)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export function Form8949Preview() {
  const { formatCurrency } = useFormat();
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<Form8949Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch data when expanded
  useEffect(() => {
    if (!expanded || data) return;

    setLoading(true);
    setError(null);

    fetch('/api/tax/form-8949')
      .then((res) => {
        if (res.status === 403) {
          throw new Error('PRO_REQUIRED');
        }
        if (!res.ok) throw new Error('Failed to load Form 8949 data');
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        setError(err.message === 'PRO_REQUIRED' ? 'PRO_REQUIRED' : err.message);
      })
      .finally(() => setLoading(false));
  }, [expanded, data]);

  // Copy CSV to clipboard
  const handleCopy = useCallback(() => {
    if (!data) return;
    const csv = generateCSV(data);
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  // Download CSV
  const handleDownload = useCallback(() => {
    if (!data) return;
    downloadCSV(data);
  }, [data]);

  return (
    <section aria-label="Form 8949 Preview">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between px-5 py-4 rounded-md motion-safe:transition-all motion-safe:duration-200 cursor-pointer',
          expanded ? 'rounded-b-none' : '',
        )}
        style={{
          background: expanded
            ? 'var(--color-bg-surface)'
            : 'var(--color-bg-surface)',
          border: expanded
            ? '1px solid rgba(230, 185, 77, 0.2)'
            : '1px solid var(--color-border-base)',
          borderBottom: expanded ? '1px solid var(--color-border-subtle)' : undefined,
        }}
        aria-expanded={expanded}
        aria-controls="form-8949-content"
      >
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-[var(--color-gold)]" />
          <span
            className="text-[13px] font-semibold text-[var(--color-text-primary)]"
          >
            Preview Form 8949
          </span>
          <span
            className="text-[11px] text-[var(--color-text-muted)]"
            style={MONO}
          >
            Capital Gains and Losses
          </span>
        </div>
        <div className="flex items-center gap-3">
          {expanded && data && (
            <span
              className={cn(
                'text-[12px] font-semibold tabular-nums',
                data.grandTotalGainLoss >= 0
                  ? 'text-[var(--color-positive)]'
                  : 'text-[var(--color-negative)]',
              )}
              style={{ ...MONO, ...TNUM }}
            >
              Net: {data.grandTotalGainLoss >= 0 ? '+' : ''}
              {formatCurrency(data.grandTotalGainLoss)}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div
          id="form-8949-content"
          className="rounded-b-md overflow-hidden"
          style={{
            border: '1px solid rgba(230, 185, 77, 0.2)',
            borderTop: 'none',
            background: 'var(--color-bg-surface)',
          }}
        >
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-4 h-4 text-[var(--color-gold)] animate-spin" />
              <span className="text-[13px] text-[var(--color-text-muted)]" style={MONO}>
                Generating Form 8949...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && error !== 'PRO_REQUIRED' && (
            <div className="flex items-center justify-center py-12 gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)]" />
              <span className="text-[13px] text-[var(--color-warning-text)]">
                {error}
              </span>
            </div>
          )}

          {/* Data loaded */}
          {data && !loading && (
            <>
              {/* Action bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-medium"
                    style={MONO}
                  >
                    IRS Form 8949
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                    &middot;
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                    TY {data.taxYear}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                    &middot;
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                    {data.transactionCount} transaction{data.transactionCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium motion-safe:transition-colors motion-safe:duration-150 cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-base)',
                    }}
                    aria-label="Copy CSV to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-[var(--color-positive)]" />
                        <span className="text-[var(--color-positive)]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy CSV
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold motion-safe:transition-colors motion-safe:duration-150 cursor-pointer"
                    style={{
                      background: 'var(--color-gold)',
                      color: 'var(--color-bg-base)',
                    }}
                    aria-label="Download CSV"
                  >
                    <Download className="w-3 h-3" />
                    Download CSV
                  </button>
                </div>
              </div>

              {/* Part I: Short-Term */}
              <div className="border-b border-[var(--color-border-subtle)]">
                <div className="px-5 py-3 border-b border-[var(--color-border-subtle)]" style={{ background: 'rgba(91, 141, 239, 0.04)' }}>
                  <span
                    className="text-[11px] uppercase tracking-[0.12em] font-bold"
                    style={{ ...MONO, color: '#5B8DEF' }}
                  >
                    Part I &mdash; Short-term
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] ml-2" style={MONO}>
                    Held one year or less
                  </span>
                </div>
                <PartTable part={data.partI} formatCurrency={formatCurrency} />
              </div>

              {/* Part II: Long-Term */}
              <div className="border-b border-[var(--color-border-subtle)]">
                <div className="px-5 py-3 border-b border-[var(--color-border-subtle)]" style={{ background: 'rgba(230, 185, 77, 0.04)' }}>
                  <span
                    className="text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--color-gold)]"
                    style={MONO}
                  >
                    Part II &mdash; Long-term
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] ml-2" style={MONO}>
                    Held more than one year
                  </span>
                </div>
                <PartTable part={data.partII} formatCurrency={formatCurrency} />
              </div>

              {/* Grand totals */}
              <div
                className="px-5 py-3.5 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <span
                  className="text-[11px] uppercase tracking-[0.15em] font-bold text-[var(--color-text-secondary)]"
                  style={MONO}
                >
                  Combined totals
                </span>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                      Proceeds
                    </span>
                    <span className="text-[12px] font-bold text-[var(--color-text-primary)] tabular-nums" style={{ ...MONO, ...TNUM }}>
                      {formatCurrency(data.grandTotalProceeds)}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                      Basis
                    </span>
                    <span className="text-[12px] font-bold text-[var(--color-text-primary)] tabular-nums" style={{ ...MONO, ...TNUM }}>
                      {formatCurrency(data.grandTotalCostBasis)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                      Net Gain/Loss
                    </span>
                    <span
                      className={cn(
                        'text-[14px] font-bold tabular-nums',
                        data.grandTotalGainLoss >= 0
                          ? 'text-[var(--color-positive)]'
                          : 'text-[var(--color-negative)]',
                      )}
                      style={{ ...MONO, ...TNUM }}
                    >
                      {data.grandTotalGainLoss >= 0 ? '+' : ''}
                      {formatCurrency(data.grandTotalGainLoss)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="px-5 py-3 border-t border-[var(--color-border-subtle)]" style={{ background: 'rgba(251, 191, 36, 0.03)' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-[var(--color-warning-text)] mt-0.5 shrink-0" />
                  <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed" style={MONO}>
                    For informational purposes only. This preview is generated from your connected account data and may not
                    include all reportable transactions. Adjustments (column g) are not computed. Confirm all figures with your
                    1099-B and consult a qualified CPA or tax professional before filing.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Empty state */}
          {data && data.transactionCount === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="w-8 h-8 text-[var(--color-text-muted)] opacity-40 mb-3" />
              <p className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">
                No realized transactions
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
                Form 8949 data will appear after you sell securities.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
