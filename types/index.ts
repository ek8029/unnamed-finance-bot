// User types
export interface User {
  id: string;
  email: string;
  created_at: Date;
}

// Account types
export interface Account {
  id: string;
  user_id: string;
  institution: string;
  account_type: 'checking' | 'savings' | 'credit_card' | 'brokerage' | 'crypto';
  balance: number;
}

// Transaction types
export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  category: string;
  date: Date;
  description?: string;
}

// Investment holdings
export interface Holding {
  id: string;
  user_id?: string;
  ticker: string;
  asset_name: string;
  shares: number;
  current_price: number;
  total_value: number;
  day_change_percentage: number;
  portfolio_allocation: number;
  sector?: string;
  asset_class?: string;
   cost_basis?: number;
   unrealised_gain?: number;
}

// Insight types
export type InsightType =
  | 'spending'
  | 'portfolio'
  | 'market'
  | 'tax'
  | 'credit';

export interface Insight {
  id: string;
  user_id?: string;
  type: InsightType;
  title: string;
  description: string;
  recommended_action?: string;
  estimated_impact?: number;
  timestamp: Date;
  is_dismissed?: boolean;
  is_useful?: boolean;
}

// Financial summary types
export interface FinancialSummary {
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  monthly_cash_flow: number;
  portfolio_value: number;
}

// Financial health score
export interface FinancialHealthScore {
  score: number; // 0-100
  debt_to_asset_ratio: number;
  savings_rate: number;
  emergency_fund_months: number;
  portfolio_diversification: number;
}

// Tax intelligence
export interface TaxIntelligence {
  estimated_income_tax: number;
  short_term_capital_gains: number;
  long_term_capital_gains: number;
  deductions_identified: number;
  estimated_quarterly_payment: number;
  optimization_suggestions: string[];
}

// Net worth history for charts
export interface NetWorthDataPoint {
  month: string;
  value: number;
}

// Portfolio allocation for pie chart
export interface PortfolioAllocation {
  name: string;
  value: number;
  percentage: number;
}
