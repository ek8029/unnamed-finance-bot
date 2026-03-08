import {
  Account,
  Holding,
  Insight,
  FinancialSummary,
  FinancialHealthScore,
  TaxIntelligence,
  NetWorthDataPoint,
  PortfolioAllocation,
  Transaction,
} from '@/types';

// Mock accounts
export const mockAccounts: Account[] = [
  {
    id: '1',
    user_id: 'user1',
    institution: 'Chase',
    account_type: 'checking',
    balance: 12340,
  },
  {
    id: '2',
    user_id: 'user1',
    institution: 'Chase',
    account_type: 'savings',
    balance: 45000,
  },
  {
    id: '3',
    user_id: 'user1',
    institution: 'Amex',
    account_type: 'credit_card',
    balance: -3210,
  },
  {
    id: '4',
    user_id: 'user1',
    institution: 'Fidelity',
    account_type: 'brokerage',
    balance: 318200,
  },
  {
    id: '5',
    user_id: 'user1',
    institution: 'Coinbase',
    account_type: 'crypto',
    balance: 24500,
  },
];

// Mock holdings
export const mockHoldings: Holding[] = [
  {
    id: '1',
    user_id: 'user1',
    ticker: 'AAPL',
    asset_name: 'Apple Inc.',
    shares: 150,
    current_price: 182.31,
    total_value: 27346.5,
    day_change_percentage: 1.24,
    portfolio_allocation: 8.6,
    sector: 'Technology',
    asset_class: 'Equity',
    cost_basis: 158.4,
    unrealised_gain: 3586.5,
  },
  {
    id: '2',
    user_id: 'user1',
    ticker: 'NVDA',
    asset_name: 'NVIDIA Corporation',
    shares: 100,
    current_price: 875.28,
    total_value: 87528,
    day_change_percentage: 2.81,
    portfolio_allocation: 27.5,
    sector: 'Technology',
    asset_class: 'Equity',
    cost_basis: 642.1,
    unrealised_gain: 23318,
  },
  {
    id: '3',
    user_id: 'user1',
    ticker: 'SPY',
    asset_name: 'SPDR S&P 500 ETF',
    shares: 200,
    current_price: 503.42,
    total_value: 100684,
    day_change_percentage: 0.52,
    portfolio_allocation: 31.7,
    sector: 'Diversified',
    asset_class: 'ETF',
    cost_basis: 468.5,
    unrealised_gain: 6984,
  },
  {
    id: '4',
    user_id: 'user1',
    ticker: 'MSFT',
    asset_name: 'Microsoft Corporation',
    shares: 75,
    current_price: 416.42,
    total_value: 31231.5,
    day_change_percentage: -0.34,
    portfolio_allocation: 9.8,
    sector: 'Technology',
    asset_class: 'Equity',
    cost_basis: 398.2,
    unrealised_gain: 1351.5,
  },
  {
    id: '5',
    user_id: 'user1',
    ticker: 'GOOGL',
    asset_name: 'Alphabet Inc.',
    shares: 120,
    current_price: 141.80,
    total_value: 17016,
    day_change_percentage: 1.12,
    portfolio_allocation: 5.4,
    sector: 'Technology',
    asset_class: 'Equity',
    cost_basis: 128.7,
    unrealised_gain: 1796,
  },
  {
    id: '6',
    user_id: 'user1',
    ticker: 'AMZN',
    asset_name: 'Amazon.com Inc.',
    shares: 90,
    current_price: 178.25,
    total_value: 16042.5,
    day_change_percentage: 0.89,
    portfolio_allocation: 5.0,
    sector: 'Technology',
    asset_class: 'Equity',
    cost_basis: 142.3,
    unrealised_gain: 3227.5,
  },
  {
    id: '7',
    user_id: 'user1',
    ticker: 'BTC',
    asset_name: 'Bitcoin',
    shares: 0.35,
    current_price: 62500,
    total_value: 21875,
    day_change_percentage: -1.45,
    portfolio_allocation: 6.9,
    sector: 'Cryptocurrency',
    asset_class: 'Crypto',
    cost_basis: 48200,
    unrealised_gain: -4987.5,
  },
  {
    id: '8',
    user_id: 'user1',
    ticker: 'ETH',
    asset_name: 'Ethereum',
    shares: 6.5,
    current_price: 3420,
    total_value: 22230,
    day_change_percentage: -0.92,
    portfolio_allocation: 7.0,
    sector: 'Cryptocurrency',
    asset_class: 'Crypto',
    cost_basis: 2860,
    unrealised_gain: -4165,
  },
];

// Mock financial summary

// Mock insights with enhanced AI intelligence
export const mockInsights: Insight[] = [
  {
    id: '1',
    user_id: 'user1',
    type: 'market',
    title: 'SEC Filing Alert: NVDA Competitor Reports 340% Revenue Growth',
    description:
      'AMD filed 10-Q showing massive Q4 data center revenue increase ($3.5B, up 340% YoY), directly competing with NVIDIA\'s AI chip business. This represents your largest portfolio holding (27.5%).',
    recommended_action:
      'Review NVIDIA\'s competitive position. Consider partial profit-taking or rebalancing to reduce concentration risk.',
    timestamp: new Date('2024-03-07T10:30:00'),
    is_dismissed: false,
  },
  {
    id: '2',
    user_id: 'user1',
    type: 'market',
    title: 'Insider Trading Signal: AAPL Executive Stock Sales',
    description:
      'Apple CFO and 3 SVPs filed Form 4s showing combined stock sales of $12.3M over the past 2 weeks. This is 2.8x higher than their typical quarterly selling activity.',
    recommended_action:
      'Monitor for negative news or earnings guidance. Insider selling often precedes stock weakness. Position represents 8.6% of portfolio.',
    timestamp: new Date('2024-03-07T08:15:00'),
    is_dismissed: false,
  },
  {
    id: '3',
    user_id: 'user1',
    type: 'portfolio',
    title: 'High Technology Sector Concentration',
    description:
      'You are currently 58% exposed to technology companies. This concentration may increase portfolio volatility during sector rotations or tech selloffs.',
    recommended_action:
      'Consider diversifying into other sectors such as healthcare, financials, or consumer staples to reduce risk.',
    timestamp: new Date('2024-03-06T14:20:00'),
    is_dismissed: false,
  },
  {
    id: '4',
    user_id: 'user1',
    type: 'tax',
    title: 'Tax-Loss Harvesting Opportunity Detected',
    description:
      'You could reduce your tax liability by $2,400 by harvesting capital losses from underperforming positions while maintaining market exposure.',
    recommended_action:
      'Consider selling positions with losses to offset capital gains. Consult with a tax professional before executing.',
    timestamp: new Date('2024-03-05T09:15:00'),
    is_dismissed: false,
  },
  {
    id: '5',
    user_id: 'user1',
    type: 'market',
    title: 'Options Flow Alert: Large MSFT Put Activity',
    description:
      'Unusual options activity detected: $8.2M in near-term MSFT puts purchased, suggesting institutional investors may be hedging downside. MSFT represents 9.8% of your portfolio.',
    recommended_action:
      'Monitor MSFT price action and consider protective measures if position drops below $410 support.',
    timestamp: new Date('2024-03-04T16:45:00'),
    is_dismissed: false,
  },
  {
    id: '6',
    user_id: 'user1',
    type: 'spending',
    title: 'Subscription Spending Increased 23%',
    description:
      'Your spending on subscriptions increased from $340 to $418 this month. Notable increases in streaming services and software subscriptions.',
    recommended_action:
      'Review active subscriptions and cancel unused services. Potential savings: $78/month.',
    timestamp: new Date('2024-03-03T11:00:00'),
    is_dismissed: false,
  },
  {
    id: '7',
    user_id: 'user1',
    type: 'credit',
    title: 'Balance Transfer Opportunity',
    description:
      'Your Amex card has a balance of $3,210 at 18.5% APR. A balance transfer to a 0% intro APR card could save $340 in interest.',
    recommended_action:
      'Apply for a balance transfer card with 0% intro APR for 15-18 months and transfer your existing balance.',
    timestamp: new Date('2024-03-02T08:30:00'),
    is_dismissed: false,
  },
  {
    id: '8',
    user_id: 'user1',
    type: 'market',
    title: 'Federal Reserve Minutes Released',
    description:
      'FOMC minutes suggest higher-for-longer interest rates. This could pressure tech valuations (58% of your portfolio) and crypto holdings (13.9%).',
    recommended_action:
      'Consider shifting some allocation to dividend-paying value stocks or bonds that benefit from higher rates.',
    timestamp: new Date('2024-03-01T14:00:00'),
    is_dismissed: false,
  },
];

// Mock financial summary
export const mockFinancialSummary: FinancialSummary = {
  net_worth: 393830,
  total_assets: 397040,
  total_liabilities: 3210,
  monthly_cash_flow: 8450,
  portfolio_value: 318200,
};

// Mock financial health score
export const mockFinancialHealthScore: FinancialHealthScore = {
  score: 78,
  debt_to_asset_ratio: 0.008,
  savings_rate: 0.28,
  emergency_fund_months: 6.7,
  portfolio_diversification: 0.72,
};

// Mock net worth history (12 months)
export const mockNetWorthHistory: NetWorthDataPoint[] = [
  { month: 'Apr 2025', value: 312000 },
  { month: 'May 2025', value: 318500 },
  { month: 'Jun 2025', value: 325000 },
  { month: 'Jul 2025', value: 331200 },
  { month: 'Aug 2025', value: 328900 },
  { month: 'Sep 2025', value: 342100 },
  { month: 'Oct 2025', value: 351800 },
  { month: 'Nov 2025', value: 348200 },
  { month: 'Dec 2025', value: 355700 },
  { month: 'Jan 2026', value: 361900 },
  { month: 'Feb 2026', value: 388200 },
  { month: 'Mar 2026', value: 393830 },
];

// Mock portfolio allocation by sector
export const mockPortfolioAllocation: PortfolioAllocation[] = [
  { name: 'Technology', value: 184154.5, percentage: 56.0 },
  { name: 'Diversified ETF', value: 100684, percentage: 30.6 },
  { name: 'Cryptocurrency', value: 44105, percentage: 13.4 },
];

// Mock tax intelligence
export const mockTaxIntelligence: TaxIntelligence = {
  estimated_income_tax: 42800,
  short_term_capital_gains: 8400,
  long_term_capital_gains: 15200,
  deductions_identified: 12300,
  estimated_quarterly_payment: 14200,
  optimization_suggestions: [
    'Max out 401(k) contributions ($23,000 limit) - potential tax savings: $5,290',
    'Harvest $5,200 in capital losses to offset gains - potential tax savings: $1,248',
    'Contribute to HSA ($4,150 limit) - potential tax savings: $1,036',
    'Consider traditional IRA contribution ($7,000 limit) - potential tax savings: $1,680',
  ],
};

// Mock recent transactions for accounts (for account drawer)
export const mockTransactions: Transaction[] = [
  {
    id: 't1',
    account_id: '1',
    amount: -54.23,
    category: 'Dining',
    date: new Date('2024-03-04'),
    description: 'Dinner at Bistro Maris',
  },
  {
    id: 't2',
    account_id: '1',
    amount: -120.5,
    category: 'Groceries',
    date: new Date('2024-03-03'),
    description: 'Whole Foods Market',
  },
  {
    id: 't3',
    account_id: '2',
    amount: 2500,
    category: 'Transfer',
    date: new Date('2024-03-01'),
    description: 'Monthly savings sweep',
  },
  {
    id: 't4',
    account_id: '3',
    amount: -320.1,
    category: 'Payment',
    date: new Date('2024-03-02'),
    description: 'Credit card payment',
  },
  {
    id: 't5',
    account_id: '4',
    amount: -1500,
    category: 'Trade',
    date: new Date('2024-02-28'),
    description: 'Equity purchase',
  },
  {
    id: 't6',
    account_id: '5',
    amount: -600,
    category: 'Crypto',
    date: new Date('2024-02-27'),
    description: 'ETH spot purchase',
  },
];

// Mock cash flow trend data (12 months)
export const mockCashFlowTrend = [
  { month: 'Apr \'23', income: 12500, expenses: 8200, netFlow: 4300 },
  { month: 'May \'23', income: 12500, expenses: 7950, netFlow: 4550 },
  { month: 'Jun \'23', income: 13200, expenses: 8400, netFlow: 4800 },
  { month: 'Jul \'23', income: 12500, expenses: 9100, netFlow: 3400 },
  { month: 'Aug \'23', income: 12500, expenses: 8600, netFlow: 3900 },
  { month: 'Sep \'23', income: 13800, expenses: 8200, netFlow: 5600 },
  { month: 'Oct \'23', income: 12500, expenses: 8800, netFlow: 3700 },
  { month: 'Nov \'23', income: 12500, expenses: 10200, netFlow: 2300 },
  { month: 'Dec \'23', income: 15200, expenses: 11400, netFlow: 3800 },
  { month: 'Jan \'24', income: 12500, expenses: 7900, netFlow: 4600 },
  { month: 'Feb \'24', income: 12500, expenses: 8100, netFlow: 4400 },
  { month: 'Mar \'24', income: 12500, expenses: 8350, netFlow: 4150 },
];

// Mock assets composition breakdown
export const mockAssetsComposition = [
  { category: 'Investment Accounts', value: 318200, percentage: 75.4 },
  { category: 'Savings & Cash', value: 57340, percentage: 13.6 },
  { category: 'Cryptocurrency', value: 24500, percentage: 5.8 },
  { category: 'Real Estate Equity', value: 21790, percentage: 5.2 },
];

// Mock liabilities composition breakdown
export const mockLiabilitiesComposition = [
  { category: 'Mortgage', value: 18750, percentage: 66.2 },
  { category: 'Credit Cards', value: 3210, percentage: 11.3 },
  { category: 'Student Loans', value: 4200, percentage: 14.8 },
  { category: 'Auto Loan', value: 2140, percentage: 7.6 },
];

// Mock savings rate timeline (12 months)
export const mockSavingsRateTimeline = [
  { month: 'Apr \'23', rate: 34.4, saved: 4300 },
  { month: 'May \'23', rate: 36.4, saved: 4550 },
  { month: 'Jun \'23', rate: 36.4, saved: 4800 },
  { month: 'Jul \'23', rate: 27.2, saved: 3400 },
  { month: 'Aug \'23', rate: 31.2, saved: 3900 },
  { month: 'Sep \'23', rate: 40.6, saved: 5600 },
  { month: 'Oct \'23', rate: 29.6, saved: 3700 },
  { month: 'Nov \'23', rate: 18.4, saved: 2300 },
  { month: 'Dec \'23', rate: 25.0, saved: 3800 },
  { month: 'Jan \'24', rate: 36.8, saved: 4600 },
  { month: 'Feb \'24', rate: 35.2, saved: 4400 },
  { month: 'Mar \'24', rate: 33.2, saved: 4150 },
];

// Mock account balance history (12 months)
export const mockAccountBalanceHistory = [
  { month: 'Apr \'23', balance: 395000, inflows: 13200, outflows: 8900 },
  { month: 'May \'23', balance: 398500, inflows: 12800, outflows: 9300 },
  { month: 'Jun \'23', balance: 402100, inflows: 14100, outflows: 10500 },
  { month: 'Jul \'23', balance: 396800, inflows: 12500, outflows: 12800 },
  { month: 'Aug \'23', balance: 399200, inflows: 13000, outflows: 10600 },
  { month: 'Sep \'23', balance: 403800, inflows: 13500, outflows: 8900 },
  { month: 'Oct \'23', balance: 405900, inflows: 12700, outflows: 10600 },
  { month: 'Nov \'23', balance: 401200, inflows: 12400, outflows: 13100 },
  { month: 'Dec \'23', balance: 404800, inflows: 15800, outflows: 12200 },
  { month: 'Jan \'24', balance: 408400, inflows: 12900, outflows: 9300 },
  { month: 'Feb \'24', balance: 411700, inflows: 13100, outflows: 9800 },
  { month: 'Mar \'24', balance: 414830, inflows: 13400, outflows: 10270 },
];
