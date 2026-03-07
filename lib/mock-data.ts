import {
  Account,
  Holding,
  Insight,
  FinancialSummary,
  FinancialHealthScore,
  TaxIntelligence,
  NetWorthDataPoint,
  PortfolioAllocation,
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
  },
];

// Mock insights
export const mockInsights: Insight[] = [
  {
    id: '1',
    user_id: 'user1',
    type: 'portfolio',
    title: 'High Technology Sector Concentration',
    description:
      'You are currently 58% exposed to technology companies. This concentration may increase portfolio volatility.',
    recommended_action:
      'Consider diversifying into other sectors such as healthcare, financials, or consumer staples to reduce risk.',
    timestamp: new Date('2024-03-07T10:30:00'),
    is_dismissed: false,
  },
  {
    id: '2',
    user_id: 'user1',
    type: 'spending',
    title: 'Subscription Spending Increased 23%',
    description:
      'Your spending on subscriptions increased from $340 to $418 this month. Notable increases in streaming services and software subscriptions.',
    recommended_action:
      'Review active subscriptions and cancel unused services. Potential savings: $78/month.',
    timestamp: new Date('2024-03-06T14:20:00'),
    is_dismissed: false,
  },
  {
    id: '3',
    user_id: 'user1',
    type: 'tax',
    title: 'Tax-Loss Harvesting Opportunity',
    description:
      'You could reduce your tax liability by $2,400 by harvesting capital losses from underperforming positions.',
    recommended_action:
      'Consider selling positions with losses to offset capital gains. Consult with a tax professional before executing.',
    timestamp: new Date('2024-03-05T09:15:00'),
    is_dismissed: false,
  },
  {
    id: '4',
    user_id: 'user1',
    type: 'market',
    title: 'Semiconductor Patent Filing Alert',
    description:
      'A competitor of NVIDIA (your largest holding) filed a patent for next-generation AI chip architecture that could impact the market.',
    recommended_action:
      'Monitor news and analyst reports over the next 30 days. Consider rebalancing if competitive pressure increases.',
    timestamp: new Date('2024-03-04T16:45:00'),
    is_dismissed: false,
  },
  {
    id: '5',
    user_id: 'user1',
    type: 'credit',
    title: 'Balance Transfer Opportunity',
    description:
      'Your Amex Platinum card has a balance of $3,210 at 18.5% APR. A balance transfer to a 0% intro APR card could save $340 in interest.',
    recommended_action:
      'Apply for a balance transfer card with 0% intro APR for 15-18 months and transfer your existing balance.',
    timestamp: new Date('2024-03-03T11:00:00'),
    is_dismissed: false,
  },
  {
    id: '6',
    user_id: 'user1',
    type: 'portfolio',
    title: 'Cryptocurrency Volatility Warning',
    description:
      'Your cryptocurrency holdings (BTC and ETH) represent 13.9% of your portfolio and have experienced 18% volatility over the past 30 days.',
    recommended_action:
      'Ensure this allocation aligns with your risk tolerance. Consider reducing exposure if volatility is concerning.',
    timestamp: new Date('2024-03-02T08:30:00'),
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
  { month: 'Apr 2023', value: 312000 },
  { month: 'May 2023', value: 318500 },
  { month: 'Jun 2023', value: 325000 },
  { month: 'Jul 2023', value: 331200 },
  { month: 'Aug 2023', value: 328900 },
  { month: 'Sep 2023', value: 342100 },
  { month: 'Oct 2023', value: 351800 },
  { month: 'Nov 2023', value: 368500 },
  { month: 'Dec 2023', value: 375200 },
  { month: 'Jan 2024', value: 381900 },
  { month: 'Feb 2024', value: 388200 },
  { month: 'Mar 2024', value: 393830 },
];

// Mock portfolio allocation by sector
export const mockPortfolioAllocation: PortfolioAllocation[] = [
  { name: 'Technology', value: 184154.5, percentage: 57.9 },
  { name: 'Diversified ETF', value: 100684, percentage: 31.7 },
  { name: 'Cryptocurrency', value: 44105, percentage: 13.9 },
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
