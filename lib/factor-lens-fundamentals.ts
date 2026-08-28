// Per-ticker fundamentals for the factor lens, cached for a day.
//
// The report reads six numbers per name (market cap and five ratios) and all
// of them move quarterly, yet /api/factor-lens used to pull quote + profile +
// financials + news live for up to 30 tickers on every visit: ~5 s cold, and
// on Vercel every instance starts cold. `unstable_cache` puts the derived
// metrics in the Data Cache, shared across instances, keyed by ticker.
//
// A day-long cache must never hold a provider outage, so an all-null result
// throws instead of returning; unstable_cache does not store thrown calls and
// the route falls back to an unclassified holding for that visit only.
import { unstable_cache } from 'next/cache';
import { getBasicFinancials, getCompanyProfile, type BasicFinancials, type CompanyProfile } from '@/lib/financial-data';
import type { FactorMetrics } from '@/lib/factor-lens';

export const FUNDAMENTALS_REVALIDATE_SECONDS = 24 * 60 * 60;

/** Single-name equities have filings to read. Funds and crypto do not; asking EDGAR is wasted calls. */
export function isEnrichable(assetClass: string | null | undefined): boolean {
  return assetClass == null || assetClass === 'equity';
}

export function toFactorMetrics(
  profile: Pick<CompanyProfile, 'marketCapitalization'> | null,
  financials: Pick<BasicFinancials, 'metric'> | null,
): Required<FactorMetrics> {
  const m = financials?.metric ?? {};
  const marketCapM = profile?.marketCapitalization; // millions
  return {
    marketCapB: marketCapM != null && marketCapM > 0 ? marketCapM / 1000 : null,
    pe: m['peBasicExclExtraTTM'] ?? null,
    pb: m['pbQuarterly'] ?? null,
    ps: m['psTTM'] ?? null,
    roe: m['roeTTM'] ?? null,
    debtToEquity: m['totalDebtToEquityQuarterly'] ?? m['debtEquityQuarterly'] ?? null,
  };
}

export function hasAnyMetric(m: FactorMetrics): boolean {
  return Object.values(m).some((v) => v != null);
}

async function fetchFactorMetrics(ticker: string): Promise<Required<FactorMetrics>> {
  const [profile, financials] = await Promise.all([getCompanyProfile(ticker), getBasicFinancials(ticker)]);
  const metrics = toFactorMetrics(profile, financials);
  if (!hasAnyMetric(metrics)) throw new Error(`no fundamentals for ${ticker}`);
  return metrics;
}

/** Cached per ticker for a day. Throws when nothing came back (never cached). */
export const getFactorMetrics = unstable_cache(fetchFactorMetrics, ['factor-metrics'], {
  revalidate: FUNDAMENTALS_REVALIDATE_SECONDS,
  tags: ['factor-metrics'],
});
