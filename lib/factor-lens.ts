/**
 * Factor Lens - pure computation.
 *
 * Classifies portfolio holdings on lightweight style/quality factors and
 * aggregates value-weighted to a portfolio-level tilt. No I/O, no network.
 * The API layer sources marketCap + metrics (via getFullTickerData) and
 * passes enriched holdings in; this module only computes.
 */

// ── Factor buckets ──

export type SizeBucket = 'mega' | 'large' | 'mid' | 'small';
export type ValueGrowth = 'value' | 'blend' | 'growth';
export type Momentum = 'high' | 'neutral' | 'low';
export type Quality = 'high' | 'mixed' | 'low';
export type RateSensitivity = 'high' | 'neutral' | 'low';

// ── Inputs ──

/** Optional fundamentals sourced from the data layer (Finazon + EDGAR). */
export interface FactorMetrics {
  /** Market cap in USD billions. */
  marketCapB?: number | null;
  /** Trailing P/E. */
  pe?: number | null;
  /** Price / book. */
  pb?: number | null;
  /** Price / sales. */
  ps?: number | null;
  /** Return on equity, percent. */
  roe?: number | null;
  /** Debt / equity ratio. */
  debtToEquity?: number | null;
}

/** A holding enriched with optional metrics. */
export interface EnrichedHolding extends FactorMetrics {
  ticker: string;
  totalValue: number;
  /** Unrealised gain/loss percent (signed). Used as a momentum proxy. */
  unrealisedPct?: number | null;
  /** Today's price move percent (signed). Used for the day-driver attribution. */
  dayChangePct?: number | null;
  sector?: string | null;
}

// ── Per-holding classification ──

export interface ClassifiedHolding {
  ticker: string;
  totalValue: number;
  sector: string;
  size: SizeBucket | null;
  valueGrowth: ValueGrowth | null;
  momentum: Momentum | null;
  quality: Quality | null;
  rateSensitivity: RateSensitivity;
  dayChangePct: number | null;
  /** 'full' when metric-dependent factors could be classified, else 'partial'. */
  coverage: 'full' | 'partial';
}

// ── Portfolio-level report ──

export interface FactorDistribution {
  factor: 'size' | 'valueGrowth' | 'momentum' | 'quality' | 'rateSensitivity';
  /** bucket -> value-weighted fraction (0..1) of the classified-for-this-factor base. */
  weights: Record<string, number>;
}

export interface SectorWeight {
  sector: string;
  weight: number; // 0..1 of total portfolio value
}

export interface DayDriver {
  /** e.g. "Technology" or "growth". */
  bucket: string;
  /** Which dimension the bucket came from. */
  dimension: 'sector' | 'size' | 'valueGrowth' | 'momentum' | 'quality';
  /** This bucket's contribution to the aggregate day move, in percentage points. */
  contributionPct: number;
  /** Aggregate portfolio day move, in percentage points. */
  portfolioDayPct: number;
}

export interface FactorReport {
  /** One-sentence portfolio tilt summary. */
  tiltSummary: string;
  distributions: FactorDistribution[];
  sectorWeights: SectorWeight[];
  dayDriver: DayDriver | null;
  holdings: ClassifiedHolding[];
  coverage: {
    classified: number; // holdings with full metric coverage
    total: number;
  };
}

// ── Classifiers ──

function classifySize(marketCapB?: number | null): SizeBucket | null {
  if (marketCapB == null || !Number.isFinite(marketCapB) || marketCapB <= 0) return null;
  if (marketCapB > 200) return 'mega';
  if (marketCapB >= 10) return 'large';
  if (marketCapB >= 2) return 'mid';
  return 'small';
}

function classifyValueGrowth(pe?: number | null, pb?: number | null): ValueGrowth | null {
  // Prefer P/E; fall back to P/B. Negative P/E (losses) reads as growth.
  if (pe != null && Number.isFinite(pe)) {
    if (pe < 0) return 'growth';
    if (pe < 15) return 'value';
    if (pe > 30) return 'growth';
    return 'blend';
  }
  if (pb != null && Number.isFinite(pb)) {
    if (pb < 1.5) return 'value';
    if (pb > 4) return 'growth';
    return 'blend';
  }
  return null;
}

function classifyMomentum(unrealisedPct?: number | null): Momentum | null {
  if (unrealisedPct == null || !Number.isFinite(unrealisedPct)) return null;
  if (unrealisedPct > 15) return 'high';
  if (unrealisedPct < -5) return 'low';
  return 'neutral';
}

function classifyQuality(roe?: number | null, debtToEquity?: number | null): Quality | null {
  const hasRoe = roe != null && Number.isFinite(roe);
  const hasDe = debtToEquity != null && Number.isFinite(debtToEquity);
  if (!hasRoe && !hasDe) return null;
  const highRoe = hasRoe && (roe as number) > 15;
  const lowDebt = hasDe && (debtToEquity as number) < 1;
  if (highRoe && lowDebt) return 'high';
  // Weak on both available signals reads low; one good one mixed.
  const lowRoe = hasRoe && (roe as number) < 5;
  const highDebt = hasDe && (debtToEquity as number) >= 2;
  if (lowRoe || highDebt) return 'low';
  return 'mixed';
}

// Sector-proxy rate sensitivity. Long-duration cash flows (REITs, utilities,
// rate-driven financials) and high-multiple tech sell off when rates rise;
// energy and staples are comparatively insensitive.
const RATE_HIGH = new Set([
  'Real Estate',
  'Utilities',
  'Financials',
  'Financial Services',
  'Technology',
  'Information Technology',
  'Communication Services',
]);
const RATE_LOW = new Set([
  'Energy',
  'Consumer Staples',
  'Consumer Defensive',
  'Materials',
]);

function classifyRateSensitivity(sector: string): RateSensitivity {
  if (RATE_HIGH.has(sector)) return 'high';
  if (RATE_LOW.has(sector)) return 'low';
  return 'neutral';
}

// ── Value-weighted distribution helper ──

function weightedDistribution<T extends string>(
  rows: { value: number; bucket: T | null }[],
): Record<string, number> {
  const totals = new Map<string, number>();
  let base = 0;
  for (const r of rows) {
    if (r.bucket == null) continue;
    totals.set(r.bucket, (totals.get(r.bucket) ?? 0) + r.value);
    base += r.value;
  }
  const out: Record<string, number> = {};
  if (base <= 0) return out;
  for (const [bucket, v] of totals) out[bucket] = v / base;
  return out;
}

function topBucket(weights: Record<string, number>): string | null {
  let best: string | null = null;
  let bestW = -1;
  for (const [k, w] of Object.entries(weights)) {
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return best;
}

// ── Tilt summary phrasing ──

const SIZE_PHRASE: Record<SizeBucket, string> = {
  mega: 'Mega-cap',
  large: 'Large-cap',
  mid: 'Mid-cap',
  small: 'Small-cap',
};

// ── Main ──

export function buildFactorReport(holdings: EnrichedHolding[]): FactorReport {
  const total = holdings.length;
  const portfolioValue = holdings.reduce((s, h) => s + (h.totalValue || 0), 0);

  const classified: ClassifiedHolding[] = holdings.map((h) => {
    const sector = h.sector && h.sector !== 'Unknown' ? h.sector : 'Other';
    const size = classifySize(h.marketCapB);
    const valueGrowth = classifyValueGrowth(h.pe, h.pb);
    const momentum = classifyMomentum(h.unrealisedPct);
    const quality = classifyQuality(h.roe, h.debtToEquity);
    // "Full" coverage means the fundamental-driven factors resolved.
    const hasMetrics = size != null && valueGrowth != null && quality != null;
    return {
      ticker: h.ticker,
      totalValue: h.totalValue || 0,
      sector,
      size,
      valueGrowth,
      momentum,
      quality,
      rateSensitivity: classifyRateSensitivity(sector),
      dayChangePct: h.dayChangePct ?? null,
      coverage: hasMetrics ? 'full' : 'partial',
    };
  });

  // Metric-dependent aggregates exclude partial holdings.
  const full = classified.filter((c) => c.coverage === 'full');

  const distributions: FactorDistribution[] = [
    {
      factor: 'size',
      weights: weightedDistribution(full.map((c) => ({ value: c.totalValue, bucket: c.size }))),
    },
    {
      factor: 'valueGrowth',
      weights: weightedDistribution(full.map((c) => ({ value: c.totalValue, bucket: c.valueGrowth }))),
    },
    {
      factor: 'momentum',
      weights: weightedDistribution(classified.map((c) => ({ value: c.totalValue, bucket: c.momentum }))),
    },
    {
      factor: 'quality',
      weights: weightedDistribution(full.map((c) => ({ value: c.totalValue, bucket: c.quality }))),
    },
    {
      factor: 'rateSensitivity',
      weights: weightedDistribution(
        classified.map((c) => ({ value: c.totalValue, bucket: c.rateSensitivity as RateSensitivity })),
      ),
    },
  ];

  // Sector weights over the full portfolio.
  const sectorTotals = new Map<string, number>();
  for (const c of classified) sectorTotals.set(c.sector, (sectorTotals.get(c.sector) ?? 0) + c.totalValue);
  const sectorWeights: SectorWeight[] = [...sectorTotals.entries()]
    .map(([sector, v]) => ({ sector, weight: portfolioValue > 0 ? v / portfolioValue : 0 }))
    .sort((a, b) => b.weight - a.weight);

  const dayDriver = computeDayDriver(classified, portfolioValue);
  const tiltSummary = buildTiltSummary(distributions, sectorWeights);

  return {
    tiltSummary,
    distributions,
    sectorWeights,
    dayDriver,
    holdings: classified.sort((a, b) => b.totalValue - a.totalValue),
    coverage: { classified: full.length, total },
  };
}

// Attribute the aggregate day move to the bucket (sector or factor) that
// contributed the most signed percentage points. Contribution of a bucket =
// sum over its holdings of weight_i * dayChange_i.
function computeDayDriver(classified: ClassifiedHolding[], portfolioValue: number): DayDriver | null {
  if (portfolioValue <= 0) return null;
  const withDay = classified.filter((c) => c.dayChangePct != null);
  if (withDay.length === 0) return null;

  const portfolioDayPct = withDay.reduce(
    (s, c) => s + (c.totalValue / portfolioValue) * (c.dayChangePct as number),
    0,
  );

  type Key = { dimension: DayDriver['dimension']; bucket: string };
  const candidates: { key: Key; get: (c: ClassifiedHolding) => string | null }[] = [
    { key: { dimension: 'sector', bucket: '' }, get: (c) => c.sector },
    { key: { dimension: 'size', bucket: '' }, get: (c) => c.size },
    { key: { dimension: 'valueGrowth', bucket: '' }, get: (c) => c.valueGrowth },
    { key: { dimension: 'momentum', bucket: '' }, get: (c) => c.momentum },
    { key: { dimension: 'quality', bucket: '' }, get: (c) => c.quality },
  ];

  let best: DayDriver | null = null;
  for (const cand of candidates) {
    const contrib = new Map<string, number>();
    for (const c of withDay) {
      const b = cand.get(c);
      if (b == null) continue;
      const add = (c.totalValue / portfolioValue) * (c.dayChangePct as number);
      contrib.set(b, (contrib.get(b) ?? 0) + add);
    }
    for (const [bucket, pts] of contrib) {
      // Pick the bucket whose contribution best explains the move: same sign
      // as the aggregate and largest magnitude.
      const aligned = portfolioDayPct === 0 ? Math.abs(pts) : Math.sign(pts) === Math.sign(portfolioDayPct);
      const score = aligned ? Math.abs(pts) : 0;
      if (best == null || score > Math.abs(best.contributionPct)) {
        if (score > 0) {
          best = {
            bucket,
            dimension: cand.key.dimension,
            contributionPct: pts,
            portfolioDayPct,
          };
        }
      }
    }
  }
  return best;
}

function buildTiltSummary(
  distributions: FactorDistribution[],
  sectorWeights: SectorWeight[],
): string {
  const byFactor = (f: FactorDistribution['factor']) =>
    distributions.find((d) => d.factor === f)?.weights ?? {};

  const parts: string[] = [];

  const sizeTop = topBucket(byFactor('size')) as SizeBucket | null;
  if (sizeTop) parts.push(SIZE_PHRASE[sizeTop]);

  const vgTop = topBucket(byFactor('valueGrowth')) as ValueGrowth | null;
  if (vgTop === 'value') parts.push('value-leaning');
  else if (vgTop === 'growth') parts.push('growth-leaning');
  else if (vgTop === 'blend') parts.push('style-balanced');

  const momTop = topBucket(byFactor('momentum')) as Momentum | null;
  if (momTop === 'high') parts.push('high-momentum');
  else if (momTop === 'low') parts.push('low-momentum');

  const qTop = topBucket(byFactor('quality')) as Quality | null;
  if (qTop === 'high') parts.push('high-quality');
  else if (qTop === 'low') parts.push('lower-quality');

  // Concentration note from the top sector.
  const topSector = sectorWeights[0];
  let tail = '';
  if (topSector) {
    const pct = Math.round(topSector.weight * 100);
    if (topSector.weight >= 0.4) tail = `concentrated in ${topSector.sector} (${pct}%)`;
    else tail = `led by ${topSector.sector} (${pct}%)`;
  }

  if (parts.length === 0 && !tail) return 'Not enough data to characterize portfolio tilt.';
  const head = parts.join(', ');
  if (head && tail) return `${head}, ${tail}.`;
  if (head) return `${head}.`;
  return `${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
}
