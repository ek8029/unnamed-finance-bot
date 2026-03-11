-- Seed realistic test data for user 503a23f9-01a0-488d-9fae-720f0d988e49
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

DO $$
DECLARE
  uid UUID := '503a23f9-01a0-488d-9fae-720f0d988e49';
  inst_chase UUID;
  inst_fidelity UUID;
  inst_amex UUID;
  acct_checking UUID;
  acct_savings UUID;
  acct_brokerage UUID;
  acct_credit UUID;
  sec_aapl UUID;
  sec_msft UUID;
  sec_spy UUID;
  sec_vti UUID;
  sec_googl UUID;
  sec_amzn UUID;
  sec_btc UUID;
  sec_nvda UUID;
BEGIN

-- =================================================================
-- CLEAN UP existing test data for this user (idempotent re-run)
-- =================================================================
DELETE FROM insights WHERE user_id = uid;
DELETE FROM financial_health_scores WHERE user_id = uid;
DELETE FROM portfolio_performance WHERE user_id = uid;
DELETE FROM portfolio_snapshots WHERE user_id = uid;
DELETE FROM holdings WHERE user_id = uid;
DELETE FROM cash_flow_snapshots WHERE user_id = uid;
DELETE FROM net_worth_snapshots WHERE user_id = uid;
DELETE FROM transactions WHERE user_id = uid;
DELETE FROM account_balances WHERE user_id = uid;
DELETE FROM linked_accounts WHERE user_id = uid;

-- =================================================================
-- INSTITUTIONS (upsert — shared table)
-- =================================================================
INSERT INTO institutions (id, name, slug, logo_url, institution_type, supports_plaid)
VALUES
  (gen_random_uuid(), 'Chase', 'chase', NULL, 'bank', true),
  (gen_random_uuid(), 'Fidelity Investments', 'fidelity', NULL, 'brokerage', true),
  (gen_random_uuid(), 'American Express', 'amex', NULL, 'bank', true)
ON CONFLICT (slug) DO NOTHING;

SELECT id INTO inst_chase FROM institutions WHERE slug = 'chase';
SELECT id INTO inst_fidelity FROM institutions WHERE slug = 'fidelity';
SELECT id INTO inst_amex FROM institutions WHERE slug = 'amex';

-- =================================================================
-- LINKED ACCOUNTS
-- =================================================================
INSERT INTO linked_accounts (id, user_id, institution_id, account_name, account_type, current_balance, available_balance, credit_limit, sync_status, last_synced_at, is_active)
VALUES
  (gen_random_uuid(), uid, inst_chase, 'Chase Total Checking', 'checking', 12450.82, 12450.82, NULL, 'healthy', NOW(), true),
  (gen_random_uuid(), uid, inst_chase, 'Chase Savings', 'savings', 34200.00, 34200.00, NULL, 'healthy', NOW(), true),
  (gen_random_uuid(), uid, inst_fidelity, 'Fidelity Individual Brokerage', 'brokerage', 87650.33, NULL, NULL, 'healthy', NOW(), true),
  (gen_random_uuid(), uid, inst_amex, 'Amex Platinum', 'credit_card', 2847.65, NULL, 25000.00, 'healthy', NOW(), true);

SELECT id INTO acct_checking FROM linked_accounts WHERE user_id = uid AND account_name = 'Chase Total Checking';
SELECT id INTO acct_savings FROM linked_accounts WHERE user_id = uid AND account_name = 'Chase Savings';
SELECT id INTO acct_brokerage FROM linked_accounts WHERE user_id = uid AND account_name = 'Fidelity Individual Brokerage';
SELECT id INTO acct_credit FROM linked_accounts WHERE user_id = uid AND account_name = 'Amex Platinum';

-- =================================================================
-- SECURITIES (upsert — shared table)
-- =================================================================
INSERT INTO securities (id, ticker, security_name, asset_class, sector, exchange, current_price, last_updated_at)
VALUES
  (gen_random_uuid(), 'AAPL', 'Apple Inc.', 'equity', 'Technology', 'NASDAQ', 227.48, NOW()),
  (gen_random_uuid(), 'MSFT', 'Microsoft Corp.', 'equity', 'Technology', 'NASDAQ', 420.15, NOW()),
  (gen_random_uuid(), 'SPY', 'SPDR S&P 500 ETF Trust', 'etf', 'Broad Market', 'NYSE', 575.30, NOW()),
  (gen_random_uuid(), 'VTI', 'Vanguard Total Stock Market ETF', 'etf', 'Broad Market', 'NYSE', 280.92, NOW()),
  (gen_random_uuid(), 'GOOGL', 'Alphabet Inc.', 'equity', 'Technology', 'NASDAQ', 171.84, NOW()),
  (gen_random_uuid(), 'AMZN', 'Amazon.com Inc.', 'equity', 'Consumer Discretionary', 'NASDAQ', 203.50, NOW()),
  (gen_random_uuid(), 'BTC-USD', 'Bitcoin USD', 'crypto', 'Cryptocurrency', 'Coinbase', 82450.00, NOW()),
  (gen_random_uuid(), 'NVDA', 'NVIDIA Corp.', 'equity', 'Technology', 'NASDAQ', 112.37, NOW())
ON CONFLICT (ticker) DO UPDATE SET
  current_price = EXCLUDED.current_price,
  last_updated_at = EXCLUDED.last_updated_at;

SELECT id INTO sec_aapl FROM securities WHERE ticker = 'AAPL';
SELECT id INTO sec_msft FROM securities WHERE ticker = 'MSFT';
SELECT id INTO sec_spy FROM securities WHERE ticker = 'SPY';
SELECT id INTO sec_vti FROM securities WHERE ticker = 'VTI';
SELECT id INTO sec_googl FROM securities WHERE ticker = 'GOOGL';
SELECT id INTO sec_amzn FROM securities WHERE ticker = 'AMZN';
SELECT id INTO sec_btc FROM securities WHERE ticker = 'BTC-USD';
SELECT id INTO sec_nvda FROM securities WHERE ticker = 'NVDA';

-- =================================================================
-- HOLDINGS (portfolio positions)
-- =================================================================
INSERT INTO holdings (user_id, account_id, security_id, ticker, shares, average_cost_basis, total_cost_basis, current_price, total_value, unrealised_gain_loss, unrealised_gain_loss_pct, day_change_pct, portfolio_allocation_pct)
VALUES
  (uid, acct_brokerage, sec_aapl,  'AAPL',     50,    145.20,   7260.00,  227.48, 11374.00,  4114.00,  0.5667,  0.0124, 12.97),
  (uid, acct_brokerage, sec_msft,  'MSFT',     30,    310.50,   9315.00,  420.15, 12604.50,  3289.50,  0.3531,  -0.0078, 14.38),
  (uid, acct_brokerage, sec_spy,   'SPY',      40,    450.00,  18000.00,  575.30, 23012.00,  5012.00,  0.2784,  0.0032, 26.25),
  (uid, acct_brokerage, sec_vti,   'VTI',      35,    220.80,   7728.00,  280.92,  9832.20,  2104.20,  0.2723,  0.0045, 11.22),
  (uid, acct_brokerage, sec_googl, 'GOOGL',    45,    130.00,   5850.00,  171.84,  7732.80,  1882.80,  0.3218,  -0.0156, 8.82),
  (uid, acct_brokerage, sec_amzn,  'AMZN',     25,    155.20,   3880.00,  203.50,  5087.50,  1207.50,  0.3113,  0.0089, 5.80),
  (uid, acct_brokerage, sec_nvda,  'NVDA',     80,     65.40,   5232.00,  112.37,  8989.60,  3757.60,  0.7183,  0.0215, 10.25),
  (uid, acct_brokerage, sec_btc,   'BTC-USD',   0.11, 43500.00, 4785.00, 82450.00, 9069.50,  4284.50,  0.8954,  -0.0312, 10.35);

-- =================================================================
-- TRANSACTIONS (last 3 months — realistic mix)
-- =================================================================
-- March 2026
INSERT INTO transactions (user_id, account_id, amount, transaction_date, description, merchant_name, category_name, is_pending)
VALUES
  (uid, acct_checking,  -142.50,  '2026-03-10', 'Whole Foods Market', 'Whole Foods', 'Groceries', false),
  (uid, acct_checking,  -67.30,   '2026-03-09', 'Shell Gas Station', 'Shell', 'Gas', false),
  (uid, acct_checking,   8500.00, '2026-03-07', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,  -1850.00, '2026-03-05', 'Rent Payment', 'Landlord', 'Rent', false),
  (uid, acct_checking,  -89.99,   '2026-03-04', 'Electric Bill', 'PG&E', 'Utilities', false),
  (uid, acct_checking,  -45.00,   '2026-03-03', 'Netflix + Spotify', 'Streaming', 'Subscriptions', false),
  (uid, acct_credit,    -234.50,  '2026-03-08', 'Nordstrom', 'Nordstrom', 'Shopping', false),
  (uid, acct_credit,    -85.20,   '2026-03-06', 'Uber Eats', 'Uber Eats', 'Dining', false),
  (uid, acct_credit,    -52.00,   '2026-03-02', 'AMC Theaters', 'AMC', 'Entertainment', false),
  (uid, acct_checking,  -200.00,  '2026-03-01', 'Transfer to Savings', 'Internal', 'Transfer', false),
  -- February 2026
  (uid, acct_checking,   8500.00, '2026-02-21', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,   8500.00, '2026-02-07', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,  -1850.00, '2026-02-05', 'Rent Payment', 'Landlord', 'Rent', false),
  (uid, acct_checking,  -165.30,  '2026-02-18', 'Whole Foods Market', 'Whole Foods', 'Groceries', false),
  (uid, acct_checking,  -73.40,   '2026-02-15', 'Costco Gas', 'Costco', 'Gas', false),
  (uid, acct_checking,  -92.50,   '2026-02-10', 'Water & Electric', 'Utilities', 'Utilities', false),
  (uid, acct_credit,    -310.00,  '2026-02-22', 'Best Buy', 'Best Buy', 'Shopping', false),
  (uid, acct_credit,    -125.80,  '2026-02-14', 'Valentines Dinner', 'Restaurant', 'Dining', false),
  (uid, acct_credit,    -42.00,   '2026-02-08', 'Spotify + iCloud', 'Streaming', 'Subscriptions', false),
  (uid, acct_checking,  -500.00,  '2026-02-01', 'Transfer to Savings', 'Internal', 'Transfer', false),
  -- January 2026
  (uid, acct_checking,   8500.00, '2026-01-22', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,   8500.00, '2026-01-08', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,  -1850.00, '2026-01-05', 'Rent Payment', 'Landlord', 'Rent', false),
  (uid, acct_checking,  -198.70,  '2026-01-20', 'Trader Joes + Safeway', 'Groceries', 'Groceries', false),
  (uid, acct_checking,  -55.80,   '2026-01-12', 'Shell Gas', 'Shell', 'Gas', false),
  (uid, acct_checking,  -105.00,  '2026-01-10', 'Internet + Electric', 'Utilities', 'Utilities', false),
  (uid, acct_credit,    -275.00,  '2026-01-25', 'Amazon', 'Amazon', 'Shopping', false),
  (uid, acct_credit,    -98.50,   '2026-01-18', 'DoorDash', 'DoorDash', 'Dining', false),
  (uid, acct_checking,  -300.00,  '2026-01-02', 'Transfer to Savings', 'Internal', 'Transfer', false),
  (uid, acct_checking,   1250.00, '2026-01-15', 'Freelance Payment', 'Client', 'Income', false),
  -- December 2025
  (uid, acct_checking,   8500.00, '2025-12-22', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,   8500.00, '2025-12-08', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,  -1850.00, '2025-12-05', 'Rent Payment', 'Landlord', 'Rent', false),
  (uid, acct_checking,  -450.00,  '2025-12-20', 'Holiday Shopping', 'Various', 'Shopping', false),
  (uid, acct_credit,    -620.00,  '2025-12-23', 'Holiday Gifts', 'Various', 'Shopping', false),
  (uid, acct_credit,    -180.00,  '2025-12-24', 'Christmas Dinner', 'Restaurant', 'Dining', false),
  (uid, acct_checking,  -88.00,   '2025-12-10', 'Utilities', 'PG&E', 'Utilities', false),
  -- November 2025
  (uid, acct_checking,   8500.00, '2025-11-21', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,   8500.00, '2025-11-07', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,  -1850.00, '2025-11-05', 'Rent Payment', 'Landlord', 'Rent', false),
  (uid, acct_checking,  -175.40,  '2025-11-15', 'Whole Foods', 'Whole Foods', 'Groceries', false),
  (uid, acct_checking,  -95.00,   '2025-11-10', 'Utilities', 'PG&E', 'Utilities', false),
  (uid, acct_credit,    -195.00,  '2025-11-28', 'Black Friday', 'Various', 'Shopping', false),
  -- October 2025
  (uid, acct_checking,   8500.00, '2025-10-22', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,   8500.00, '2025-10-08', 'Payroll Direct Deposit', 'Employer', 'Income', false),
  (uid, acct_checking,  -1850.00, '2025-10-05', 'Rent Payment', 'Landlord', 'Rent', false),
  (uid, acct_checking,  -160.00,  '2025-10-18', 'Groceries', 'Safeway', 'Groceries', false),
  (uid, acct_checking,  -82.00,   '2025-10-12', 'Utilities', 'PG&E', 'Utilities', false),
  (uid, acct_credit,    -150.00,  '2025-10-20', 'Target', 'Target', 'Shopping', false);

-- =================================================================
-- NET WORTH SNAPSHOTS (12 months of history — steady growth)
-- =================================================================
INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities, net_worth, cash_balance, investment_balance, crypto_balance, credit_card_debt, loan_debt)
VALUES
  (uid, '2025-04-01', 105200.00, 3200.00, 102000.00, 38500.00, 62500.00, 4200.00, 3200.00, 0),
  (uid, '2025-05-01', 108500.00, 3100.00, 105400.00, 39200.00, 65100.00, 4200.00, 3100.00, 0),
  (uid, '2025-06-01', 110800.00, 2950.00, 107850.00, 40100.00, 66400.00, 4300.00, 2950.00, 0),
  (uid, '2025-07-01', 112400.00, 3400.00, 109000.00, 40800.00, 67200.00, 4400.00, 3400.00, 0),
  (uid, '2025-08-01', 115700.00, 2800.00, 112900.00, 41500.00, 69500.00, 4700.00, 2800.00, 0),
  (uid, '2025-09-01', 113200.00, 3100.00, 110100.00, 41000.00, 67500.00, 4700.00, 3100.00, 0),
  (uid, '2025-10-01', 118900.00, 2750.00, 116150.00, 42200.00, 71800.00, 4900.00, 2750.00, 0),
  (uid, '2025-11-01', 122100.00, 2900.00, 119200.00, 43000.00, 73900.00, 5200.00, 2900.00, 0),
  (uid, '2025-12-01', 119500.00, 3500.00, 116000.00, 42500.00, 72000.00, 5000.00, 3500.00, 0),
  (uid, '2026-01-01', 125800.00, 2600.00, 123200.00, 44100.00, 76200.00, 5500.00, 2600.00, 0),
  (uid, '2026-02-01', 129300.00, 2950.00, 126350.00, 45200.00, 78500.00, 5600.00, 2950.00, 0),
  (uid, '2026-03-01', 134301.15, 2847.65, 131453.50, 46650.82, 87650.33, 0, 2847.65, 0);

-- =================================================================
-- CASH FLOW SNAPSHOTS (6 months)
-- =================================================================
INSERT INTO cash_flow_snapshots (user_id, snapshot_month, total_income, total_expenses, net_flow, savings_amount, savings_rate)
VALUES
  (uid, '2025-10-01', 17000.00, 12292.00, 4708.00, 4708.00, 0.2769),
  (uid, '2025-11-01', 17000.00, 12315.40, 4684.60, 4684.60, 0.2756),
  (uid, '2025-12-01', 17000.00, 13688.00, 3312.00, 3312.00, 0.1948),
  (uid, '2026-01-01', 18250.00, 12833.00, 5417.00, 5417.00, 0.2968),
  (uid, '2026-02-01', 17000.00, 13159.00, 3841.00, 3841.00, 0.2259),
  (uid, '2026-03-01', 8500.00,  4766.49,  3733.51, 3733.51, 0.4392);

-- =================================================================
-- PORTFOLIO SNAPSHOTS (12 months)
-- =================================================================
INSERT INTO portfolio_snapshots (user_id, snapshot_date, total_value, total_cost_basis, total_gain_loss, total_gain_loss_pct)
VALUES
  (uid, '2025-04-01', 62500.00, 54000.00, 8500.00,   0.1574),
  (uid, '2025-05-01', 65100.00, 54000.00, 11100.00,  0.2056),
  (uid, '2025-06-01', 66400.00, 54000.00, 12400.00,  0.2296),
  (uid, '2025-07-01', 67200.00, 54500.00, 12700.00,  0.2330),
  (uid, '2025-08-01', 69500.00, 55000.00, 14500.00,  0.2636),
  (uid, '2025-09-01', 67500.00, 55000.00, 12500.00,  0.2273),
  (uid, '2025-10-01', 71800.00, 56000.00, 15800.00,  0.2821),
  (uid, '2025-11-01', 73900.00, 56500.00, 17400.00,  0.3080),
  (uid, '2025-12-01', 72000.00, 56500.00, 15500.00,  0.2743),
  (uid, '2026-01-01', 76200.00, 57000.00, 19200.00,  0.3368),
  (uid, '2026-02-01', 78500.00, 57000.00, 21500.00,  0.3772),
  (uid, '2026-03-01', 87702.10, 62050.00, 25652.10,  0.4134);

-- =================================================================
-- PORTFOLIO PERFORMANCE (latest snapshot)
-- =================================================================
INSERT INTO portfolio_performance (user_id, calculated_at, return_1d_pct, return_1w_pct, return_1m_pct, return_3m_pct, return_6m_pct, return_ytd_pct, return_1y_pct, sharpe_ratio, beta, volatility, diversification_score, sector_concentration, asset_class_allocation)
VALUES (
  uid, NOW(),
  0.0032,   -- +0.32% today
  0.0145,   -- +1.45% this week
  0.0485,   -- +4.85% this month
  0.1172,   -- +11.72% 3 months
  0.2215,   -- +22.15% 6 months
  0.1510,   -- +15.10% YTD
  0.4030,   -- +40.30% 1 year
  1.82,     -- Sharpe ratio
  1.15,     -- Beta (slightly above market)
  0.1840,   -- 18.4% volatility
  0.7200,   -- 72% diversification
  '{"Technology": 46.42, "Broad Market": 37.47, "Consumer Discretionary": 5.80, "Cryptocurrency": 10.35}'::jsonb,
  '{"equity": 52.22, "etf": 37.47, "crypto": 10.35}'::jsonb
);

-- =================================================================
-- FINANCIAL HEALTH SCORE
-- =================================================================
INSERT INTO financial_health_scores (user_id, calculated_at, overall_score, debt_to_asset_ratio, savings_rate, emergency_fund_months, portfolio_diversification, debt_score, savings_score, emergency_fund_score, diversification_score)
VALUES (
  uid, NOW(),
  82,       -- Overall: 82/100
  0.0212,   -- 2.12% debt-to-asset (excellent)
  0.2700,   -- 27% savings rate (good)
  8.50,     -- 8.5 months emergency fund (great)
  0.7200,   -- 72% diversification
  95,       -- Debt score
  78,       -- Savings score
  88,       -- Emergency fund score
  72        -- Diversification score
);

-- =================================================================
-- INSIGHTS (actionable intelligence)
-- =================================================================
INSERT INTO insights (user_id, insight_type, priority, title, description, recommended_action, estimated_impact_amount, confidence_score, source_type, is_dismissed)
VALUES
  (uid, 'portfolio', 'high', 'Tech Concentration Risk',
   'Technology stocks make up 46% of your portfolio, above the recommended 30% threshold. A market correction in tech could significantly impact your net worth.',
   'Consider rebalancing by shifting 10-15% into healthcare, energy, or international ETFs like VEA or XLV.',
   NULL, 0.92, 'rule_based', false),

  (uid, 'spending', 'medium', 'Dining Spend Up 18% MoM',
   'Your dining and food delivery spending increased from $98.50 in January to $125.80 in February, an 18% jump.',
   'Set a monthly dining budget of $120 to keep this category in check.',
   327.60, 0.85, 'rule_based', false),

  (uid, 'market', 'high', 'NVDA Earnings Beat',
   'NVIDIA reported Q4 earnings beating estimates by 12%. Your 80-share position is up 71.8% since purchase.',
   'Consider taking partial profits on 20-30 shares to lock in gains while maintaining exposure.',
   NULL, 0.88, 'rule_based', false),

  (uid, 'portfolio', 'medium', 'Strong Savings Rate',
   'Your trailing 6-month savings rate averages 27%, well above the recommended 20% target.',
   'Consider directing excess savings into tax-advantaged accounts (Roth IRA, HSA) before maxing taxable brokerage.',
   2400.00, 0.90, 'rule_based', false),

  (uid, 'credit', 'low', 'Credit Utilization Healthy',
   'Your Amex Platinum utilization is at 11.4% ($2,847 of $25,000 limit), well within the optimal 1-30% range.',
   'No action needed. Continue paying statement balance in full to maintain excellent credit.',
   NULL, 0.95, 'rule_based', false),

  (uid, 'tax', 'medium', 'Tax-Loss Harvesting Opportunity',
   'GOOGL has pulled back 8% from recent highs. If you have losses in individual lots, consider harvesting them against your NVDA gains.',
   'Review individual lot cost basis in your Fidelity account and sell any lots with losses before year-end.',
   850.00, 0.75, 'rule_based', false);

RAISE NOTICE 'Seed data inserted successfully for user %', uid;
END $$;
