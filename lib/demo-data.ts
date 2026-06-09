/**
 * Demo data for users who haven't connected Plaid yet.
 * Realistic but obviously fake — designed to show dashboard value.
 */

const now = new Date();
const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(now);
  d.setMonth(d.getMonth() - (5 - i));
  return d.toISOString().slice(0, 7); // YYYY-MM
});

export const DEMO_FINANCIAL_SUMMARY = {
  net_worth: 247_832,
  total_assets: 289_150,
  total_liabilities: 41_318,
  monthly_cash_flow: 3_420,
  portfolio_value: 184_600,
  changes: {
    assets: 2.4,
    liabilities: -0.8,
    cash_flow: 12.5,
    portfolio: 3.1,
    net_worth: 2.8,
  },
};

export const DEMO_HEALTH_SCORE = {
  score: 78,
  debt_to_asset_ratio: 0.143,
  savings_rate: 0.24,
  emergency_fund_months: 4.2,
  portfolio_diversification: 0.72,
};

export const DEMO_ACCOUNTS = [
  { id: 'demo-1', institution: 'Chase', account_type: 'checking', balance: 12_450, account_name: 'Total Checking', sync_status: 'synced', last_synced_at: now.toISOString() },
  { id: 'demo-2', institution: 'Chase', account_type: 'savings', balance: 34_200, account_name: 'Savings', sync_status: 'synced', last_synced_at: now.toISOString() },
  { id: 'demo-3', institution: 'Fidelity', account_type: 'brokerage', balance: 142_500, account_name: 'Individual Brokerage', sync_status: 'synced', last_synced_at: now.toISOString() },
  { id: 'demo-4', institution: 'Vanguard', account_type: 'brokerage', balance: 42_100, account_name: 'Roth IRA', sync_status: 'synced', last_synced_at: now.toISOString() },
  { id: 'demo-5', institution: 'Chase', account_type: 'credit_card', balance: -3_218, account_name: 'Sapphire Reserve', sync_status: 'synced', last_synced_at: now.toISOString() },
];

export const DEMO_HOLDINGS = [
  { id: 'h-1', ticker: 'AAPL', asset_name: 'Apple Inc.', shares: 85, current_price: 198.50, total_value: 16_872, day_change_percentage: 1.2, portfolio_allocation: 9.1, sector: 'Technology', cost_basis: 14_200, unrealised_gain: 2_672 },
  { id: 'h-2', ticker: 'MSFT', asset_name: 'Microsoft Corp.', shares: 42, current_price: 445.20, total_value: 18_698, day_change_percentage: -0.3, portfolio_allocation: 10.1, sector: 'Technology', cost_basis: 15_800, unrealised_gain: 2_898 },
  { id: 'h-3', ticker: 'NVDA', asset_name: 'NVIDIA Corp.', shares: 25, current_price: 924.80, total_value: 23_120, day_change_percentage: 2.8, portfolio_allocation: 12.5, sector: 'Technology', cost_basis: 18_500, unrealised_gain: 4_620 },
  { id: 'h-4', ticker: 'GOOGL', asset_name: 'Alphabet Inc.', shares: 60, current_price: 178.30, total_value: 10_698, day_change_percentage: 0.5, portfolio_allocation: 5.8, sector: 'Technology', cost_basis: 9_200, unrealised_gain: 1_498 },
  { id: 'h-5', ticker: 'VOO', asset_name: 'Vanguard S&P 500 ETF', shares: 120, current_price: 528.40, total_value: 63_408, day_change_percentage: 0.4, portfolio_allocation: 34.3, sector: 'Index Fund', cost_basis: 52_000, unrealised_gain: 11_408 },
  { id: 'h-6', ticker: 'AMZN', asset_name: 'Amazon.com Inc.', shares: 55, current_price: 192.60, total_value: 10_593, day_change_percentage: -1.1, portfolio_allocation: 5.7, sector: 'Consumer', cost_basis: 8_800, unrealised_gain: 1_793 },
  { id: 'h-7', ticker: 'JPM', asset_name: 'JPMorgan Chase', shares: 70, current_price: 215.40, total_value: 15_078, day_change_percentage: 0.8, portfolio_allocation: 8.2, sector: 'Financials', cost_basis: 12_600, unrealised_gain: 2_478 },
  { id: 'h-8', ticker: 'VTI', asset_name: 'Vanguard Total Stock', shares: 95, current_price: 278.90, total_value: 26_496, day_change_percentage: 0.3, portfolio_allocation: 14.3, sector: 'Index Fund', cost_basis: 22_000, unrealised_gain: 4_496 },
];

export const DEMO_NET_WORTH_HISTORY = months.map((month, i) => ({
  month,
  value: 220_000 + i * 5_500 + (Math.random() - 0.3) * 3_000,
  assets: 260_000 + i * 5_800,
  liabilities: 43_000 - i * 300,
}));

export const DEMO_CASH_FLOW_HISTORY = months.map((month) => {
  const income = 8_200 + Math.random() * 800;
  const expenses = 4_500 + Math.random() * 1_200;
  return { month, income: Math.round(income), expenses: Math.round(expenses), netFlow: Math.round(income - expenses) };
});

export const DEMO_ASSETS_COMPOSITION = [
  { name: 'Investments', value: 184_600, percentage: 63.8, items: ['Fidelity Brokerage', 'Vanguard IRA'] },
  { name: 'Cash', value: 46_650, percentage: 16.1, items: ['Chase Checking', 'Chase Savings'] },
  { name: 'Retirement', value: 42_100, percentage: 14.6, items: ['Vanguard Roth IRA'] },
  { name: 'Other', value: 15_800, percentage: 5.5 },
];

export const DEMO_LIABILITIES_COMPOSITION = [
  { name: 'Credit Cards', value: 3_218, percentage: 7.8, items: ['Chase Sapphire Reserve'] },
  { name: 'Student Loans', value: 28_100, percentage: 68.0 },
  { name: 'Auto Loan', value: 10_000, percentage: 24.2 },
];

export const DEMO_SAVINGS_RATE = months.map((month) => ({
  month,
  rate: 22 + Math.random() * 8,
  saved: 2_800 + Math.random() * 1_200,
}));

export const DEMO_INSIGHTS = [
  { id: 'di-1', type: 'tax_loss_harvest', priority: 'high', title: 'Tax-loss harvesting opportunity: AMZN', description: 'AMZN is down 12% from cost basis. Harvesting this loss could save ~$580 in taxes this year.', recommended_action: 'Consider selling AMZN and replacing with a correlated ETF to maintain exposure.', estimated_impact: 580, source: 'portfolio', created_at: now.toISOString() },
  { id: 'di-2', type: 'concentration_risk', priority: 'medium', title: 'Portfolio concentrated in Technology (43%)', description: 'Technology stocks make up 43% of your portfolio. A sector downturn could significantly impact returns.', recommended_action: 'Consider rebalancing into healthcare, energy, or international exposure.', estimated_impact: null, source: 'portfolio', created_at: now.toISOString() },
  { id: 'di-3', type: 'savings_rate', priority: 'low', title: 'Strong savings rate: 24% this month', description: 'You saved $3,420 this month, beating your 6-month average of $2,950. Keep it up.', recommended_action: null, estimated_impact: null, source: 'cash_flow', created_at: now.toISOString() },
];

export const DEMO_BRIEF = {
  portfolio: { totalValue: 184_600, overnightChange: 1_842, overnightChangePct: 1.01, vsBenchmark: 0.3 },
  market: {
    spy: { price: 528.40, changePct: 0.71 },
    qqq: { price: 462.15, changePct: 1.12 },
    vix: { price: 14.2, level: 'low' },
    treasury: { price: 4.28, changePct: -0.02 },
  },
  movers: [
    { ticker: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', changePct: 2.8, dollarImpact: 647 },
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', changePct: 1.2, dollarImpact: 202 },
    { ticker: 'AMZN', name: 'Amazon.com', sector: 'Consumer', changePct: -1.1, dollarImpact: -117 },
  ],
  allHoldings: [
    { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', changePct: 2.8, dollarImpact: 647 },
    { ticker: 'AAPL', name: 'Apple', sector: 'Technology', changePct: 1.2, dollarImpact: 202 },
    { ticker: 'JPM', name: 'JPMorgan', sector: 'Financials', changePct: 0.8, dollarImpact: 121 },
    { ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology', changePct: 0.5, dollarImpact: 53 },
    { ticker: 'VOO', name: 'S&P 500 ETF', sector: 'Index Fund', changePct: 0.4, dollarImpact: 254 },
    { ticker: 'VTI', name: 'Total Stock', sector: 'Index Fund', changePct: 0.3, dollarImpact: 79 },
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', changePct: -0.3, dollarImpact: -56 },
    { ticker: 'AMZN', name: 'Amazon', sector: 'Consumer', changePct: -1.1, dollarImpact: -117 },
  ],
  sectorHeat: [
    { sector: 'Technology', weight: 37.5, changePct: 1.1, tickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL'] },
    { sector: 'Index Funds', weight: 48.6, changePct: 0.35, tickers: ['VOO', 'VTI'] },
    { sector: 'Financials', weight: 8.2, changePct: 0.8, tickers: ['JPM'] },
    { sector: 'Consumer', weight: 5.7, changePct: -1.1, tickers: ['AMZN'] },
  ],
  earningsThisWeek: [{ ticker: 'AAPL', reportDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], portfolioWeight: 9.1 }],
  dividendsThisWeek: [{ ticker: 'VOO', exDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], cashAmount: 1.5975, payDate: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0] }],
};
