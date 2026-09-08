import type { EarningsReport, EarningsPosition } from '@/hooks/use-financial-data';

// Illustrative fixtures only: dates, prices and results are not market data.
// Kept separate from the authenticated earnings endpoint and its calculations.
const position = (ticker: string, securityName: string, shares: number, currentPrice: number, allocationPct: number): EarningsPosition => ({
  ticker, securityName, shares, currentPrice, totalValue: shares * currentPrice, allocationPct, sector: 'Technology',
});

export const DEMO_EARNINGS: EarningsReport = {
  sample: true,
  upcoming: [
    { ticker: 'MSFT', companyName: 'Microsoft', date: '2026-10-27', time: 'after_close', estimated: true, epsEstimate: null, revenueEstimate: null, position: position('MSFT', 'Microsoft', 50, 420, 8.5), beatImpact5pct: null, missImpact5pct: null, thesisStatus: 'intact', testPillar: 'Cloud growth remains strong enough to support the cost of expanding infrastructure.' },
    { ticker: 'AAPL', companyName: 'Apple', date: '2026-10-29', time: 'after_close', estimated: true, epsEstimate: null, revenueEstimate: null, position: position('AAPL', 'Apple', 80, 220, 7.1), beatImpact5pct: null, missImpact5pct: null },
  ],
  recent: [
    { ticker: 'NVDA', companyName: 'NVIDIA', date: '2026-08-26', epsActual: 1.2, epsEstimate: null, epsYearAgo: 1, epsYoyPct: 20, surprisePct: null, beat: false, position: position('NVDA', 'NVIDIA', 100, 140, 5.6), estimatedImpact: null, actualPostEarningsMove: null, actualDollarImpact: null },
  ],
  totalUpcomingExposure: 38600,
  recentNetImpact: 0,
};
