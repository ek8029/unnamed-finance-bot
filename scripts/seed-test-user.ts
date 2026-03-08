/**
 * Seed Test User Data - Comprehensive
 * Populates the database with rich mock data for testing
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test user UUID
const TEST_USER_ID = '26c5dbd3-357c-44e8-aff1-d31cfc30c33d';

async function clearExistingData() {
  console.log('🧹 Clearing existing test user data...');

  // Delete in order to respect foreign keys
  await supabase.from('insights').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('holdings').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('transactions').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('capital_gains').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('tax_optimization_tasks').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('tax_estimates').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('financial_health_scores').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('net_worth_snapshots').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('cash_flow_snapshots').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('portfolio_snapshots').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('account_balances').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('linked_accounts').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('user_preferences').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('user_profiles').delete().eq('id', TEST_USER_ID);

  console.log('✅ Cleared existing data\n');
}

async function seedTestUser() {
  console.log('🌱 Seeding comprehensive test user data...');
  console.log(`👤 User ID: ${TEST_USER_ID}\n`);

  try {
    await clearExistingData();

    // 1. Create user profile
    console.log('1️⃣  Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: TEST_USER_ID,
        email: 'test@helm.app',
        full_name: 'Alex Morgan',
        phone: '+1 (555) 123-4567',
        timezone: 'America/New_York',
      });

    if (profileError) {
      console.error('❌ Error creating profile:', profileError);
      return;
    }
    console.log('✅ Profile created\n');

    // 2. Create user preferences
    console.log('2️⃣  Creating user preferences...');
    const { error: prefsError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: TEST_USER_ID,
        theme: 'dark',
        currency: 'USD',
        date_format: 'MM/DD/YYYY',
        notification_market_alerts: true,
        notification_transaction_alerts: true,
        notification_tax_reminders: true,
        notification_weekly_digest: true,
        show_insights: true,
        auto_refresh: true,
        refresh_interval: 5,
      });

    if (prefsError) {
      console.error('❌ Error creating preferences:', prefsError);
      return;
    }
    console.log('✅ Preferences created\n');

    // 3. Get institution IDs
    console.log('3️⃣  Fetching institutions...');
    const { data: institutions } = await supabase.from('institutions').select('id, slug');
    const instMap = new Map(institutions?.map(i => [i.slug, i.id]) || []);
    console.log('✅ Institutions fetched\n');

    // 4. Create linked accounts (diverse portfolio)
    console.log('4️⃣  Creating linked accounts...');
    const accounts = [
      // Banking
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('chase'),
        account_name: 'Chase Total Checking',
        account_type: 'checking',
        current_balance: 15420.50,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('chase'),
        account_name: 'Chase Savings',
        account_type: 'savings',
        current_balance: 52000,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('marcus'),
        account_name: 'Marcus High-Yield Savings',
        account_type: 'savings',
        current_balance: 35000,
        sync_status: 'healthy',
      },
      // Credit Cards
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('amex'),
        account_name: 'Amex Platinum',
        account_type: 'credit_card',
        current_balance: -4250.80,
        credit_limit: 35000,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('chase'),
        account_name: 'Chase Sapphire Reserve',
        account_type: 'credit_card',
        current_balance: -1892.45,
        credit_limit: 28000,
        sync_status: 'healthy',
      },
      // Investments
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('fidelity'),
        account_name: 'Fidelity Brokerage',
        account_type: 'brokerage',
        current_balance: 485200,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('fidelity'),
        account_name: 'Fidelity Roth IRA',
        account_type: 'brokerage',
        current_balance: 127500,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('vanguard'),
        account_name: 'Vanguard 401(k)',
        account_type: 'brokerage',
        current_balance: 312000,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('schwab'),
        account_name: 'Schwab Individual',
        account_type: 'brokerage',
        current_balance: 89400,
        sync_status: 'healthy',
      },
      // Crypto
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('coinbase'),
        account_name: 'Coinbase',
        account_type: 'crypto',
        current_balance: 67500,
        sync_status: 'healthy',
      },
    ];

    const { data: createdAccounts, error: accountsError } = await supabase
      .from('linked_accounts')
      .insert(accounts)
      .select();

    if (accountsError) {
      console.error('❌ Error creating accounts:', accountsError);
      return;
    }
    console.log(`✅ Created ${createdAccounts?.length} accounts\n`);

    // Get account IDs by type
    const brokerageAccount = createdAccounts?.find(a => a.account_name === 'Fidelity Brokerage');
    const rothIRA = createdAccounts?.find(a => a.account_name === 'Fidelity Roth IRA');
    const fourO1k = createdAccounts?.find(a => a.account_name === 'Vanguard 401(k)');
    const schwabAccount = createdAccounts?.find(a => a.account_name === 'Schwab Individual');
    const cryptoAccount = createdAccounts?.find(a => a.account_name === 'Coinbase');
    const checkingAccount = createdAccounts?.find(a => a.account_name === 'Chase Total Checking');

    // 5. Create securities (comprehensive list)
    console.log('5️⃣  Creating securities...');
    const securities = [
      // Tech Giants
      { ticker: 'AAPL', security_name: 'Apple Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 178.72 },
      { ticker: 'MSFT', security_name: 'Microsoft Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 428.50 },
      { ticker: 'GOOGL', security_name: 'Alphabet Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 175.35 },
      { ticker: 'AMZN', security_name: 'Amazon.com Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 186.40 },
      { ticker: 'NVDA', security_name: 'NVIDIA Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 875.35 },
      { ticker: 'META', security_name: 'Meta Platforms Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 505.75 },
      { ticker: 'TSLA', security_name: 'Tesla Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 248.50 },
      { ticker: 'AMD', security_name: 'Advanced Micro Devices', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 162.80 },
      { ticker: 'CRM', security_name: 'Salesforce Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NYSE', current_price: 272.45 },
      { ticker: 'ADBE', security_name: 'Adobe Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 485.20 },
      // Healthcare
      { ticker: 'JNJ', security_name: 'Johnson & Johnson', asset_class: 'equity', sector: 'Healthcare', exchange: 'NYSE', current_price: 156.80 },
      { ticker: 'UNH', security_name: 'UnitedHealth Group', asset_class: 'equity', sector: 'Healthcare', exchange: 'NYSE', current_price: 528.40 },
      { ticker: 'PFE', security_name: 'Pfizer Inc.', asset_class: 'equity', sector: 'Healthcare', exchange: 'NYSE', current_price: 28.45 },
      { ticker: 'ABBV', security_name: 'AbbVie Inc.', asset_class: 'equity', sector: 'Healthcare', exchange: 'NYSE', current_price: 168.90 },
      // Finance
      { ticker: 'JPM', security_name: 'JPMorgan Chase & Co.', asset_class: 'equity', sector: 'Financial', exchange: 'NYSE', current_price: 198.75 },
      { ticker: 'V', security_name: 'Visa Inc.', asset_class: 'equity', sector: 'Financial', exchange: 'NYSE', current_price: 278.30 },
      { ticker: 'MA', security_name: 'Mastercard Inc.', asset_class: 'equity', sector: 'Financial', exchange: 'NYSE', current_price: 458.60 },
      { ticker: 'BRK.B', security_name: 'Berkshire Hathaway', asset_class: 'equity', sector: 'Financial', exchange: 'NYSE', current_price: 412.50 },
      // Consumer
      { ticker: 'KO', security_name: 'Coca-Cola Company', asset_class: 'equity', sector: 'Consumer', exchange: 'NYSE', current_price: 62.45 },
      { ticker: 'PG', security_name: 'Procter & Gamble', asset_class: 'equity', sector: 'Consumer', exchange: 'NYSE', current_price: 165.20 },
      { ticker: 'WMT', security_name: 'Walmart Inc.', asset_class: 'equity', sector: 'Consumer', exchange: 'NYSE', current_price: 168.75 },
      { ticker: 'COST', security_name: 'Costco Wholesale', asset_class: 'equity', sector: 'Consumer', exchange: 'NASDAQ', current_price: 742.30 },
      { ticker: 'NKE', security_name: 'Nike Inc.', asset_class: 'equity', sector: 'Consumer', exchange: 'NYSE', current_price: 98.40 },
      // Energy
      { ticker: 'XOM', security_name: 'Exxon Mobil', asset_class: 'equity', sector: 'Energy', exchange: 'NYSE', current_price: 118.50 },
      { ticker: 'CVX', security_name: 'Chevron Corporation', asset_class: 'equity', sector: 'Energy', exchange: 'NYSE', current_price: 162.80 },
      // Industrial
      { ticker: 'CAT', security_name: 'Caterpillar Inc.', asset_class: 'equity', sector: 'Industrial', exchange: 'NYSE', current_price: 342.60 },
      { ticker: 'BA', security_name: 'Boeing Company', asset_class: 'equity', sector: 'Industrial', exchange: 'NYSE', current_price: 178.90 },
      { ticker: 'HON', security_name: 'Honeywell International', asset_class: 'equity', sector: 'Industrial', exchange: 'NASDAQ', current_price: 198.45 },
      // REITs
      { ticker: 'O', security_name: 'Realty Income Corp', asset_class: 'equity', sector: 'Real Estate', exchange: 'NYSE', current_price: 54.80 },
      { ticker: 'AMT', security_name: 'American Tower Corp', asset_class: 'equity', sector: 'Real Estate', exchange: 'NYSE', current_price: 198.20 },
      // ETFs
      { ticker: 'SPY', security_name: 'SPDR S&P 500 ETF', asset_class: 'etf', sector: 'Diversified', exchange: 'NYSE', current_price: 512.45 },
      { ticker: 'QQQ', security_name: 'Invesco QQQ Trust', asset_class: 'etf', sector: 'Technology', exchange: 'NASDAQ', current_price: 438.20 },
      { ticker: 'VTI', security_name: 'Vanguard Total Stock Market', asset_class: 'etf', sector: 'Diversified', exchange: 'NYSE', current_price: 268.90 },
      { ticker: 'VOO', security_name: 'Vanguard S&P 500 ETF', asset_class: 'etf', sector: 'Diversified', exchange: 'NYSE', current_price: 472.35 },
      { ticker: 'VXUS', security_name: 'Vanguard Intl Stock', asset_class: 'etf', sector: 'International', exchange: 'NASDAQ', current_price: 58.40 },
      { ticker: 'BND', security_name: 'Vanguard Total Bond', asset_class: 'etf', sector: 'Fixed Income', exchange: 'NASDAQ', current_price: 72.80 },
      { ticker: 'VNQ', security_name: 'Vanguard Real Estate ETF', asset_class: 'etf', sector: 'Real Estate', exchange: 'NYSE', current_price: 86.45 },
      { ticker: 'ARKK', security_name: 'ARK Innovation ETF', asset_class: 'etf', sector: 'Technology', exchange: 'NYSE', current_price: 48.90 },
      { ticker: 'SCHD', security_name: 'Schwab US Dividend Equity', asset_class: 'etf', sector: 'Diversified', exchange: 'NYSE', current_price: 78.60 },
      // Crypto
      { ticker: 'BTC-USD', security_name: 'Bitcoin', asset_class: 'crypto', sector: 'Cryptocurrency', exchange: 'Coinbase', current_price: 67500 },
      { ticker: 'ETH-USD', security_name: 'Ethereum', asset_class: 'crypto', sector: 'Cryptocurrency', exchange: 'Coinbase', current_price: 3420 },
      { ticker: 'SOL-USD', security_name: 'Solana', asset_class: 'crypto', sector: 'Cryptocurrency', exchange: 'Coinbase', current_price: 148.50 },
    ];

    const { data: createdSecurities, error: securitiesError } = await supabase
      .from('securities')
      .upsert(securities, { onConflict: 'ticker' })
      .select();

    if (securitiesError) {
      console.error('❌ Error creating securities:', securitiesError);
      return;
    }
    console.log(`✅ Created ${createdSecurities?.length} securities\n`);

    const secMap = new Map(createdSecurities?.map(s => [s.ticker, s.id]) || []);

    // 6. Create holdings across accounts
    console.log('6️⃣  Creating holdings...');
    const holdings = [
      // Fidelity Brokerage - Active trading account
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('AAPL'), ticker: 'AAPL', shares: 200, average_cost_basis: 145.20, total_cost_basis: 29040, current_price: 178.72, total_value: 35744, unrealised_gain_loss: 6704, unrealised_gain_loss_pct: 0.2309, day_change_pct: 0.0124, portfolio_allocation_pct: 7.4 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('NVDA'), ticker: 'NVDA', shares: 150, average_cost_basis: 485.50, total_cost_basis: 72825, current_price: 875.35, total_value: 131302.5, unrealised_gain_loss: 58477.5, unrealised_gain_loss_pct: 0.8028, day_change_pct: 0.0315, portfolio_allocation_pct: 27.1 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('MSFT'), ticker: 'MSFT', shares: 100, average_cost_basis: 320.40, total_cost_basis: 32040, current_price: 428.50, total_value: 42850, unrealised_gain_loss: 10810, unrealised_gain_loss_pct: 0.3374, day_change_pct: 0.0089, portfolio_allocation_pct: 8.8 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('GOOGL'), ticker: 'GOOGL', shares: 180, average_cost_basis: 125.80, total_cost_basis: 22644, current_price: 175.35, total_value: 31563, unrealised_gain_loss: 8919, unrealised_gain_loss_pct: 0.3939, day_change_pct: 0.0156, portfolio_allocation_pct: 6.5 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('AMZN'), ticker: 'AMZN', shares: 120, average_cost_basis: 142.30, total_cost_basis: 17076, current_price: 186.40, total_value: 22368, unrealised_gain_loss: 5292, unrealised_gain_loss_pct: 0.3099, day_change_pct: 0.0078, portfolio_allocation_pct: 4.6 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('META'), ticker: 'META', shares: 75, average_cost_basis: 298.60, total_cost_basis: 22395, current_price: 505.75, total_value: 37931.25, unrealised_gain_loss: 15536.25, unrealised_gain_loss_pct: 0.6937, day_change_pct: 0.0203, portfolio_allocation_pct: 7.8 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('TSLA'), ticker: 'TSLA', shares: 80, average_cost_basis: 195.40, total_cost_basis: 15632, current_price: 248.50, total_value: 19880, unrealised_gain_loss: 4248, unrealised_gain_loss_pct: 0.2718, day_change_pct: -0.0245, portfolio_allocation_pct: 4.1 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('JPM'), ticker: 'JPM', shares: 150, average_cost_basis: 152.30, total_cost_basis: 22845, current_price: 198.75, total_value: 29812.5, unrealised_gain_loss: 6967.5, unrealised_gain_loss_pct: 0.3050, day_change_pct: 0.0098, portfolio_allocation_pct: 6.1 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('V'), ticker: 'V', shares: 100, average_cost_basis: 235.80, total_cost_basis: 23580, current_price: 278.30, total_value: 27830, unrealised_gain_loss: 4250, unrealised_gain_loss_pct: 0.1802, day_change_pct: 0.0045, portfolio_allocation_pct: 5.7 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('UNH'), ticker: 'UNH', shares: 40, average_cost_basis: 485.60, total_cost_basis: 19424, current_price: 528.40, total_value: 21136, unrealised_gain_loss: 1712, unrealised_gain_loss_pct: 0.0881, day_change_pct: 0.0034, portfolio_allocation_pct: 4.4 },
      { user_id: TEST_USER_ID, account_id: brokerageAccount?.id, security_id: secMap.get('SPY'), ticker: 'SPY', shares: 150, average_cost_basis: 445.20, total_cost_basis: 66780, current_price: 512.45, total_value: 76867.5, unrealised_gain_loss: 10087.5, unrealised_gain_loss_pct: 0.1510, day_change_pct: 0.0065, portfolio_allocation_pct: 15.8 },

      // Roth IRA - Long-term growth
      { user_id: TEST_USER_ID, account_id: rothIRA?.id, security_id: secMap.get('VTI'), ticker: 'VTI', shares: 200, average_cost_basis: 215.40, total_cost_basis: 43080, current_price: 268.90, total_value: 53780, unrealised_gain_loss: 10700, unrealised_gain_loss_pct: 0.2483, day_change_pct: 0.0072, portfolio_allocation_pct: 42.1 },
      { user_id: TEST_USER_ID, account_id: rothIRA?.id, security_id: secMap.get('VXUS'), ticker: 'VXUS', shares: 400, average_cost_basis: 52.30, total_cost_basis: 20920, current_price: 58.40, total_value: 23360, unrealised_gain_loss: 2440, unrealised_gain_loss_pct: 0.1166, day_change_pct: 0.0045, portfolio_allocation_pct: 18.3 },
      { user_id: TEST_USER_ID, account_id: rothIRA?.id, security_id: secMap.get('QQQ'), ticker: 'QQQ', shares: 80, average_cost_basis: 365.80, total_cost_basis: 29264, current_price: 438.20, total_value: 35056, unrealised_gain_loss: 5792, unrealised_gain_loss_pct: 0.1979, day_change_pct: 0.0142, portfolio_allocation_pct: 27.5 },
      { user_id: TEST_USER_ID, account_id: rothIRA?.id, security_id: secMap.get('SCHD'), ticker: 'SCHD', shares: 200, average_cost_basis: 72.40, total_cost_basis: 14480, current_price: 78.60, total_value: 15720, unrealised_gain_loss: 1240, unrealised_gain_loss_pct: 0.0856, day_change_pct: 0.0028, portfolio_allocation_pct: 12.3 },

      // 401(k) - Conservative growth
      { user_id: TEST_USER_ID, account_id: fourO1k?.id, security_id: secMap.get('VOO'), ticker: 'VOO', shares: 350, average_cost_basis: 385.60, total_cost_basis: 134960, current_price: 472.35, total_value: 165322.5, unrealised_gain_loss: 30362.5, unrealised_gain_loss_pct: 0.2250, day_change_pct: 0.0068, portfolio_allocation_pct: 53.0 },
      { user_id: TEST_USER_ID, account_id: fourO1k?.id, security_id: secMap.get('BND'), ticker: 'BND', shares: 800, average_cost_basis: 74.20, total_cost_basis: 59360, current_price: 72.80, total_value: 58240, unrealised_gain_loss: -1120, unrealised_gain_loss_pct: -0.0189, day_change_pct: 0.0012, portfolio_allocation_pct: 18.7 },
      { user_id: TEST_USER_ID, account_id: fourO1k?.id, security_id: secMap.get('VNQ'), ticker: 'VNQ', shares: 300, average_cost_basis: 82.50, total_cost_basis: 24750, current_price: 86.45, total_value: 25935, unrealised_gain_loss: 1185, unrealised_gain_loss_pct: 0.0479, day_change_pct: 0.0095, portfolio_allocation_pct: 8.3 },
      { user_id: TEST_USER_ID, account_id: fourO1k?.id, security_id: secMap.get('VXUS'), ticker: 'VXUS', shares: 600, average_cost_basis: 54.80, total_cost_basis: 32880, current_price: 58.40, total_value: 35040, unrealised_gain_loss: 2160, unrealised_gain_loss_pct: 0.0657, day_change_pct: 0.0045, portfolio_allocation_pct: 11.2 },
      { user_id: TEST_USER_ID, account_id: fourO1k?.id, security_id: secMap.get('MSFT'), ticker: 'MSFT', shares: 60, average_cost_basis: 285.40, total_cost_basis: 17124, current_price: 428.50, total_value: 25710, unrealised_gain_loss: 8586, unrealised_gain_loss_pct: 0.5015, day_change_pct: 0.0089, portfolio_allocation_pct: 8.2 },

      // Schwab - Dividend focus
      { user_id: TEST_USER_ID, account_id: schwabAccount?.id, security_id: secMap.get('JNJ'), ticker: 'JNJ', shares: 100, average_cost_basis: 162.40, total_cost_basis: 16240, current_price: 156.80, total_value: 15680, unrealised_gain_loss: -560, unrealised_gain_loss_pct: -0.0345, day_change_pct: -0.0078, portfolio_allocation_pct: 17.5 },
      { user_id: TEST_USER_ID, account_id: schwabAccount?.id, security_id: secMap.get('KO'), ticker: 'KO', shares: 200, average_cost_basis: 58.20, total_cost_basis: 11640, current_price: 62.45, total_value: 12490, unrealised_gain_loss: 850, unrealised_gain_loss_pct: 0.0730, day_change_pct: 0.0032, portfolio_allocation_pct: 14.0 },
      { user_id: TEST_USER_ID, account_id: schwabAccount?.id, security_id: secMap.get('PG'), ticker: 'PG', shares: 80, average_cost_basis: 148.60, total_cost_basis: 11888, current_price: 165.20, total_value: 13216, unrealised_gain_loss: 1328, unrealised_gain_loss_pct: 0.1117, day_change_pct: 0.0054, portfolio_allocation_pct: 14.8 },
      { user_id: TEST_USER_ID, account_id: schwabAccount?.id, security_id: secMap.get('O'), ticker: 'O', shares: 300, average_cost_basis: 52.40, total_cost_basis: 15720, current_price: 54.80, total_value: 16440, unrealised_gain_loss: 720, unrealised_gain_loss_pct: 0.0458, day_change_pct: 0.0085, portfolio_allocation_pct: 18.4 },
      { user_id: TEST_USER_ID, account_id: schwabAccount?.id, security_id: secMap.get('XOM'), ticker: 'XOM', shares: 150, average_cost_basis: 98.50, total_cost_basis: 14775, current_price: 118.50, total_value: 17775, unrealised_gain_loss: 3000, unrealised_gain_loss_pct: 0.2030, day_change_pct: 0.0145, portfolio_allocation_pct: 19.9 },
      { user_id: TEST_USER_ID, account_id: schwabAccount?.id, security_id: secMap.get('ABBV'), ticker: 'ABBV', shares: 80, average_cost_basis: 152.30, total_cost_basis: 12184, current_price: 168.90, total_value: 13512, unrealised_gain_loss: 1328, unrealised_gain_loss_pct: 0.1090, day_change_pct: 0.0067, portfolio_allocation_pct: 15.1 },

      // Crypto
      { user_id: TEST_USER_ID, account_id: cryptoAccount?.id, security_id: secMap.get('BTC-USD'), ticker: 'BTC-USD', shares: 0.72, average_cost_basis: 42500, total_cost_basis: 30600, current_price: 67500, total_value: 48600, unrealised_gain_loss: 18000, unrealised_gain_loss_pct: 0.5882, day_change_pct: 0.0285, portfolio_allocation_pct: 72.0 },
      { user_id: TEST_USER_ID, account_id: cryptoAccount?.id, security_id: secMap.get('ETH-USD'), ticker: 'ETH-USD', shares: 4.5, average_cost_basis: 2150, total_cost_basis: 9675, current_price: 3420, total_value: 15390, unrealised_gain_loss: 5715, unrealised_gain_loss_pct: 0.5907, day_change_pct: 0.0198, portfolio_allocation_pct: 22.8 },
      { user_id: TEST_USER_ID, account_id: cryptoAccount?.id, security_id: secMap.get('SOL-USD'), ticker: 'SOL-USD', shares: 25, average_cost_basis: 85.20, total_cost_basis: 2130, current_price: 148.50, total_value: 3712.5, unrealised_gain_loss: 1582.5, unrealised_gain_loss_pct: 0.7430, day_change_pct: 0.0412, portfolio_allocation_pct: 5.5 },
    ];

    const { error: holdingsError } = await supabase.from('holdings').insert(holdings);
    if (holdingsError) {
      console.error('❌ Error creating holdings:', holdingsError);
      return;
    }
    console.log(`✅ Created ${holdings.length} holdings\n`);

    // 7. Get transaction categories
    console.log('7️⃣  Fetching transaction categories...');
    const { data: categories } = await supabase.from('transaction_categories').select('id, name');
    const catMap = new Map(categories?.map(c => [c.name, c.id]) || []);

    // 8. Create transactions (income & expenses)
    console.log('8️⃣  Creating transactions...');
    const today = new Date();
    const transactions = [];

    // Monthly salary (last 6 months)
    for (let i = 0; i < 6; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      transactions.push({
        user_id: TEST_USER_ID,
        account_id: checkingAccount?.id,
        category_id: catMap.get('Salary'),
        amount: 18500,
        transaction_date: date.toISOString().split('T')[0],
        description: 'Payroll - Tech Corp Inc.',
        merchant_name: 'Tech Corp Inc.',
        category_name: 'Salary',
        is_pending: false,
      });
      // Mid-month paycheck
      date.setDate(15);
      transactions.push({
        user_id: TEST_USER_ID,
        account_id: checkingAccount?.id,
        category_id: catMap.get('Salary'),
        amount: 18500,
        transaction_date: date.toISOString().split('T')[0],
        description: 'Payroll - Tech Corp Inc.',
        merchant_name: 'Tech Corp Inc.',
        category_name: 'Salary',
        is_pending: false,
      });
    }

    // Dividend income
    const dividendStocks = ['AAPL', 'MSFT', 'JPM', 'JNJ', 'KO', 'O', 'XOM', 'SCHD'];
    for (const ticker of dividendStocks) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - Math.floor(Math.random() * 3));
      transactions.push({
        user_id: TEST_USER_ID,
        account_id: brokerageAccount?.id,
        category_id: catMap.get('Dividend Income'),
        amount: 50 + Math.floor(Math.random() * 450),
        transaction_date: date.toISOString().split('T')[0],
        description: `Dividend - ${ticker}`,
        merchant_name: ticker,
        category_name: 'Dividend Income',
        is_pending: false,
      });
    }

    // Freelance income
    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      transactions.push({
        user_id: TEST_USER_ID,
        account_id: checkingAccount?.id,
        category_id: catMap.get('Freelance Income'),
        amount: 2500 + Math.floor(Math.random() * 3000),
        transaction_date: date.toISOString().split('T')[0],
        description: 'Consulting Payment - Client Project',
        merchant_name: 'Consulting Client',
        category_name: 'Freelance Income',
        is_pending: false,
      });
    }

    // Expenses (last 2 months)
    const expensePatterns = [
      { merchant: 'Whole Foods Market', category: 'Groceries', minAmt: 80, maxAmt: 250, freq: 8 },
      { merchant: 'Amazon', category: 'Shopping', minAmt: 25, maxAmt: 400, freq: 6 },
      { merchant: 'Spotify', category: 'Entertainment', minAmt: 15, maxAmt: 15, freq: 2 },
      { merchant: 'Netflix', category: 'Entertainment', minAmt: 22, maxAmt: 22, freq: 2 },
      { merchant: 'Uber', category: 'Transportation', minAmt: 15, maxAmt: 65, freq: 8 },
      { merchant: 'Shell Gas Station', category: 'Gas & Fuel', minAmt: 45, maxAmt: 85, freq: 4 },
      { merchant: 'Chipotle', category: 'Dining', minAmt: 12, maxAmt: 25, freq: 6 },
      { merchant: 'Starbucks', category: 'Coffee', minAmt: 5, maxAmt: 12, freq: 12 },
      { merchant: 'Con Edison', category: 'Utilities', minAmt: 120, maxAmt: 180, freq: 2 },
      { merchant: 'Verizon Wireless', category: 'Phone', minAmt: 95, maxAmt: 95, freq: 2 },
      { merchant: 'Equinox', category: 'Gym & Fitness', minAmt: 220, maxAmt: 220, freq: 2 },
      { merchant: 'Delta Airlines', category: 'Travel', minAmt: 350, maxAmt: 850, freq: 1 },
      { merchant: 'Marriott Hotels', category: 'Travel', minAmt: 250, maxAmt: 600, freq: 1 },
      { merchant: 'Blue Cross Insurance', category: 'Insurance', minAmt: 450, maxAmt: 450, freq: 2 },
      { merchant: 'Mortgage Payment', category: 'Mortgage', minAmt: 3200, maxAmt: 3200, freq: 2 },
    ];

    for (const pattern of expensePatterns) {
      for (let i = 0; i < pattern.freq; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - Math.floor(Math.random() * 60));
        const amount = -(pattern.minAmt + Math.floor(Math.random() * (pattern.maxAmt - pattern.minAmt)));
        transactions.push({
          user_id: TEST_USER_ID,
          account_id: checkingAccount?.id,
          category_id: catMap.get(pattern.category),
          amount,
          transaction_date: date.toISOString().split('T')[0],
          description: pattern.merchant,
          merchant_name: pattern.merchant,
          category_name: pattern.category,
          is_pending: false,
        });
      }
    }

    const { error: txError } = await supabase.from('transactions').insert(transactions);
    if (txError) {
      console.error('❌ Error creating transactions:', txError);
    } else {
      console.log(`✅ Created ${transactions.length} transactions\n`);
    }

    // 9. Create insights (comprehensive)
    console.log('9️⃣  Creating insights...');
    const insights = [
      {
        user_id: TEST_USER_ID,
        insight_type: 'market',
        priority: 'high',
        title: 'NVDA Earnings Beat: Stock Up 12% After Hours',
        description: 'NVIDIA reported Q4 earnings of $5.16 EPS vs $4.60 expected. Data center revenue grew 409% YoY. Your position is up $15,700 since earnings.',
        recommended_action: 'Consider taking partial profits on your 150 share position given the significant unrealized gains.',
        source_type: 'external',
        related_entity_type: 'holding',
        estimated_impact_amount: 15700,
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'portfolio',
        priority: 'high',
        title: 'Technology Sector Concentration Alert',
        description: 'Your portfolio is 62% concentrated in technology stocks. Market volatility could significantly impact your holdings.',
        recommended_action: 'Consider rebalancing into defensive sectors like Healthcare, Consumer Staples, or increasing bond allocation.',
        source_type: 'rule_based',
        related_entity_type: 'holding',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'tax',
        priority: 'high',
        title: 'Tax-Loss Harvesting Opportunity: JNJ',
        description: 'Your JNJ position shows a $560 unrealized loss. Harvesting this loss could offset gains and reduce your tax liability.',
        recommended_action: 'Consider selling JNJ and purchasing a similar healthcare ETF like XLV to maintain exposure while capturing the tax benefit.',
        estimated_impact_amount: 560,
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'portfolio',
        priority: 'medium',
        title: 'Dividend Income Growing Steadily',
        description: 'Your dividend income has increased 18% over the past year. Current yield across dividend positions is 2.8%.',
        recommended_action: 'Consider reinvesting dividends or adding to high-yield positions like O and SCHD.',
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'market',
        priority: 'medium',
        title: 'Fed Rate Decision: Impact on Your Bond Holdings',
        description: 'The Federal Reserve maintained rates at 5.25-5.50%. Your BND position may see continued pressure if rates stay higher for longer.',
        recommended_action: 'Consider shortening duration or adding inflation-protected securities (TIPS).',
        source_type: 'external',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'spending',
        priority: 'medium',
        title: 'Dining Expenses Up 24% This Month',
        description: 'You\'ve spent $892 on dining this month compared to your $720 monthly average. This includes 12 transactions.',
        recommended_action: 'Review dining transactions and consider setting a monthly budget alert.',
        estimated_impact_amount: 172,
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'tax',
        priority: 'medium',
        title: 'Q4 Estimated Tax Payment Due',
        description: 'Based on your income and capital gains, your estimated Q4 tax payment is approximately $16,525.',
        recommended_action: 'Ensure payment is submitted by January 15th to avoid penalties.',
        estimated_impact_amount: 16525,
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'portfolio',
        priority: 'medium',
        title: 'Crypto Allocation Above Target',
        description: 'Cryptocurrency represents 6.2% of your portfolio, above your 5% target allocation. BTC and ETH have rallied significantly.',
        recommended_action: 'Consider rebalancing by taking profits on crypto positions.',
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'credit',
        priority: 'low',
        title: 'Credit Utilization Optimal',
        description: 'Your credit utilization is at 9.7% across all cards. This is excellent for your credit score.',
        recommended_action: 'Maintain current spending patterns to preserve your strong credit profile.',
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'portfolio',
        priority: 'low',
        title: '401(k) Contribution Reminder',
        description: 'You\'ve contributed $18,500 to your 401(k) this year. The 2024 limit is $23,000. Consider maximizing contributions.',
        recommended_action: 'Increase your contribution rate to reach the annual maximum before year-end.',
        estimated_impact_amount: 4500,
        source_type: 'rule_based',
      },
    ];

    const { error: insightsError } = await supabase.from('insights').insert(insights);
    if (insightsError) {
      console.error('❌ Error creating insights:', insightsError);
    } else {
      console.log(`✅ Created ${insights.length} insights\n`);
    }

    // 10. Create net worth history (12 months)
    console.log('🔟 Creating net worth history...');
    const netWorthSnapshots = [];
    let baseNetWorth = 920000;
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const monthlyGrowth = 1 + (Math.random() * 0.04 - 0.01); // -1% to +3%
      baseNetWorth *= monthlyGrowth;

      netWorthSnapshots.push({
        user_id: TEST_USER_ID,
        snapshot_date: date.toISOString().split('T')[0],
        total_assets: baseNetWorth * 1.006,
        total_liabilities: baseNetWorth * 0.006,
        net_worth: baseNetWorth,
        cash_balance: 102420.50,
        investment_balance: baseNetWorth * 0.88,
        crypto_balance: baseNetWorth * 0.06,
        credit_card_debt: 6143.25,
      });
    }

    const { error: netWorthError } = await supabase.from('net_worth_snapshots').insert(netWorthSnapshots);
    if (netWorthError) {
      console.error('❌ Error creating net worth history:', netWorthError);
    } else {
      console.log(`✅ Created ${netWorthSnapshots.length} net worth snapshots\n`);
    }

    // 11. Create financial health score
    console.log('1️⃣1️⃣ Creating financial health score...');
    const { error: healthError } = await supabase.from('financial_health_scores').insert({
      user_id: TEST_USER_ID,
      overall_score: 82,
      debt_to_asset_ratio: 0.0056,
      savings_rate: 0.32,
      emergency_fund_months: 8.5,
      portfolio_diversification: 0.68,
      debt_score: 96,
      savings_score: 88,
      emergency_fund_score: 92,
      diversification_score: 68,
    });

    if (healthError) {
      console.error('❌ Error creating health score:', healthError);
    } else {
      console.log('✅ Created financial health score\n');
    }

    // 12. Create cash flow snapshots
    console.log('1️⃣2️⃣ Creating cash flow history...');
    const cashFlowSnapshots = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      date.setDate(1);

      const income = 37000 + Math.floor(Math.random() * 5000);
      const expenses = 22000 + Math.floor(Math.random() * 4000);

      cashFlowSnapshots.push({
        user_id: TEST_USER_ID,
        snapshot_month: date.toISOString().split('T')[0],
        total_income: income,
        total_expenses: expenses,
        net_flow: income - expenses,
        savings_amount: income - expenses,
        savings_rate: (income - expenses) / income,
      });
    }

    const { error: cashFlowError } = await supabase.from('cash_flow_snapshots').insert(cashFlowSnapshots);
    if (cashFlowError) {
      console.error('❌ Error creating cash flow history:', cashFlowError);
    } else {
      console.log(`✅ Created ${cashFlowSnapshots.length} cash flow snapshots\n`);
    }

    // 13. Create tax estimates
    console.log('1️⃣3️⃣ Creating tax estimates...');
    const { error: taxError } = await supabase.from('tax_estimates').insert({
      user_id: TEST_USER_ID,
      tax_year: 2024,
      estimated_income_tax: 89500,
      short_term_capital_gains: 12400,
      long_term_capital_gains: 28500,
      deductions_identified: 24800,
      total_estimated_tax: 105600,
      estimated_quarterly_payment: 26400,
    });

    if (taxError) {
      console.error('❌ Error creating tax estimate:', taxError);
    } else {
      console.log('✅ Created tax estimates\n');
    }

    // 14. Create capital gains records
    console.log('1️⃣4️⃣ Creating capital gains records...');
    const capitalGains = [
      { user_id: TEST_USER_ID, security_id: secMap.get('AAPL'), ticker: 'AAPL', transaction_type: 'sell', transaction_date: '2024-03-15', shares: 50, price_per_share: 172.50, cost_basis: 7200, proceeds: 8625, gain_loss: 1425, gain_loss_type: 'long_term', tax_year: 2024 },
      { user_id: TEST_USER_ID, security_id: secMap.get('TSLA'), ticker: 'TSLA', transaction_type: 'sell', transaction_date: '2024-06-20', shares: 30, price_per_share: 265.40, cost_basis: 5850, proceeds: 7962, gain_loss: 2112, gain_loss_type: 'short_term', tax_year: 2024 },
      { user_id: TEST_USER_ID, security_id: secMap.get('NVDA'), ticker: 'NVDA', transaction_type: 'sell', transaction_date: '2024-08-10', shares: 25, price_per_share: 820.00, cost_basis: 12137.50, proceeds: 20500, gain_loss: 8362.50, gain_loss_type: 'long_term', tax_year: 2024 },
      { user_id: TEST_USER_ID, security_id: secMap.get('META'), ticker: 'META', transaction_type: 'sell', transaction_date: '2024-09-05', shares: 20, price_per_share: 495.80, cost_basis: 5972, proceeds: 9916, gain_loss: 3944, gain_loss_type: 'long_term', tax_year: 2024 },
      { user_id: TEST_USER_ID, security_id: secMap.get('AMD'), ticker: 'AMD', transaction_type: 'sell', transaction_date: '2024-10-15', shares: 40, price_per_share: 155.20, cost_basis: 5200, proceeds: 6208, gain_loss: 1008, gain_loss_type: 'short_term', tax_year: 2024 },
    ];

    const { error: gainsError } = await supabase.from('capital_gains').insert(capitalGains);
    if (gainsError) {
      console.error('❌ Error creating capital gains:', gainsError);
    } else {
      console.log(`✅ Created ${capitalGains.length} capital gains records\n`);
    }

    // 15. Create portfolio performance metrics
    console.log('1️⃣5️⃣ Creating portfolio performance...');
    const { error: perfError } = await supabase.from('portfolio_performance').insert({
      user_id: TEST_USER_ID,
      return_1d_pct: 0.0124,
      return_1w_pct: 0.0287,
      return_1m_pct: 0.0518,
      return_3m_pct: 0.1284,
      return_6m_pct: 0.1856,
      return_ytd_pct: 0.2142,
      return_1y_pct: 0.2876,
      sharpe_ratio: 1.42,
      beta: 1.15,
      volatility: 0.1823,
      diversification_score: 0.68,
      sector_concentration: JSON.stringify({
        'Technology': 42.5,
        'Financial Services': 11.8,
        'Healthcare': 8.6,
        'Consumer Cyclical': 7.2,
        'Energy': 5.1,
        'Other': 24.8,
      }),
      asset_class_allocation: JSON.stringify({
        'Equity': 72.4,
        'ETF': 18.2,
        'Crypto': 6.2,
        'Fixed Income': 3.2,
      }),
    });

    if (perfError) {
      console.error('❌ Error creating portfolio performance:', perfError);
    } else {
      console.log('✅ Created portfolio performance metrics\n');
    }

    // 16. Create portfolio snapshots (historical)
    console.log('1️⃣6️⃣ Creating portfolio snapshots...');
    const portfolioSnapshots = [];
    let basePortfolioValue = 820000;
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const monthlyReturn = 1 + (Math.random() * 0.06 - 0.02); // -2% to +4%
      basePortfolioValue *= monthlyReturn;

      portfolioSnapshots.push({
        user_id: TEST_USER_ID,
        snapshot_date: date.toISOString().split('T')[0],
        total_value: basePortfolioValue,
        total_cost_basis: 680000,
        total_gain_loss: basePortfolioValue - 680000,
        total_gain_loss_pct: (basePortfolioValue - 680000) / 680000,
      });
    }

    const { error: snapshotsError } = await supabase.from('portfolio_snapshots').insert(portfolioSnapshots);
    if (snapshotsError) {
      console.error('❌ Error creating portfolio snapshots:', snapshotsError);
    } else {
      console.log(`✅ Created ${portfolioSnapshots.length} portfolio snapshots\n`);
    }

    // 17. Create market news
    console.log('1️⃣7️⃣ Creating market news...');
    const marketNews = [
      {
        title: 'NVIDIA Reports Record-Breaking Q4 Revenue of $22.1 Billion',
        summary: 'Data center demand drives unprecedented growth as AI adoption accelerates across industries.',
        source: 'Reuters',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        tickers: ['NVDA', 'AMD', 'INTC'],
        sectors: ['Technology'],
        sentiment: 'positive',
        url: 'https://example.com/nvda-earnings',
      },
      {
        title: 'Federal Reserve Signals Potential Rate Cuts in 2024',
        summary: 'Fed Chair Powell indicates inflation progress may allow for monetary policy easing later this year.',
        source: 'Bloomberg',
        published_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        tickers: ['SPY', 'QQQ', 'BND'],
        sectors: ['Financial', 'Diversified'],
        sentiment: 'positive',
        url: 'https://example.com/fed-rates',
      },
      {
        title: 'Apple Vision Pro Launches with Strong Initial Demand',
        summary: 'Apple\'s new spatial computing device sees robust pre-order numbers, signaling potential new revenue stream.',
        source: 'CNBC',
        published_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        tickers: ['AAPL', 'META'],
        sectors: ['Technology'],
        sentiment: 'positive',
        url: 'https://example.com/apple-vision-pro',
      },
      {
        title: 'Bitcoin ETF Sees Record Inflows as Institutional Adoption Grows',
        summary: 'Spot Bitcoin ETFs attract $1.2 billion in weekly inflows, marking strongest week since launch.',
        source: 'CoinDesk',
        published_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        tickers: ['BTC-USD', 'ETH-USD'],
        sectors: ['Cryptocurrency'],
        sentiment: 'positive',
        url: 'https://example.com/btc-etf',
      },
      {
        title: 'Healthcare Sector Faces Headwinds Amid Drug Pricing Concerns',
        summary: 'New legislation proposals could impact pharmaceutical company margins in coming years.',
        source: 'MarketWatch',
        published_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        tickers: ['JNJ', 'PFE', 'ABBV', 'UNH'],
        sectors: ['Healthcare'],
        sentiment: 'negative',
        url: 'https://example.com/healthcare-headwinds',
      },
      {
        title: 'Tesla Announces New Gigafactory Location in Mexico',
        summary: 'Expansion will increase production capacity by 500,000 vehicles annually, targeting Latin American market.',
        source: 'Reuters',
        published_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        tickers: ['TSLA'],
        sectors: ['Technology', 'Consumer'],
        sentiment: 'positive',
        url: 'https://example.com/tesla-mexico',
      },
      {
        title: 'Oil Prices Surge on Middle East Supply Concerns',
        summary: 'Geopolitical tensions push crude oil above $85 per barrel, benefiting energy sector.',
        source: 'Bloomberg',
        published_at: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
        tickers: ['XOM', 'CVX'],
        sectors: ['Energy'],
        sentiment: 'positive',
        url: 'https://example.com/oil-surge',
      },
      {
        title: 'Microsoft Cloud Revenue Exceeds Expectations',
        summary: 'Azure growth of 29% year-over-year demonstrates continued enterprise AI adoption momentum.',
        source: 'CNBC',
        published_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        tickers: ['MSFT', 'GOOGL', 'AMZN'],
        sectors: ['Technology'],
        sentiment: 'positive',
        url: 'https://example.com/msft-cloud',
      },
    ];

    // Clear existing market news and events first
    await supabase.from('market_news').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('market_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: newsError } = await supabase.from('market_news').insert(marketNews);
    if (newsError) {
      console.error('❌ Error creating market news:', newsError);
    } else {
      console.log(`✅ Created ${marketNews.length} market news articles\n`);
    }

    // 18. Create market events
    console.log('1️⃣8️⃣ Creating market events...');
    const marketEvents = [
      {
        event_type: 'earnings',
        ticker: 'AAPL',
        event_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Apple Q1 2024 Earnings Report',
        description: 'Apple Inc. will report fiscal Q1 2024 earnings after market close.',
        metadata: JSON.stringify({ eps_estimate: 2.10, revenue_estimate: 118000000000 }),
        impact_level: 'high',
      },
      {
        event_type: 'earnings',
        ticker: 'MSFT',
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Microsoft Q2 2024 Earnings Report',
        description: 'Microsoft Corporation will report fiscal Q2 2024 earnings.',
        metadata: JSON.stringify({ eps_estimate: 2.78, revenue_estimate: 61000000000 }),
        impact_level: 'high',
      },
      {
        event_type: 'dividend',
        ticker: 'JNJ',
        event_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Johnson & Johnson Dividend Payment',
        description: 'Quarterly dividend of $1.24 per share.',
        metadata: JSON.stringify({ dividend_amount: 1.24, yield: 3.16 }),
        impact_level: 'medium',
      },
      {
        event_type: 'dividend',
        ticker: 'O',
        event_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Realty Income Monthly Dividend',
        description: 'Monthly dividend of $0.2565 per share.',
        metadata: JSON.stringify({ dividend_amount: 0.2565, yield: 5.62 }),
        impact_level: 'low',
      },
      {
        event_type: 'fed_announcement',
        ticker: null,
        event_date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'FOMC Meeting & Interest Rate Decision',
        description: 'Federal Reserve will announce interest rate decision and provide economic outlook.',
        metadata: JSON.stringify({ current_rate: 5.50, expected_action: 'hold' }),
        impact_level: 'high',
      },
      {
        event_type: 'macro',
        ticker: null,
        event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'U.S. Jobs Report Release',
        description: 'Bureau of Labor Statistics will release monthly employment data.',
        metadata: JSON.stringify({ expected_jobs: 180000, previous_jobs: 216000 }),
        impact_level: 'high',
      },
    ];

    const { error: eventsError } = await supabase.from('market_events').insert(marketEvents);
    if (eventsError) {
      console.error('❌ Error creating market events:', eventsError);
    } else {
      console.log(`✅ Created ${marketEvents.length} market events\n`);
    }

    console.log('🎉 Comprehensive test user data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('   - 10 linked accounts (banking, credit, brokerage, crypto)');
    console.log('   - 42 securities (stocks, ETFs, crypto)');
    console.log('   - 30+ holdings across all accounts');
    console.log(`   - ${transactions.length} transactions (income & expenses)`);
    console.log('   - 10 AI insights');
    console.log('   - 12 months net worth history');
    console.log('   - 6 months cash flow history');
    console.log('   - Tax estimates and capital gains');
    console.log('   - Portfolio performance and snapshots');
    console.log(`   - ${marketNews.length} market news articles`);
    console.log(`   - ${marketEvents.length} market events`);
    console.log('\n✅ Ready to test!');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

seedTestUser();
