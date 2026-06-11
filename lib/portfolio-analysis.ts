/**
 * Portfolio analysis data layer.
 * Pulls holdings from Supabase, enriches with sector data,
 * calculates concentration risk, exposure, and unrealized gains.
 * Produces a comprehensive text context for the AI.
 *
 * Results are cached in-memory for 5 minutes per userId.
 */

import { createClient } from '@/lib/supabase/server';
import { getCompanyProfile } from '@/lib/financial-data';
import { CONCENTRATION_THRESHOLDS, CACHE_TTL } from '@/lib/financial-config';

// ── Types ──

export interface EnrichedHolding {
  ticker: string;
  securityName: string;
  shares: number;
  currentPrice: number;
  totalValue: number;
  costBasis: number | null;
  totalCostBasis: number | null;
  unrealizedGainLoss: number | null;
  unrealizedGainLossPct: number | null;
  dayChangePct: number | null;
  allocationPct: number;
  sector: string;
  industry: string;
  assetClass: string;
  exchange: string;
}

export interface ConcentrationAlert {
  ticker: string;
  securityName: string;
  allocationPct: number;
  totalValue: number;
  threshold: number;
  severity: 'critical' | 'high' | 'medium';
}

export interface SectorExposure {
  sector: string;
  totalValue: number;
  allocationPct: number;
  holdings: { ticker: string; value: number; pct: number }[];
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGainLoss: number;
  totalUnrealizedGainLossPct: number;
  positionCount: number;
  holdings: EnrichedHolding[];
  concentrationAlerts: ConcentrationAlert[];
  sectorExposure: SectorExposure[];
  topHolding: EnrichedHolding | null;
  largestGainer: EnrichedHolding | null;
  largestLoser: EnrichedHolding | null;
}

// ── In-memory cache (5 min TTL) ──

const cache = new Map<string, { data: PortfolioSummary; expiry: number }>();
const CACHE_TTL_MS = CACHE_TTL.portfolioAnalysis;

function getCached(userId: string): PortfolioSummary | null {
  const entry = cache.get(userId);
  if (entry && Date.now() < entry.expiry) return entry.data;
  if (entry) cache.delete(userId);
  return null;
}

function setCache(userId: string, data: PortfolioSummary) {
  cache.set(userId, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// ── Core data fetching ──

interface RawHolding {
  ticker: string;
  shares: number;
  current_price: number;
  total_value: number;
  average_cost_basis: number | null;
  total_cost_basis: number | null;
  unrealised_gain_loss: number | null;
  unrealised_gain_loss_pct: number | null;
  day_change_pct: number | null;
  portfolio_allocation_pct: number | null;
  security: {
    security_name: string | null;
    asset_class: string | null;
    sector: string | null;
    industry: string | null;
    exchange: string | null;
  } | null;
}

async function fetchHoldings(userId: string): Promise<RawHolding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('holdings')
    .select(`
      ticker, shares, current_price, total_value,
      average_cost_basis, total_cost_basis,
      unrealised_gain_loss, unrealised_gain_loss_pct,
      day_change_pct, portfolio_allocation_pct,
      security:securities(security_name, asset_class, sector, industry, exchange)
    `)
    .eq('user_id', userId)
    .order('total_value', { ascending: false });

  if (error) {
    console.error('portfolio-analysis: failed to fetch holdings', error);
    return [];
  }
  return (data || []) as unknown as RawHolding[];
}

// ── Sector enrichment via Finnhub (fills in missing sectors) ──

async function enrichSectors(holdings: RawHolding[]): Promise<void> {
  const needsEnrichment = holdings.filter(
    (h) => !h.security?.sector && h.ticker && !h.ticker.includes('-'),
  );

  // Enrich up to 5 at a time to stay within rate limits
  const batch = needsEnrichment.slice(0, 5);
  await Promise.allSettled(
    batch.map(async (h) => {
      try {
        const profile = await getCompanyProfile(h.ticker);
        if (profile && h.security) {
          h.security.sector = profile.industry || 'Unknown';
        }
      } catch {
        // Swallow — sector stays Unknown
      }
    }),
  );
}

// ── Build enriched holdings ──

function enrichHoldings(raw: RawHolding[], totalValue: number): EnrichedHolding[] {
  return raw.map((h) => ({
    ticker: h.ticker,
    securityName: h.security?.security_name || h.ticker,
    shares: h.shares,
    currentPrice: h.current_price,
    totalValue: h.total_value || 0,
    costBasis: h.average_cost_basis,
    totalCostBasis: h.total_cost_basis,
    unrealizedGainLoss: h.unrealised_gain_loss,
    unrealizedGainLossPct: h.unrealised_gain_loss_pct,
    dayChangePct: h.day_change_pct,
    allocationPct:
      h.portfolio_allocation_pct ?? (totalValue > 0 ? ((h.total_value || 0) / totalValue) * 100 : 0),
    sector: h.security?.sector || 'Unknown',
    industry: h.security?.industry || 'Unknown',
    assetClass: h.security?.asset_class || 'Unknown',
    exchange: h.security?.exchange || '',
  }));
}

// ── Concentration risk ──

function getConcentrationAlerts(holdings: EnrichedHolding[]): ConcentrationAlert[] {
  const alerts: ConcentrationAlert[] = [];
  for (const h of holdings) {
    if (h.allocationPct >= CONCENTRATION_THRESHOLDS.critical) {
      alerts.push({
        ticker: h.ticker,
        securityName: h.securityName,
        allocationPct: h.allocationPct,
        totalValue: h.totalValue,
        threshold: CONCENTRATION_THRESHOLDS.critical,
        severity: 'critical',
      });
    } else if (h.allocationPct >= CONCENTRATION_THRESHOLDS.high) {
      alerts.push({
        ticker: h.ticker,
        securityName: h.securityName,
        allocationPct: h.allocationPct,
        totalValue: h.totalValue,
        threshold: CONCENTRATION_THRESHOLDS.high,
        severity: 'high',
      });
    } else if (h.allocationPct >= CONCENTRATION_THRESHOLDS.medium) {
      alerts.push({
        ticker: h.ticker,
        securityName: h.securityName,
        allocationPct: h.allocationPct,
        totalValue: h.totalValue,
        threshold: CONCENTRATION_THRESHOLDS.medium,
        severity: 'medium',
      });
    }
  }
  return alerts.sort((a, b) => b.allocationPct - a.allocationPct);
}

// ── Sector exposure ──

function getSectorExposure(holdings: EnrichedHolding[], totalValue: number): SectorExposure[] {
  const map = new Map<string, { value: number; holdings: { ticker: string; value: number; pct: number }[] }>();

  for (const h of holdings) {
    const sector = h.sector;
    const existing = map.get(sector) || { value: 0, holdings: [] };
    existing.value += h.totalValue;
    existing.holdings.push({
      ticker: h.ticker,
      value: h.totalValue,
      pct: h.allocationPct,
    });
    map.set(sector, existing);
  }

  return [...map.entries()]
    .map(([sector, data]) => ({
      sector,
      totalValue: data.value,
      allocationPct: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      holdings: data.holdings.sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

// ── Main export: getPortfolioSummary ──

export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const cached = getCached(userId);
  if (cached) return cached;

  const raw = await fetchHoldings(userId);
  if (raw.length === 0) {
    return {
      totalValue: 0,
      totalCostBasis: 0,
      totalUnrealizedGainLoss: 0,
      totalUnrealizedGainLossPct: 0,
      positionCount: 0,
      holdings: [],
      concentrationAlerts: [],
      sectorExposure: [],
      topHolding: null,
      largestGainer: null,
      largestLoser: null,
    };
  }

  // Enrich missing sectors in the background
  await enrichSectors(raw);

  const totalValue = raw.reduce((s, h) => s + (h.total_value || 0), 0);
  const totalCostBasis = raw.reduce((s, h) => s + (h.total_cost_basis || 0), 0);
  const totalGL = raw.reduce((s, h) => s + (h.unrealised_gain_loss || 0), 0);

  const holdings = enrichHoldings(raw, totalValue);
  const concentrationAlerts = getConcentrationAlerts(holdings);
  const sectorExposure = getSectorExposure(holdings, totalValue);

  const withGL = holdings.filter((h) => h.unrealizedGainLoss != null);
  const largestGainer = withGL.length > 0
    ? withGL.reduce((best, h) => ((h.unrealizedGainLoss ?? 0) > (best.unrealizedGainLoss ?? 0) ? h : best))
    : null;
  const largestLoser = withGL.length > 0
    ? withGL.reduce((best, h) => ((h.unrealizedGainLoss ?? 0) < (best.unrealizedGainLoss ?? 0) ? h : best))
    : null;

  const summary: PortfolioSummary = {
    totalValue,
    totalCostBasis,
    totalUnrealizedGainLoss: totalGL,
    totalUnrealizedGainLossPct: totalCostBasis > 0 ? (totalGL / totalCostBasis) * 100 : 0,
    positionCount: holdings.length,
    holdings,
    concentrationAlerts,
    sectorExposure,
    topHolding: holdings[0] || null,
    largestGainer,
    largestLoser,
  };

  setCache(userId, summary);
  return summary;
}

// ── Format portfolio context for LLM ──

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPortfolioContext(summary: PortfolioSummary): string {
  if (summary.positionCount === 0) return '';

  const lines: string[] = [
    '=== USER PORTFOLIO (REAL DATA — reference specific numbers) ===',
    `Total Portfolio Value: $${fmt(summary.totalValue)}`,
    `Total Cost Basis: $${fmt(summary.totalCostBasis)}`,
    `Total Unrealized P&L: $${fmt(summary.totalUnrealizedGainLoss)} (${summary.totalUnrealizedGainLossPct >= 0 ? '+' : ''}${summary.totalUnrealizedGainLossPct.toFixed(2)}%)`,
    `Number of Positions: ${summary.positionCount}`,
    '',
  ];

  // ── Individual holdings ──
  lines.push('HOLDINGS (sorted by value):');
  for (const h of summary.holdings) {
    const gl = h.unrealizedGainLoss != null ? `$${fmt(h.unrealizedGainLoss)}` : 'N/A';
    const glPct = h.unrealizedGainLossPct != null ? `${(h.unrealizedGainLossPct * 100).toFixed(2)}%` : '';
    const dayChg = h.dayChangePct != null ? `${(h.dayChangePct * 100).toFixed(2)}%` : 'N/A';
    lines.push(
      `  ${h.ticker} (${h.securityName}) | ${h.shares} shares @ $${h.currentPrice} = $${fmt(h.totalValue)} | ` +
      `${h.allocationPct.toFixed(1)}% of portfolio | Cost basis: $${h.totalCostBasis != null ? fmt(h.totalCostBasis) : 'N/A'} | ` +
      `Unrealized P&L: ${gl} (${glPct}) | Day change: ${dayChg} | ` +
      `Sector: ${h.sector} | Class: ${h.assetClass}`
    );
  }

  // ── Concentration alerts ──
  if (summary.concentrationAlerts.length > 0) {
    lines.push('', 'CONCENTRATION ALERTS:');
    for (const a of summary.concentrationAlerts) {
      lines.push(
        `  [${a.severity.toUpperCase()}] ${a.ticker} at ${a.allocationPct.toFixed(1)}% ($${fmt(a.totalValue)}) — above ${a.threshold}% threshold`
      );
    }
  }

  // ── Sector breakdown ──
  lines.push('', 'SECTOR EXPOSURE:');
  for (const s of summary.sectorExposure) {
    const tickers = s.holdings.map((h) => h.ticker).join(', ');
    lines.push(`  ${s.sector}: $${fmt(s.totalValue)} (${s.allocationPct.toFixed(1)}%) — [${tickers}]`);
  }

  // ── Top gainer / loser ──
  if (summary.largestGainer && (summary.largestGainer.unrealizedGainLoss ?? 0) > 0) {
    lines.push('', `BEST PERFORMER: ${summary.largestGainer.ticker} — +$${fmt(summary.largestGainer.unrealizedGainLoss!)} (${((summary.largestGainer.unrealizedGainLossPct ?? 0) * 100).toFixed(1)}%)`);
  }
  if (summary.largestLoser && (summary.largestLoser.unrealizedGainLoss ?? 0) < 0) {
    lines.push(`WORST PERFORMER: ${summary.largestLoser.ticker} — -$${fmt(Math.abs(summary.largestLoser.unrealizedGainLoss!))} (${((summary.largestLoser.unrealizedGainLossPct ?? 0) * 100).toFixed(1)}%)`);
  }

  // ── Hypothetical impact helper ──
  lines.push('', 'HYPOTHETICAL IMPACT DATA (for scenario questions):');
  for (const s of summary.sectorExposure) {
    lines.push(`  If ${s.sector} drops 20%: portfolio loses $${fmt(s.totalValue * 0.2)} (${(s.allocationPct * 0.2).toFixed(1)}% of total)`);
  }

  return lines.join('\n');
}
