/**
 * Seed Test User Data
 * Populates the database with mock data for testing
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

async function seedTestUser() {
  console.log('🌱 Seeding test user data...');
  console.log(`👤 User ID: ${TEST_USER_ID}\n`);

  try {
    // 1. Create user profile
    console.log('1️⃣  Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: TEST_USER_ID,
        email: 'test@helm.app',
        full_name: 'Test User',
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

    // 4. Create linked accounts
    console.log('4️⃣  Creating linked accounts...');
    const accounts = [
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('chase'),
        account_name: 'Chase Checking',
        account_type: 'checking',
        current_balance: 12340,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('chase'),
        account_name: 'Chase Savings',
        account_type: 'savings',
        current_balance: 45000,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('amex'),
        account_name: 'Amex Gold Card',
        account_type: 'credit_card',
        current_balance: -3210,
        credit_limit: 25000,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('fidelity'),
        account_name: 'Fidelity Brokerage',
        account_type: 'brokerage',
        current_balance: 318200,
        sync_status: 'healthy',
      },
      {
        user_id: TEST_USER_ID,
        institution_id: instMap.get('coinbase'),
        account_name: 'Coinbase',
        account_type: 'crypto',
        current_balance: 24500,
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

    // Get brokerage account ID for holdings
    const brokerageAccount = createdAccounts?.find(a => a.account_type === 'brokerage');

    // 5. Create securities
    console.log('5️⃣  Creating securities...');
    const securities = [
      { ticker: 'AAPL', security_name: 'Apple Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 182.31 },
      { ticker: 'NVDA', security_name: 'NVIDIA Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 875.28 },
      { ticker: 'SPY', security_name: 'SPDR S&P 500 ETF', asset_class: 'etf', sector: 'Diversified', exchange: 'NYSE', current_price: 503.42 },
      { ticker: 'MSFT', security_name: 'Microsoft Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 416.42 },
      { ticker: 'GOOGL', security_name: 'Alphabet Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 141.80 },
      { ticker: 'AMZN', security_name: 'Amazon.com Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 178.25 },
      { ticker: 'BTC-USD', security_name: 'Bitcoin', asset_class: 'crypto', sector: 'Cryptocurrency', exchange: 'Coinbase', current_price: 67500 },
      { ticker: 'ETH-USD', security_name: 'Ethereum', asset_class: 'crypto', sector: 'Cryptocurrency', exchange: 'Coinbase', current_price: 3850 },
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

    // Create a map of ticker to security_id
    const secMap = new Map(createdSecurities?.map(s => [s.ticker, s.id]) || []);

    // 6. Create holdings
    if (brokerageAccount) {
      console.log('6️⃣  Creating holdings...');
      const holdings = [
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('AAPL'),
          ticker: 'AAPL',
          shares: 150,
          average_cost_basis: 158.4,
          total_cost_basis: 23760,
          current_price: 182.31,
          total_value: 27346.5,
          unrealised_gain_loss: 3586.5,
          unrealised_gain_loss_pct: 0.1509,
          day_change_pct: 0.0124,
          portfolio_allocation_pct: 8.6,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('NVDA'),
          ticker: 'NVDA',
          shares: 100,
          average_cost_basis: 642.1,
          total_cost_basis: 64210,
          current_price: 875.28,
          total_value: 87528,
          unrealised_gain_loss: 23318,
          unrealised_gain_loss_pct: 0.3631,
          day_change_pct: 0.0281,
          portfolio_allocation_pct: 27.5,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('SPY'),
          ticker: 'SPY',
          shares: 200,
          average_cost_basis: 468.5,
          total_cost_basis: 93700,
          current_price: 503.42,
          total_value: 100684,
          unrealised_gain_loss: 6984,
          unrealised_gain_loss_pct: 0.0745,
          day_change_pct: 0.0052,
          portfolio_allocation_pct: 31.7,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('MSFT'),
          ticker: 'MSFT',
          shares: 75,
          average_cost_basis: 398.2,
          total_cost_basis: 29865,
          current_price: 416.42,
          total_value: 31231.5,
          unrealised_gain_loss: 1366.5,
          unrealised_gain_loss_pct: 0.0457,
          day_change_pct: -0.0034,
          portfolio_allocation_pct: 9.8,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('GOOGL'),
          ticker: 'GOOGL',
          shares: 120,
          average_cost_basis: 128.7,
          total_cost_basis: 15444,
          current_price: 141.80,
          total_value: 17016,
          unrealised_gain_loss: 1572,
          unrealised_gain_loss_pct: 0.1018,
          day_change_pct: 0.0112,
          portfolio_allocation_pct: 5.4,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('AMZN'),
          ticker: 'AMZN',
          shares: 90,
          average_cost_basis: 142.3,
          total_cost_basis: 12807,
          current_price: 178.25,
          total_value: 16042.5,
          unrealised_gain_loss: 3235.5,
          unrealised_gain_loss_pct: 0.2526,
          day_change_pct: 0.0089,
          portfolio_allocation_pct: 5.0,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('BTC-USD'),
          ticker: 'BTC-USD',
          shares: 0.35,
          average_cost_basis: 52000,
          total_cost_basis: 18200,
          current_price: 67500,
          total_value: 23625,
          unrealised_gain_loss: 5425,
          unrealised_gain_loss_pct: 0.2981,
          day_change_pct: 0.0215,
          portfolio_allocation_pct: 7.4,
        },
        {
          user_id: TEST_USER_ID,
          account_id: brokerageAccount.id,
          security_id: secMap.get('ETH-USD'),
          ticker: 'ETH-USD',
          shares: 5,
          average_cost_basis: 2800,
          total_cost_basis: 14000,
          current_price: 3850,
          total_value: 19250,
          unrealised_gain_loss: 5250,
          unrealised_gain_loss_pct: 0.375,
          day_change_pct: 0.0189,
          portfolio_allocation_pct: 6.0,
        },
      ];

      const { error: holdingsError } = await supabase
        .from('holdings')
        .insert(holdings);

      if (holdingsError) {
        console.error('❌ Error creating holdings:', holdingsError);
        return;
      }
      console.log(`✅ Created ${holdings.length} holdings\n`);
    }

    // 7. Create insights
    console.log('7️⃣  Creating insights...');
    const insights = [
      {
        user_id: TEST_USER_ID,
        insight_type: 'market',
        priority: 'high',
        title: 'SEC Filing Alert: NVDA Competitor Reports 340% Revenue Growth',
        description: 'AMD filed 10-Q showing massive Q4 datacenter revenue growth, potentially impacting NVIDIA\'s market position.',
        recommended_action: 'Review NVIDIA\'s competitive position in your portfolio (27.5% allocation)',
        source_type: 'external',
        related_entity_type: 'holding',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'portfolio',
        priority: 'high',
        title: 'High Technology Sector Concentration',
        description: 'You are currently 58% exposed to technology stocks. Consider diversifying.',
        recommended_action: 'Consider diversifying into other sectors like healthcare, consumer staples, or bonds',
        source_type: 'rule_based',
        related_entity_type: 'holding',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'tax',
        priority: 'medium',
        title: 'Tax-Loss Harvesting Opportunity Detected',
        description: 'You could reduce your tax liability by $2,400 through strategic tax-loss harvesting',
        recommended_action: 'Consider selling positions with losses before year-end',
        estimated_impact_amount: 2400,
        source_type: 'rule_based',
      },
      {
        user_id: TEST_USER_ID,
        insight_type: 'portfolio',
        priority: 'medium',
        title: 'Cryptocurrency Holdings at All-Time High',
        description: 'Your crypto allocation (13.4%) has increased significantly. Consider rebalancing.',
        recommended_action: 'Review your target allocation and consider taking profits',
        source_type: 'rule_based',
      },
    ];

    const { error: insightsError } = await supabase
      .from('insights')
      .insert(insights);

    if (insightsError) {
      console.error('❌ Error creating insights:', insightsError);
      return;
    }
    console.log(`✅ Created ${insights.length} insights\n`);

    // 8. Create net worth snapshot
    console.log('8️⃣  Creating financial snapshots...');
    const today = new Date().toISOString().split('T')[0];

    const { error: netWorthError } = await supabase
      .from('net_worth_snapshots')
      .insert({
        user_id: TEST_USER_ID,
        snapshot_date: today,
        total_assets: 397040,
        total_liabilities: 3210,
        net_worth: 393830,
        cash_balance: 57340,
        investment_balance: 318200,
        crypto_balance: 24500,
        credit_card_debt: 3210,
      });

    if (netWorthError) {
      console.error('❌ Error creating net worth:', netWorthError);
      return;
    }

    const { error: healthError } = await supabase
      .from('financial_health_scores')
      .insert({
        user_id: TEST_USER_ID,
        overall_score: 78,
        debt_to_asset_ratio: 0.008,
        savings_rate: 0.28,
        emergency_fund_months: 6.7,
        portfolio_diversification: 0.72,
        debt_score: 95,
        savings_score: 85,
        emergency_fund_score: 90,
        diversification_score: 72,
      });

    if (healthError) {
      console.error('❌ Error creating health score:', healthError);
      return;
    }
    console.log('✅ Created financial snapshots\n');

    // 9. Create tax estimate
    console.log('9️⃣  Creating tax estimate...');
    const { error: taxError } = await supabase
      .from('tax_estimates')
      .insert({
        user_id: TEST_USER_ID,
        tax_year: 2024,
        estimated_income_tax: 42800,
        short_term_capital_gains: 8400,
        long_term_capital_gains: 15200,
        deductions_identified: 12300,
        total_estimated_tax: 66100,
        estimated_quarterly_payment: 16525,
      });

    if (taxError) {
      console.error('❌ Error creating tax estimate:', taxError);
      return;
    }
    console.log('✅ Created tax estimate\n');

    console.log('🎉 Test user data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('   - 5 linked accounts');
    console.log('   - 8 securities');
    console.log('   - 8 holdings');
    console.log('   - 4 insights');
    console.log('   - Financial health score');
    console.log('   - Tax estimates');
    console.log('\n✅ Ready to test API routes!');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

seedTestUser();
